/**
 * Session Routes
 * Session 查詢和管理的 API 端點
 */

import { Elysia } from 'elysia'
import type { DatabaseService } from '../services/database.service'
import {
    ListSessionsQuerySchema,
    SessionIdParamSchema,
    ListMessagesQuerySchema,
    SessionStatsQuerySchema,
    DeleteSessionParamSchema
} from '../schemas/session.schema'

export const createSessionRoutes = (db: DatabaseService) => {
    const sessionService = db.sessionService

    return new Elysia({ prefix: '/api/sessions' })
        /**
         * GET /api/sessions
         * 列出 sessions（支援篩選、分頁、排序）
         */
        .get(
            '/',
            async ({ query, set, log, fileLogger, requestId }) => {
                try {
                    const {
                        workspace_path,
                        status,
                        limit = 50,
                        offset = 0,
                        order_by = 'created_at',
                        order = 'desc'
                    } = query

                    const result = sessionService.listSessions({
                        workspace_path,
                        status,
                        limit,
                        offset,
                        order_by,
                        order
                    })

                    const listLog = {
                        event: 'sessions_listed',
                        requestId,
                        workspace_path,
                        status,
                        total: result.total,
                        returned: result.sessions.length
                    }
                    log.info(listLog, 'Sessions listed')
                    fileLogger.info(listLog, 'Sessions listed')

                    return {
                        success: true,
                        data: {
                            sessions: result.sessions,
                            total: result.total,
                            limit,
                            offset
                        }
                    }
                } catch (error: any) {
                    set.status = 500

                    const errorLog = {
                        event: 'sessions_list_error',
                        requestId,
                        error: error.message
                    }
                    log.error(errorLog, 'Failed to list sessions')
                    fileLogger.error(errorLog, 'Failed to list sessions')

                    return {
                        success: false,
                        error: error.message || 'Failed to list sessions'
                    }
                }
            },
            {
                query: ListSessionsQuerySchema,
                detail: {
                    summary: '列出 Sessions',
                    description: '查詢 session 列表，支援篩選、分頁和排序',
                    tags: ['Sessions']
                }
            }
        )

        /**
         * GET /api/sessions/stats
         * 取得 Session 統計資訊
         */
        .get(
            '/stats',
            async ({ query, set, log, fileLogger, requestId }) => {
                try {
                    const { workspace_path, date_from, date_to } = query

                    const dateRange =
                        date_from || date_to
                            ? {
                                  from: date_from,
                                  to: date_to
                              }
                            : undefined

                    const stats = sessionService.getSessionStats(workspace_path, dateRange)

                    const statsLog = {
                        event: 'session_stats_retrieved',
                        requestId,
                        workspace_path,
                        total_sessions: stats.total_sessions
                    }
                    log.info(statsLog, 'Session stats retrieved')
                    fileLogger.info(statsLog, 'Session stats retrieved')

                    return {
                        success: true,
                        data: stats
                    }
                } catch (error: any) {
                    set.status = 500

                    const errorLog = {
                        event: 'session_stats_error',
                        requestId,
                        error: error.message
                    }
                    log.error(errorLog, 'Failed to get session stats')
                    fileLogger.error(errorLog, 'Failed to get session stats')

                    return {
                        success: false,
                        error: error.message || 'Failed to get session stats'
                    }
                }
            },
            {
                query: SessionStatsQuerySchema,
                detail: {
                    summary: '取得統計資訊',
                    description: '取得 session 的統計資訊（總數、成本、工具使用等）',
                    tags: ['Sessions']
                }
            }
        )

        /**
         * GET /api/sessions/:session_id
         * 取得單一 session 詳情
         */
        .get(
            '/:session_id',
            async ({ params, set, log, fileLogger, requestId }) => {
                try {
                    const { session_id } = params
                    const session = sessionService.getSession(session_id)

                    if (!session) {
                        set.status = 404

                        const notFoundLog = {
                            event: 'session_not_found',
                            requestId,
                            session_id
                        }
                        log.warn(notFoundLog, 'Session not found')
                        fileLogger.warn(notFoundLog, 'Session not found')

                        return {
                            success: false,
                            error: `Session not found: ${session_id}`
                        }
                    }

                    const retrievedLog = {
                        event: 'session_retrieved',
                        requestId,
                        session_id,
                        status: session.status
                    }
                    log.info(retrievedLog, 'Session retrieved')
                    fileLogger.info(retrievedLog, 'Session retrieved')

                    return {
                        success: true,
                        data: session
                    }
                } catch (error: any) {
                    set.status = 500

                    const errorLog = {
                        event: 'session_get_error',
                        requestId,
                        session_id: params.session_id,
                        error: error.message
                    }
                    log.error(errorLog, 'Failed to get session')
                    fileLogger.error(errorLog, 'Failed to get session')

                    return {
                        success: false,
                        error: error.message || 'Failed to get session'
                    }
                }
            },
            {
                params: SessionIdParamSchema,
                detail: {
                    summary: '取得 Session 詳情',
                    description: '根據 session_id 取得完整的 session 資訊',
                    tags: ['Sessions']
                }
            }
        )

        /**
         * GET /api/sessions/:session_id/messages
         * 取得 session 的所有訊息
         */
        .get(
            '/:session_id/messages',
            async ({ params, query, set, log, fileLogger, requestId }) => {
                try {
                    const { session_id } = params
                    const { message_type, limit = 100, offset = 0 } = query

                    // 先確認 session 是否存在
                    const session = sessionService.getSession(session_id)
                    if (!session) {
                        set.status = 404

                        const notFoundLog = {
                            event: 'session_not_found',
                            requestId,
                            session_id
                        }
                        log.warn(notFoundLog, 'Session not found')
                        fileLogger.warn(notFoundLog, 'Session not found')

                        return {
                            success: false,
                            error: `Session not found: ${session_id}`
                        }
                    }

                    const result = sessionService.getSessionMessages(session_id, {
                        message_type,
                        limit,
                        offset
                    })

                    const messagesLog = {
                        event: 'session_messages_retrieved',
                        requestId,
                        session_id,
                        message_type,
                        total: result.total,
                        returned: result.messages.length
                    }
                    log.info(messagesLog, 'Session messages retrieved')
                    fileLogger.info(messagesLog, 'Session messages retrieved')

                    return {
                        success: true,
                        data: {
                            messages: result.messages,
                            total: result.total
                        }
                    }
                } catch (error: any) {
                    set.status = 500

                    const errorLog = {
                        event: 'session_messages_error',
                        requestId,
                        session_id: params.session_id,
                        error: error.message
                    }
                    log.error(errorLog, 'Failed to get session messages')
                    fileLogger.error(errorLog, 'Failed to get session messages')

                    return {
                        success: false,
                        error: error.message || 'Failed to get session messages'
                    }
                }
            },
            {
                params: SessionIdParamSchema,
                query: ListMessagesQuerySchema,
                detail: {
                    summary: '取得 Session 訊息',
                    description: '取得指定 session 的所有訊息記錄',
                    tags: ['Sessions']
                }
            }
        )

        /**
         * DELETE /api/sessions/:session_id
         * 刪除 session（CASCADE 刪除所有 messages）
         */
        .delete(
            '/:session_id',
            async ({ params, set, log, fileLogger, requestId }) => {
                try {
                    const { session_id } = params

                    // 先確認 session 是否存在
                    const session = sessionService.getSession(session_id)
                    if (!session) {
                        set.status = 404

                        const notFoundLog = {
                            event: 'session_not_found',
                            requestId,
                            session_id,
                            operation: 'delete'
                        }
                        log.warn(notFoundLog, 'Session not found for deletion')
                        fileLogger.warn(notFoundLog, 'Session not found for deletion')

                        return {
                            success: false,
                            error: `Session not found: ${session_id}`
                        }
                    }

                    const deleted = sessionService.deleteSession(session_id)

                    if (deleted) {
                        const deleteLog = {
                            event: 'session_deleted',
                            requestId,
                            session_id,
                            message_count: session.message_count
                        }
                        log.info(deleteLog, 'Session deleted')
                        fileLogger.info(deleteLog, 'Session deleted')

                        return {
                            success: true,
                            message: 'Session deleted successfully'
                        }
                    } else {
                        set.status = 500

                        const errorLog = {
                            event: 'session_delete_failed',
                            requestId,
                            session_id
                        }
                        log.error(errorLog, 'Failed to delete session')
                        fileLogger.error(errorLog, 'Failed to delete session')

                        return {
                            success: false,
                            error: 'Failed to delete session'
                        }
                    }
                } catch (error: any) {
                    set.status = 500

                    const errorLog = {
                        event: 'session_delete_error',
                        requestId,
                        session_id: params.session_id,
                        error: error.message
                    }
                    log.error(errorLog, 'Error deleting session')
                    fileLogger.error(errorLog, 'Error deleting session')

                    return {
                        success: false,
                        error: error.message || 'Failed to delete session'
                    }
                }
            },
            {
                params: DeleteSessionParamSchema,
                detail: {
                    summary: '刪除 Session',
                    description: '刪除指定 session 及其所有訊息（CASCADE 刪除）',
                    tags: ['Sessions']
                }
            }
        )
}
