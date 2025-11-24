/**
 * Agent Service
 * 整合 Claude Agent SDK 並執行查詢
 */

import { query } from '@anthropic-ai/claude-agent-sdk'
import type { SettingsService, AgentOptions } from './settings.service'
import type { QueryRequest } from '@workspace/shared'
import { logger } from '../utils/logger'

export class AgentService {
    private settingsService: SettingsService

    constructor(settingsService: SettingsService) {
        this.settingsService = settingsService
        logger.debug({ event: 'agent_service_init' }, 'AgentService initialized')
    }

    /**
     * 執行 Agent 查詢
     * @param request 查詢請求
     * @param abortController 可選的 AbortController 用於取消查詢
     * @returns Async Generator 串流結果
     */
    async *executeQuery(request: QueryRequest & { abortController?: AbortController }) {
        const { workspacePath, prompt, options = {}, abortController } = request

        logger.info(
            {
                event: 'agent_query_init',
                workspacePath,
                hasOptions: Object.keys(options).length > 0
            },
            'Initializing agent query'
        )

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
                    workspacePath
                },
                'Starting agent query execution'
            )

            // SDK 自動處理 resume 和 continue 選項
            // 如果提供了 AbortController，將其加入 options
            const queryOptions = abortController
                ? { ...mergedOptions, abortController }
                : mergedOptions

            const queryResult = query({
                prompt,
                options: queryOptions as any
            })

            // 4. 串流結果
            let messageCount = 0
            for await (const message of queryResult) {
                messageCount++

                // 診斷日誌：追蹤每個訊息
                logger.debug(
                    {
                        event: 'agent_message_received',
                        workspacePath,
                        message_type: message.type,
                        message_count: messageCount
                    },
                    `Message ${messageCount} received`
                )

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
                            cost_usd: (message as any).total_cost_usd,
                            total_messages: messageCount
                        },
                        'Agent query completed'
                    )
                }

                yield message
            }

            // 診斷日誌：確認 generator 正常結束
            logger.info(
                {
                    event: 'agent_generator_completed',
                    workspacePath,
                    total_messages: messageCount
                },
                'Generator loop completed normally'
            )

            // 明確結束 generator（修復 ERR_INCOMPLETE_CHUNKED_ENCODING）
            return
        } catch (error: any) {
            // 處理 AbortError（用戶取消操作）
            if (error.name === 'AbortError' || error.message?.includes('abort')) {
                logger.info(
                    {
                        event: 'agent_query_cancelled',
                        workspacePath
                    },
                    'Agent query cancelled by user'
                )
                throw new Error('Query cancelled by user')
            }

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
}
