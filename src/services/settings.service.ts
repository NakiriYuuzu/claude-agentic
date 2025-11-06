/**
 * Settings Service
 * 載入工作空間設定並轉換為 Claude Agent SDK Options 格式
 */

import { DatabaseService } from './database.service'
import type { Options } from '@anthropic-ai/claude-agent-sdk'

/**
 * Agent Options 型別
 * 直接使用 Claude Agent SDK 的 Options 型別
 */
export type AgentOptions = Options

export class SettingsService {
    private db: DatabaseService

    constructor(dbPath?: string) {
        this.db = new DatabaseService(dbPath)
    }

    /**
     * 載入工作空間設定（用於 AgentService）
     * @param workspacePath 工作空間路徑
     * @returns Agent Options 或 null（如果不存在）
     */
    loadSettings(workspacePath: string): AgentOptions | null {
        const settings = this.db.getSettings(workspacePath)

        if (!settings) {
            return null
        }

        // 轉換為 Claude Agent SDK Options 格式
        const options: AgentOptions = {
            cwd: workspacePath
        }

        // System Prompt
        if (settings.systemPrompt) {
            options.systemPrompt = settings.systemPrompt
        } else {
            // 預設使用 claude_code preset
            options.systemPrompt = { type: 'preset', preset: 'claude_code' }
        }

        // Allowed Tools
        if (settings.allowedTools) {
            options.allowedTools = settings.allowedTools
        }

        // Disallowed Tools
        if (settings.disallowedTools) {
            options.disallowedTools = settings.disallowedTools
        }

        // Agents
        if (settings.agents) {
            options.agents = settings.agents
        }

        // MCP Servers
        if (settings.mcpServers) {
            options.mcpServers = settings.mcpServers
        }

        // Hooks
        if (settings.hooks) {
            options.hooks = settings.hooks
        }

        // Setting Sources
        if (settings.settingSources) {
            options.settingSources = settings.settingSources
        } else {
            // 預設值為 ['project']
            options.settingSources = ['project']
        }

        return options
    }

    /**
     * 檢查工作空間是否存在
     * @param workspacePath 工作空間路徑
     * @returns 是否存在
     */
    hasSettings(workspacePath: string): boolean {
        return this.db.getSettings(workspacePath) !== null
    }

    /**
     * 取得資料庫實例（用於 API routes）
     * @returns DatabaseService 實例
     */
    getDatabase(): DatabaseService {
        return this.db
    }

    /**
     * 關閉服務
     */
    close(): void {
        this.db.close()
    }
}
