/**
 * Workspace Store (Composition API / Setup Store)
 * 管理 Claude Agent SDK Workspace 狀態
 *
 * 功能：
 * - Workspace 列表獲取與管理
 * - 當前選中的 Workspace 狀態
 * - Workspace CRUD 操作
 * - 資料夾瀏覽（File System Access API）
 * - 持久化當前選中的 Workspace
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { apiService, ApiError } from '@/services/api'
import type {
  WorkspaceListItem,
  WorkspaceSettings,
  CreateWorkspaceSettingsRequest,
  UpdateWorkspaceSettingsRequest
} from '@workspace/shared'

/**
 * Workspace Store
 *
 * 使用 Composition API (Setup Store) 實作
 */
export const useWorkspaceStore = defineStore(
  'workspace',
  () => {
    // ===========================
    // State (使用 ref)
    // ===========================

    /** 所有可用的 Workspace 列表 */
    const workspaces = ref<WorkspaceListItem[]>([])

    /** 當前選中的 Workspace */
    const currentWorkspace = ref<WorkspaceListItem | null>(null)

    /** 當前 Workspace 的詳細設定（懶加載） */
    const currentWorkspaceSettings = ref<WorkspaceSettings | null>(null)

    /** 載入狀態 */
    const isLoading = ref<boolean>(false)

    /** 錯誤訊息 */
    const error = ref<string | null>(null)

    /** 搜索關鍵字 */
    const searchQuery = ref<string>('')

    // ===========================
    // Getters (使用 computed)
    // ===========================

    /**
     * 是否有可用的 Workspace
     */
    const hasWorkspaces = computed<boolean>(() => workspaces.value.length > 0)

    /**
     * 當前 Workspace 路徑
     */
    const currentWorkspacePath = computed<string | undefined>(
      () => currentWorkspace.value?.workspacePath
    )

    /**
     * 當前 Workspace 設定
     */
    const currentSettings = computed<WorkspaceSettings | null>(
      () => currentWorkspaceSettings.value
    )

    /**
     * 是否已選擇 Workspace
     */
    const hasSelectedWorkspace = computed<boolean>(
      () => currentWorkspace.value !== null
    )

    /**
     * Workspace 總數
     */
    const workspaceCount = computed<number>(() => workspaces.value.length)

    /**
     * 過濾後的 Workspace 列表
     * 根據搜索關鍵字過濾
     */
    const filteredWorkspaces = computed<WorkspaceListItem[]>(() => {
      if (!searchQuery.value.trim()) {
        return workspaces.value
      }

      const query = searchQuery.value.toLowerCase()
      return workspaces.value.filter(workspace => {
        const path = workspace.workspacePath.toLowerCase()
        const name = workspace.workspacePath.split('/').pop()?.toLowerCase() || ''
        return path.includes(query) || name.includes(query)
      })
    })

    // ===========================
    // Actions (普通函數)
    // ===========================

    /**
     * 獲取所有 Workspace
     * GET /api/workspaces
     */
    async function fetchWorkspaces(): Promise<void> {
      isLoading.value = true
      error.value = null

      try {
        const response = await apiService.getWorkspaces()

        if (response.success && response.data) {
          workspaces.value = response.data

          // 如果有 Workspace 但沒有選中任何一個，自動選中第一個
          if (workspaces.value.length > 0 && !currentWorkspace.value) {
            currentWorkspace.value = workspaces.value[0] || null
          }

          // 如果當前選中的 Workspace 存在，同步物件引用
          if (currentWorkspace.value) {
            const updatedWorkspace = workspaces.value.find(
              (w) => w.workspacePath === currentWorkspace.value?.workspacePath
            )

            if (updatedWorkspace) {
              // 同步物件引用，確保 currentWorkspace 指向最新的物件
              console.log('[WorkspaceStore] Syncing currentWorkspace reference:', updatedWorkspace.workspacePath)
              currentWorkspace.value = updatedWorkspace
            } else {
              // 確實不存在了，才清空
              console.warn('[WorkspaceStore] Current workspace no longer exists, clearing:', currentWorkspace.value.workspacePath)
              currentWorkspace.value = null
              currentWorkspaceSettings.value = null
            }
          }
        } else {
          throw new Error(response.error || '獲取 Workspace 列表失敗')
        }
      } catch (err) {
        error.value = err instanceof Error ? err.message : '未知錯誤'
        console.error('[WorkspaceStore] fetchWorkspaces error:', err)
      } finally {
        isLoading.value = false
      }
    }

    /**
     * 選擇 Workspace
     * 自動載入該 Workspace 的詳細設定
     *
     * @param path - Workspace 路徑
     */
    async function selectWorkspace(path: string): Promise<void> {
      isLoading.value = true
      error.value = null

      try {
        // 1. 從列表中找到對應的 Workspace
        const workspace = workspaces.value.find((w) => w.workspacePath === path)

        if (!workspace) {
          throw new Error(`找不到 Workspace: ${path}`)
        }

        // 2. 設定當前 Workspace
        currentWorkspace.value = workspace
        console.log('[WorkspaceStore] Workspace selected:', workspace.workspacePath)

        // 3. 載入詳細設定
        const response = await apiService.getWorkspace(path)

        if (response.success && response.data) {
          currentWorkspaceSettings.value = response.data
        } else {
          throw new Error(response.error || '獲取 Workspace 設定失敗')
        }
      } catch (err) {
        error.value = err instanceof Error ? err.message : '未知錯誤'
        console.error('[WorkspaceStore] selectWorkspace error:', err)

        // 選擇失敗時清空當前選擇
        currentWorkspace.value = null
        currentWorkspaceSettings.value = null

        throw err
      } finally {
        isLoading.value = false
      }
    }

    /**
     * 建立新的 Workspace
     * POST /api/workspaces
     *
     * @param data - 建立 Workspace 的資料
     * @returns 建立成功的 Workspace 設定
     */
    async function createWorkspace(
      data: CreateWorkspaceSettingsRequest
    ): Promise<WorkspaceSettings> {
      isLoading.value = true
      error.value = null

      try {
        const response = await apiService.createWorkspace(data)

        if (response.success && response.data) {
          // 重新載入 Workspace 列表
          await fetchWorkspaces()

          // 自動選擇剛建立的 Workspace
          await selectWorkspace(data.workspacePath)

          return response.data
        } else {
          throw new Error(response.error || '建立 Workspace 失敗')
        }
      } catch (err) {
        error.value = err instanceof Error ? err.message : '未知錯誤'
        console.error('[WorkspaceStore] createWorkspace error:', err)
        throw err
      } finally {
        isLoading.value = false
      }
    }

    /**
     * 更新 Workspace 設定
     * PUT /api/workspaces/:path
     *
     * @param path - Workspace 路徑
     * @param data - 更新的設定資料
     */
    async function updateWorkspace(
      path: string,
      data: UpdateWorkspaceSettingsRequest
    ): Promise<void> {
      isLoading.value = true
      error.value = null

      try {
        const response = await apiService.updateWorkspace(path, data)

        if (response.success && response.data) {
          // 如果更新的是當前選中的 Workspace，更新其設定
          if (currentWorkspace.value?.workspacePath === path) {
            currentWorkspaceSettings.value = response.data
          }

          // 重新載入列表以更新時間戳
          await fetchWorkspaces()
        } else {
          throw new Error(response.error || '更新 Workspace 失敗')
        }
      } catch (err) {
        error.value = err instanceof Error ? err.message : '未知錯誤'
        console.error('[WorkspaceStore] updateWorkspace error:', err)
        throw err
      } finally {
        isLoading.value = false
      }
    }

    /**
     * 刪除 Workspace
     * DELETE /api/workspaces/:path
     *
     * @param path - 要刪除的 Workspace 路徑
     */
    async function deleteWorkspace(path: string): Promise<void> {
      isLoading.value = true
      error.value = null

      try {
        const response = await apiService.deleteWorkspace(path)

        if (response.success) {
          // 如果刪除的是當前選中的 Workspace，清空選擇
          if (currentWorkspace.value?.workspacePath === path) {
            currentWorkspace.value = null
            currentWorkspaceSettings.value = null
          }

          // 重新載入列表
          await fetchWorkspaces()
        } else {
          throw new Error(response.error || '刪除 Workspace 失敗')
        }
      } catch (err) {
        error.value = err instanceof Error ? err.message : '未知錯誤'
        console.error('[WorkspaceStore] deleteWorkspace error:', err)
        throw err
      } finally {
        isLoading.value = false
      }
    }

    /**
     * 瀏覽並選擇資料夾
     * 使用後端 API 呼叫系統原生資料夾選擇對話框
     *
     * @returns 選擇的資料夾路徑，取消則返回 null
     * @throws 如果選擇失敗
     */
    async function browseFolder(): Promise<string | null> {
      error.value = null

      try {
        console.log('[WorkspaceStore] Calling backend selectFolder API')

        // 呼叫後端 API 開啟系統原生資料夾選擇對話框
        const response = await apiService.selectFolder()

        if (response.success && response.data?.folderPath) {
          console.log('[WorkspaceStore] Folder selected:', response.data.folderPath)
          return response.data.folderPath
        }

        // 用戶取消選擇
        if (response.success && !response.data?.folderPath) {
          console.log('[WorkspaceStore] User cancelled folder selection')
          return null
        }

        // API 錯誤
        throw new Error(response.error || '選擇資料夾失敗')
      } catch (err) {
        error.value = err instanceof Error ? err.message : '未知錯誤'
        console.error('[WorkspaceStore] browseFolder error:', err)
        throw err
      }
    }

    /**
     * 清空錯誤訊息
     */
    function clearError(): void {
      error.value = null
    }

    /**
     * 設定搜索關鍵字
     */
    function setSearchQuery(query: string): void {
      searchQuery.value = query
    }

    /**
     * 清空搜索關鍵字
     */
    function clearSearch(): void {
      searchQuery.value = ''
    }

    /**
     * 重設 Store 狀態
     */
    function reset(): void {
      workspaces.value = []
      currentWorkspace.value = null
      currentWorkspaceSettings.value = null
      isLoading.value = false
      error.value = null
      searchQuery.value = ''
    }

    // ===========================
    // Return (導出所有需要的屬性)
    // ===========================
    return {
      // State
      workspaces,
      currentWorkspace,
      currentWorkspaceSettings,
      isLoading,
      error,
      searchQuery,

      // Getters
      hasWorkspaces,
      currentWorkspacePath,
      currentSettings,
      hasSelectedWorkspace,
      workspaceCount,
      filteredWorkspaces,

      // Actions
      fetchWorkspaces,
      selectWorkspace,
      createWorkspace,
      updateWorkspace,
      deleteWorkspace,
      browseFolder,
      clearError,
      setSearchQuery,
      clearSearch,
      reset
    }
  },
  {
    /**
     * Persist Configuration
     * 使用 pinia-plugin-persistedstate 持久化
     * 只持久化當前選中的 Workspace
     * 列表和設定會在應用啟動時重新載入
     */
    persist: {
      key: 'workspace-store',
      pick: ['currentWorkspace'],  // 只持久化當前選中的 workspace
      debug: true  // 開發階段開啟除錯（測試後可移除）
    }
  }
)
