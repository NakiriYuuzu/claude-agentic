/**
 * Session 管理系統型別定義
 */

/**
 * Session 狀態
 */
export type SessionStatus = 'running' | 'completed' | 'error' | 'interrupted'

/**
 * Session 主表記錄
 */
export interface Session {
    session_id: string
    workspace_path: string

    // 時間戳
    created_at: string
    updated_at: string
    completed_at: string | null

    // Session 狀態
    status: SessionStatus

    // 初始配置（來自 system.init message）
    model: string | null
    permission_mode: string | null
    cwd: string | null
    tools: string | null              // JSON string array
    mcp_servers: string | null        // JSON string

    // 執行結果（來自 result message）
    total_cost_usd: number
    num_turns: number
    duration_ms: number | null
    duration_api_ms: number | null
    is_error: boolean
    error_message: string | null

    // 統計
    message_count: number
}

/**
 * Session 訊息記錄
 */
export interface SessionMessage {
    id: number
    session_id: string

    // Message 識別
    uuid: string
    message_type: string              // 'system', 'user', 'assistant', 'result'
    message_subtype: string | null    // 'init', 'success', 'error', etc.

    // Message 內容
    message_content: string           // 完整 JSON 格式的 message

    // Tool 使用記錄
    tools_used: string | null         // JSON string array

    // 時間戳
    created_at: string
}

/**
 * 建立 Session 的資料
 */
export interface CreateSessionData {
    session_id: string
    workspace_path: string
    model?: string
    permission_mode?: string
    cwd?: string
    tools?: string
    mcp_servers?: string
}

/**
 * 更新 Session 結果的資料
 */
export interface SessionResult {
    status: SessionStatus
    total_cost_usd?: number
    num_turns?: number
    duration_ms?: number
    duration_api_ms?: number
    is_error?: boolean
    error_message?: string
    completed_at?: string
}

/**
 * 列出 Sessions 的選項
 */
export interface ListSessionsOptions {
    workspace_path?: string
    status?: SessionStatus
    limit?: number
    offset?: number
    order_by?: 'created_at' | 'updated_at' | 'total_cost_usd'
    order?: 'asc' | 'desc'
}

/**
 * 列出 Messages 的選項
 */
export interface ListMessagesOptions {
    message_type?: string
    limit?: number
    offset?: number
}

/**
 * Session 統計資訊
 */
export interface SessionStats {
    total_sessions: number
    completed_sessions: number
    error_sessions: number
    total_cost_usd: number
    total_turns: number
    average_duration_ms: number
    most_used_tools: Array<{ tool: string; count: number }>
}

/**
 * 日期範圍
 */
export interface DateRange {
    from?: string
    to?: string
}

/**
 * 佇列項目
 */
export interface QueueItem {
    type: 'session' | 'message' | 'update_status' | 'update_result'
    data: any
    timestamp: number
}

/**
 * 注意：Claude Agent SDK 的型別（SDKMessage, SDKUserMessage 等）
 * 應由 backend 直接從 '@anthropic-ai/claude-agent-sdk' 引入
 */
