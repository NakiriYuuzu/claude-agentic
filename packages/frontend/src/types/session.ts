/**
 * Session 管理系統型別定義
 * 用於 Vue 3 前端應用，與 Backend API 完全對應
 *
 * 架構說明：
 * - 基礎 API 型別：從 @workspace/shared 引入
 * - UI 專用型別：本地定義（ConvertedMessage, UI 狀態等）
 *
 * 相關檔案：
 * - Backend Schema: packages/shared/src/schemas/session.schema.ts
 * - Composable: packages/frontend/public/composables/useSessions.js
 */

import type {
  SessionStatus,
  Session,
  SessionMessage,
  CreateSessionData,
  SessionResult,
  ListSessionsOptions,
  ListMessagesOptions,
  SessionStats,
  DateRange,
  QueueItem
} from '@workspace/shared'

// Re-export for convenience
export type {
  SessionStatus,
  Session,
  SessionMessage,
  CreateSessionData,
  SessionResult,
  ListSessionsOptions,
  ListMessagesOptions,
  SessionStats,
  DateRange,
  QueueItem
}

/**
 * 訊息排序方式
 */
export type SortOrder = 'asc' | 'desc'

/**
 * 訊息排序欄位
 */
export type SortField = 'created_at' | 'updated_at' | 'total_cost_usd'

/**
 * 訊息類型
 */
export type MessageType = 'system' | 'user' | 'assistant' | 'result'

/**
 * 訊息子類型
 */
export type MessageSubtype = 'init' | 'success' | 'error' | null

// Session 和 SessionMessage 已從 @workspace/shared 引入

/**
 * 轉換後的 Session 訊息
 *
 * 用於前端顯示的訊息格式，經過解析和轉換。
 */
export interface ConvertedMessage {
  /** 訊息類型 */
  type: 'user' | 'assistant'

  /** 文字內容 */
  text?: string

  /** Assistant 訊息內容 */
  content?: string

  /** Tool 列表 */
  tools?: ToolCall[]

  /** 是否展開 Tool 詳情 */
  toolsExpanded?: boolean

  /** 是否正在串流 */
  isStreaming?: boolean

  /** Tool 執行結果 */
  result?: any

  /** 是否為歷史訊息 */
  isHistorical?: boolean
}

/**
 * Tool 呼叫信息
 */
export interface ToolCall {
  /** Tool ID */
  id: string

  /** Tool 名稱 */
  name: string

  /** Tool 輸入參數 */
  input?: Record<string, any>
}

// CreateSessionData, SessionResult, ListSessionsOptions,
// ListMessagesOptions, SessionStats, DateRange
// 已從 @workspace/shared 引入

/**
 * 列出 Sessions 的回應資料
 */
export interface ListSessionsResponse {
  /** 是否成功 */
  success: boolean

  /** 回應資料 */
  data: {
    /** Session 列表 */
    sessions: Session[]

    /** 總筆數 */
    total: number

    /** 每頁數量 */
    limit: number

    /** 分頁偏移 */
    offset: number
  }
}

/**
 * 單一 Session 詳情回應
 */
export interface SessionDetailResponse {
  /** 是否成功 */
  success: boolean

  /** Session 詳情 */
  data: Session
}

/**
 * 訊息列表回應
 */
export interface MessageListResponse {
  /** 是否成功 */
  success: boolean

  /** 回應資料 */
  data: {
    /** 訊息列表 */
    messages: SessionMessage[]

    /** 總筆數 */
    total: number
  }
}

/**
 * 統計資訊回應
 */
export interface SessionStatsResponse {
  /** 是否成功 */
  success: boolean

  /** 統計資訊 */
  data: SessionStats
}

/**
 * 刪除操作回應
 */
export interface DeleteResponse {
  /** 是否成功 */
  success: boolean

  /** 操作訊息 */
  message?: string
}

/**
 * 錯誤回應
 */
export interface ErrorResponse {
  /** 是否成功 (永遠為 false) */
  success: boolean

  /** 錯誤訊息 */
  error: string
}

// QueueItem 已從 @workspace/shared 引入
// QueryOptions 已在 api.ts 中定義
