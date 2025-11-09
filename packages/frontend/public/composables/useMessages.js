/**
 * useMessages Composable
 * 訊息狀態管理與即時更新
 */

const { ref, computed } = Vue

export function useMessages() {
    // 響應式狀態
    const messages = ref([])
    const isQuerying = ref(false)
    const currentSessionId = ref(null)
    const sessionTotalCost = ref(0)
    const sessionMessageCount = ref(0)
    const sessionStatus = ref('')  // 'initializing', 'ready', 'completed'
    const sessionResult = ref(null)

    // 計算屬性
    const hasStreamingMessage = computed(() => {
        return messages.value.some(m => m.isStreaming)
    })

    /**
     * 添加用戶訊息
     */
    function addUserMessage(text) {
        messages.value.push({
            type: 'user',
            text: text
        })
    }

    /**
     * 創建新的 Assistant 訊息
     */
    function createAssistantMessage() {
        const newMessage = {
            type: 'assistant',
            content: '',
            tools: [],
            toolsExpanded: false,
            isStreaming: true,
            result: null,
            isHistorical: false  // 標記為即時訊息
        }
        messages.value.push(newMessage)
        return messages.value.length - 1
    }

    /**
     * 更新 Assistant 訊息內容
     */
    function updateAssistantMessage(index, contentBlocks) {
        if (index === -1 || !messages.value[index]) return

        const msg = messages.value[index]

        // 重新解析所有 content blocks
        let textContent = ''
        const toolsMap = new Map()

        for (const block of contentBlocks) {
            if (block.type === 'text') {
                textContent += block.text
            } else if (block.type === 'tool_use') {
                toolsMap.set(block.id, {
                    id: block.id,
                    name: block.name,
                    input: block.input,
                    result: null,
                    is_error: false,
                    expanded: false
                })
            } else if (block.type === 'tool_result') {
                // 更新對應工具的結果
                if (toolsMap.has(block.tool_use_id)) {
                    toolsMap.get(block.tool_use_id).result = block.content
                    toolsMap.get(block.tool_use_id).is_error = block.is_error || false
                }
            }
        }

        // 更新訊息內容
        msg.content = textContent
        msg.tools = Array.from(toolsMap.values())

        console.log('[useMessages] Updated assistant message:', {
            contentLength: textContent.length,
            toolsCount: msg.tools.length,
            toolNames: msg.tools.map(t => t.name),
            toolsWithResults: msg.tools.filter(t => t.result).length
        })
    }

    /**
     * 標記 Assistant 訊息完成
     */
    function markAssistantComplete(index, resultData) {
        if (index === -1 || !messages.value[index]) return

        const msg = messages.value[index]
        msg.isStreaming = false
        msg.result = {
            total_cost_usd: resultData.total_cost_usd,
            num_turns: resultData.num_turns,
            duration_ms: resultData.duration_ms,
            is_error: resultData.is_error,
            usage: resultData.usage
        }

        // 更新 session 統計
        if (resultData.total_cost_usd) {
            sessionTotalCost.value = resultData.total_cost_usd
        }
        sessionMessageCount.value = messages.value.filter(m =>
            m.type === 'user' || m.type === 'assistant'
        ).length

        console.log('[useMessages] Assistant message completed')
    }

    /**
     * 清空訊息（開始新對話）
     */
    function clearMessages() {
        messages.value = []
        currentSessionId.value = null
        sessionStatus.value = ''
        sessionResult.value = null
        sessionTotalCost.value = 0
        sessionMessageCount.value = 0
    }

    /**
     * 設置訊息列表（載入歷史記錄時使用）
     */
    function setMessages(newMessages) {
        messages.value = newMessages

        // 計算總成本和訊息數
        sessionTotalCost.value = 0
        newMessages.forEach(msg => {
            if (msg.result && msg.result.total_cost_usd) {
                sessionTotalCost.value += msg.result.total_cost_usd
            }
        })
        sessionMessageCount.value = newMessages.filter(m =>
            m.type === 'user' || m.type === 'assistant'
        ).length
    }

    return {
        // 狀態
        messages,
        isQuerying,
        currentSessionId,
        sessionTotalCost,
        sessionMessageCount,
        sessionStatus,
        sessionResult,

        // 計算屬性
        hasStreamingMessage,

        // 方法
        addUserMessage,
        createAssistantMessage,
        updateAssistantMessage,
        markAssistantComplete,
        clearMessages,
        setMessages
    }
}
