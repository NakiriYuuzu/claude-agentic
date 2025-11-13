/**
 * Message Types
 * 訊息型別定義模組
 *
 * 這個模組定義了聊天應用中所有訊息相關的型別，
 * 包括使用者訊息、助手訊息、工具執行資訊和會話結果。
 */

/**
 * 訊息角色類型
 * 定義訊息的發送者角色
 */
export type MessageRole = 'user' | 'assistant' | 'system' | 'error'

/**
 * 訊息類型
 * 定義訊息的高層分類
 */
export type MessageType = 'user' | 'assistant' | 'system' | 'error'

/**
 * 內容區塊類型
 * Claude SDK 返回的內容區塊類型
 */
export type ContentBlockType = 'text' | 'tool_use' | 'tool_result' | 'image' | 'document'

/**
 * 工具狀態
 * 工具執行的當前狀態
 */
export type ToolStatus = 'pending' | 'running' | 'success' | 'error'

/**
 * 工具 Block 介面
 * 代表一個工具使用和其結果
 */
export interface ToolBlock {
  /** 工具區塊的唯一識別碼 */
  id: string

  /** 工具名稱 */
  name: string

  /** 工具輸入參數 */
  input: Record<string, any>

  /** 工具執行結果 */
  result?: any

  /** 工具執行是否出錯 */
  is_error?: boolean

  /** 工具執行狀態 */
  status?: ToolStatus

  /** UI 狀態：工具詳情是否展開 */
  expanded?: boolean
}

/**
 * 訊息結果資訊
 * 代表整個查詢的結果和統計資訊
 */
export interface MessageResult {
  /** 查詢的總成本（USD） */
  total_cost_usd?: number

  /** 對話轉數 */
  num_turns?: number

  /** 查詢耗時（毫秒） */
  duration_ms?: number

  /** 查詢是否出錯 */
  is_error?: boolean

  /** Token 使用統計 */
  usage?: {
    input_tokens?: number
    output_tokens?: number
    total_tokens?: number
  }
}

/**
 * 使用者訊息介面
 * 代表使用者發送的訊息
 */
export interface UserMessage {
  /** 訊息類型 */
  type: 'user'

  /** 訊息文字內容 */
  text: string

  /** 訊息內容（相容舊格式） */
  content?: string

  /** 是否處於編輯狀態 */
  isEditing?: boolean
}

/**
 * 助手訊息介面
 * 代表 Claude 助手返回的訊息
 */
export interface AssistantMessage {
  /** 訊息類型 */
  type: 'assistant'

  /** 文字內容 */
  content: string

  /** 工具區塊列表 */
  tools: ToolBlock[]

  /** 工具面板是否展開 */
  toolsExpanded?: boolean

  /** 訊息是否在流式傳輸中 */
  isStreaming?: boolean

  /** 訊息是否完成 */
  isComplete?: boolean

  /** 查詢結果和統計資訊 */
  result?: MessageResult | null

  /** 是否是歷史訊息（已保存） */
  isHistorical?: boolean
}

/**
 * 系統訊息介面
 * 代表系統通知訊息
 */
export interface SystemMessage {
  /** 訊息類型 */
  type: 'system'

  /** 訊息文字 */
  text: string

  /** 系統訊息子類型 */
  subtype?: 'init' | 'error' | 'warning' | 'info'
}

/**
 * 錯誤訊息介面
 * 代表錯誤通知訊息
 */
export interface ErrorMessage {
  /** 訊息類型 */
  type: 'error'

  /** 錯誤文字 */
  text: string

  /** 錯誤代碼 */
  code?: string
}

/**
 * 通用訊息型別
 * 所有訊息類型的聯合型別
 */
export type Message = UserMessage | AssistantMessage | SystemMessage | ErrorMessage

/**
 * 內容區塊介面
 * Claude SDK 返回的內容區塊結構
 */
export interface ContentBlock {
  /** 區塊類型 */
  type: ContentBlockType

  /** 文字內容（text 區塊） */
  text?: string

  /** 工具使用區塊 ID */
  id?: string

  /** 工具名稱 */
  name?: string

