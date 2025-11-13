/**
 * 工具圖示映射
 * 為不同的工具提供特定圖示和樣式
 */

import {
    BookOpen,
    Edit,
    FileEdit,
    Terminal,
    FolderSearch,
    Search,
    Bot,
    Sparkles,
    Globe,
    Wrench,
    type LucideIcon
} from 'lucide-vue-next'

export interface ToolIconConfig {
    icon: LucideIcon
    colorClass: string
}

/**
 * 工具圖示映射表
 */
export const toolIconMap: Record<string, ToolIconConfig> = {
    'Read': {
        icon: BookOpen,
        colorClass: 'text-blue-600 dark:text-blue-400'
    },
    'Edit': {
        icon: Edit,
        colorClass: 'text-green-600 dark:text-green-400'
    },
    'Write': {
        icon: FileEdit,
        colorClass: 'text-purple-600 dark:text-purple-400'
    },
    'Bash': {
        icon: Terminal,
        colorClass: 'text-gray-700 dark:text-gray-300'
    },
    'Glob': {
        icon: FolderSearch,
        colorClass: 'text-yellow-600 dark:text-yellow-400'
    },
    'Grep': {
        icon: Search,
        colorClass: 'text-orange-600 dark:text-orange-400'
    },
    'Task': {
        icon: Bot,
        colorClass: 'text-indigo-600 dark:text-indigo-400'
    },
    'Skill': {
        icon: Sparkles,
        colorClass: 'text-pink-600 dark:text-pink-400'
    },
    'WebFetch': {
        icon: Globe,
        colorClass: 'text-cyan-600 dark:text-cyan-400'
    },
    'WebSearch': {
        icon: Search,
        colorClass: 'text-teal-600 dark:text-teal-400'
    }
}

/**
 * 取得工具圖示配置
 * @param toolName 工具名稱
 * @returns 圖示組件和顏色類名
 */
export function getToolIcon(toolName: string): ToolIconConfig {
    return toolIconMap[toolName] || {
        icon: Wrench,
        colorClass: 'text-muted-foreground'
    }
}
