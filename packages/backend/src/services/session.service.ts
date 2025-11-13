// @ts-nocheck - SDK 型別定義問題待修復

import { Database } from 'bun:sqlite'
import type {
    Session,
    SessionMessage,
    CreateSessionData,
    SessionResult,
    ListSessionsOptions,
    ListMessagesOptions,
    SessionStats,
    DateRange
} from '@workspace/shared'
import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk'
import { logger } from '../utils/logger'

/**
 * Session 管理服務
 * 負責 Session 和 Message 的 CRUD 操作
 */
export class SessionService {
    constructor(private db: Database) {
        this.migrateIfNeeded()
        this.initializeTables()
    }

    /**
     * 資料庫遷移：修復外鍵約束
     */
    private migrateIfNeeded() {
        try {
            // 檢查是否需要遷移（檢查外鍵是否正確）
            const foreignKeys = this.db.query(`PRAGMA foreign_key_list(sessions)`).all() as any[]
            const needMigration = foreignKeys.some(
                fk => fk.table === 'workspace_settings' && fk.to === 'workspacePath'
            )

            if (needMigration) {
                logger.info({ event: 'db_migration_start' }, 'Starting database migration to fix foreign key')

                // 關閉外鍵約束
                this.db.run('PRAGMA foreign_keys = OFF')

                // 開始交易
                this.db.run('BEGIN TRANSACTION')

                try {
                    // 1. 備份現有資料
                    this.db.run(`CREATE TABLE sessions_backup AS SELECT * FROM sessions`)
                    this.db.run(`CREATE TABLE session_messages_backup AS SELECT * FROM session_messages`)

                    // 2. 刪除舊表格
                    this.db.run(`DROP TABLE IF EXISTS session_messages`)
                    this.db.run(`DROP TABLE IF EXISTS sessions`)

                    // 3. 重建表格（使用正確的外鍵）
                    this.createSessionsTables()

                    // 4. 還原資料
                    this.db.run(`
                        INSERT INTO sessions SELECT * FROM sessions_backup
                    `)
                    this.db.run(`
                        INSERT INTO session_messages SELECT * FROM session_messages_backup
                    `)

                    // 5. 刪除備份表格
                    this.db.run(`DROP TABLE sessions_backup`)
                    this.db.run(`DROP TABLE session_messages_backup`)

                    // 提交交易
                    this.db.run('COMMIT')

                    logger.info({ event: 'db_migration_complete' }, 'Database migration completed successfully')
                } catch (error) {
                    // 回滾交易
                    this.db.run('ROLLBACK')
                    throw error
                } finally {
                    // 重新啟用外鍵約束
                    this.db.run('PRAGMA foreign_keys = ON')
                }
            }
        } catch (error: any) {
            // 如果表格不存在，跳過遷移
            if (!error.message.includes('no such table')) {
                logger.error({ event: 'db_migration_error', error: error.message }, 'Migration failed')
            }
        }
    }

