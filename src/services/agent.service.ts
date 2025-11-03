/**
 * Agent Service
 * 整合 Claude Agent SDK 並執行查詢
 */

import { query } from '@anthropic-ai/claude-agent-sdk'
import type { SettingsService, AgentOptions } from './settings.service'
import type { QueryRequest } from '../types/query.types'
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
     * @returns Async Generator 串流結果
     */
    async *executeQuery(request: QueryRequest) {
        const { workspacePath, prompt, options = {} } = request

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
            const queryResult = query({
                prompt,
                options: mergedOptions as any
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
}
