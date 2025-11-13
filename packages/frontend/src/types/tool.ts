/**
 * Tool 相關型別定義
 * 提供 Claude Agent SDK tool 的完整型別支援
 */

/**
 * 標準工具名稱枚舉
 * 包含 Claude Code 和 Claude Agent SDK 支援的工具
 */
export type StandardToolName =
  | 'Bash'
  | 'Read'
  | 'Write'
  | 'Edit'
  | 'Glob'
  | 'Grep'
  | 'WebFetch'
  | 'WebSearch'
  | 'NotebookEdit'
  | 'Skill'
  | 'SlashCommand'
  | 'AskUserQuestion'
  | 'TodoWrite'
  | 'BashOutput'
  | 'KillShell'
  | 'mcp__plugin_superpowers-chrome_chrome__use_browser'
  | 'mcp__context7__resolve-library-id'
  | 'mcp__context7__get-library-docs'
  | 'mcp__devtool__click'
  | 'mcp__devtool__close_page'
  | 'mcp__devtool__drag'
  | 'mcp__devtool__emulate'
  | 'mcp__devtool__evaluate_script'
  | 'mcp__devtool__fill'
  | 'mcp__devtool__fill_form'
  | 'mcp__devtool__get_console_message'
  | 'mcp__devtool__get_network_request'
  | 'mcp__devtool__handle_dialog'
  | 'mcp__devtool__hover'
  | 'mcp__devtool__list_console_messages'
  | 'mcp__devtool__list_network_requests'
  | 'mcp__devtool__list_pages'
  | 'mcp__devtool__navigate_page'
  | 'mcp__devtool__new_page'
  | 'mcp__devtool__performance_analyze_insight'
  | 'mcp__devtool__performance_start_trace'
  | 'mcp__devtool__performance_stop_trace'
  | 'mcp__devtool__press_key'
  | 'mcp__devtool__resize_page'
  | 'mcp__devtool__select_page'
  | 'mcp__devtool__take_screenshot'
  | 'mcp__devtool__take_snapshot'
  | 'mcp__devtool__upload_file'
  | 'mcp__devtool__wait_for'
  | 'mcp__ide__getDiagnostics'

/**
 * Tool 名稱型別
 * 支援標準工具名稱或自訂工具名稱
 */
export type ToolName = StandardToolName | string

/**
 * Tool 執行狀態
 */
export type ToolStatus = 'pending' | 'running' | 'success' | 'error'

/**
 * Tool 輸入參數
 * 支援任意鍵值對
 */
export interface ToolInput {
  [key: string]: any
}

/**
 * Tool 執行結果
 * 包含輸出或錯誤資訊
 */
export interface ToolResult {
  /** Tool 的標準輸出 */
  output?: string
  /** Tool 執行中的錯誤訊息 */
  error?: string
  /** Tool 執行是否出錯 */
  is_error?: boolean
  /** Tool 返回的其他資訊 */
  [key: string]: any
}

/**
 * Tool 使用塊（來自 Claude SDK）
 * 代表一次 tool 呼叫
 */
export interface ToolUseBlock {
  /** Block 類型 */
  type: 'tool_use'
  /** Tool 呼叫的唯一識別符 */
  id: string
  /** Tool 名稱 */
  name: ToolName
  /** Tool 輸入參數 */
  input: ToolInput
}

/**
 * Tool 結果塊（來自 Claude SDK）
 * 代表 tool 執行結果
 */
export interface ToolResultBlock {
  /** Block 類型 */
  type: 'tool_result'
  /** 對應的 tool_use 區塊 ID */
  tool_use_id: string
  /** Tool 執行結果內容（可能是字串或 JSON） */
  content: string | ToolResult[]
  /** 結果是否表示錯誤 */
  is_error?: boolean
}

/**
 * Tool 執行資訊
 * 整合 tool_use 和 tool_result
 */
export interface ToolExecution {
  /** Tool 呼叫 ID */
  id: string
  /** Tool 名稱 */
  name: ToolName
  /** Tool 輸入參數 */
  input: ToolInput
  /** Tool 執行結果（若有） */
  result?: ToolResult | string
  /** Tool 執行狀態 */
  status: ToolStatus
  /** 是否為錯誤結果 */
  is_error: boolean
  /** 執行時間戳 */
  timestamp: number
  /** 執行耗時（毫秒） */
  duration_ms?: number
}

/**
 * Tool 圖示配置
 * 包含 SVG 路徑和顏色樣式
 */
export interface ToolIcon {
  /** SVG 路徑資料 */
  icon: string
  /** Tailwind CSS 樣式類別 */
  color: string
}

/**
 * Tool 圖示映射
 * 工具名稱對應其圖示配置
 */
export type ToolIconMap = Record<string, ToolIcon>

/**
 * 預設 Tool 圖示配置
 */
export const DEFAULT_TOOL_ICONS: ToolIconMap = {
  'Read': {
    icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
    color: 'text-blue-600 bg-blue-50'
  },
  'Edit': {
    icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
    color: 'text-green-600 bg-green-50'
  },
  'Write': {
    icon: 'M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z',
    color: 'text-purple-600 bg-purple-50'
  },
  'Bash': {
    icon: 'M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
    color: 'text-gray-700 bg-gray-50'
  },
  'Glob': {
    icon: 'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z',
    color: 'text-yellow-600 bg-yellow-50'
  },
  'Grep': {
    icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
    color: 'text-orange-600 bg-orange-50'
  }
}

/**
 * 預設 Tool 圖示
 */
export const DEFAULT_TOOL_ICON: ToolIcon = {
  icon: 'M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4',
  color: 'text-indigo-600 bg-indigo-50'
}

/**
 * Tool 展開狀態信息
 */
export interface ToolExpandState {
  /** Tool ID */
  id: string
  /** 是否展開 */
  expanded: boolean
}

/**
 * 訊息中的 Tool 面板狀態
 */
export interface MessageToolsState {
  /** Tool 面板是否展開 */
  toolsExpanded: boolean
  /** 所有工具的展開狀態 */
  tools: ToolExecution[]
}

/**
 * Tool 使用統計
 */
export interface ToolUsageStats {
  /** Tool 名稱 */
  tool: string
  /** 被使用的次數 */
  count: number
  /** 成功次數 */
  success_count: number
  /** 失敗次數 */
  error_count: number
  /** 平均執行時間（毫秒） */
  avg_duration_ms: number
}

/**
 * Tool 引數配置
 * 用於驗證和展示 Tool 的參數
 */
export interface ToolParameterConfig {
  /** 參數名稱 */
  name: string
  /** 參數型別 */
  type: 'string' | 'number' | 'boolean' | 'array' | 'object'
  /** 參數是否必須 */
  required: boolean
  /** 參數描述 */
  description?: string
  /** 預設值 */
  default?: any
  /** 參數選項（適用於列舉） */
  options?: string[]
}

/**
 * Tool 定義
 * 用於描述可用工具的完整資訊
 */
export interface ToolDefinition {
  /** Tool 名稱 */
  name: ToolName
  /** Tool 描述 */
  description: string
  /** Tool 參數配置 */
  parameters: ToolParameterConfig[]
  /** 是否為內建工具 */
  is_builtin: boolean
  /** Tool 圖示配置 */
  icon?: ToolIcon
}

/**
 * Content block 基礎型別
 */
export interface ContentBlock {
  type: string
  [key: string]: any
}

/**
 * Tool 解析結果
 * parseToolBlocks 函數的返回型別
 */
export interface ParseToolBlocksResult extends ToolExecution {
  /** Tool 執行狀態（重新映射） */
  status: ToolStatus
}
