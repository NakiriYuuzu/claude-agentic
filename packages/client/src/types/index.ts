/**
 * Type definitions index
 * 統一匯出所有型別定義
 *
 * 架構說明：
 * - UI 專用型別：本地定義（message, tool）
 * - API/DB 型別：從 @workspace/shared re-export
 * - 前端特化型別：本地定義（api, workspace, session）
 *
 * 衝突解決：
 * - ContentBlock, ToolStatus: 從 message 導出（message 定義是 SDK message 的結構）
 * - SDKMessage: 從 message 導出（主要定義）
 * - ListSessionsResponse: 從 session 導出（專用於 Session 管理）
 * - MessageType: 從 message 導出（核心訊息類型）
 */

// ===== UI 專用型別（保留） =====
// 按導入順序排列以避免重複導出衝突
export type {
  MessageRole,
  MessageType,
  ContentBlockType,
  ToolStatus,
  ToolBlock,
  MessageResult,
  UserMessage,
  AssistantMessage,
  SystemMessage,
  ErrorMessage,
  Message,
  ContentBlock,
  SDKMessage,
  SessionStats as MessageSessionStats,
  Session as MessageSession,
  StoredMessage,
  QueryOptions as MessageQueryOptions,
  WebSocketQueryMessage,
  WebSocketResponseMessage,
  Toast
} from './message'

export type {
  StandardToolName,
  ToolName,
  ToolInput,
  ToolResult,
  ToolUseBlock,
  ToolResultBlock,
  ToolExecution,
  ToolIcon,
  ToolIconMap,
  ToolExpandState,
  MessageToolsState,
  ToolUsageStats,
  ToolParameterConfig,
  ToolDefinition,
  ParseToolBlocksResult
} from './tool'

export {
  DEFAULT_TOOL_ICONS,
  DEFAULT_TOOL_ICON
} from './tool'

// ===== 從 shared re-export API/DB 型別 =====
export type {
  // Query 相關
  QueryRequest,
  QueryOptions,

  // Session 相關 (API)
  SessionStatus,
  Session,
  SessionMessage,
  CreateSessionData,
  SessionResult,
  ListSessionsOptions,
  ListMessagesOptions,
  SessionStats,
  DateRange,
  QueueItem,

  // Workspace 相關
  WorkspaceSettings,
  AgentDefinition,
  McpServerConfig,
  HookMatcher,
  HookEvent,
  SettingSource,
  CreateWorkspaceSettingsRequest,
  UpdateWorkspaceSettingsRequest,
  WorkspaceListItem,

  // API 回應
  ApiResponse
} from '@workspace/shared'

// ===== API 專用型別（WebSocket、分頁等） =====
// 避免重複導出 SDKMessage 和 ListSessionsResponse
export type {
  WebSocketMessageType,
  WebSocketQueryRequest,
  WebSocketQueryOptions,
  WebSocketMessageResponse,
  WebSocketCompleteResponse,
  WebSocketErrorResponse,
  WebSocketConnectedResponse,
  WebSocketResponse,
  QueryResponse,
  ListSessionsQuery,
  SessionStatsQuery,
  GetSessionResponse,
  ListMessagesQuery,
  ListMessagesResponse,
  DeleteSessionResponse,
  CreateWorkspaceSettingsRequest as ApiCreateWorkspaceSettingsRequest,
  UpdateWorkspaceSettingsRequest as ApiUpdateWorkspaceSettingsRequest,
  CreateWorkspaceSettingsResponse,
  GetWorkspaceSettingsResponse,
  UpdateWorkspaceSettingsResponse,
  DeleteWorkspaceSettingsResponse,
  ListWorkspacesResponse,
  SelectFolderResponse,
  HealthCheckResponse,
  PaginationInfo,
  WebSocketRequestCallbacks,
  WebSocketQueryResult
} from './api'

// ===== Workspace 專用型別 =====
export type {
  ModelType,
  PermissionMode,
  ToolsConfig,
  Workspace,
  WorkspaceDetails,
  WorkspaceEditForm,
  WorkspaceState,
  SessionSummary
} from './workspace'

// ===== Session 專用型別 =====
export type {
  SortOrder,
  SortField,
  MessageSubtype,
  ConvertedMessage,
  ToolCall,
  ListSessionsResponse,
  SessionDetailResponse,
  MessageListResponse,
  SessionStatsResponse,
  DeleteResponse,
  ErrorResponse
} from './session'
