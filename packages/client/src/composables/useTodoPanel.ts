/**
 * Todo Panel Composable
 * 管理浮動 Todo 面板的狀態和數據
 */

import { ref, computed, watchEffect } from 'vue'
import { useLocalStorage } from '@vueuse/core'
import { useSessionManagerStore } from '@/stores/session-manager'
import type { TodoItem } from '@/types/message'

/**
 * Todo 面板配置介面
 */
interface TodoPanelConfig {
    /** 面板是否開啟 */
    isOpen: boolean
    /** 面板位置 (像素) */
    position: { x: number; y: number }
    /** 面板大小 (像素) */
    size: { width: number; height: number }
    /** 是否最小化 */
    isMinimized: boolean
}

/**
 * 預設配置
 */
const DEFAULT_CONFIG: TodoPanelConfig = {
    isOpen: false,
    position: { x: window.innerWidth - 420, y: window.innerHeight - 350 },
    size: { width: 400, height: 300 },
    isMinimized: false
}

/**
 * 確保位置在視窗範圍內
 */
function constrainPosition(config: TodoPanelConfig): TodoPanelConfig {
    const maxX = window.innerWidth - config.size.width
    const maxY = window.innerHeight - config.size.height

    return {
        ...config,
        position: {
            x: Math.max(0, Math.min(config.position.x, maxX)),
            y: Math.max(0, Math.min(config.position.y, maxY))
        }
    }
}

/**
 * 從工具區塊提取 TodoWrite 項目
 * 使用 Map 去重，保留同名任務的最新狀態
 */
function extractTodos(): TodoItem[] {
    const sessionManager = useSessionManagerStore()
    const activeStore = sessionManager.activeMessageStore

    if (!activeStore) return []

    // 使用 Map 追蹤每個任務的最新狀態
    // Key: todo.content (任務名稱)
    // Value: TodoItem (最新的 todo 項目)
    const todoMap = new Map<string, TodoItem>()

    // 遍歷所有助手訊息（按時間順序，後面的會覆蓋前面的）
    activeStore.messages.forEach(msg => {
        if (msg.type === 'assistant' && msg.tools) {
            // 找出所有 TodoWrite 工具
            msg.tools
                .filter(tool => tool.name === 'TodoWrite')
                .forEach(tool => {
                    // 提取 todos 陣列
                    if (tool.input?.todos && Array.isArray(tool.input.todos)) {
                        tool.input.todos.forEach((todo: TodoItem) => {
                            // 用 content 作為 key，後面的會覆蓋前面的
                            // 這樣可以確保同名任務只保留最新狀態
                            todoMap.set(todo.content, todo)
                        })
                    }
                })
        }
    })

    // 轉換為陣列並返回
    return Array.from(todoMap.values())
}

/**
 * Todo 面板 Composable
 */
export function useTodoPanel() {
    // 持久化配置到 LocalStorage
    const config = useLocalStorage<TodoPanelConfig>('todo-panel-config', DEFAULT_CONFIG)

    // 確保初始位置在視窗範圍內
    config.value = constrainPosition(config.value)

    // Todos 資料（響應式）
    const todos = ref<TodoItem[]>([])

    // 計算統計資訊
    const stats = computed(() => {
        const total = todos.value.length
        const completed = todos.value.filter(t => t.status === 'completed').length
        const inProgress = todos.value.filter(t => t.status === 'in_progress').length
        const pending = todos.value.filter(t => t.status === 'pending').length
        const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0

        return { total, completed, inProgress, pending, completionRate }
    })

    // 監聽 Session 變化，自動更新 Todos
    watchEffect(() => {
        todos.value = extractTodos()
    })

    // 切換面板開啟/關閉
    const togglePanel = () => {
        config.value.isOpen = !config.value.isOpen
    }

    // 開啟面板
    const openPanel = () => {
        config.value.isOpen = true
    }

    // 關閉面板
    const closePanel = () => {
        config.value.isOpen = false
    }

    // 切換最小化
    const toggleMinimize = () => {
        config.value.isMinimized = !config.value.isMinimized
    }

    // 更新面板位置
    const updatePosition = (x: number, y: number) => {
        config.value.position = { x, y }
        config.value = constrainPosition(config.value)
    }

    // 更新面板大小
    const updateSize = (width: number, height: number) => {
        config.value.size = { width, height }
        config.value = constrainPosition(config.value)
    }

    // 重置配置
    const resetConfig = () => {
        config.value = DEFAULT_CONFIG
    }

    return {
        // 狀態
        config,
        todos,
        stats,

        // 方法
        togglePanel,
        openPanel,
        closePanel,
        toggleMinimize,
        updatePosition,
        updateSize,
        resetConfig
    }
}
