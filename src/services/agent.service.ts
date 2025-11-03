/**
 * Agent Service
 * 整合 Claude Agent SDK 並執行查詢
 */

import { query } from '@anthropic-ai/claude-agent-sdk'
import type { SettingsService, AgentOptions } from './settings.service'
import type { DatabaseService } from './database.service'
import type { QueryRequest } from '../types/query.types'
import { logger } from '../utils/logger'

export class AgentService {
    private settingsService: SettingsService
    private databaseService?: DatabaseService

    constructor(settingsService: SettingsService, databaseService?: DatabaseService) {
        this.settingsService = settingsService
        this.databaseService = databaseService
        logger.debug({ event: 'agent_service_init' }, 'AgentService initialized')
    }

    /**
     * 執行 Agent 查詢
     * @param request 查詢請求
     * @returns Async Generator 串流結果
     */
    async *executeQuery(request: QueryRequest) {
        const { workspacePath, prompt, options = {} } = request

        logger.info(
            {
                event: 'agent_query_init',
                workspacePath,
                hasOptions: Object.keys(options).length > 0,
                resume: options.resume,
                continue: options.continue
            },
            'Initializing agent query'
        )

        // 0. 處理 Resume 功能
        let resumeMessages: any[] | undefined
        if (options.resume || options.continue) {
            resumeMessages = await this.loadSessionMessages(
                workspacePath,
                options.resume,
                options.continue
            )
        }

        // 1. 載入工作空間設定
        const workspaceSettings = this.settingsService.loadSettings(workspacePath)

        if (workspaceSettings) {
            logger.debug(
                {
                    event: 'agent_settings_loaded',
                    workspacePath,
                    hasAgents: !!workspaceSettings.agents,
                    hasMcpServers: !!workspaceSettings.mcpServers,
                    hasHooks: !!workspaceSettings.hooks
                },
                'Workspace settings loaded'
            )
        } else {
            logger.debug(
                { event: 'agent_settings_default', workspacePath },
                'Using default settings (no workspace settings found)'
            )
        }

        // 2. 合併設定（使用者提供的 options 優先）
        const mergedOptions: Partial<AgentOptions> = workspaceSettings
            ? {
                ...workspaceSettings,
                ...options,
                // 特殊處理：agents、mcpServers、hooks 需要深度合併
                agents: {
                    ...workspaceSettings.agents,
                    ...options.agents
                },
                mcpServers: {
                    ...workspaceSettings.mcpServers,
                    ...options.mcpServers
                },
                hooks: {
                    ...workspaceSettings.hooks,
                    ...options.hooks
                }
            }
            : {
                cwd: workspacePath,
                systemPrompt: { type: 'preset', preset: 'claude_code' },
                ...options
            }

        logger.debug(
            {
                event: 'agent_settings_merged',
                workspacePath,
                model: mergedOptions.model,
                permissionMode: mergedOptions.permissionMode
            },
            'Settings merged successfully'
        )

        // 3. 執行查詢
        try {
            logger.info(
                {
                    event: 'agent_query_start',
                    workspacePath,
                    has_resume_messages: !!resumeMessages
                },
                'Starting agent query execution'
            )

            // NOTE: 根據 Claude Agent SDK 的實際 API 調整
            // 如果有 resumeMessages，將其傳遞給 query 函數
            const queryResult = query({
                prompt,
                options: mergedOptions as any,
                // TODO: 確認 Agent SDK 的實際 API
                // 可能需要調整為 messages, initialMessages, 或其他參數名稱
                ...(resumeMessages ? { messages: resumeMessages } : {})
            })

            // 4. 串流結果
            for await (const message of queryResult) {
                // 只在重要訊息類型記錄（避免過多日誌）
                if (message.type === 'system' && message.subtype === 'init') {
                    logger.debug(
                        { event: 'agent_session_init', session_id: (message as any).session_id },
                        'Agent session initialized'
                    )
                } else if (message.type === 'result') {
                    logger.info(
                        {
                            event: 'agent_query_result',
                            workspacePath,
                            is_error: (message as any).is_error,
                            num_turns: (message as any).num_turns,
                            cost_usd: (message as any).total_cost_usd
                        },
                        'Agent query completed'
                    )
                }

                yield message
            }
        } catch (error: any) {
            logger.error(
                {
                    event: 'agent_query_error',
                    workspacePath,
                    error: error.message,
                    stack: error.stack
                },
                'Agent query failed'
            )

            // 錯誤處理
            throw new Error(`Agent query failed: ${error.message}`)
        }
    }

    /**
     * 載入 Session 訊息以恢復對話
     * @param workspacePath 工作空間路徑
     * @param resumeSessionId 要恢復的 session ID
     * @param continueFlag 是否繼續最近的 session
     * @returns Session 訊息陣列
     */
    private async loadSessionMessages(
        workspacePath: string,
        resumeSessionId?: string,
        continueFlag?: boolean
    ): Promise<any[] | undefined> {
        if (!this.databaseService) {
            logger.warn(
                { event: 'resume_no_db', workspacePath },
                'Cannot resume: DatabaseService not available'
            )
            return undefined
        }

        const sessionService = this.databaseService.sessionService

        try {
            let sessionId: string | undefined

            // 1. 確定要恢復的 session ID
            if (resumeSessionId) {
                sessionId = resumeSessionId
                logger.debug(
                    { event: 'resume_session_specified', session_id: sessionId },
                    'Resuming specified session'
                )
            } else if (continueFlag) {
                // 取得最近的 completed session
                const recentSessions = sessionService.listSessions({
                    workspace_path: workspacePath,
                    status: 'completed',
                    limit: 1,
                    order_by: 'created_at',
                    order: 'desc'
                })

                if (recentSessions.sessions.length > 0) {
                    sessionId = recentSessions.sessions[0].session_id
                    logger.debug(
                        { event: 'resume_session_auto', session_id: sessionId },
                        'Resuming most recent session'
                    )
                }
            }

            if (!sessionId) {
                logger.warn(
                    { event: 'resume_no_session', workspacePath },
                    'No session to resume'
                )
                return undefined
            }

            // 2. 載入 session 訊息
            const { messages } = sessionService.getSessionMessages(sessionId, {
                limit: 10000 // 載入所有訊息
            })

            if (messages.length === 0) {
                logger.warn(
                    { event: 'resume_empty_session', session_id: sessionId },
                    'Session has no messages'
                )
                return undefined
            }

            // 3. 轉換為 Agent SDK 格式
            const resumeMessages = messages
                .map((msg) => {
                    try {
                        return JSON.parse(msg.message_content)
                    } catch (e) {
                        logger.error(
                            {
                                event: 'resume_parse_error',
                                message_id: msg.id,
                                error: (e as Error).message
                            },
                            'Failed to parse message'
                        )
                        return null
                    }
                })
                .filter((msg) => msg !== null)

            logger.info(
                {
                    event: 'resume_messages_loaded',
                    session_id: sessionId,
                    message_count: resumeMessages.length
                },
                'Loaded session messages for resume'
            )

            return resumeMessages
        } catch (error: any) {
            logger.error(
                {
                    event: 'resume_load_error',
                    workspacePath,
                    error: error.message
                },
                'Failed to load session messages'
            )
            return undefined
        }
    }
}
