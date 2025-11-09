/**
 * Database Service
 * 使用 Bun SQLite 管理工作空間設定的 CRUD 操作
 */

import { Database } from 'bun:sqlite'
import type { WorkspaceSettings, WorkspaceSettingsRow, WorkspaceListItem } from '@workspace/shared'
import { logger } from '../utils/logger'
import { SessionService } from './session.service'
import { existsSync, mkdirSync } from 'fs'
import { dirname, resolve } from 'path'

export class DatabaseService {
    private db: Database
    private _sessionService: SessionService | null = null

    constructor(dbPath: string = './data/settings.db') {
        // 確保資料庫目錄存在（跨平台兼容）
        const absolutePath = resolve(dbPath)
        const dirPath = dirname(absolutePath)

        if (!existsSync(dirPath)) {
            mkdirSync(dirPath, { recursive: true })
            logger.debug({ event: 'db_dir_created', path: dirPath }, 'Database directory created')
        }

        this.db = new Database(dbPath, { create: true })
        logger.info({ event: 'db_connecting', path: dbPath }, 'Connecting to database')

        // 啟用外鍵約束
        this.db.run('PRAGMA foreign_keys = ON')
        logger.debug({ event: 'db_foreign_keys_enabled' }, 'Foreign keys enabled')

        this.initialize()
    }

    /**
     * 取得 SessionService 實例
     */
    get sessionService(): SessionService {
        if (!this._sessionService) {
            this._sessionService = new SessionService(this.db)
        }
        return this._sessionService
    }

    /**
     * 初始化資料庫（建立表格、索引、觸發器）
     */
    private initialize(): void {
        logger.debug({ event: 'db_initialize_start' }, 'Initializing database schema')

        // 建立 workspaces 表
        this.db.query(`
            CREATE TABLE IF NOT EXISTS workspaces (
                workspace_path TEXT PRIMARY KEY,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            )
        `).run()

        // 建立 workspace_settings 表
        this.db.query(`
            CREATE TABLE IF NOT EXISTS workspace_settings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                workspace_path TEXT NOT NULL UNIQUE,
                system_prompt TEXT,
                allowed_tools TEXT,
                disallowed_tools TEXT,
                agents TEXT,
                mcp_servers TEXT,
                hooks TEXT,
                setting_sources TEXT DEFAULT '["project"]',
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY (workspace_path) REFERENCES workspaces(workspace_path) ON DELETE CASCADE
            )
        `).run()

        // 資料遷移：為現有表格新增 setting_sources 欄位（如果不存在）
        try {
            this.db.query(`
                ALTER TABLE workspace_settings
                ADD COLUMN setting_sources TEXT DEFAULT '["project"]'
            `).run()
            logger.debug({ event: 'db_migration_add_setting_sources' }, 'Added setting_sources column')
        } catch (error: any) {
            // 欄位已存在時會拋出錯誤，可以忽略
            if (!error.message.includes('duplicate column name')) {
                logger.warn({ event: 'db_migration_warning', error: error.message }, 'Migration warning')
            }
        }

        // 建立索引
        this.db.query(`
            CREATE INDEX IF NOT EXISTS idx_workspace_settings_workspace_path
            ON workspace_settings(workspace_path)
        `).run()

        this.db.query(`
            CREATE INDEX IF NOT EXISTS idx_workspace_settings_updated_at
            ON workspace_settings(updated_at DESC)
        `).run()

        // 建立觸發器（自動更新 updated_at）
        this.db.query(`
            CREATE TRIGGER IF NOT EXISTS update_workspace_settings_timestamp
            AFTER UPDATE ON workspace_settings
            BEGIN
                UPDATE workspace_settings
                SET updated_at = datetime('now')
                WHERE id = NEW.id;
            END
        `).run()

        logger.debug({ event: 'db_initialize_complete' }, 'Database schema initialized')
    }

