/**
 * Settings Routes
 * 工作空間設定的 CRUD API 端點
 */

import { Elysia } from 'elysia'
import type { DatabaseService } from '../services/database.service'
import {
    CreateSettingsSchema,
    UpdateSettingsSchema,
    WorkspacePathParamSchema
} from '../schemas/settings.schema'

export const createSettingsRoutes = (db: DatabaseService) => new Elysia({ prefix: '/api/workspaces' })

    /**
     * POST /api/workspaces
     * 建立工作空間設定
     */
    .post('/', async ({ body, set, log, requestId }) => {
        try {
            const settings = db.createSettings(body)
            set.status = 201

            log.info(
                {
                    event: 'settings_created',
                    requestId,
                    workspacePath: body.workspacePath
                },
                'Workspace settings created'
            )

            return {
                success: true,
                data: settings
            }
        } catch (error: any) {
            set.status = 400

            log.error(
                {
                    event: 'settings_create_error',
                    requestId,
                    workspacePath: body.workspacePath,
                    error: error.message
                },
                'Failed to create workspace settings'
            )

            return {
                success: false,
                error: error.message || 'Failed to create workspace settings'
            }
        }
    }, {
        body: CreateSettingsSchema,
        detail: {
            summary: '建立工作空間設定',
            description: '建立新的工作空間設定，workspacePath 必須唯一',
            tags: ['Settings']
        }
    })

    /**
     * GET /api/workspaces/:path
     * 取得工作空間設定（:path 是 URL encoded）
     */
    .get('/:path', async ({ params, set, log, requestId }) => {
        try {
            const workspacePath = decodeURIComponent(params.path)
            const settings = db.getSettings(workspacePath)

            if (!settings) {
                set.status = 404

                log.warn(
                    {
                        event: 'workspace_not_found',
                        requestId,
                        workspacePath
                    },
                    'Workspace not found'
                )

                return {
                    success: false,
                    error: `Workspace not found: ${workspacePath}`
                }
            }

            log.info(
                {
                    event: 'settings_retrieved',
                    requestId,
                    workspacePath
                },
                'Workspace settings retrieved'
            )

            return {
                success: true,
                data: settings
            }
        } catch (error: any) {
            set.status = 500

            log.error(
                {
                    event: 'settings_get_error',
                    requestId,
                    workspacePath: params.path,
                    error: error.message
                },
                'Failed to get workspace settings'
            )

            return {
                success: false,
                error: error.message || 'Failed to get workspace settings'
            }
        }
    }, {
        params: WorkspacePathParamSchema,
        detail: {
            summary: '取得工作空間設定',
            description: '根據 workspacePath 取得設定（需要 URL encode）',
            tags: ['Settings']
        }
    })

    /**
     * PUT /api/workspaces/:path
     * 更新工作空間設定
     */
    .put('/:path', async ({ params, body, set, log, requestId }) => {
        try {
            const workspacePath = decodeURIComponent(params.path)
            const settings = db.updateSettings(workspacePath, body)

            log.info(
                {
                    event: 'settings_updated',
                    requestId,
                    workspacePath,
                    updatedFields: Object.keys(body)
                },
                'Workspace settings updated'
            )

            return {
                success: true,
                data: settings
            }
        } catch (error: any) {
            const statusCode = error.message.includes('not found') ? 404 : 400
            set.status = statusCode

            log.error(
                {
                    event: 'settings_update_error',
                    requestId,
                    workspacePath: params.path,
                    error: error.message,
                    statusCode
                },
                'Failed to update workspace settings'
            )

            return {
                success: false,
                error: error.message || 'Failed to update workspace settings'
            }
        }
    }, {
        params: WorkspacePathParamSchema,
        body: UpdateSettingsSchema,
        detail: {
            summary: '更新工作空間設定',
            description: '更新指定工作空間的設定',
            tags: ['Settings']
        }
    })

    /**
     * DELETE /api/workspaces/:path
     * 刪除工作空間設定
     */
    .delete('/:path', async ({ params, set, log, requestId }) => {
        try {
            const workspacePath = decodeURIComponent(params.path)
            const deleted = db.deleteSettings(workspacePath)

            if (!deleted) {
                set.status = 404

                log.warn(
                    {
                        event: 'workspace_not_found',
                        requestId,
                        workspacePath,
                        operation: 'delete'
                    },
                    'Workspace not found for deletion'
                )

                return {
                    success: false,
                    error: `Workspace not found: ${workspacePath}`
                }
            }

            log.info(
                {
                    event: 'settings_deleted',
                    requestId,
                    workspacePath
                },
                'Workspace settings deleted'
            )

            return {
                success: true,
                message: 'Workspace deleted successfully'
            }
        } catch (error: any) {
            set.status = 500

            log.error(
                {
                    event: 'settings_delete_error',
                    requestId,
                    workspacePath: params.path,
                    error: error.message
                },
                'Failed to delete workspace settings'
            )

            return {
                success: false,
                error: error.message || 'Failed to delete workspace settings'
            }
        }
    }, {
        params: WorkspacePathParamSchema,
        detail: {
            summary: '刪除工作空間設定',
            description: '刪除指定工作空間的設定（CASCADE 刪除）',
            tags: ['Settings']
        }
    })

    /**
     * GET /api/workspaces
     * 列出所有工作空間
     */
    .get('/', async ({ log, requestId }) => {
        try {
            const workspaces = db.listWorkspaces()

            log.info(
                {
                    event: 'list_workspaces',
                    requestId,
                    count: workspaces.length
                },
                'Listed all workspaces'
            )

            return {
                success: true,
                data: workspaces,
                count: workspaces.length
            }
        } catch (error: any) {
            log.error(
                {
                    event: 'list_workspaces_error',
                    requestId,
                    error: error.message
                },
                'Failed to list workspaces'
            )

            return {
                success: false,
                error: error.message || 'Failed to list workspaces'
            }
        }
    }, {
        detail: {
            summary: '列出所有工作空間',
            description: '取得所有工作空間的清單（按更新時間排序）',
            tags: ['Settings']
        }
    })
