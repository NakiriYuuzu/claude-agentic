/**
 * Workspace 型別定義
 * 適用於 Claude Agent SDK + Vue 3 聊天應用
 * 與 Backend 設定系統完全相容
 *
 * 架構說明：
 * - 基礎 API 型別：從 @workspace/shared 引入
 * - UI 專用型別：本地定義（WorkspaceDetails, WorkspaceState 等）
 */

import type {
  WorkspaceSettings,
  AgentDefinition,
  McpServerConfig,
  HookMatcher,
  HookEvent,
  SettingSource,
  WorkspaceListItem
} from '@workspace/shared'

/**
 * Model 型別
 * 支援的 Claude 模型
 */
export type ModelType = 'sonnet' | 'opus' | 'haiku'

/**
 * Permission Mode 型別
 * Agent 權限管理模式
 */
export type PermissionMode = 'default' | 'acceptEdits' | 'bypassPermissions' | 'plan'

/**
 * Tools 設定
 * 定義工具的允許/不允許列表
 */
export interface ToolsConfig {
  /** 允許使用的工具列表 */
  allowed?: string[]
  /** 不允許使用的工具列表 */
  disallowed?: string[]
}

/**
 * Workspace 資訊
 * 對應資料庫的 workspaces 表
 */
export interface Workspace {
  /** 資料庫主鍵 */
  id: number
  /** Workspace 路徑（唯一標識） */
  workspace_path: string
  /** 建立時間 ISO 8601 格式 */
  created_at: string
  /** 最後更新時間 ISO 8601 格式 */
  updated_at: string
}

/**
 * 工作空間詳細資訊（前端顯示用）
 * 結合 Workspace 和 WorkspaceSettings 資訊
 * WorkspaceSettings 從 api.ts 引入
 */
export interface WorkspaceDetails {
  /** 資料庫主鍵 */
  id?: number
  /** Workspace 路徑 */
  workspacePath: string
  /** 全域系統提示詞 */
  systemPrompt?: string
  /** 全域允許使用的工具列表 */
  allowedTools?: string[]
  /** 全域不允許使用的工具列表 */
  disallowedTools?: string[]
  /** Agent 定義映射 */
  agents?: Record<string, AgentDefinition>
  /** MCP Server 設定映射 */
  mcpServers?: Record<string, McpServerConfig>
  /** Hook 事件設定映射 */
  hooks?: Partial<Record<HookEvent, HookMatcher[]>>
  /** 設定來源優先級順序 */
  settingSources?: SettingSource[]
  /** 建立時間 */
  createdAt?: string
  /** 最後更新時間 */
  updatedAt?: string
}

/**
 * Workspace 編輯表單資料
 * 前端編輯 Workspace 時使用的資料結構
 */
export interface WorkspaceEditForm {
  /** Workspace 路徑 */
  workspacePath: string
  /** 系統提示詞（可選） */
  systemPrompt?: string
  /** 允許的工具列表（可選） */
  allowedTools?: string[]
  /** 不允許的工具列表（可選） */
  disallowedTools?: string[]
  /** Agent 定義映射（可選） */
  agents?: Record<string, AgentDefinition>
  /** MCP Server 設定映射（可選） */
  mcpServers?: Record<string, McpServerConfig>
  /** Hook 設定映射（可選） */
  hooks?: Partial<Record<HookEvent, HookMatcher[]>>
  /** 設定來源（可選） */
  settingSources?: SettingSource[]
  /** 允許工具的逗號分隔字符串（前端輔助） */
  allowedToolsText?: string
  /** 不允許工具的逗號分隔字符串（前端輔助） */
  disallowedToolsText?: string
}

/**
 * Workspace 選擇狀態
 * 前端使用的 Workspace 狀態管理
 */
export interface WorkspaceState {
  /** 所有可用的 Workspace（使用 api.ts 的 WorkspaceListItem） */
  workspaces: Array<{
    workspacePath: string
    createdAt: string
    updatedAt: string
  }>
  /** 當前選擇的 Workspace 路徑 */
  currentWorkspace: string
  /** 是否正在載入 */
  isLoading: boolean
  /** 載入錯誤訊息 */
  error?: string
  /** 是否顯示建立 Workspace 表單 */
  showCreateForm: boolean
  /** 是否顯示編輯 Workspace 表單 */
  showEditForm: boolean
  /** 是否顯示 Workspace 詳細資訊 */
  showDetailsModal: boolean
  /** 當前編輯或檢視的 Workspace 資訊 */
  selectedWorkspace?: WorkspaceDetails
}

/**
 * Session 簡要資訊
 * 用於列表顯示（SessionStatus 從 api.ts 引入）
 */
export interface SessionSummary {
  /** Session ID */
  session_id: string
  /** Workspace 路徑 */
  workspace_path: string
  /** Session 狀態 */
  status: 'running' | 'completed' | 'error' | 'interrupted'
  /** 建立時間 */
  created_at: string
  /** 最後更新時間 */
  updated_at: string
  /** 完成時間（如果已完成） */
  completed_at?: string | null
  /** 訊息總數 */
  message_count: number
  /** 使用的模型 */
  model?: string | null
  /** 首條使用者訊息（用於列表標題） */
  first_user_message?: string
  /** 總成本（美元） */
  total_cost_usd: number
  /** 對話輪數 */
  num_turns: number
  /** 執行時間（毫秒） */
  duration_ms?: number | null
}

// WorkspaceSettingsRow 已從 @workspace/shared 引入，此處不再重複定義

/**
 * Workspace 右鍵選單操作類型
 */
export type WorkspaceContextMenuAction = 'edit' | 'copy-path' | 'delete' | 'view-stats'

/**
 * WorkspaceEditDialog Tab 名稱
 */
export type WorkspaceEditTabName = 'basic' | 'tools' | 'agents' | 'mcp' | 'hooks'

/**
 * JSON 編輯器組件屬性
 */
export interface JsonEditorProps {
  /** JSON 字符串或對象 */
  modelValue: string | object
  /** 編輯器高度 */
  height?: string
  /** 佔位符文字 */
  placeholder?: string
  /** 是否唯讀 */
  readonly?: boolean
  /** JSON Schema（用於驗證） */
  schema?: object
}

/**
 * TagInput 組件屬性
 */
export interface TagInputProps {
  /** 標籤陣列 */
  modelValue: string[]
  /** 佔位符文字 */
  placeholder?: string
  /** 最大標籤數量 */
  maxTags?: number
  /** 是否唯讀 */
  readonly?: boolean
}

/**
 * Workspace 搜索狀態
 */
export interface WorkspaceSearchState {
  /** 搜索關鍵字 */
  query: string
  /** 過濾後的 Workspace 列表 */
  filteredWorkspaces: WorkspaceListItem[]
}
