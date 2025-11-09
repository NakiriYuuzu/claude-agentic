/**
 * Session API Validation Schemas
 * 使用 TypeBox 定義驗證規則
 */

import { Type as t } from '@sinclair/typebox'

/**
 * Session 狀態枚舉
 */
export const SessionStatusSchema = t.Union([
    t.Literal('running'),
    t.Literal('completed'),
    t.Literal('error'),
    t.Literal('interrupted')
])

/**
 * 排序方式
 */
export const OrderSchema = t.Union([t.Literal('asc'), t.Literal('desc')])

/**
 * 排序欄位
 */
export const OrderBySchema = t.Union([
    t.Literal('created_at'),
    t.Literal('updated_at'),
    t.Literal('total_cost_usd')
])

/**
 * 訊息類型
 */
export const MessageTypeSchema = t.Union([
    t.Literal('system'),
    t.Literal('user'),
    t.Literal('assistant'),
    t.Literal('result')
])

/**
 * GET /api/sessions - 列出 sessions 的 Query Parameters
 */
export const ListSessionsQuerySchema = t.Object({
    workspace_path: t.Optional(t.String({ minLength: 1 })),
    status: t.Optional(SessionStatusSchema),
    limit: t.Optional(t.Number({ minimum: 1, maximum: 1000, default: 50 })),
    offset: t.Optional(t.Number({ minimum: 0, default: 0 })),
    order_by: t.Optional(OrderBySchema),
    order: t.Optional(OrderSchema)
})

/**
 * GET /api/sessions/:session_id - 取得 session 詳情的 Path Parameters
 */
export const SessionIdParamSchema = t.Object({
    session_id: t.String({ minLength: 1 })
})

/**
 * GET /api/sessions/:session_id/messages - 取得 messages 的 Query Parameters
 */
export const ListMessagesQuerySchema = t.Object({
    message_type: t.Optional(MessageTypeSchema),
    limit: t.Optional(t.Number({ minimum: 1, maximum: 1000, default: 100 })),
    offset: t.Optional(t.Number({ minimum: 0, default: 0 }))
})

/**
 * GET /api/sessions/stats - 統計資訊的 Query Parameters
 */
export const SessionStatsQuerySchema = t.Object({
    workspace_path: t.Optional(t.String({ minLength: 1 })),
    date_from: t.Optional(t.String({ format: 'date-time' })),
    date_to: t.Optional(t.String({ format: 'date-time' }))
})

/**
 * DELETE /api/sessions/:session_id - 刪除 session 的 Path Parameters
 */
export const DeleteSessionParamSchema = t.Object({
    session_id: t.String({ minLength: 1 })
})

/**
 * Response Schema - Session 物件
 */
export const SessionResponseSchema = t.Object({
    session_id: t.String(),
    workspace_path: t.String(),
    created_at: t.String(),
    updated_at: t.String(),
    completed_at: t.Union([t.String(), t.Null()]),
    status: SessionStatusSchema,
    model: t.Union([t.String(), t.Null()]),
    permission_mode: t.Union([t.String(), t.Null()]),
    cwd: t.Union([t.String(), t.Null()]),
    tools: t.Union([t.String(), t.Null()]),
    mcp_servers: t.Union([t.String(), t.Null()]),
    total_cost_usd: t.Number(),
    num_turns: t.Number(),
    duration_ms: t.Union([t.Number(), t.Null()]),
    duration_api_ms: t.Union([t.Number(), t.Null()]),
    is_error: t.Boolean(),
    error_message: t.Union([t.String(), t.Null()]),
    message_count: t.Number()
})

/**
 * Response Schema - Session Message 物件
 */
export const SessionMessageResponseSchema = t.Object({
    id: t.Number(),
    session_id: t.String(),
    uuid: t.String(),
    message_type: t.String(),
    message_subtype: t.Union([t.String(), t.Null()]),
    message_content: t.String(),
    tools_used: t.Union([t.String(), t.Null()]),
    created_at: t.String()
})

/**
 * Response Schema - 列表回應
 */
export const SessionListResponseSchema = t.Object({
    success: t.Boolean(),
    data: t.Object({
        sessions: t.Array(SessionResponseSchema),
        total: t.Number(),
        limit: t.Number(),
        offset: t.Number()
    })
})

/**
 * Response Schema - 單一 session 回應
 */
export const SessionDetailResponseSchema = t.Object({
    success: t.Boolean(),
    data: SessionResponseSchema
})

/**
 * Response Schema - Messages 列表回應
 */
export const MessageListResponseSchema = t.Object({
    success: t.Boolean(),
    data: t.Object({
        messages: t.Array(SessionMessageResponseSchema),
        total: t.Number()
    })
})

/**
 * Response Schema - 統計資訊回應
 */
export const SessionStatsResponseSchema = t.Object({
    success: t.Boolean(),
    data: t.Object({
        total_sessions: t.Number(),
        completed_sessions: t.Number(),
        error_sessions: t.Number(),
        total_cost_usd: t.Number(),
        total_turns: t.Number(),
        average_duration_ms: t.Number(),
        most_used_tools: t.Array(
            t.Object({
                tool: t.String(),
                count: t.Number()
            })
        )
    })
})

/**
 * Response Schema - 刪除回應
 */
export const DeleteResponseSchema = t.Object({
    success: t.Boolean(),
    message: t.Optional(t.String())
})

/**
 * Response Schema - 錯誤回應
 */
export const ErrorResponseSchema = t.Object({
    success: t.Boolean(),
    error: t.String()
})
