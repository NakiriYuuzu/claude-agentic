/**
 * API 型別定義
 * 包含 WebSocket 和 REST API 的請求/回應型別
 *
 * 架構說明：
 * - 基礎型別：從 @workspace/shared 引入
 * - WebSocket 專用型別：本地定義
 * - API 回應包裝：本地定義
 *
 * 對應的後端路由：
 * - WebSocket: packages/backend/src/routes/websocket.routes.ts
 * - REST: packages/backend/src/routes/query.routes.ts
 * - Sessions: packages/backend/src/routes/session.routes.ts
 * - Settings: packages/backend/src/routes/settings.routes.ts
 */

import type {
  QueryRequest,
  QueryOptions,
  SessionStatus,
  Session,
  SessionMessage,
  SessionStats,
  WorkspaceSettings,
  WorkspaceListItem,
  ApiResponse
} from '@workspace/shared'

// Re-export for convenience
export type {
  QueryRequest,
  QueryOptions,
  SessionStatus,
  Session,
  SessionMessage,
  SessionStats,
  WorkspaceSettings,
  WorkspaceListItem,
  ApiResponse
}

/**
 * Claude Agent SDK Message 型別（簡化版，實際從 SDK 引入）
 */
export interface SDKMessage {
  type: string
  subtype?: string
  uuid?: string
  session_id?: string
  [key: string]: any
}

/**
 * WebSocket 訊息型別
 */
export type WebSocketMessageType = 'query' | 'complete' | 'error' | 'message' | 'connected'

// ===========================
// WebSocket 請求型別
// ===========================

/**
 * WebSocket 查詢請求
 *
 * @example
 * ```typescript
 * const request: WebSocketQueryRequest = {
 *   type: 'query',
 *   requestId: '1234567890-abc123',
 *   workspacePath: '/Users/user/project',
 *   prompt: 'What is TypeScript?',
 *   options: {
 *     model: 'claude-sonnet-4',
 *     maxTurns: 5,
 *     resume: 'session-id-optional'
 *   }
 * }
 * ```
 */
export interface WebSocketQueryRequest {
  /** 訊息類型，固定為 'query' */
  type: 'query'

  /** 唯一的請求 ID，用於追蹤響應 */
  requestId: string

  /** 工作空間路徑（目錄路徑或邏輯識別符） */
  workspacePath: string

  /** 使用者提示（查詢內容） */
  prompt: string

  /** 查詢選項（可選） */
  options?: WebSocketQueryOptions
}

/**
 * WebSocket 查詢選項
 */
export interface WebSocketQueryOptions {
  /** Claude 模型（例如 'claude-sonnet-4', 'claude-haiku-4'） */
  model?: string

  /** 權限模式 */
  permissionMode?: 'default' | 'acceptEdits' | 'bypassPermissions' | 'plan'

  /** 最大對話輪數 */
  maxTurns?: number

  /** 允許的工具列表 */
  allowedTools?: string[]

  /** 禁止的工具列表 */
  disallowedTools?: string[]

  /** Session ID，用於繼續前一個對話 */
  resume?: string
}

// ===========================
// WebSocket 回應型別
// ===========================

/**
 * WebSocket 訊息回應（串流訊息）
 */
export interface WebSocketMessageResponse {
  /** 對應的請求 ID */
  requestId: string

  /** Claude SDK 訊息物件 */
  message: SDKMessage
}

/**
 * WebSocket 完成回應
 */
export interface WebSocketCompleteResponse {
  /** 對應的請求 ID */
  requestId: string

  /** 訊息類型 */
  type: 'complete'

  /** 本次查詢建立的 Session ID */
  sessionId?: string

  /** 查詢耗時（毫秒） */
  duration: number
}

/**
 * WebSocket 錯誤回應
 */
export interface WebSocketErrorResponse {
  /** 對應的請求 ID */
  requestId: string

  /** 訊息類型 */
  type: 'error'

  /** 錯誤訊息 */
  error: string
}

/**
 * WebSocket 連接確認回應
 */
export interface WebSocketConnectedResponse {
  /** 訊息類型 */
  type: 'connected'

  /** 確認訊息 */
  message: string

  /** 連接 ID */
  connectionId: string
}

