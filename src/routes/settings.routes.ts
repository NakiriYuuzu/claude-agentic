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
import { spawn } from 'child_process'

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

    /**
     * POST /api/workspaces/select-folder
     * 開啟系統原生資料夾選擇對話框
     */
    .post('/select-folder', async ({ set, log, requestId }) => {
        try {
            const platform = process.platform
            let folderPath: string | null = null

            log.info(
                {
                    event: 'select_folder_start',
                    requestId,
                    platform
                },
                'Opening folder selection dialog'
            )

            if (platform === 'darwin') {
                // macOS - 使用 osascript (AppleScript)
                folderPath = await new Promise((resolve, reject) => {
                    const script = `
                        tell application "System Events"
                            activate
                            set selectedFolder to choose folder with prompt "選擇工作空間資料夾"
                            return POSIX path of selectedFolder
                        end tell
                    `
                    const process = spawn('osascript', ['-e', script])
                    let output = ''
                    let error = ''

                    process.stdout.on('data', (data) => {
                        output += data.toString()
                    })

                    process.stderr.on('data', (data) => {
                        error += data.toString()
                    })

                    process.on('close', (code) => {
                        if (code === 0 && output.trim()) {
                            // 移除尾部斜線
                            const path = output.trim().replace(/\/$/, '')
                            resolve(path)
                        } else if (code === -128) {
                            // 使用者取消
                            resolve(null)
                        } else {
                            reject(new Error(error || 'Failed to select folder'))
                        }
                    })
                })
            } else if (platform === 'win32') {
                // Windows - 使用 PowerShell
                folderPath = await new Promise((resolve, reject) => {
                    const script = `
                        Add-Type -AssemblyName System.Windows.Forms
                        $folderBrowser = New-Object System.Windows.Forms.FolderBrowserDialog
                        $folderBrowser.Description = "選擇工作空間資料夾"
                        $folderBrowser.ShowNewFolderButton = $true
                        $result = $folderBrowser.ShowDialog()
                        if ($result -eq [System.Windows.Forms.DialogResult]::OK) {
                            Write-Output $folderBrowser.SelectedPath
                        }
                    `
                    const process = spawn('powershell', ['-Command', script])
                    let output = ''
                    let error = ''

                    process.stdout.on('data', (data) => {
                        output += data.toString()
                    })

                    process.stderr.on('data', (data) => {
                        error += data.toString()
                    })

                    process.on('close', (code) => {
                        if (code === 0 && output.trim()) {
                            resolve(output.trim())
                        } else {
                            resolve(null)
                        }
                    })
                })
            } else {
                // Linux - 使用 zenity (需要安裝)
                folderPath = await new Promise((resolve, reject) => {
                    const process = spawn('zenity', [
                        '--file-selection',
                        '--directory',
                        '--title=選擇工作空間資料夾'
                    ])
                    let output = ''
                    let error = ''

                    process.stdout.on('data', (data) => {
                        output += data.toString()
                    })

                    process.stderr.on('data', (data) => {
                        error += data.toString()
                    })

                    process.on('close', (code) => {
                        if (code === 0 && output.trim()) {
                            resolve(output.trim())
                        } else if (code === 1) {
                            // 使用者取消
                            resolve(null)
                        } else {
                            reject(new Error('zenity not installed. Please install zenity to use folder selection.'))
                        }
                    })
                })
            }

            if (folderPath) {
                log.info(
                    {
                        event: 'folder_selected',
                        requestId,
                        folderPath
                    },
                    'Folder selected successfully'
                )

                return {
                    success: true,
                    data: {
                        folderPath
                    }
                }
            } else {
                log.info(
                    {
                        event: 'folder_selection_cancelled',
                        requestId
                    },
                    'Folder selection cancelled by user'
                )

                return {
                    success: false,
                    cancelled: true,
                    message: 'Folder selection cancelled'
                }
            }
        } catch (error: any) {
            set.status = 500

            log.error(
                {
                    event: 'select_folder_error',
                    requestId,
                    error: error.message
                },
                'Failed to open folder selection dialog'
            )

            return {
                success: false,
                error: error.message || 'Failed to open folder selection dialog'
            }
        }
    }, {
        detail: {
            summary: '選擇資料夾',
            description: '開啟系統原生資料夾選擇對話框，返回使用者選擇的資料夾路徑',
            tags: ['Settings']
        }
    })