    /**
     * 建立工作空間設定
     */
    createSettings(settings: WorkspaceSettings): WorkspaceSettings {
        logger.debug({ event: 'db_create', workspacePath: settings.workspacePath }, 'Creating workspace settings')

        const transaction = this.db.transaction(() => {
            // 1. 建立 workspace
            this.db.query(`
                INSERT OR IGNORE INTO workspaces (workspace_path)
                VALUES (?)
            `).run(settings.workspacePath)

            // 2. 建立 settings
            this.db.query(`
                INSERT INTO workspace_settings (
                    workspace_path, system_prompt, allowed_tools,
                    disallowed_tools, agents, mcp_servers, hooks, setting_sources
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                settings.workspacePath,
                settings.systemPrompt ?? null,
                settings.allowedTools ? JSON.stringify(settings.allowedTools) : null,
                settings.disallowedTools ? JSON.stringify(settings.disallowedTools) : null,
                settings.agents ? JSON.stringify(settings.agents) : null,
                settings.mcpServers ? JSON.stringify(settings.mcpServers) : null,
                settings.hooks ? JSON.stringify(settings.hooks) : null,
                settings.settingSources ? JSON.stringify(settings.settingSources) : JSON.stringify(['project'])
            )

            // 3. 查詢完整資料
            const row = this.db.query<WorkspaceSettingsRow, [string]>(`
                SELECT * FROM workspace_settings WHERE workspace_path = ?
            `).get(settings.workspacePath)

            return this.rowToSettings(row!)
        })

        const result = transaction()
        logger.debug({ event: 'db_created', workspacePath: settings.workspacePath }, 'Workspace settings created')
        return result
    }

    /**
     * 取得工作空間設定
     */
    getSettings(workspacePath: string): WorkspaceSettings | null {
        logger.debug({ event: 'db_get', workspacePath }, 'Getting workspace settings')

        const row = this.db.query<WorkspaceSettingsRow, [string]>(`
            SELECT * FROM workspace_settings WHERE workspace_path = ?
        `).get(workspacePath)

        return row ? this.rowToSettings(row) : null
    }

    /**
     * 更新工作空間設定
     */
    updateSettings(workspacePath: string, updates: Partial<WorkspaceSettings>): WorkspaceSettings {
        logger.debug({ event: 'db_update', workspacePath, fields: Object.keys(updates) }, 'Updating workspace settings')

        const existing = this.getSettings(workspacePath)
        if (!existing) {
            logger.error({ event: 'db_update_not_found', workspacePath }, 'Workspace not found for update')
            throw new Error(`Workspace not found: ${workspacePath}`)
        }

        // 建立更新語句
        const fields: string[] = []
        const values: any[] = []

        if (updates.systemPrompt !== undefined) {
            fields.push('system_prompt = ?')
            values.push(updates.systemPrompt ?? null)
        }
        if (updates.allowedTools !== undefined) {
            fields.push('allowed_tools = ?')
            values.push(updates.allowedTools ? JSON.stringify(updates.allowedTools) : null)
        }
        if (updates.disallowedTools !== undefined) {
            fields.push('disallowed_tools = ?')
            values.push(updates.disallowedTools ? JSON.stringify(updates.disallowedTools) : null)
        }
        if (updates.agents !== undefined) {
            fields.push('agents = ?')
            values.push(updates.agents ? JSON.stringify(updates.agents) : null)
        }
        if (updates.mcpServers !== undefined) {
            fields.push('mcp_servers = ?')
            values.push(updates.mcpServers ? JSON.stringify(updates.mcpServers) : null)
        }
        if (updates.hooks !== undefined) {
            fields.push('hooks = ?')
            values.push(updates.hooks ? JSON.stringify(updates.hooks) : null)
        }
        if (updates.settingSources !== undefined) {
            fields.push('setting_sources = ?')
            values.push(updates.settingSources ? JSON.stringify(updates.settingSources) : JSON.stringify(['project']))
        }

        if (fields.length === 0) {
            return existing
        }

        values.push(workspacePath)

        this.db.query(`
            UPDATE workspace_settings
            SET ${fields.join(', ')}
            WHERE workspace_path = ?
        `).run(...values)

        logger.debug({ event: 'db_updated', workspacePath }, 'Workspace settings updated')
        return this.getSettings(workspacePath)!
    }

    /**
     * 刪除工作空間設定
     */
    deleteSettings(workspacePath: string): boolean {
        logger.debug({ event: 'db_delete', workspacePath }, 'Deleting workspace settings')

        const result = this.db.query(`
            DELETE FROM workspaces WHERE workspace_path = ?
        `).run(workspacePath)

        const deleted = result.changes > 0
        if (deleted) {
            logger.debug({ event: 'db_deleted', workspacePath }, 'Workspace settings deleted')
        } else {
            logger.debug({ event: 'db_delete_not_found', workspacePath }, 'Workspace not found for deletion')
        }

        return deleted
    }

    /**
     * 列出所有工作空間
     */
    listWorkspaces(): WorkspaceListItem[] {
        logger.debug({ event: 'db_list' }, 'Listing all workspaces')

        const rows = this.db.query<Pick<WorkspaceSettingsRow, 'workspace_path' | 'created_at' | 'updated_at'>, []>(`
            SELECT workspace_path, created_at, updated_at
            FROM workspace_settings
            ORDER BY updated_at DESC
        `).all()

        logger.debug({ event: 'db_listed', count: rows.length }, 'Listed all workspaces')

        return rows.map(row => ({
            workspacePath: row.workspace_path,
            createdAt: row.created_at,
            updatedAt: row.updated_at
        }))
    }

    /**
     * 轉換 DB row 為 WorkspaceSettings
     */
    private rowToSettings(row: WorkspaceSettingsRow): WorkspaceSettings {
        return {
            workspacePath: row.workspace_path,
            systemPrompt: row.system_prompt ?? undefined,
            allowedTools: row.allowed_tools ? JSON.parse(row.allowed_tools) : undefined,
            disallowedTools: row.disallowed_tools ? JSON.parse(row.disallowed_tools) : undefined,
            agents: row.agents ? JSON.parse(row.agents) : undefined,
            mcpServers: row.mcp_servers ? JSON.parse(row.mcp_servers) : undefined,
            hooks: row.hooks ? JSON.parse(row.hooks) : undefined,
            settingSources: row.setting_sources ? JSON.parse(row.setting_sources) : ['project'],
            createdAt: row.created_at,
            updatedAt: row.updated_at
        }
    }

    /**
     * 關閉資料庫連線
     */
    close(): void {
        this.db.close()
    }
}