/**
 * WebSocket 所有可能的回應聯合型別
 */
export type WebSocketResponse =
  | WebSocketMessageResponse
  | WebSocketCompleteResponse
  | WebSocketErrorResponse
  | WebSocketConnectedResponse

// ===========================
// REST API 查詢端點
// ===========================

// QueryRequest 和 QueryOptions 已從 @workspace/shared 引入

/**
 * POST /api/query 回應
 */
export interface QueryResponse {
  /** 是否成功 */
  success: boolean

  /** 所有訊息（已完整收集） */
  messages?: SDKMessage[]

  /** Session ID */
  sessionId?: string

  /** 總成本（USD） */
  totalCost?: number

  /** 對話輪數 */
  numTurns?: number

  /** 查詢耗時（毫秒） */
  duration?: number

  /** 錯誤訊息 */
  error?: string
}

// ===========================
// Sessions API 類型
// ===========================

// SessionStatus, Session, SessionMessage 已從 @workspace/shared 引入

/**
 * GET /api/sessions 查詢參數
 */
export interface ListSessionsQuery {
  /** 工作空間路徑（可選篩選） */
  workspace_path?: string

  /** Session 狀態（可選篩選） */
  status?: SessionStatus

  /** 分頁：每頁筆數（預設 50） */
  limit?: number

  /** 分頁：偏移量（預設 0） */
  offset?: number

  /** 排序欄位（預設 'created_at'） */
  order_by?: 'created_at' | 'updated_at' | 'total_cost_usd'

  /** 排序方向（預設 'desc'） */
  order?: 'asc' | 'desc'
}

/**
 * GET /api/sessions 回應
 */
export interface ListSessionsResponse {
  /** 是否成功 */
  success: boolean

  /** 回應資料 */
  data?: {
    /** Session 列表 */
    sessions: Session[]

    /** 總筆數 */
    total: number

    /** 分頁：每頁筆數 */
    limit: number

    /** 分頁：偏移量 */
    offset: number
  }

  /** 錯誤訊息 */
  error?: string
}

/**
 * GET /api/sessions/stats 查詢參數
 */
export interface SessionStatsQuery {
  /** 工作空間路徑（可選） */
  workspace_path?: string

  /** 開始日期（ISO 8601） */
  date_from?: string

  /** 結束日期（ISO 8601） */
  date_to?: string
}

// SessionStats 已從 @workspace/shared 引入

/**
 * GET /api/sessions/:session_id 回應
 */
export interface GetSessionResponse {
  /** 是否成功 */
  success: boolean

  /** Session 資料 */
  data?: Session

  /** 錯誤訊息 */
  error?: string
}

/**
 * GET /api/sessions/:session_id/messages 查詢參數
 */
export interface ListMessagesQuery {
  /** 訊息類型篩選 */
  message_type?: string

  /** 分頁：每頁筆數（預設 100） */
  limit?: number

  /** 分頁：偏移量（預設 0） */
  offset?: number
}

/**
 * GET /api/sessions/:session_id/messages 回應
 */
export interface ListMessagesResponse {
  /** 是否成功 */
  success: boolean

  /** 回應資料 */
  data?: {
    /** 訊息列表 */
    messages: SessionMessage[]

    /** 總筆數 */
    total: number
  }

  /** 錯誤訊息 */
  error?: string
}

/**
 * DELETE /api/sessions/:session_id 回應
 */
export interface DeleteSessionResponse {
  /** 是否成功 */
  success: boolean

  /** 成功訊息 */
  message?: string

  /** 錯誤訊息 */
  error?: string
}

// ===========================
// Settings API 類型
// ===========================

// WorkspaceSettings 已從 @workspace/shared 引入

/**
 * POST /api/workspaces 請求體
 */
export interface CreateWorkspaceSettingsRequest {
  /** 工作空間路徑 */
  workspacePath: string

  /** 系統提示（可選） */
  systemPrompt?: string

  /** 允許的工具列表（可選） */
  allowedTools?: string[]

  /** 禁止的工具列表（可選） */
  disallowedTools?: string[]

  /** Agent 定義（可選） */
  agents?: Record<string, any>

