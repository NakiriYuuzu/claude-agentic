/**
 * WebSocket Routes
 * Agent 查詢的 WebSocket API（即時串流）
 * 遵循 Elysia.js 官方 WebSocket 最佳實踐
 */

// @ts-nocheck - Elysia derive 屬性型別推斷問題待修復

import { Elysia, t } from 'elysia'
import { AgentService } from '../services/agent.service'
import type { SettingsService } from '../services/settings.service'
import type { SessionRecorder } from '../services/session-recorder'
import { randomUUID } from 'crypto'
import type { SDKUserMessage, SDKMessage } from '@anthropic-ai/claude-agent-sdk'

/**
 * WebSocket 回應型別定義
 */
export type WSQueryResponse = {
    requestId: string
    message: SDKMessage
}

export type WSCompleteResponse = {
    requestId: string
    type: 'complete'
    sessionId?: string
    duration: number
}

export type WSErrorResponse = {
    requestId: string
    type: 'error'
    error: string
}

export type WSResponse = WSQueryResponse | WSCompleteResponse | WSErrorResponse

/**
 * WebSocket 訊息驗證 Schema
 */
const WSQueryRequestSchema = t.Object({
    type: t.Literal('query'),
    requestId: t.String(),
    workspacePath: t.String(),
    prompt: t.String(),
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
        resume: t.Optional(t.String())
    }))
})

/**
 * 全局狀態管理 - 使用 Map 追蹤活躍連接
 */
const activeConnections = new Map<string, Set<string>>()

export const createWebSocketRoutes = (
    settingsService: SettingsService,
    sessionRecorder?: SessionRecorder
) => {
    const agentService = new AgentService(settingsService)

    return new Elysia({ prefix: '/api' })
        /**
         * WebSocket /api/ws
         * 即時串流 Agent 查詢結果
         */
        .ws('/ws', {
            // 訊息驗證 schema
            body: WSQueryRequestSchema,

            // 連接建立時
            open(ws) {
                const connectionId = randomUUID()
                // 使用全局 Map 追蹤活躍請求
                activeConnections.set(connectionId, new Set())

                // 儲存連接 ID 到 ws.data（Elysia 建議的方式）
                ws.data.connectionId = connectionId

                console.log(`[${connectionId}] WebSocket connected`)
                console.log(`[${connectionId}] Active connections count:`, activeConnections.size)
                ws.send(JSON.stringify({
                    type: 'connected',
                    message: 'WebSocket connection established',
                    connectionId
                }))
            },

            // 接收訊息時（已由 Elysia 自動驗證和解析）
            async message(ws, data) {
                const connectionId = ws.data.connectionId

                console.log(`[WS] Received message, connectionId:`, connectionId)
                console.log(`[WS] Active connections:`, Array.from(activeConnections.keys()))

                const activeRequests = activeConnections.get(connectionId)

                if (!activeRequests) {
                    console.error(`[${connectionId}] Connection not found in activeConnections!`)
                    ws.send(JSON.stringify({
                        type: 'error',
                        error: 'Connection not initialized',
                        requestId: data.requestId || undefined
                    }))
                    return
                }

                try {
                    if (data.type === 'query') {
                        await handleQueryRequest(ws, data, connectionId, activeRequests)
                    }
                } catch (error: any) {
                    console.error(`[${connectionId}] WebSocket message error:`, error)
                    ws.send(JSON.stringify({
                        type: 'error',
                        error: error.message || 'Failed to process message'
                    }))
                }
            },

            // 連接關閉時
            close(ws) {
                const connectionId = ws.data.connectionId
                const activeRequests = activeConnections.get(connectionId)

                console.log(
                    `[${connectionId}] WebSocket disconnected, active requests:`,
                    activeRequests?.size || 0
                )

                // 清理連接狀態
                if (connectionId) {
                    activeConnections.delete(connectionId)
                    console.log(`[${connectionId}] Connection removed, remaining:`, activeConnections.size)
                }
            }
        })

    /**
     * 處理查詢請求
     */
    async function handleQueryRequest(
        ws: any,
        request: any,
        _connectionId: string,
        activeRequests: Set<string>
    ) {
        const { requestId, workspacePath, prompt, options = {} } = request
        const startTime = Date.now()

        // 標記請求開始
        activeRequests.add(requestId)

        try {
            console.log(`[${requestId}] Query started:`, {
                workspacePath,
                promptPreview: prompt.substring(0, 50) + '...',
                options
            })

            // 執行查詢並串流結果
            const queryGenerator = sessionRecorder
                ? sessionRecorder.recordQuery(agentService, {
                    workspacePath,
                    prompt,
                    options
                })
                : agentService.executeQuery({
                    workspacePath,
                    prompt,
                    options
                })

            // 用於記錄使用者輸入訊息（如果使用 sessionRecorder）
            let userMessageRecorded = false
            let sessionId: string | undefined
            let messageCount = 0

            // 串流所有訊息到 WebSocket
            for await (const message of queryGenerator) {
                messageCount++

                // 記錄 session ID
                if (message.type === 'system' && message.subtype === 'init' && message.session_id) {
                    sessionId = message.session_id
                    console.log(`[${requestId}] Session created:`, sessionId)

                    // 手動記錄使用者輸入訊息（SDK 不會自動發出）
                    if (sessionRecorder && !userMessageRecorded && prompt) {
                        const userMessage: SDKUserMessage = {
                            type: 'user',
                            uuid: randomUUID(),
                            session_id: sessionId,
                            message: {
                                role: 'user',
                                content: [{
                                    type: 'text',
                                    text: prompt
                                }]
                            },
                            parent_tool_use_id: null
                        }

                        // 非阻塞記錄
                        userMessageRecorded = true
                        ;(sessionRecorder as any).handleMessage(userMessage, workspacePath)
                            .catch((recordError: any) => {
                                console.error(`[${requestId}] Failed to record user message:`, recordError)
                            })
                    }
                }

                // 即時發送訊息到客戶端
                const response: WSQueryResponse = {
                    requestId,
                    message
                }
                ws.send(JSON.stringify(response))
            }

            // 發送完成訊息
            const duration = Date.now() - startTime
            const completeResponse: WSCompleteResponse = {
                requestId,
                type: 'complete',
                sessionId,
                duration
            }
            ws.send(JSON.stringify(completeResponse))

            console.log(`[${requestId}] Query completed:`, {
                messageCount,
                duration,
                sessionId
            })

        } catch (error: any) {
            const _duration = Date.now() - startTime
            console.error(`[${requestId}] Query error:`, error)

            // 發送錯誤訊息
            const errorResponse: WSErrorResponse = {
                requestId,
                type: 'error',
                error: error.message || 'Query execution failed'
            }
            ws.send(JSON.stringify(errorResponse))

        } finally {
            // 移除請求標記
            activeRequests.delete(requestId)
        }
    }
}
