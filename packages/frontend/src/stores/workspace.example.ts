/**
 * Workspace Store 使用範例
 *
 * 此檔案展示如何在 Vue 3 Composition API 中使用 Workspace Store
 */

import { useWorkspaceStore } from '@/stores/workspace'
import { storeToRefs } from 'pinia'

/**
 * 範例 1: 在 Vue 組件中獲取 Workspace 列表
 */
export function exampleFetchWorkspaces() {
  const workspaceStore = useWorkspaceStore()

  // 使用 storeToRefs 讓響應式屬性保持響應性
  const { workspaces, isLoading, error } = storeToRefs(workspaceStore)

  // 獲取 Workspace 列表
  workspaceStore.fetchWorkspaces()

  return {
    workspaces,
    isLoading,
    error
  }
}

/**
 * 範例 2: 選擇 Workspace
 */
export async function exampleSelectWorkspace() {
  const workspaceStore = useWorkspaceStore()
  const { currentWorkspace, currentWorkspaceSettings } = storeToRefs(workspaceStore)

  try {
    await workspaceStore.selectWorkspace('/path/to/workspace')
    console.log('當前 Workspace:', currentWorkspace.value)
    console.log('Workspace 設定:', currentWorkspaceSettings.value)
  } catch (error) {
    console.error('選擇 Workspace 失敗:', error)
  }
}

/**
 * 範例 3: 建立新的 Workspace
 */
export async function exampleCreateWorkspace() {
  const workspaceStore = useWorkspaceStore()

  try {
    const newWorkspace = await workspaceStore.createWorkspace({
      workspacePath: '/path/to/new/workspace',
      systemPrompt: '你是一個專業的程式設計助手',
      settingSources: ['project', 'local'],
      allowedTools: ['Read', 'Write', 'Bash'],
      disallowedTools: ['Edit']
    })

    console.log('建立成功:', newWorkspace)
  } catch (error) {
    console.error('建立失敗:', error)
  }
}

/**
 * 範例 4: 更新 Workspace 設定
 */
export async function exampleUpdateWorkspace() {
  const workspaceStore = useWorkspaceStore()

  try {
    await workspaceStore.updateWorkspace('/path/to/workspace', {
      systemPrompt: '更新後的系統提示詞',
      allowedTools: ['Read', 'Write', 'Bash', 'Glob']
    })

    console.log('更新成功')
  } catch (error) {
    console.error('更新失敗:', error)
  }
}

/**
 * 範例 5: 刪除 Workspace
 */
export async function exampleDeleteWorkspace() {
  const workspaceStore = useWorkspaceStore()

  try {
    await workspaceStore.deleteWorkspace('/path/to/workspace')
    console.log('刪除成功')
  } catch (error) {
    console.error('刪除失敗:', error)
  }
}

/**
 * 範例 6: 使用瀏覽器資料夾選擇器
 */
export async function exampleBrowseFolder() {
  const workspaceStore = useWorkspaceStore()

  try {
    const folderPath = await workspaceStore.browseFolder()

    if (folderPath) {
      console.log('選擇的資料夾:', folderPath)

      // 使用選擇的路徑建立 Workspace
      await workspaceStore.createWorkspace({
        workspacePath: folderPath
      })
    } else {
      console.log('使用者取消選擇')
    }
  } catch (error) {
    console.error('瀏覽資料夾失敗:', error)
  }
}

/**
 * 範例 7: 在 Vue 組件中完整使用
 */
export function exampleComponentUsage() {
  const workspaceStore = useWorkspaceStore()

  // 解構響應式屬性
  const {
    workspaces,
    currentWorkspace,
    currentWorkspaceSettings,
    isLoading,
    error,
    hasWorkspaces,
    currentWorkspacePath
  } = storeToRefs(workspaceStore)

  // 解構方法（不需要 storeToRefs）
  const {
    fetchWorkspaces,
    selectWorkspace,
    createWorkspace,
    updateWorkspace,
    deleteWorkspace,
    browseFolder: browseFolderMethod,
    clearError
  } = workspaceStore

  return {
    // 響應式狀態
    workspaces,
    currentWorkspace,
    currentWorkspaceSettings,
    isLoading,
    error,

    // 計算屬性
    hasWorkspaces,
    currentWorkspacePath,

    // 方法
    fetchWorkspaces,
    selectWorkspace,
    createWorkspace,
    updateWorkspace,
    deleteWorkspace,
    browseFolder: browseFolderMethod,
    clearError
  }
}

/**
 * 範例 8: 使用 Getters
 */
export function exampleUseGetters() {
  const workspaceStore = useWorkspaceStore()

  console.log('是否有 Workspace:', workspaceStore.hasWorkspaces)
  console.log('當前 Workspace 路徑:', workspaceStore.currentWorkspacePath)
  console.log('當前設定:', workspaceStore.currentSettings)
  console.log('是否已選擇:', workspaceStore.hasSelectedWorkspace)
  console.log('Workspace 總數:', workspaceStore.workspaceCount)
}
