/**
 * Frontend 顯示用型別定義
 * 用於 Vue.js 前端的訊息顯示和 UI 狀態管理
 */

import type { QueryOptions } from './query.types'

/**
 * 前端顯示用的訊息類型
 * 從 SDK 訊息轉換而來，適合 UI 渲染
 */
export interface DisplayMessage {
    // 訊息識別
    uuid?: string
    type: 'user' | 'assistant' | 'system' | 'error'

    // 內容
    text?: string           // 文字內容（user 訊息）
    content?: string        // 助理回應內容（assistant 訊息，可能包含 markdown）

    // 工具相關
    tools?: ToolExecution[]
    toolsExpanded?: boolean

    // 狀態
    isStreaming?: boolean   // 是否正在串流中
    isHistorical?: boolean  // 是否為歷史記錄（用於判斷預設展開邏輯）

    // 結果資料
    result?: QueryResult

    // 原始訊息（用於除錯或進階功能）
    rawMessage?: any
}

/**
 * 工具執行記錄
 * 解析自 tool_use 和 tool_result blocks
 */
export interface ToolExecution {
    id: string
    name: string
    input: any
    result: any
    is_error: boolean
    expanded: boolean       // UI 展開狀態
}

/**
 * 查詢結果
 * 從 result message 解析而來
 */
export interface QueryResult {
    total_cost_usd: number
    num_turns: number
    duration_ms: number
    is_error: boolean
    error_message?: string
    usage?: {
        input_tokens: number
        output_tokens: number
    }
}

/**
 * WebSocket 查詢訊息
 */
export interface WSQueryMessage {
    type: 'query'
    requestId: string
    workspacePath: string
    prompt: string
    options?: QueryOptions
}

/**
 * WebSocket 回應訊息
 */
export interface WSResponseMessage {
    requestId: string
    message?: any           // SDK message
    type?: 'complete' | 'error'
    error?: string
}

/**
 * SDK Content Block 類型
 * 用於解析訊息內容
 */
export interface TextBlock {
    type: 'text'
    text: string
}

export interface ToolUseBlock {
    type: 'tool_use'
    id: string
    name: string
    input: any
}

export interface ToolResultBlock {
    type: 'tool_result'
    tool_use_id: string
    content: any
    is_error?: boolean
}

export type ContentBlock = TextBlock | ToolUseBlock | ToolResultBlock

/**
 * SDK Message 類型
 * 基於 Claude Agent SDK 的訊息格式
 */
export interface SDKMessage {
    type: 'system' | 'user' | 'assistant' | 'result'
    message?: {
        role?: string
        content?: ContentBlock[]
    }
    session_id?: string
    model?: string
    permission_mode?: string
    cwd?: string
    tools?: string[]
    result?: {
        total_cost_usd: number
        num_turns: number
        duration_ms: number
        duration_api_ms?: number
        is_error: boolean
        error_message?: string
        usage?: {
            input_tokens: number
            output_tokens: number
        }
    }
}

/**
 * 工具圖示配置
 */
export interface ToolIconConfig {
    icon: string        // SVG path 或圖示名稱
    variant: 'default' | 'secondary' | 'destructive' | 'outline'
}
