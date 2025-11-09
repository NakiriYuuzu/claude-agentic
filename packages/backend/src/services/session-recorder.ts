// @ts-nocheck - SDK 型別定義問題待修復

import type { AgentService } from './agent.service'
import type { SessionQueueService } from './session-queue.service'
import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk'
import type { QueryRequest } from '@workspace/shared'
import { logger } from '../utils/logger'

/**
 * Session 記錄器
 * 攔截 Agent query 的 SSE messages 並自動記錄到資料庫
 */
export class SessionRecorder {
    constructor(private queueService: SessionQueueService) {
        logger.info({ event: 'recorder_initialized' }, 'SessionRecorder initialized')
    }

    /**
     * 包裝 executeQuery 並自動記錄 session
     */
    async *recordQuery(
        agentService: AgentService,
        request: QueryRequest
    ): AsyncGenerator<SDKMessage, void, unknown> {
        let currentSessionId: string | null = null
        let hasError = false
        let errorMessage: string | null = null

        try {
            logger.debug(
                {
                    event: 'recorder_start',
                    workspacePath: request.workspacePath
                },
                'Starting session recording'
            )

            // 開始執行 query 並記錄所有 messages
            for await (const message of agentService.executeQuery(request)) {
                try {
                    // 處理不同類型的 message
                    await this.handleMessage(message, request.workspacePath)

                    // 記錄 session_id
                    if (message.type === 'system' && message.subtype === 'init' && message.session_id) {
                        currentSessionId = message.session_id
                        logger.debug(
                            {
                                event: 'recorder_session_created',
                                session_id: currentSessionId
                            },
                            'Session created'
                        )
                    }

                    // 檢查錯誤
                    if (message.type === 'result' && message.is_error) {
                        hasError = true
                        errorMessage = message.result || 'Unknown error'
                    }
                } catch (recordError: any) {
                    // 記錄失敗不應中斷 query 執行
                    logger.error(
                        {
                            event: 'recorder_message_error',
                            message_type: message.type,
                            error: recordError.message
                        },
                        'Failed to record message'
                    )
                }

                // 無論記錄成功與否，都要 yield message
                yield message
            }

            logger.debug(
                {
                    event: 'recorder_complete',
                    session_id: currentSessionId,
                    has_error: hasError
                },
                'Session recording completed'
            )

            // 明確結束 generator（修復 ERR_INCOMPLETE_CHUNKED_ENCODING）
            return
        } catch (queryError: any) {
            // Query 執行失敗
            hasError = true
            errorMessage = queryError.message

            logger.error(
                {
                    event: 'recorder_query_error',
                    session_id: currentSessionId,
                    error: queryError.message
                },
                'Query execution failed'
            )

            // 更新 session 狀態為 error
            if (currentSessionId) {
                this.queueService.enqueueUpdateStatus(currentSessionId, 'error')
                this.queueService.enqueueUpdateResult(currentSessionId, {
                    status: 'error',
                    is_error: true,
                    error_message: errorMessage,
                    completed_at: new Date().toISOString()
                })
            }

            throw queryError
        }
    }

    /**
     * 處理單一 message
     * 改為 public 以允許手動記錄使用者輸入訊息
     */
    async handleMessage(message: SDKMessage, workspacePath: string): Promise<void> {
        const sessionId = message.session_id

        if (!sessionId) {
            logger.warn(
                {
                    event: 'recorder_missing_session_id',
                    message_type: message.type
                },
                'Message missing session_id'
            )
            return
        }

        switch (message.type) {
            case 'system':
                if (message.subtype === 'init') {
                    // 建立 session
                    this.queueService.enqueueCreateSession({
                        session_id: sessionId,
                        workspace_path: workspacePath,
                        model: message.model,
                        permission_mode: message.permissionMode,
                        cwd: message.cwd,
                        tools: message.tools ? JSON.stringify(message.tools) : undefined,
                        mcp_servers: message.mcp_servers
                            ? JSON.stringify(message.mcp_servers)
                            : undefined
                    })

                    logger.debug(
                        {
                            event: 'recorder_session_init',
                            session_id: sessionId,
                            model: message.model
                        },
                        'Session init recorded'
                    )
                }
                break

            case 'result':
                // 更新 session 結果
                this.queueService.enqueueUpdateResult(sessionId, {
                    status: message.is_error ? 'error' : 'completed',
                    total_cost_usd: message.total_cost_usd,
                    num_turns: message.num_turns,
                    duration_ms: message.duration_ms,
                    duration_api_ms: message.duration_api_ms,
                    is_error: message.is_error,
                    error_message: message.error_message || null,
                    completed_at: new Date().toISOString()
                })

                logger.debug(
                    {
                        event: 'recorder_session_result',
                        session_id: sessionId,
                        status: message.is_error ? 'error' : 'completed',
                        cost_usd: message.total_cost_usd
                    },
                    'Session result recorded'
                )
                break

            case 'user':
            case 'assistant':
                // 這些都是需要記錄的訊息類型
                break

            default:
                // 未知類型也記錄
                logger.debug(
                    {
                        event: 'recorder_unknown_type',
                        type: message.type
                    },
                    'Unknown message type'
                )
        }

        // 記錄訊息到 session_messages 表
        this.queueService.enqueueAddMessage(sessionId, message)
    }

    /**
     * 強制 flush 佇列
     */
    async flush(): Promise<void> {
        logger.info({ event: 'recorder_flush' }, 'Flushing recorder queue')
        await this.queueService.flush()
    }

    /**
     * 取得佇列狀態
     */
    getQueueStatus(): { queueSize: number; processing: boolean } {
        return this.queueService.getStatus()
    }
}