    /**
     * 建立 sessions 和 session_messages 表格
     */
    private createSessionsTables() {
        // 建立 sessions 表
        this.db.run(`
            CREATE TABLE IF NOT EXISTS sessions (
                session_id TEXT PRIMARY KEY,
                workspace_path TEXT NOT NULL,

                -- Session 基本資訊
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now')),
                completed_at TEXT,

                -- Session 狀態
                status TEXT NOT NULL DEFAULT 'running',

                -- 初始配置 (來自 system.init message)
                model TEXT,
                permission_mode TEXT,
                cwd TEXT,
                tools TEXT,              -- JSON array of tool names
                mcp_servers TEXT,        -- JSON array of MCP server info

                -- 執行結果 (來自 result message)
                total_cost_usd REAL DEFAULT 0,
                num_turns INTEGER DEFAULT 0,
                duration_ms INTEGER,
                duration_api_ms INTEGER,
                is_error INTEGER DEFAULT 0,
                error_message TEXT,

                -- 使用統計
                message_count INTEGER DEFAULT 0,

                FOREIGN KEY (workspace_path) REFERENCES workspace_settings(workspace_path) ON DELETE CASCADE
            )
        `)

        // 建立 session_messages 表
        this.db.run(`
            CREATE TABLE IF NOT EXISTS session_messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL,

                -- Message 識別
                uuid TEXT NOT NULL UNIQUE,
                message_type TEXT NOT NULL,
                message_subtype TEXT,

                -- Message 內容
                message_content TEXT NOT NULL,

                -- Tool 使用記錄
                tools_used TEXT,

                -- 時間戳
                created_at TEXT NOT NULL DEFAULT (datetime('now')),

                FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
            )
        `)

        // 建立索引
        this.db.run(`
            CREATE INDEX IF NOT EXISTS idx_sessions_workspace_created
            ON sessions(workspace_path, created_at DESC)
        `)
        this.db.run(`
            CREATE INDEX IF NOT EXISTS idx_sessions_status
            ON sessions(status)
        `)
        this.db.run(`
            CREATE INDEX IF NOT EXISTS idx_sessions_updated
            ON sessions(updated_at DESC)
        `)
        this.db.run(`
            CREATE INDEX IF NOT EXISTS idx_messages_session_created
            ON session_messages(session_id, created_at)
        `)
        this.db.run(`
            CREATE INDEX IF NOT EXISTS idx_messages_type
            ON session_messages(message_type)
        `)
        this.db.run(`
            CREATE INDEX IF NOT EXISTS idx_messages_uuid
            ON session_messages(uuid)
        `)

        // 建立觸發器：自動更新 sessions.updated_at
        this.db.run(`
            CREATE TRIGGER IF NOT EXISTS update_sessions_timestamp
            AFTER UPDATE ON sessions
            BEGIN
                UPDATE sessions
                SET updated_at = datetime('now')
                WHERE session_id = NEW.session_id;
            END
        `)

        // 建立觸發器：自動更新 sessions.message_count
        this.db.run(`
            CREATE TRIGGER IF NOT EXISTS increment_message_count
            AFTER INSERT ON session_messages
            BEGIN
                UPDATE sessions
                SET message_count = message_count + 1,
                    updated_at = datetime('now')
                WHERE session_id = NEW.session_id;
            END
        `)

        logger.debug({ event: 'sessions_tables_initialized' }, 'Sessions tables initialized')
    }

    /**
     * 初始化資料庫表格（包裝方法）
     */
    private initializeTables() {
        this.createSessionsTables()
    }

