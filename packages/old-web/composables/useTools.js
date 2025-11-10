/**
 * useTools Composable
 * 工具解析與顯示
 */

export function useTools() {
    /**
     * 解析工具 blocks
     */
    function parseToolBlocks(contentBlocks) {
        if (!contentBlocks || !Array.isArray(contentBlocks)) {
            return []
        }

        const tools = []
        const toolUseMap = new Map()
        const toolResultMap = new Map()

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
                    is_error: block.is_error
                })
            }
        }

        for (const [id, toolUse] of toolUseMap) {
            const toolResult = toolResultMap.get(id)
            tools.push({
                id,
                name: toolUse.name,
                input: toolUse.input,
                result: toolResult ? toolResult.content : null,
                is_error: toolResult ? toolResult.is_error : false,
                expanded: false
            })
        }

        return tools
    }

    /**
     * 取得工具圖示
     */
    function getToolIcon(toolName) {
        const icons = {
            'Read': {
                icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
                color: 'text-blue-600 bg-blue-50'
            },
            'Edit': {
                icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
                color: 'text-green-600 bg-green-50'
            },
            'Write': {
                icon: 'M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z',
                color: 'text-purple-600 bg-purple-50'
            },
            'Bash': {
                icon: 'M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
                color: 'text-gray-700 bg-gray-50'
            },
            'Glob': {
                icon: 'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z',
                color: 'text-yellow-600 bg-yellow-50'
            },
            'Grep': {
                icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
                color: 'text-orange-600 bg-orange-50'
            }
        }

        return icons[toolName] || {
            icon: 'M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4',
            color: 'text-indigo-600 bg-indigo-50'
        }
    }

    /**
     * 切換工具展開狀態
     */
    function toggleToolExpand(tool) {
        tool.expanded = !tool.expanded
    }

    /**
     * 切換訊息工具面板展開狀態
     */
    function toggleMessageTools(msg) {
        msg.toolsExpanded = !msg.toolsExpanded
    }

    return {
        parseToolBlocks,
        getToolIcon,
        toggleToolExpand,
        toggleMessageTools
    }
}