  /** MCP 伺服器配置（可選） */
  mcpServers?: Record<string, any>

  /** 鉤子配置（可選） */
  hooks?: Record<string, any>

  /** 設定來源（可選） */
  settingSources?: string[]
}

/**
 * PUT /api/workspaces/:path 請求體
 */
export interface UpdateWorkspaceSettingsRequest {
  /** 系統提示（可選） */
  systemPrompt?: string

  /** 允許的工具列表（可選） */
  allowedTools?: string[]

  /** 禁止的工具列表（可選） */
  disallowedTools?: string[]

  /** Agent 定義（可選） */
  agents?: Record<string, any>

  /** MCP 伺服器配置（可選） */
  mcpServers?: Record<string, any>

  /** 鉤子配置（可選） */
  hooks?: Record<string, any>

  /** 設定來源（可選） */
  settingSources?: string[]
}

/**
 * POST /api/workspaces 回應
 */
export interface CreateWorkspaceSettingsResponse {
  /** 是否成功 */
  success: boolean

  /** 建立後的設定 */
  data?: WorkspaceSettings

  /** 錯誤訊息 */
  error?: string
}

/**
 * GET /api/workspaces/:path 回應
 */
export interface GetWorkspaceSettingsResponse {
  /** 是否成功 */
  success: boolean

  /** 工作空間設定 */
  data?: WorkspaceSettings

  /** 錯誤訊息 */
  error?: string
}

/**
 * PUT /api/workspaces/:path 回應
 */
export interface UpdateWorkspaceSettingsResponse {
  /** 是否成功 */
  success: boolean

  /** 更新後的設定 */
  data?: WorkspaceSettings

  /** 錯誤訊息 */
  error?: string
}

/**
 * DELETE /api/workspaces/:path 回應
 */
export interface DeleteWorkspaceSettingsResponse {
  /** 是否成功 */
  success: boolean

  /** 成功訊息 */
  message?: string

  /** 錯誤訊息 */
  error?: string
}

// WorkspaceListItem 已從 @workspace/shared 引入

/**
 * GET /api/workspaces 回應
 */
export interface ListWorkspacesResponse {
  /** 是否成功 */
  success: boolean

  /** 工作空間列表 */
  data?: WorkspaceListItem[]

  /** 工作空間總數 */
  count?: number

  /** 錯誤訊息 */
  error?: string
}

/**
 * POST /api/workspaces/select-folder 回應
 */
export interface SelectFolderResponse {
  /** 是否成功 */
  success: boolean

  /** 是否被使用者取消 */
  cancelled?: boolean

  /** 選定的資料夾路徑 */
  data?: {
    folderPath: string
  }

  /** 訊息（取消時） */
  message?: string

  /** 錯誤訊息 */
  error?: string
}

// ===========================
// Health Check API
// ===========================

/**
 * GET /api/health 回應
 */
export interface HealthCheckResponse {
  /** 狀態 */
  status: 'ok' | 'error'

  /** 時間戳（ISO 8601） */
  timestamp: string
}

// ===========================
// 通用 API 回應型別
// ===========================

// ApiResponse 已從 @workspace/shared 引入

/**
 * 分頁資訊
 */
export interface PaginationInfo {
  /** 每頁筆數 */
  limit: number

  /** 偏移量 */
  offset: number

  /** 總筆數 */
  total: number

  /** 是否有下一頁 */
  hasNext: boolean
}

// ===========================
// WebSocket 連線管理
// ===========================

/**
 * WebSocket 要求回調函數
 */
export interface WebSocketRequestCallbacks {
  /** 接收訊息時的回調 */
  onMessage: (message: SDKMessage) => void

  /** 查詢完成時的回調 */
  onComplete: (response: WebSocketCompleteResponse) => void

  /** 發生錯誤時的回調 */
  onError: (error: string) => void
}

/**
 * WebSocket 查詢送出結果
 */
export interface WebSocketQueryResult {
  /** 此請求的唯一 ID */
  requestId: string

  /** 送出查詢並設置回調 */
  send: (
    onMessage: (message: SDKMessage) => void,
    onComplete: (response: WebSocketCompleteResponse) => void,
    onError: (error: string) => void
  ) => void
}