    /**
     * 建立 Session
     */
    createSession(data: CreateSessionData): Session {
        try {
            this.db.run(
                `INSERT INTO sessions (
                    session_id, workspace_path, model, permission_mode,
                    cwd, tools, mcp_servers
                ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                    data.session_id,
                    data.workspace_path,
                    data.model || null,
                    data.permission_mode || null,
                    data.cwd || null,
                    data.tools || null,
                    data.mcp_servers || null
                ]
            )

            logger.debug(
                { event: 'session_created', session_id: data.session_id },
                'Session created'
            )

            const session = this.getSession(data.session_id)
            if (!session) {
                throw new Error('Failed to create session')
            }

            return session
        } catch (error: any) {
            logger.error(
                { event: 'session_create_error', session_id: data.session_id, error: error.message },
                'Failed to create session'
            )
            throw error
        }
    }

    /**
     * 取得 Session
     */
    getSession(sessionId: string): Session | null {
        try {
            const session = this.db
                .query<Session, [string]>(`SELECT * FROM sessions WHERE session_id = ?`)
                .get(sessionId)

            return session || null
        } catch (error: any) {
            logger.error(
                { event: 'session_get_error', session_id: sessionId, error: error.message },
                'Failed to get session'
            )
            return null
        }
    }

    /**
     * 更新 Session 狀態
     */
    updateSessionStatus(sessionId: string, status: string): void {
        try {
            this.db.run(`UPDATE sessions SET status = ? WHERE session_id = ?`, [status, sessionId])

            logger.debug(
                { event: 'session_status_updated', session_id: sessionId, status },
                'Session status updated'
            )
        } catch (error: any) {
            logger.error(
                {
                    event: 'session_status_update_error',
                    session_id: sessionId,
                    error: error.message
                },
                'Failed to update session status'
            )
        }
    }

    /**
     * 更新 Session 結果
     */
    updateSessionResult(sessionId: string, result: SessionResult): void {
        try {
            const updates: string[] = []
            const values: any[] = []

            if (result.status !== undefined) {
                updates.push('status = ?')
                values.push(result.status)
            }
            if (result.total_cost_usd !== undefined) {
                updates.push('total_cost_usd = ?')
                values.push(result.total_cost_usd)
            }
            if (result.num_turns !== undefined) {
                updates.push('num_turns = ?')
                values.push(result.num_turns)
            }
            if (result.duration_ms !== undefined) {
                updates.push('duration_ms = ?')
                values.push(result.duration_ms)
            }
            if (result.duration_api_ms !== undefined) {
                updates.push('duration_api_ms = ?')
                values.push(result.duration_api_ms)
            }
            if (result.is_error !== undefined) {
                updates.push('is_error = ?')
                values.push(result.is_error ? 1 : 0)
            }
            if (result.error_message !== undefined) {
                updates.push('error_message = ?')
                values.push(result.error_message)
            }
            if (result.completed_at !== undefined) {
                updates.push('completed_at = ?')
                values.push(result.completed_at)
            }

            if (updates.length > 0) {
                values.push(sessionId)
                this.db.run(
                    `UPDATE sessions SET ${updates.join(', ')} WHERE session_id = ?`,
                    values
                )

                logger.debug(
                    { event: 'session_result_updated', session_id: sessionId },
                    'Session result updated'
                )
            }
        } catch (error: any) {
            logger.error(
                {
                    event: 'session_result_update_error',
                    session_id: sessionId,
                    error: error.message
                },
                'Failed to update session result'
            )
        }
    }

    /**
     * 列出 Sessions
     */
    listSessions(options: ListSessionsOptions = {}): { sessions: Session[]; total: number } {
        try {
            const {
                workspace_path,
                status,
                limit = 50,
                offset = 0,
                order_by = 'created_at',
                order = 'desc'
            } = options

            // 建立查詢條件
            const conditions: string[] = []
            const values: any[] = []

            if (workspace_path) {
                conditions.push('workspace_path = ?')
                values.push(workspace_path)
            }
            if (status) {
                conditions.push('status = ?')
                values.push(status)
            }

            const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

            // 查詢總數
            const totalQuery = `SELECT COUNT(*) as count FROM sessions ${whereClause}`
            const totalResult = this.db.query<{ count: number }, any[]>(totalQuery).get(...values)
            const total = totalResult?.count || 0

            // 查詢資料
            const dataQuery = `
                SELECT * FROM sessions
                ${whereClause}
                ORDER BY ${order_by} ${order.toUpperCase()}
                LIMIT ? OFFSET ?
            `
            const sessions = this.db.query<Session, any[]>(dataQuery).all(...values, limit, offset)

            return { sessions, total }
        } catch (error: any) {
            logger.error(
                { event: 'sessions_list_error', error: error.message },
                'Failed to list sessions'
            )
            return { sessions: [], total: 0 }
        }
    }

    /**
     * 刪除 Session（CASCADE 刪除所有 messages）
     */
    deleteSession(sessionId: string): boolean {
        try {
            this.db.run(`DELETE FROM sessions WHERE session_id = ?`, [sessionId])

            logger.debug({ event: 'session_deleted', session_id: sessionId }, 'Session deleted')

            return true
        } catch (error: any) {
            logger.error(
                { event: 'session_delete_error', session_id: sessionId, error: error.message },
                'Failed to delete session'
            )
            return false
        }
    }

    /**
     * 新增 Message
     */
    addMessage(sessionId: string, message: SDKMessage): void {
        try {
            // 提取工具使用
            const toolsUsed = this.extractToolsUsed(message)

            this.db.run(
                `INSERT INTO session_messages (
                    session_id, uuid, message_type, message_subtype,
                    message_content, tools_used
                ) VALUES (?, ?, ?, ?, ?, ?)`,
                [
                    sessionId,
                    message.uuid || `msg_${Date.now()}`,
                    message.type,
                    message.subtype || null,
                    JSON.stringify(message),
                    toolsUsed.length > 0 ? JSON.stringify(toolsUsed) : null
                ]
            )

            logger.debug(
                {
                    event: 'message_added',
                    session_id: sessionId,
                    message_type: message.type,
                    tools_count: toolsUsed.length
                },
                'Message added to session'
            )
        } catch (error: any) {
            logger.error(
                {
                    event: 'message_add_error',
                    session_id: sessionId,
                    message_type: message.type,
                    error: error.message
                },
                'Failed to add message'
            )
        }
    }

    /**
     * 取得 Session 的所有 Messages
     */
    getSessionMessages(
        sessionId: string,
        options: ListMessagesOptions = {}
    ): { messages: SessionMessage[]; total: number } {
        try {
            const { message_type, limit = 100, offset = 0 } = options

            // 建立查詢條件
            const conditions: string[] = ['session_id = ?']
            const values: any[] = [sessionId]

            if (message_type) {
                conditions.push('message_type = ?')
                values.push(message_type)
            }

            const whereClause = conditions.join(' AND ')

            // 查詢總數
            const totalQuery = `SELECT COUNT(*) as count FROM session_messages WHERE ${whereClause}`
            const totalResult = this.db.query<{ count: number }, any[]>(totalQuery).get(...values)
            const total = totalResult?.count || 0

            // 查詢資料
            const dataQuery = `
                SELECT * FROM session_messages
                WHERE ${whereClause}
                ORDER BY created_at ASC
                LIMIT ? OFFSET ?
            `
            const messages = this.db
                .query<SessionMessage, any[]>(dataQuery)
                .all(...values, limit, offset)

            return { messages, total }
        } catch (error: any) {
            logger.error(
                {
                    event: 'messages_get_error',
                    session_id: sessionId,
                    error: error.message
                },
                'Failed to get session messages'
            )
            return { messages: [], total: 0 }
        }
    }

    /**
     * 取得 Session 統計
     */
    getSessionStats(workspacePath?: string, dateRange?: DateRange): SessionStats {
        try {
            const conditions: string[] = []
            const values: any[] = []

            if (workspacePath) {
                conditions.push('workspace_path = ?')
                values.push(workspacePath)
            }
            if (dateRange?.from) {
                conditions.push('created_at >= ?')
                values.push(dateRange.from)
            }
            if (dateRange?.to) {
                conditions.push('created_at <= ?')
                values.push(dateRange.to)
            }

            const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

            // 基本統計
            const statsQuery = `
                SELECT
                    COUNT(*) as total_sessions,
                    SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_sessions,
                    SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as error_sessions,
                    SUM(total_cost_usd) as total_cost_usd,
                    SUM(num_turns) as total_turns,
                    AVG(duration_ms) as average_duration_ms
                FROM sessions
                ${whereClause}
            `
            const stats = this.db.query<any, any[]>(statsQuery).get(...values)

            // 最常使用的工具
            const toolMessages = this.db.query<{ tools_used: string }, any[]>(
                `SELECT sm.tools_used
                 FROM session_messages sm
                 JOIN sessions s ON sm.session_id = s.session_id
                 ${whereClause}
                 AND sm.tools_used IS NOT NULL`
            ).all(...values)

            // 統計工具使用次數
            const toolCounts: Map<string, number> = new Map()
            toolMessages.forEach((msg) => {
                try {
                    const tools = JSON.parse(msg.tools_used) as string[]
                    tools.forEach((tool) => {
                        toolCounts.set(tool, (toolCounts.get(tool) || 0) + 1)
                    })
                } catch (e) {
                    // 忽略解析錯誤
                }
            })

            const most_used_tools = Array.from(toolCounts.entries())
                .map(([tool, count]) => ({ tool, count }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 10)

            return {
                total_sessions: stats?.total_sessions || 0,
                completed_sessions: stats?.completed_sessions || 0,
                error_sessions: stats?.error_sessions || 0,
                total_cost_usd: stats?.total_cost_usd || 0,
                total_turns: stats?.total_turns || 0,
                average_duration_ms: stats?.average_duration_ms || 0,
                most_used_tools
            }
        } catch (error: any) {
            logger.error(
                { event: 'stats_get_error', error: error.message },
                'Failed to get session stats'
            )
            return {
                total_sessions: 0,
                completed_sessions: 0,
                error_sessions: 0,
                total_cost_usd: 0,
                total_turns: 0,
                average_duration_ms: 0,
                most_used_tools: []
            }
        }
    }

    /**
     * 從 Message 中提取使用的工具
     */
    private extractToolsUsed(message: SDKMessage): string[] {
        if (message.type !== 'assistant') return []

        const tools: Set<string> = new Set()
        const content = message.message?.content

        if (Array.isArray(content)) {
            content.forEach((block) => {
                if (block.type === 'tool_use' && block.name) {
                    tools.add(block.name)
                }
            })
        }

        return Array.from(tools)
    }

    /**
     * 清理超時的 running sessions
     */
    cleanupStuckSessions(timeoutHours: number = 24): number {
        try {
            const result = this.db.run(
                `UPDATE sessions
                 SET status = 'interrupted'
                 WHERE status = 'running'
                 AND datetime(created_at, '+' || ? || ' hours') < datetime('now')`,
                [timeoutHours]
            )

            const cleaned = result.changes

            if (cleaned > 0) {
                logger.info(
                    { event: 'sessions_cleaned', count: cleaned, timeout_hours: timeoutHours },
                    'Cleaned up stuck sessions'
                )
            }

            return cleaned
        } catch (error: any) {
            logger.error(
                { event: 'cleanup_error', error: error.message },
                'Failed to cleanup stuck sessions'
            )
            return 0
        }
    }
}
