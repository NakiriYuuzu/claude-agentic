/**
 * Query 相關型別定義
 */

/**
 * Query 請求參數
 */
export interface QueryRequest {
    workspacePath: string
    prompt: string
    options?: QueryOptions
}

/**
 * Query 選項
 */
export interface QueryOptions {
    model?: string
    permissionMode?: 'default' | 'acceptEdits' | 'bypassPermissions' | 'plan'
    maxTurns?: number
    allowedTools?: string[]
    disallowedTools?: string[]
    // Resume 功能
    resume?: string        // Session ID to resume from
    continue?: boolean     // Continue from last session of this workspace
    // Advanced options
    agents?: Record<string, any>      // Agent definitions
    mcpServers?: Record<string, any>  // MCP server configurations
    hooks?: Record<string, any>       // Hook configurations
    recordSession?: boolean           // Whether to record this session
}
