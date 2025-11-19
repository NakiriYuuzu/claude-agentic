/**
 * Message Store (Composition API / Setup Store)
 * 訊息狀態管理模組
 *
 * 負責管理聊天應用中的所有訊息，包括：
 * - 使用者訊息和 Claude 助手訊息
 * - 流式傳輸中的訊息更新
 * - 工具區塊（Tool Block）管理
 * - 會話統計資訊
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type {
    Message,
    UserMessage,
    AssistantMessage,
    ToolBlock,
    ContentBlock,
    MessageResult
} from '@/types/message'

/**
 * Message Store
 *
 * 提供訊息管理的核心功能：
 * - 添加和更新訊息
 * - 流式傳輸支援
 * - 工具執行追蹤
 * - 會話統計
 *
 * 使用 Composition API (Setup Store) 實作
 */
export const useMessageStore = defineStore('message', () => {
    // ===========================
    // State (使用 ref)
    // ===========================

    /** 所有訊息列表 */
    const messages = ref<Message[]>([])

    /** 是否正在查詢 */
    const isQuerying = ref<boolean>(false)

    /** 當前會話 ID */
    const currentSessionId = ref<string | null>(null)

    /** 會話總成本（USD） */
    const sessionTotalCost = ref<number>(0)

    /** 會話訊息總數 */
    const sessionMessageCount = ref<number>(0)

    /** 會話狀態 */
    const sessionStatus = ref<'initializing' | 'ready' | 'completed' | ''>('')

    /** 會話結果資訊 */
    const sessionResult = ref<MessageResult | null>(null)

    // ===========================
    // Getters (使用 computed)
    // ===========================

    /**
     * 取得所有使用者訊息
     */
    const userMessages = computed<UserMessage[]>(() => {
        return messages.value.filter((m): m is UserMessage => m.type === 'user')
    })

    /**
     * 取得所有助手訊息
     */
    const assistantMessages = computed<AssistantMessage[]>(() => {
        return messages.value.filter((m): m is AssistantMessage => m.type === 'assistant')
    })

    /**
     * 取得最後一條使用者訊息
     */
    const lastUserMessage = computed<UserMessage | undefined>(() => {
        const userMsgs = messages.value.filter((m): m is UserMessage => m.type === 'user')
        return userMsgs[userMsgs.length - 1]
    })

    /**
     * 訊息總數
     */
    const messageCount = computed<number>(() => {
        return messages.value.length
    })

    /**
     * 是否有正在流式傳輸的訊息
     */
    const hasStreamingMessage = computed<boolean>(() => {
        return messages.value.some(
            (m): m is AssistantMessage => m.type === 'assistant' && m.isStreaming === true
        )
    })

    /**
     * 取得當前流式傳輸的訊息索引
     */
    const streamingMessageIndex = computed<number>(() => {
        return messages.value.findIndex(
            (m): m is AssistantMessage => m.type === 'assistant' && m.isStreaming === true
        )
    })

    /**
     * 取得當前流式傳輸的訊息
     */
    const streamingMessage = computed<AssistantMessage | undefined>(() => {
        return messages.value.find(
            (m): m is AssistantMessage => m.type === 'assistant' && m.isStreaming === true
        )
    })

    // ===========================
    // Actions (普通函數)
    // ===========================

    /**
     * 添加使用者訊息
     *
     * @param text - 使用者輸入的文字
     * @returns 新建立的使用者訊息
     */
    function addUserMessage(text: string): UserMessage {
        const userMessage: UserMessage = {
            type: 'user',
            text,
            content: text
        }

        messages.value.push(userMessage)
        console.log('[MessageStore] Added user message:', {
            textLength: text.length
        })

        return userMessage
    }

    /**
     * 建立新的助手訊息
     *
     * @returns 新建立的助手訊息索引
     */
    function createAssistantMessage(): number {
        const assistantMessage: AssistantMessage = {
            type: 'assistant',
            content: '',
            tools: [],
            toolsExpanded: false,
            isStreaming: true,
            isComplete: false,
            result: null,
            isHistorical: false
        }

        messages.value.push(assistantMessage)
        const index = messages.value.length - 1

        console.log('[MessageStore] Created assistant message at index:', index)

        return index
    }

    /**
     * 更新助手訊息內容
     *
     * @param index - 訊息索引
     * @param contentBlocks - Claude SDK 返回的 content blocks
     */
    function updateAssistantMessage(index: number, contentBlocks: ContentBlock[]): void {
        if (index === -1 || !messages.value[index]) {
            console.warn('[MessageStore] Invalid message index:', index)
            return
        }

        const msg = messages.value[index]
        if (msg.type !== 'assistant') {
            console.warn('[MessageStore] Message at index is not assistant type:', index)
            return
        }

        // 累積式更新：保留現有的 tools
        const toolsMap = new Map<string, ToolBlock>()

        // 先將現有的 tools 加入 map
        msg.tools.forEach(tool => {
            toolsMap.set(tool.id, tool)
        })

        // 累積文字內容
        let textContent = ''

        // 處理新收到的 content blocks
        for (const block of contentBlocks) {
            if (block.type === 'text' && block.text) {
                textContent += block.text
            } else if (block.type === 'tool_use' && block.id && block.name) {
                // 只在工具不存在時才添加
                if (!toolsMap.has(block.id)) {
                    toolsMap.set(block.id, {
                        id: block.id,
                        name: block.name,
                        input: block.input || {},
                        result: undefined,
                        is_error: false,
                        expanded: false
                    })
                }
            } else if (block.type === 'tool_result' && block.tool_use_id) {
                // 更新對應工具的結果
                const tool = toolsMap.get(block.tool_use_id)
                if (tool) {
                    tool.result = block.content
                    tool.is_error = block.is_error || false
                }
            }
        }

        // 更新訊息內容（累積文字）
        msg.content = textContent
        msg.tools = Array.from(toolsMap.values())

        console.log('[MessageStore] assistant original contentBlocks:', contentBlocks)
        console.log('[MessageStore] Updated assistant message:', {
            index,
            contentLength: textContent.length,
            toolsCount: msg.tools.length,
            toolNames: msg.tools.map((t) => t.name),
            toolsWithResults: msg.tools.filter((t) => t.result).length
        })
    }

    /**
     * 標記助手訊息為完成狀態
     *
     * @param index - 訊息索引
     * @param resultData - 查詢結果資訊
     */
    function markAssistantComplete(index: number, resultData: MessageResult): void {
        if (index === -1 || !messages.value[index]) {
            console.warn('[MessageStore] Invalid message index:', index)
            return
        }

        const msg = messages.value[index]
        if (msg.type !== 'assistant') {
            console.warn('[MessageStore] Message at index is not assistant type:', index)
            return
        }

        // 標記訊息完成
        msg.isStreaming = false
        msg.isComplete = true
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

        sessionMessageCount.value = messages.value.filter(
            (m) => m.type === 'user' || m.type === 'assistant'
        ).length

        console.log('[MessageStore] Assistant message completed:', {
            index,
            cost: resultData.total_cost_usd,
            turns: resultData.num_turns,
            duration: resultData.duration_ms
        })
    }

    /**
     * 添加工具區塊到訊息
     *
     * @param messageIndex - 訊息索引
     * @param toolBlock - 工具區塊資訊
     */
    function addToolBlock(messageIndex: number, toolBlock: ToolBlock): void {
        if (messageIndex === -1 || !messages.value[messageIndex]) {
            console.warn('[MessageStore] Invalid message index:', messageIndex)
            return
        }

        const msg = messages.value[messageIndex]
        if (msg.type !== 'assistant') {
            console.warn('[MessageStore] Message at index is not assistant type:', messageIndex)
            return
        }

        // 檢查工具是否已存在
        const existingIndex = msg.tools.findIndex((t) => t.id === toolBlock.id)
        if (existingIndex === -1) {
            msg.tools.push(toolBlock)
            console.log('[MessageStore] Added tool block:', {
                messageIndex,
                toolId: toolBlock.id,
                toolName: toolBlock.name
            })
        } else {
            // 更新現有工具
            msg.tools[existingIndex] = { ...msg.tools[existingIndex], ...toolBlock } as ToolBlock
            console.log('[MessageStore] Updated existing tool block:', {
                messageIndex,
                toolId: toolBlock.id
            })
        }
    }

    /**
     * 更新工具區塊資訊
     *
     * @param messageIndex - 訊息索引
     * @param toolId - 工具 ID
     * @param updates - 要更新的欄位（不包含 id 和 name）
     */
    function updateToolBlock(
        messageIndex: number,
        toolId: string,
        updates: Partial<Omit<ToolBlock, 'id' | 'name'>>
    ): void {
        if (messageIndex === -1 || !messages.value[messageIndex]) {
            console.warn('[MessageStore] Invalid message index:', messageIndex)
            return
        }

        const msg = messages.value[messageIndex]
        if (msg.type !== 'assistant') {
            console.warn('[MessageStore] Message at index is not assistant type:', messageIndex)
            return
        }

        const toolIndex = msg.tools.findIndex((t) => t.id === toolId)
        if (toolIndex !== -1) {
            msg.tools[toolIndex] = { ...msg.tools[toolIndex], ...updates } as ToolBlock
            console.log('[MessageStore] Updated tool block:', {
                messageIndex,
                toolId,
                updates: Object.keys(updates)
            })
        } else {
            console.warn('[MessageStore] Tool block not found:', {
                messageIndex,
                toolId
            })
        }
    }

    /**
     * 清空所有訊息（開始新對話）
     */
    function clearMessages(): void {
        messages.value = []
        currentSessionId.value = null
        sessionStatus.value = ''
        sessionResult.value = null
        sessionTotalCost.value = 0
        sessionMessageCount.value = 0
        isQuerying.value = false

        console.log('[MessageStore] Cleared all messages and session state')
    }

    /**
     * 設置訊息列表（從 Session 載入歷史訊息）
     *
     * @param newMessages - 新的訊息列表
     */
    function setMessages(newMessages: Message[]): void {
        messages.value = newMessages

        // 計算總成本和訊息數
        let totalCost = 0
        newMessages.forEach((msg) => {
            if (msg.type === 'assistant' && msg.result?.total_cost_usd) {
                totalCost += msg.result.total_cost_usd
            }
        })

        sessionTotalCost.value = totalCost
        sessionMessageCount.value = newMessages.filter(
            (m) => m.type === 'user' || m.type === 'assistant'
        ).length

        console.log('[MessageStore] Set messages from session:', {
            messageCount: newMessages.length,
            totalCost,
            sessionMessageCount: sessionMessageCount.value
        })
    }

    /**
     * 設置查詢狀態
     *
     * @param querying - 是否正在查詢
     */
    function setQuerying(querying: boolean): void {
        isQuerying.value = querying
        console.log('[MessageStore] Set querying state:', querying)
    }

    /**
     * 設置當前會話 ID
     *
     * @param sessionId - 會話 ID
     */
    function setSessionId(sessionId: string | null): void {
        currentSessionId.value = sessionId
        console.log('[MessageStore] Set session ID:', sessionId)
    }

    /**
     * 設置會話狀態
     *
     * @param status - 會話狀態
     */
    function setSessionStatus(status: 'initializing' | 'ready' | 'completed' | ''): void {
        sessionStatus.value = status
        console.log('[MessageStore] Set session status:', status)
    }

    /**
     * 設置會話結果
     *
     * @param result - 會話結果資訊
     */
    function setSessionResult(result: MessageResult | null): void {
        sessionResult.value = result
        console.log('[MessageStore] Set session result:', result)
    }

    /**
     * 切換工具面板展開狀態
     *
     * @param messageIndex - 訊息索引
     */
    function toggleToolsExpanded(messageIndex: number): void {
        if (messageIndex === -1 || !messages.value[messageIndex]) {
            console.warn('[MessageStore] Invalid message index:', messageIndex)
            return
        }

        const msg = messages.value[messageIndex]
        if (msg.type !== 'assistant') {
            console.warn('[MessageStore] Message at index is not assistant type:', messageIndex)
            return
        }

        msg.toolsExpanded = !msg.toolsExpanded
        console.log('[MessageStore] Toggled tools expanded:', {
            messageIndex,
            expanded: msg.toolsExpanded
        })
    }

    /**
     * 切換單個工具區塊展開狀態
     *
     * @param messageIndex - 訊息索引
     * @param toolId - 工具 ID
     */
    function toggleToolExpanded(messageIndex: number, toolId: string): void {
        if (messageIndex === -1 || !messages.value[messageIndex]) {
            console.warn('[MessageStore] Invalid message index:', messageIndex)
            return
        }

        const msg = messages.value[messageIndex]
        if (msg.type !== 'assistant') {
            console.warn('[MessageStore] Message at index is not assistant type:', messageIndex)
            return
        }

        const tool = msg.tools.find((t) => t.id === toolId)
        if (tool) {
            tool.expanded = !tool.expanded
            console.log('[MessageStore] Toggled tool expanded:', {
                messageIndex,
                toolId,
                expanded: tool.expanded
            })
        } else {
            console.warn('[MessageStore] Tool block not found:', {
                messageIndex,
                toolId
            })
        }
    }

    // ===========================
    // Return (導出所有需要的屬性)
    // ===========================
    return {
        // State
        messages,
        isQuerying,
        currentSessionId,
        sessionTotalCost,
        sessionMessageCount,
        sessionStatus,
        sessionResult,

        // Getters
        userMessages,
        assistantMessages,
        lastUserMessage,
        messageCount,
        hasStreamingMessage,
        streamingMessageIndex,
        streamingMessage,

        // Actions
        addUserMessage,
        createAssistantMessage,
        updateAssistantMessage,
        markAssistantComplete,
        addToolBlock,
        updateToolBlock,
        clearMessages,
        setMessages,
        setQuerying,
        setSessionId,
        setSessionStatus,
        setSessionResult,
        toggleToolsExpanded,
        toggleToolExpanded
    }
})
