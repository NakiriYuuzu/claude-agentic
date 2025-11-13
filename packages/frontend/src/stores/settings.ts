/**
 * Settings Store (Composition API / Setup Store)
 *
 * 管理應用程式設定，包括：
 * - 查詢選項（model, permissionMode, maxTurns）
 * - UI 設定（showSidebar）
 * - 快速提示（quickPrompts）
 *
 * Dark Mode 使用 VueUse 的 useDark/useToggle 獨立管理
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useDark, useToggle } from '@vueuse/core'
import type { QueryOptions } from '@/types/api'

/**
 * Settings Store
 *
 * @remarks
 * 使用 Composition API (Setup Store) 實作
 * 使用 pinia-plugin-persistedstate 自動持久化到 localStorage
 *
 * @example
 * ```typescript
 * const settingsStore = useSettingsStore()
 *
 * // 更新查詢選項
 * settingsStore.updateQueryOptions({ model: 'claude-sonnet-4', maxTurns: 10 })
 *
 * // 取得當前查詢選項
 * const options = settingsStore.queryOptions
 * ```
 */
export const useSettingsStore = defineStore(
  'settings',
  () => {
    // ===========================
    // State (使用 ref)
    // ===========================

    /**
     * Claude 模型
     * @default 'haiku'
     */
    const model = ref<QueryOptions['model']>('haiku')

    /**
     * 權限模式
     * @default 'default'
     */
    const permissionMode = ref<QueryOptions['permissionMode']>('default')

    /**
     * 最大對話輪數
     * @default 50
     */
    const maxTurns = ref<number>(50)

    /**
     * Resume Session ID（用於繼續現有對話）
     * @default undefined
     */
    const resume = ref<string | undefined>(undefined)

    /**
     * 是否顯示側邊欄
     * @default true（桌面版）
     */
    const showSidebar = ref<boolean>(true)

    /**
     * 快速提示範本列表
     */
    const quickPrompts = ref<string[]>([
      '列出當前目錄的所有檔案',
      '分析 src 目錄中的程式碼結構',
      '執行所有單元測試',
      '為專案生成 README 文件'
    ])

    // ===========================
    // Getters (使用 computed)
    // ===========================

    /**
     * 組合查詢選項（用於傳遞給 API）
     *
     * @returns QueryOptions 物件（自動過濾 undefined）
     *
     * @example
     * ```typescript
     * const settingsStore = useSettingsStore()
     * const options = settingsStore.queryOptions
     * // { model: 'haiku', permissionMode: 'default', maxTurns: 50 }
     * ```
     */
    const queryOptions = computed<QueryOptions>(() => ({
      model: model.value,
      permissionMode: permissionMode.value,
      maxTurns: maxTurns.value || undefined,
      resume: resume.value
    }))

    // ===========================
    // Actions (普通函數)
    // ===========================

    /**
     * 更新查詢選項
     *
     * @param options - 部分 QueryOptions（僅更新提供的欄位）
     *
     * @example
     * ```typescript
     * settingsStore.updateQueryOptions({ model: 'claude-sonnet-4' })
     * settingsStore.updateQueryOptions({ maxTurns: 10, permissionMode: 'acceptEdits' })
     * ```
     */
    function updateQueryOptions(options: Partial<QueryOptions>): void {
      if (options.model !== undefined) {
        model.value = options.model
      }
      if (options.permissionMode !== undefined) {
        permissionMode.value = options.permissionMode
      }
      if (options.maxTurns !== undefined) {
        maxTurns.value = options.maxTurns
      }
      if (options.resume !== undefined) {
        resume.value = options.resume
      }
    }

    /**
     * 切換側邊欄顯示狀態
     *
     * @example
     * ```typescript
     * settingsStore.toggleSidebar() // true → false
     * settingsStore.toggleSidebar() // false → true
     * ```
     */
    function toggleSidebar(): void {
      showSidebar.value = !showSidebar.value
    }

    /**
     * 新增快速提示
     *
     * @param prompt - 提示內容
     *
     * @example
     * ```typescript
     * settingsStore.addQuickPrompt('幫我解釋這段代碼')
     * ```
     */
    function addQuickPrompt(prompt: string): void {
      if (!prompt.trim()) return
      if (!quickPrompts.value.includes(prompt.trim())) {
        quickPrompts.value.push(prompt.trim())
      }
    }

    /**
     * 移除快速提示
     *
     * @param index - 提示索引
     *
     * @example
     * ```typescript
     * settingsStore.removeQuickPrompt(0) // 移除第一個提示
     * ```
     */
    function removeQuickPrompt(index: number): void {
      if (index >= 0 && index < quickPrompts.value.length) {
        quickPrompts.value.splice(index, 1)
      }
    }

    /**
     * 設置 Resume Session ID（用於繼續現有對話）
     *
     * @param sessionId - Session ID
     *
     * @example
     * ```typescript
     * settingsStore.setResume('session-123')
     * ```
     */
    function setResume(sessionId: string | undefined): void {
      resume.value = sessionId
      console.log('[SettingsStore] Set resume:', sessionId)
    }

    /**
     * 清除 Resume Session ID（開始新對話時使用）
     *
     * @example
     * ```typescript
     * settingsStore.clearResume()
     * ```
     */
    function clearResume(): void {
      resume.value = undefined
      console.log('[SettingsStore] Cleared resume')
    }

    // ===========================
    // Return (導出所有需要的屬性)
    // ===========================
    return {
      // State
      model,
      permissionMode,
      maxTurns,
      resume,
      showSidebar,
      quickPrompts,

      // Getters
      queryOptions,

      // Actions
      updateQueryOptions,
      toggleSidebar,
      addQuickPrompt,
      removeQuickPrompt,
      setResume,
      clearResume
    }
  },
  {
    /**
     * 持久化設定
     * @see https://prazdevs.github.io/pinia-plugin-persistedstate/
     */
    persist: {
      key: 'settings-store'
    }
  }
)

/**
 * Dark Mode 狀態管理（使用 VueUse）
 *
 * @remarks
 * 不使用 Pinia，直接使用 VueUse 的 useDark/useToggle
 * - 自動同步 localStorage（key: 'vueuse-color-scheme'）
 * - 自動切換 HTML class（dark）
 * - 支援系統偏好自動偵測
 *
 * @example
 * ```typescript
 * import { isDark, toggleDark } from '@/stores/settings'
 *
 * console.log(isDark.value) // true/false
 * toggleDark() // 切換 Dark Mode
 * ```
 */
export const isDark = useDark()

/**
 * 切換 Dark Mode
 *
 * @example
 * ```typescript
 * toggleDark() // 切換到相反狀態
 * toggleDark(true) // 強制開啟
 * toggleDark(false) // 強制關閉
 * ```
 */
export const toggleDark = useToggle(isDark)