  /** 工具輸入 */
  input?: Record<string, any>

  /** 工具結果區塊的工具 ID */
  tool_use_id?: string

  /** 工具結果內容 */
  content?: any

  /** 結果是否為錯誤 */
  is_error?: boolean
}

/**
 * SDK 訊息介面
 * Claude Agent SDK 返回的原始訊息結構
 */
export interface SDKMessage {
  /** 訊息類型 */
  type: 'assistant' | 'system' | 'result' | 'error'

  /** 訊息內容 */
  message?: {
    content: ContentBlock[]
    [key: string]: any
  }

  /** 系統訊息子類型 */
  subtype?: string

  /** 會話 ID */
  session_id?: string

  /** 查詢結果資訊 */
  total_cost_usd?: number
  num_turns?: number
  duration_ms?: number
  is_error?: boolean
  usage?: {
    input_tokens?: number
    output_tokens?: number
    total_tokens?: number
  }

  /** 錯誤資訊 */
  error?: string
}

/**
 * 會話統計介面
 * 代表一個會話的統計資訊
 */
export interface SessionStats {
  /** 會話 ID */
  session_id: string

  /** 訊息總數 */
  message_count: number

  /** Token 總消耗 */
  total_tokens: number

  /** 總成本（USD） */
  total_cost_usd: number

  /** 建立時間 */
  created_at: string

  /** 更新時間 */
  updated_at: string

  /** 會話狀態 */
  status: 'running' | 'completed' | 'error'
}

/**
 * 會話介面
 * 代表一個聊天會話
 */
export interface Session {
  /** 會話 ID */
  session_id: string

  /** 工作空間路徑 */
  workspace_path: string

  /** 第一條使用者訊息 */
  first_user_message?: string

  /** 訊息總數 */
  message_count?: number

  /** Token 消耗 */
  total_tokens?: number

  /** 總成本 */
  total_cost_usd?: number

  /** 建立時間 */
  created_at: string

  /** 更新時間 */
  updated_at: string

  /** 會話狀態 */
  status: 'running' | 'completed' | 'error'
}

/**
 * 會話訊息介面
 * 代表保存在資料庫中的單條訊息
 */
export interface StoredMessage {
  /** 訊息 ID */
  message_id: string

  /** 會話 ID */
  session_id: string

  /** 訊息類型 */
  message_type: MessageType

  /** 訊息子類型 */
  message_subtype?: string

  /** 訊息序號 */
  message_index?: number

  /** 訊息內容（JSON 字串） */
  message_content: string

  /** 建立時間 */
  created_at: string
}

/**
 * 查詢選項介面
 * WebSocket 查詢時的選項
 */
export interface QueryOptions {
  /** 模型名稱 */
  model?: string

  /** 權限模式 */
  permissionMode?: 'default' | 'acceptEdits' | 'bypassPermissions' | 'plan'

  /** 最大對話轉數 */
  maxTurns?: number

  /** 會話 ID（用於恢復） */
  resume?: string

  /** 其他自訂選項 */
  [key: string]: any
}

/**
 * WebSocket 查詢訊息介面
 * 發送給 WebSocket 的查詢訊息
 */
export interface WebSocketQueryMessage {
  /** 訊息類型 */
  type: 'query'

  /** 唯一請求 ID */
  requestId: string

  /** 工作空間路徑 */
  workspacePath: string

  /** 使用者提示 */
  prompt: string

  /** 查詢選項 */
  options?: QueryOptions
}

/**
 * WebSocket 回應訊息介面
 * WebSocket 返回的回應訊息
 */
export interface WebSocketResponseMessage {
  /** 請求 ID */
  requestId: string

  /** SDK 訊息 */
  message?: SDKMessage

  /** 訊息類型 */
  type?: 'complete' | 'error'

  /** 錯誤訊息 */
  error?: string
}

/**
 * Toast 通知介面
 * UI 通知提示
 */
export interface Toast {
  /** 通知 ID */
  id: number

  /** 通知類型 */
  type: 'success' | 'error' | 'warning' | 'info'

  /** 通知訊息 */
  message: string
}
