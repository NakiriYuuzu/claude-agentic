/**
 * 工具解析工具函數
 * 解析 Claude SDK 訊息中的工具使用和結果
 */

import type { ContentBlock, ToolExecution, ToolIconConfig } from '../types/frontend.types'

/**
 * 解析工具 blocks
 * 從 content blocks 中提取 tool_use 和 tool_result，並配對
 */
export function parseToolBlocks(contentBlocks: ContentBlock[] | undefined): ToolExecution[] {
    if (!contentBlocks || !Array.isArray(contentBlocks)) {
        return []
    }

    const tools: ToolExecution[] = []
    const toolUseMap = new Map<string, { id: string; name: string; input: any }>()
    const toolResultMap = new Map<string, { content: any; is_error: boolean }>()

    // 第一輪：收集所有 tool_use 和 tool_result
    for (const block of contentBlocks) {
        if (block.type === 'tool_use') {
            toolUseMap.set(block.id, {
                id: block.id,
                name: block.name,
                input: block.input
            })
        } else if (block.type === 'tool_result') {
            toolResultMap.set(block.tool_use_id, {
                content: block.content,
                is_error: block.is_error || false
            })
        }
    }

    // 第二輪：配對並創建 ToolExecution
    for (const [id, toolUse] of toolUseMap) {
        const toolResult = toolResultMap.get(id)
        tools.push({
            id,
            name: toolUse.name,
            input: toolUse.input,
            result: toolResult ? toolResult.content : null,
            is_error: toolResult ? toolResult.is_error : false,
            expanded: false  // 預設折疊
        })
    }

    return tools
}

/**
 * 取得工具圖示配置
 * 使用 lucide-vue-next 圖示名稱和 shadcn badge variant
 */
export function getToolIconConfig(toolName: string): ToolIconConfig {
    const iconMap: Record<string, ToolIconConfig> = {
        'Read': {
            icon: 'BookOpen',
            variant: 'default'
        },
        'Edit': {
            icon: 'Edit',
            variant: 'default'
        },
        'Write': {
            icon: 'FileEdit',
            variant: 'secondary'
        },
        'Bash': {
            icon: 'Terminal',
            variant: 'outline'
        },
        'Glob': {
            icon: 'FolderSearch',
            variant: 'secondary'
        },
        'Grep': {
            icon: 'Search',
            variant: 'outline'
        },
        'Task': {
            icon: 'Bot',
            variant: 'default'
        },
        'Skill': {
            icon: 'Sparkles',
            variant: 'default'
        },
        'WebFetch': {
            icon: 'Globe',
            variant: 'secondary'
        },
        'WebSearch': {
            icon: 'Search',
            variant: 'secondary'
        }
    }

    return iconMap[toolName] || {
        icon: 'Wrench',
        variant: 'outline'
    }
}

/**
 * 提取訊息的文字內容
 * 從 content blocks 中提取所有文字內容並合併
 */
export function extractTextContent(contentBlocks: ContentBlock[] | undefined): string {
    if (!contentBlocks || !Array.isArray(contentBlocks)) {
        return ''
    }

    return contentBlocks
        .filter(block => block.type === 'text')
        .map(block => (block as any).text)
        .join('\n')
}

/**
 * 判斷是否有工具使用
 */
export function hasToolUse(contentBlocks: ContentBlock[] | undefined): boolean {
    if (!contentBlocks || !Array.isArray(contentBlocks)) {
        return false
    }

    return contentBlocks.some(block => block.type === 'tool_use')
}
