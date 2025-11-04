/**
 * Query Routes
 * Agent 查詢的 API 端點（SSE 串流）
 */

import { Elysia, t } from 'elysia'
import { AgentService } from '../services/agent.service'
import type { SettingsService } from '../services/settings.service'
import type { SessionRecorder } from '../services/session-recorder'
import { randomUUID } from 'crypto'
import type { SDKUserMessage } from '../types/session.types'

/**
 * 格式化為 SSE 事件
 */
function formatSSE(event: string, data: any): string {
    return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
}

/**
 * 截斷 prompt 用於日誌（避免記錄完整內容）
 */
function truncatePrompt(prompt: string, maxLength: number = 50): string {
    return prompt.length > maxLength ? prompt.slice(0, maxLength) + '...' : prompt
}

export const createQueryRoutes = (
    settingsService: SettingsService,
    sessionRecorder?: SessionRecorder
) => {
    // AgentService 使用 SDK 原生 Resume，不需要 DatabaseService
    const agentService = new AgentService(settingsService)

    return new Elysia({ prefix: '/api' })

        /**
         * POST /api/query
         * 執行 Agent 查詢（SSE 串流回應）
         */
        .post('/query', async function* ({ body, set, log, fileLogger, requestId }) {
            const startTime = Date.now()

            // 設定 SSE headers
            set.headers['Content-Type'] = 'text/event-stream'
            set.headers['Cache-Control'] = 'no-cache'
            set.headers['Connection'] = 'keep-alive'

            // 記錄查詢開始
            const queryStartLog = {
                event: 'query_start',
                requestId,
                workspacePath: body.workspacePath,
                promptPreview: truncatePrompt(body.prompt),
                options: body.options,
                resume: body.options?.resume,
                continue: body.options?.continue
            }
            log.info(queryStartLog, 'Agent query started')
            fileLogger.info(queryStartLog, 'Agent query started')

            try {
                // 送出初始化事件
                yield formatSSE('init', {
                    workspacePath: body.workspacePath,
                    timestamp: new Date().toISOString()
                })

                // 執行查詢並串流結果
                // 如果有 sessionRecorder，使用它來記錄 session
                const queryGenerator = sessionRecorder
                    ? sessionRecorder.recordQuery(agentService, body)
                    : agentService.executeQuery(body)

                // 用於記錄使用者輸入訊息
                let userMessageRecorded = false

                // 心跳機制：防止長時間無資料時連線中斷
                let lastHeartbeat = Date.now()
                const HEARTBEAT_INTERVAL = 15000 // 15 seconds

                for await (const message of queryGenerator) {
                    // 檢查是否需要發送心跳
                    if (Date.now() - lastHeartbeat > HEARTBEAT_INTERVAL) {
                        yield formatSSE('heartbeat', { timestamp: new Date().toISOString() })
                        lastHeartbeat = Date.now()
                    }

                    // 根據訊息類型格式化不同的 SSE 事件
                    switch (message.type) {
                        case 'system':
                            if (message.subtype === 'init') {
                                yield formatSSE('session_init', {
                                    session_id: (message as any).session_id,
                                    cwd: (message as any).cwd,
                                    model: (message as any).model
                                })
                                lastHeartbeat = Date.now() // 重置心跳

                                // 手動記錄使用者輸入訊息（SDK 不會自動發出）
                                if (sessionRecorder && !userMessageRecorded && body.prompt) {
                                    const userMessage: SDKUserMessage = {
                                        type: 'user',
                                        uuid: randomUUID(),
                                        session_id: (message as any).session_id,
                                        message: {
                                            role: 'user',
                                            content: [{
                                                type: 'text',
                                                text: body.prompt
                                            }]
                                        },
                                        parent_tool_use_id: null
                                    }

                                    // 使用 queueService 記錄訊息（非阻塞）
                                    userMessageRecorded = true
                                    ;(sessionRecorder as any).handleMessage(userMessage, body.workspacePath)
                                        .then(() => {
                                            log.debug(
                                                {
                                                    event: 'user_message_recorded',
                                                    session_id: (message as any).session_id,
                                                    prompt_length: body.prompt.length
                                                },
                                                'User input message recorded'
                                            )
                                        })
                                        .catch((recordError: any) => {
                                            log.error(
                                                {
                                                    event: 'user_message_record_error',
                                                    session_id: (message as any).session_id,
                                                    error: recordError.message
                                                },
                                                'Failed to record user input message'
                                            )
                                        })
                                }
                            }
                            break

                        case 'assistant':
                            yield formatSSE('assistant_message', {
                                content: (message as any).message?.content,
                                uuid: (message as any).uuid
                            })
                            lastHeartbeat = Date.now() // 重置心跳
                            break

                        case 'result':
                            yield formatSSE('result', {
                                result: (message as any).result,
                                total_cost_usd: (message as any).total_cost_usd,
                                num_turns: (message as any).num_turns,
                                duration_ms: (message as any).duration_ms,
                                is_error: (message as any).is_error
                            })
                            lastHeartbeat = Date.now() // 重置心跳
                            break

                        default:
                            // 其他訊息類型
                            yield formatSSE('message', message)
                            lastHeartbeat = Date.now() // 重置心跳
                    }
                }

                // 完成事件
                const duration = Date.now() - startTime
                yield formatSSE('complete', {
                    timestamp: new Date().toISOString()
                })

                // 記錄查詢完成
                const completeLog = {
                    event: 'query_complete',
                    requestId,
                    workspacePath: body.workspacePath,
                    duration_ms: duration
                }
                log.info(completeLog, 'Agent query completed')
                fileLogger.info(completeLog, 'Agent query completed')
                return // 明確結束 generator，確保 chunked transfer encoding 正確終止

            } catch (error: any) {
                const duration = Date.now() - startTime

                // 記錄錯誤
                log.error(
                    {
                        event: 'query_error',
                        requestId,
                        workspacePath: body.workspacePath,
                        error: error.message,
                        stack: error.stack,
                        duration_ms: duration
                    },
                    'Agent query failed'
                )

                // 錯誤事件
                yield formatSSE('error', {
                    error: error.message || 'Query execution failed',
                    timestamp: new Date().toISOString()
                })

                // 記錄錯誤到 fileLogger
                const errorLog = {
                    event: 'query_error',
                    requestId,
                    workspacePath: body.workspacePath,
                    error: error.message,
                    duration_ms: duration
                }
                fileLogger.error(errorLog, 'Agent query failed')
                return // 明確結束 generator，確保錯誤時 chunked transfer encoding 也正確終止
            }
        }, {
            body: t.Object({
                workspacePath: t.String({ minLength: 1 }),
                prompt: t.String({ minLength: 1 }),
                options: t.Optional(t.Object({
                    model: t.Optional(t.String()),
                    permissionMode: t.Optional(t.Union([
                        t.Literal('default'),
                        t.Literal('acceptEdits'),
                        t.Literal('bypassPermissions'),
                        t.Literal('plan')
                    ])),
                    maxTurns: t.Optional(t.Number()),
                    allowedTools: t.Optional(t.Array(t.String())),
                    disallowedTools: t.Optional(t.Array(t.String())),
                    // Resume 功能
                    resume: t.Optional(t.String({ minLength: 1 })), // Session ID to resume
                    continue: t.Optional(t.Boolean()) // Continue from last session
                }))
            }),
            detail: {
                summary: '執行 Agent 查詢',
                description: '使用 Server-Sent Events 串流回應 Agent 查詢結果。支援 resume 參數繼續指定 session，或 continue 參數繼續最近的 session。',
                tags: ['Query']
            }
        })

        /**
         * GET /api/health
         * 健康檢查
         */
        .get('/health', () => ({
            status: 'ok',
            timestamp: new Date().toISOString()
        }), {
            detail: {
                summary: '健康檢查',
                description: '檢查 API 服務狀態',
                tags: ['System']
            }
        })
}
