/**
 * Settings Types
 * 定義工作空間設定相關的 TypeScript 型別
 */

/**
 * Setting Source Type
 * 對應 Claude Agent SDK 的 SettingSource
 */
export type SettingSource = 'user' | 'project' | 'local'

/**
 * Agent 定義（簡化版本，對應 Claude Agent SDK）
 */
export interface AgentDefinition {
    description: string
    prompt: string
    tools?: string[]
    model?: 'sonnet' | 'opus' | 'haiku'
    disallowedTools?: string[]
}

/**
 * MCP Server 設定
 */
export interface McpServerConfig {
    type?: 'stdio' | 'sse'
    command?: string
    args?: string[]
    env?: Record<string, string>
    url?: string
    headers?: Record<string, string>
}

/**
 * Hook 設定
 */
export interface HookMatcher {
    matcher?: string
    hooks?: string[]
    command?: string
    args?: string[]
}

export type HookEvent =
    | 'PreToolUse'
    | 'PostToolUse'
    | 'SessionStart'
    | 'SessionEnd'
    | 'UserPromptSubmit'

/**
 * 工作空間設定（完整結構）
 */
export interface WorkspaceSettings {
    workspacePath: string
    systemPrompt?: string
    allowedTools?: string[]
    disallowedTools?: string[]
    agents?: Record<string, AgentDefinition>
    mcpServers?: Record<string, McpServerConfig>
    hooks?: Partial<Record<HookEvent, HookMatcher[]>>
    settingSources?: SettingSource[]
    createdAt?: string
    updatedAt?: string
}

/**
 * 資料庫儲存格式（對應 SQLite row）
 */
export interface WorkspaceSettingsRow {
    id: number
    workspace_path: string
    system_prompt: string | null
    allowed_tools: string | null      // JSON string
    disallowed_tools: string | null   // JSON string
    agents: string | null              // JSON string
    mcp_servers: string | null         // JSON string
    hooks: string | null               // JSON string
    setting_sources: string | null     // JSON string
    created_at: string
    updated_at: string
}

/**
 * API 請求：建立工作空間設定
 */
export interface CreateWorkspaceSettingsRequest {
    workspacePath: string
    systemPrompt?: string
    allowedTools?: string[]
    disallowedTools?: string[]
    agents?: Record<string, AgentDefinition>
    mcpServers?: Record<string, McpServerConfig>
    hooks?: Partial<Record<HookEvent, HookMatcher[]>>
    settingSources?: SettingSource[]
}

/**
 * API 請求：更新工作空間設定
 */
export interface UpdateWorkspaceSettingsRequest {
    systemPrompt?: string
    allowedTools?: string[]
    disallowedTools?: string[]
    agents?: Record<string, AgentDefinition>
    mcpServers?: Record<string, McpServerConfig>
    hooks?: Partial<Record<HookEvent, HookMatcher[]>>
    settingSources?: SettingSource[]
}

/**
 * API 回應：工作空間列表項目
 */
export interface WorkspaceListItem {
    workspacePath: string
    createdAt: string
    updatedAt: string
}

/**
 * API 回應：標準格式
 */
export interface ApiResponse<T = any> {
    success: boolean
    data?: T
    error?: string
    message?: string
}
