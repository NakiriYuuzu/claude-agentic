/**
 * Query Routes
 * Agent 查詢的標準 REST API（收集完整結果後返回）
 */

import { Elysia, t } from 'elysia'
import { AgentService } from '../services/agent.service'
import type { SettingsService } from '../services/settings.service'
import type { SessionRecorder } from '../services/session-recorder'
import { randomUUID } from 'crypto'
import type { SDKUserMessage, SDKMessage } from '@anthropic-ai/claude-agent-sdk'

export const createQueryRoutes = (
    settingsService: SettingsService,
    sessionRecorder?: SessionRecorder
) => {
    const agentService = new AgentService(settingsService)

    return new Elysia({ prefix: '/api' })

        /**
         * POST /api/query
         * 執行 Agent 查詢（標準 REST API，收集完整結果後返回）
         */
        .post('/query', async ({ body, log, fileLogger, requestId }) => {
            const startTime = Date.now()

            // 記錄查詢開始
            const queryStartLog = {
                event: 'query_start',
                requestId,
                workspacePath: body.workspacePath,
                promptPreview: body.prompt.substring(0, 50) + '...',
                options: body.options,
                resume: body.options?.resume
            }
            log.info(queryStartLog, 'Agent query started')
            fileLogger.info(queryStartLog, 'Agent query started')

            try {
                // 收集所有訊息
                const messages: SDKMessage[] = []
                let sessionId: string | undefined
                let userMessageRecorded = false
                let totalCost: number | undefined
                let numTurns: number | undefined

                // 執行查詢
                const recordSession = body.options?.recordSession !== false // 預設開啟

                const queryGenerator = (recordSession && sessionRecorder)
                    ? sessionRecorder.recordQuery(agentService, body)
                    : agentService.executeQuery(body)

                // 收集所有訊息
                for await (const message of queryGenerator) {
                    messages.push(message)

                    // 記錄 session ID
                    if (message.type === 'system' && message.subtype === 'init' && message.session_id) {
                        sessionId = message.session_id
                        log.debug(
                            {
                                event: 'session_created',
                                session_id: sessionId
                            },
                            'Session created'
                        )

                        // 手動記錄使用者輸入訊息（如果啟用 session recording）
                        if (sessionRecorder && recordSession && !userMessageRecorded && body.prompt) {
                            const userMessage: SDKUserMessage = {
                                type: 'user',
                                uuid: randomUUID(),
                                session_id: sessionId,
                                message: {
                                    role: 'user',
                                    content: [{
                                        type: 'text',
                                        text: body.prompt
                                    }]
                                },
                                parent_tool_use_id: null
                            }

                            userMessageRecorded = true
                            ;(sessionRecorder as any).handleMessage(userMessage, body.workspacePath)
                                .catch((recordError: any) => {
                                    log.error(
                                        {
                                            event: 'user_message_record_error',
                                            session_id: sessionId,
                                            error: recordError.message
                                        },
                                        'Failed to record user input message'
                                    )
                                })
                        }
                    }

                    // 擷取最終結果數據
                    if (message.type === 'result') {
                        totalCost = (message as any).total_cost_usd
                        numTurns = (message as any).num_turns
                    }
                }

                const duration = Date.now() - startTime

                // 記錄完成
                const completeLog = {
                    event: 'query_complete',
                    requestId,
                    workspacePath: body.workspacePath,
                    duration_ms: duration,
                    total_messages: messages.length,
                    session_id: sessionId,
                    total_cost_usd: totalCost,
                    num_turns: numTurns
                }
                log.info(completeLog, 'Agent query completed')
                fileLogger.info(completeLog, 'Agent query completed')

                // 返回完整結果
                return {
                    success: true,
                    messages,
                    sessionId,
                    totalCost,
                    numTurns,
                    duration
                }

            } catch (error: any) {
                const duration = Date.now() - startTime

                // 記錄錯誤
                const errorLog = {
                    event: 'query_error',
                    requestId,
                    workspacePath: body.workspacePath,
                    error: error.message,
                    stack: error.stack,
                    duration_ms: duration
                }
                log.error(errorLog, 'Agent query failed')
                fileLogger.error(errorLog, 'Agent query failed')

                // 返回錯誤
                return {
                    success: false,
                    error: error.message || 'Query execution failed',
                    duration
                }
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
                    resume: t.Optional(t.String({ minLength: 1 })), // SDK 原生 resume
                    recordSession: t.Optional(t.Boolean()) // 是否記錄 session（預設 true）
                }))
            }),
            detail: {
                summary: '執行 Agent 查詢（REST API）',
                description: '執行 Agent 查詢並返回完整結果。支援 resume 參數繼續指定 session，以及 recordSession 控制是否記錄對話。',
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
