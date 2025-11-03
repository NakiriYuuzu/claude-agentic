/**
 * Query Routes
 * Agent 查詢的 API 端點（SSE 串流）
 */

import { Elysia, t } from 'elysia'
import { AgentService } from '../services/agent.service'
import type { SettingsService } from '../services/settings.service'
import type { SessionRecorder } from '../services/session-recorder'

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

                for await (const message of queryGenerator) {
                    // 根據訊息類型格式化不同的 SSE 事件
                    switch (message.type) {
                        case 'system':
                            if (message.subtype === 'init') {
                                yield formatSSE('session_init', {
                                    session_id: (message as any).session_id,
                                    cwd: (message as any).cwd,
                                    model: (message as any).model
                                })
                            }
                            break

                        case 'assistant':
                            yield formatSSE('assistant_message', {
                                content: (message as any).message?.content,
                                uuid: (message as any).uuid
                            })
                            break

                        case 'result':
                            yield formatSSE('result', {
                                result: (message as any).result,
                                total_cost_usd: (message as any).total_cost_usd,
                                num_turns: (message as any).num_turns,
                                duration_ms: (message as any).duration_ms,
                                is_error: (message as any).is_error
                            })
                            break

                        default:
                            // 其他訊息類型
                            yield formatSSE('message', message)
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
