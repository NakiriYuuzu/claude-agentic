/**
 * Session Manager Store (Composition API / Setup Store)
 * 多 Session 並行管理核心模組
 *
 * 負責管理多個 Claude Agent Session 的生命週期：
 * - 創建、切換、刪除、重新命名 Session
 * - 每個 Session 擁有獨立的 MessageStore 實例
 * - 追蹤 Session 狀態（idle、running、error）
 * - LocalStorage 持久化支援
 *
 * 設計原則：
 * - 每個 Session 完全隔離（獨立的 MessageStore）
 * - 背景 Session 持續接收訊息更新
 * - 自動命名（基於第一個 prompt）+ 可編輯
 * - 手動生命週期管理（用戶控制創建/刪除）
 */

import { defineStore, getActivePinia } from 'pinia'
import { ref, computed } from 'vue'
import type { Message, UserMessage, AssistantMessage, SubagentPrompt, ToolBlock, ContentBlock, MessageResult } from '@/types/message'

/**
 * Debounce 工具函數
 * 用於防止短時間內多次呼叫同一函數（例如 LocalStorage 頻繁寫入）
 *
 * @param func - 需要防抖的函數
 * @param wait - 延遲時間（毫秒）
 * @returns Debounced 函數
 */
function debounce<T extends (...args: any[]) => void>(func: T, wait: number): (...args: Parameters<T>) => void {
    let timeout: ReturnType<typeof setTimeout> | null = null

    return function (this: any, ...args: Parameters<T>) {
        const context = this

        if (timeout) {
            clearTimeout(timeout)
        }

        timeout = setTimeout(() => {
            func.apply(context, args)
            timeout = null
        }, wait)
    }
}

/**
 * 創建獨立的 MessageStore 實例（使用動態 Store ID）
 * 每個 Session 擁有獨立的 MessageStore
 *
 * @param sessionId - Session ID（用於生成唯一 Store ID）
 * @returns MessageStore 實例
 */
function createMessageStore(sessionId: string) {
    return defineStore(`message-${sessionId}`, () => {
        // State
        const messages = ref<Message[]>([])
        const isQuerying = ref<boolean>(false)
        const currentSessionId = ref<string | null>(sessionId)
        const sessionTotalCost = ref<number>(0)
        const sessionMessageCount = ref<number>(0)
        const sessionStatus = ref<'initializing' | 'ready' | 'completed' | ''>('')
        const sessionResult = ref<MessageResult | null>(null)

        // Getters
        const userMessages = computed<UserMessage[]>(() => {
            return messages.value.filter((m): m is UserMessage => m.type === 'user')
        })

        const assistantMessages = computed<AssistantMessage[]>(() => {
            return messages.value.filter((m): m is AssistantMessage => m.type === 'assistant')
        })

        const lastUserMessage = computed<UserMessage | undefined>(() => {
            const userMsgs = messages.value.filter((m): m is UserMessage => m.type === 'user')
            return userMsgs[userMsgs.length - 1]
        })

        const messageCount = computed<number>(() => {
            return messages.value.length
        })

        const hasStreamingMessage = computed<boolean>(() => {
            return messages.value.some(
                (m): m is AssistantMessage => m.type === 'assistant' && m.isStreaming === true
            )
        })

        const streamingMessageIndex = computed<number>(() => {
            return messages.value.findIndex(
                (m): m is AssistantMessage => m.type === 'assistant' && m.isStreaming === true
            )
        })

        const streamingMessage = computed<AssistantMessage | undefined>(() => {
            return messages.value.find(
                (m): m is AssistantMessage => m.type === 'assistant' && m.isStreaming === true
            )
        })

        // Actions (複製自 message.ts 的核心功能)
        function addUserMessage(text: string): UserMessage {
            const userMessage: UserMessage = {
                type: 'user',
                text,
                content: text
            }
            messages.value.push(userMessage)
            return userMessage
        }

        function createAssistantMessage(): number {
            const assistantMessage: AssistantMessage = {
                type: 'assistant',
                content: '',
                tools: [],
                subagentPrompts: [],
                toolsExpanded: false,
                isStreaming: true,
                isComplete: false,
                result: null,
                isHistorical: false
            }
            messages.value.push(assistantMessage)
            return messages.value.length - 1
        }

        function updateAssistantMessage(index: number, contentBlocks: ContentBlock[]): void {
            if (index === -1 || !messages.value[index]) return

            const msg = messages.value[index]
            if (msg.type !== 'assistant') return

            const toolsMap = new Map<string, ToolBlock>()
            msg.tools.forEach(tool => {
                toolsMap.set(tool.id, tool)
            })

            let textContent = ''

            for (const block of contentBlocks) {
                if (block.type === 'text' && block.text) {
                    textContent += block.text
                } else if (block.type === 'tool_use' && block.id && block.name) {
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
                    const tool = toolsMap.get(block.tool_use_id)
                    if (tool) {
                        tool.result = block.content
                        tool.is_error = block.is_error || false
                    }
                }
            }

            msg.content = textContent
            msg.tools = Array.from(toolsMap.values())
        }

        function markAssistantComplete(index: number, resultData: MessageResult): void {
            if (index === -1 || !messages.value[index]) return

            const msg = messages.value[index]
            if (msg.type !== 'assistant') return

            msg.isStreaming = false
            msg.isComplete = true
            msg.result = resultData

            if (resultData.total_cost_usd) {
                sessionTotalCost.value = resultData.total_cost_usd
            }

            sessionMessageCount.value = messages.value.filter(
                (m) => m.type === 'user' || m.type === 'assistant'
            ).length
        }

        function clearMessages(): void {
            messages.value = []
            currentSessionId.value = sessionId
            sessionStatus.value = ''
            sessionResult.value = null
            sessionTotalCost.value = 0
            sessionMessageCount.value = 0
            isQuerying.value = false
        }

        function setMessages(newMessages: Message[]): void {
            messages.value = newMessages
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
        }

        function setQuerying(querying: boolean): void {
            isQuerying.value = querying
        }

        function setSessionId(newSessionId: string | null): void {
            currentSessionId.value = newSessionId
        }

        function toggleToolsExpanded(messageIndex: number): void {
            if (messageIndex === -1 || !messages.value[messageIndex]) return
            const msg = messages.value[messageIndex]
            if (msg.type !== 'assistant') return
            msg.toolsExpanded = !msg.toolsExpanded
        }

        function toggleToolExpanded(messageIndex: number, toolId: string): void {
            if (messageIndex === -1 || !messages.value[messageIndex]) return
            const msg = messages.value[messageIndex]
            if (msg.type !== 'assistant') return
            const tool = msg.tools.find((t) => t.id === toolId)
            if (tool) {
                tool.expanded = !tool.expanded
            }
        }

        function addSubagentPrompt(messageIndex: number, prompt: SubagentPrompt): void {
            if (messageIndex === -1 || !messages.value[messageIndex]) return
            const msg = messages.value[messageIndex]
            if (msg.type !== 'assistant') return

            if (!msg.subagentPrompts) {
                msg.subagentPrompts = []
            }
            msg.subagentPrompts.push(prompt)
        }

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
            addSubagentPrompt,
            clearMessages,
            setMessages,
            setQuerying,
            setSessionId,
            toggleToolsExpanded,
            toggleToolExpanded
        }
    })()
}

/**
 * Session 狀態類型
 * - idle：閒置（歷史 Session 或等待中）
 * - running：執行中（正在查詢）
 * - error：錯誤（查詢失敗）
 * - complete：完成（查詢完成）
 */
export type SessionStatus = 'idle' | 'running' | 'error' | 'complete'

/**
 * Session 基本資訊
 */
export interface SessionInfo {
    /** Session 唯一 ID（來自 Claude SDK） */
    id: string
    /** Session 顯示名稱（自動生成 + 可編輯） */
    name: string
    /** Workspace 路徑 */
    workspacePath: string
    /** Session 狀態 */
    status: SessionStatus
    /** 最後活動時間 */
    lastActivity: Date
    /** 訊息數量 */
    messageCount: number
    /** 訊息是否已從資料庫載入 */
    isLoaded: boolean
    /** 當前查詢的 requestId（用於取消） */
    currentRequestId: string | null
    /** Session 總費用（美元）*/
    totalCost?: number
}

/**
 * Session 完整資料（包含 MessageStore 實例）
 */
interface SessionData extends SessionInfo {
    /** 獨立的 MessageStore 實例 */
    messageStore: ReturnType<typeof createMessageStore>
}

const MAX_SESSION_NAME_LENGTH = 50

/**
 * Session Manager Store
 *
 * 提供多 Session 管理的核心功能：
 * - 創建和刪除 Session
 * - Session 切換
 * - Session 命名（自動 + 手動）
 * - 狀態追蹤
 * - 與 Backend Database 同步
 *
 * 使用 Composition API (Setup Store) 實作
 */
export const useSessionManagerStore = defineStore('session-manager', () => {
    // ===========================
    // State (使用 ref)
    // ===========================

    /** 所有 Session 的 Map（key: sessionId） */
    const sessions = ref<Map<string, SessionData>>(new Map())

    /** 當前活躍的 Session ID */
    const activeSessionId = ref<string | null>(null)

    /** 正在執行查詢的 Session IDs */
    const runningQueries = ref<Set<string>>(new Set())

    // ===========================
    // Getters (使用 computed)
    // ===========================

    /**
     * 取得當前活躍的 Session
     */
    const activeSession = computed<SessionData | null>(() => {
        if (!activeSessionId.value) return null
        return sessions.value.get(activeSessionId.value) ?? null
    })

    /**
     * 取得當前活躍的 MessageStore
     */
    const activeMessageStore = computed(() => {
        return activeSession.value?.messageStore ?? null
    })

    /**
     * 取得所有 Session 列表（依最後活動時間排序）
     */
    const sessionList = computed<SessionInfo[]>(() => {
        return Array.from(sessions.value.values())
            .map(session => ({
                id: session.id,
                name: session.name,
                workspacePath: session.workspacePath,
                status: session.status,
                lastActivity: session.lastActivity,
                messageCount: session.messageCount,
                isLoaded: session.isLoaded,
                currentRequestId: session.currentRequestId,
                // 從 MessageStore 即時讀取 totalCost
                totalCost: session.messageStore.sessionTotalCost
            }))
            .sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime())
    })

    /**
     * Session 總數
     */
    const sessionCount = computed<number>(() => {
        return sessions.value.size
    })

    /**
     * 是否有 Session
     */
    const hasSessions = computed<boolean>(() => {
        return sessions.value.size > 0
    })

    /**
     * 正在執行的 Session 數量
     */
    const runningSessionCount = computed<number>(() => {
        return runningQueries.value.size
    })

    /**
     * 檢查當前 Session 是否可以發送查詢
     */
    const canQuery = computed<boolean>(() => {
        if (!activeSession.value) return false
        return activeSession.value.status !== 'running'
    })

    // ===========================
    // Actions (普通函數)
    // ===========================

    /**
     * 創建新的 Session
     *
     * @param workspacePath - Workspace 路徑
     * @param name - Session 名稱（可選，預設為 "New Chat"）
     * @returns 新創建的 Session ID
     */
    function createSession(workspacePath: string, name: string = 'New Chat'): string {
        // 生成唯一 ID（暫時使用時間戳，後續會由 Claude SDK 返回真實 session_id）
        const sessionId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

        // 創建獨立的 MessageStore 實例（使用動態 Store ID）
        const messageStore = createMessageStore(sessionId)

        // 創建 Session 資料
        const sessionData: SessionData = {
            id: sessionId,
            name,
            workspacePath,
            status: 'idle',
            lastActivity: new Date(),
            messageCount: 0,
            isLoaded: false,
            currentRequestId: null,
            messageStore
        }

        sessions.value.set(sessionId, sessionData)
        activeSessionId.value = sessionId

        console.log('[SessionManager] Created session:', {
            sessionId,
            name,
            workspacePath
        })

        return sessionId
    }

    /**
     * 添加歷史 Session 到 SessionManager
     * 使用真實 Session ID，不創建新的臨時 ID
     *
     * @param sessionId - 真實的 Session ID（來自資料庫）
     * @param workspacePath - 工作空間路徑
     * @param name - Session 名稱
     * @param messageCount - 訊息數量
     * @param lastActivity - 最後活動時間
     * @returns Session ID
     */
    function addHistoricalSession(
        sessionId: string,
        workspacePath: string,
        name: string,
        messageCount: number = 0,
        lastActivity: Date = new Date()
    ): string {
        // 檢查是否已存在（避免重複添加）
        if (sessions.value.has(sessionId)) {
            console.log('[SessionManager] Session already exists, switching:', sessionId)
            switchSession(sessionId)
            return sessionId
        }

        // 創建 MessageStore（使用真實 Session ID）
        const messageStore = createMessageStore(sessionId)

        // 創建 Session 資料
        const sessionData: SessionData = {
            id: sessionId, // 使用真實 ID，不是臨時 ID
            name,
            workspacePath,
            status: 'idle',
            lastActivity,
            messageCount,
            isLoaded: false, // 訊息尚未載入，需要 Lazy Loading
            currentRequestId: null,
            messageStore
        }

        sessions.value.set(sessionId, sessionData)
        // 不自動設置 activeSessionId，讓用戶手動選擇或在發送訊息時自動創建新 session
        // 移除：activeSessionId.value = sessionId

        console.log('[SessionManager] Added historical session:', {
            sessionId,
            name,
            messageCount
        })

        return sessionId
    }

    /**
     * 切換到指定的 Session
     *
     * @param sessionId - 要切換到的 Session ID
     */
    function switchSession(sessionId: string): void {
        const session = sessions.value.get(sessionId)
        if (!session) {
            console.warn('[SessionManager] Session not found:', sessionId)
            return
        }

        activeSessionId.value = sessionId

        console.log('[SessionManager] Switched to session:', {
            sessionId,
            name: session.name
        })
    }

    /**
     * 刪除 Session
     *
     * @param sessionId - 要刪除的 Session ID
     * @returns 是否成功刪除
     */
    function deleteSession(sessionId: string): boolean {
        const session = sessions.value.get(sessionId)
        if (!session) {
            console.warn('[SessionManager] Session not found:', sessionId)
            return false
        }

        // 如果 Session 正在執行，先取消查詢
        if (session.currentRequestId) {
            // TODO: 調用 WebSocket cancelQuery
            runningQueries.value.delete(sessionId)
        }

        // 清理 MessageStore
        session.messageStore.clearMessages()

        // 從 Map 中移除
        sessions.value.delete(sessionId)

        // 如果刪除的是當前活躍 Session，切換到第一個可用 Session
        if (activeSessionId.value === sessionId) {
            const firstSession = Array.from(sessions.value.keys())[0]
            activeSessionId.value = firstSession ?? null
        }

        console.log('[SessionManager] Deleted session:', sessionId)

        return true
    }

    /**
     * 重新命名 Session
     *
     * @param sessionId - Session ID
     * @param newName - 新名稱
     */
    function renameSession(sessionId: string, newName: string): void {
        const session = sessions.value.get(sessionId)
        if (!session) {
            console.warn('[SessionManager] Session not found:', sessionId)
            return
        }

        // 限制名稱長度
        const truncatedName = newName.slice(0, MAX_SESSION_NAME_LENGTH)
        session.name = truncatedName
        session.lastActivity = new Date()

        console.log('[SessionManager] Renamed session:', {
            sessionId,
            oldName: session.name,
            newName: truncatedName
        })
    }

    /**
     * 根據第一個 prompt 自動更新 Session 名稱
     *
     * @param sessionId - Session ID
     * @param prompt - 使用者 prompt
     */
    function updateSessionName(sessionId: string, prompt: string): void {
        const session = sessions.value.get(sessionId)
        if (!session) {
            console.warn('[SessionManager] Session not found:', sessionId)
            return
        }

        // 只在名稱為預設值時才更新
        if (session.name === 'New Chat') {
            // 取前 30 個字元作為名稱
            const autoName = prompt.slice(0, 30) + (prompt.length > 30 ? '...' : '')
            session.name = autoName
            session.lastActivity = new Date()

            console.log('[SessionManager] Auto-updated session name:', {
                sessionId,
                name: autoName
            })
        }
    }

    /**
     * 更新 Session 狀態
     *
     * @param sessionId - Session ID
     * @param status - 新狀態
     */
    function updateSessionStatus(sessionId: string, status: SessionStatus): void {
        const session = sessions.value.get(sessionId)
        if (!session) {
            console.warn('[SessionManager] Session not found:', sessionId)
            return
        }

        session.status = status
        session.lastActivity = new Date()

        // 更新 runningQueries
        if (status === 'running') {
            runningQueries.value.add(sessionId)
        } else {
            runningQueries.value.delete(sessionId)
        }

        console.log('[SessionManager] Updated session status:', {
            sessionId,
            status
        })
    }

    /**
     * 設置 Session 的 requestId
     *
     * @param sessionId - Session ID
     * @param requestId - 請求 ID（null 表示清除）
     */
    function setSessionRequestId(sessionId: string, requestId: string | null): void {
        const session = sessions.value.get(sessionId)
        if (!session) {
            console.warn('[SessionManager] Session not found:', sessionId)
            return
        }

        session.currentRequestId = requestId
    }

    /**
     * 更新 Session 的真實 ID（從 Claude SDK 返回後）
     *
     * @param tempId - 臨時 ID
     * @param realId - 真實 session_id
     */
    function updateSessionId(tempId: string, realId: string): void {
        const session = sessions.value.get(tempId)
        if (!session) {
            console.warn('[SessionManager] Session not found:', tempId)
            return
        }

        // 創建新的 SessionData（更新 ID）
        const updatedSession: SessionData = {
            ...session,
            id: realId
        }

        // 從 Map 中移除舊 ID，添加新 ID
        sessions.value.delete(tempId)
        sessions.value.set(realId, updatedSession)

        // 更新活躍 Session ID
        if (activeSessionId.value === tempId) {
            activeSessionId.value = realId
        }

        console.log('[SessionManager] Updated session ID:', {
            tempId,
            realId
        })
    }

    /**
     * 標記 Session 訊息已載入
     *
     * @param sessionId - Session ID
     */
    function markSessionLoaded(sessionId: string): void {
        const session = sessions.value.get(sessionId)
        if (!session) {
            console.warn('[SessionManager] Session not found:', sessionId)
            return
        }

        session.isLoaded = true
    }

    /**
     * 更新 Session 訊息數量
     *
     * @param sessionId - Session ID
     */
    function updateMessageCount(sessionId: string): void {
        const session = sessions.value.get(sessionId)
        if (!session) {
            console.warn('[SessionManager] Session not found:', sessionId)
            return
        }

        session.messageCount = session.messageStore.messageCount
        session.lastActivity = new Date()
    }

    /**
     * 取得指定 Session 的 MessageStore
     *
     * @param sessionId - Session ID
     * @returns MessageStore 實例或 null
     */
    function getMessageStore(sessionId: string): ReturnType<typeof useMessageStore> | null {
        const session = sessions.value.get(sessionId)
        return session?.messageStore ?? null
    }

    /**
     * 清空所有 Sessions
     */
    function clearAllSessions(): void {
        // 清理所有 MessageStore
        sessions.value.forEach(session => {
            session.messageStore.clearMessages()
        })

        sessions.value.clear()
        activeSessionId.value = null
        runningQueries.value.clear()

        console.log('[SessionManager] Cleared all sessions')
    }

    // ===========================
    // Return (導出所有需要的屬性)
    // ===========================
    return {
        // State
        sessions,
        activeSessionId,
        runningQueries,

        // Getters
        activeSession,
        activeMessageStore,
        sessionList,
        sessionCount,
        hasSessions,
        runningSessionCount,
        canQuery,

        // Actions
        createSession,
        addHistoricalSession,
        switchSession,
        deleteSession,
        renameSession,
        updateSessionName,
        updateSessionStatus,
        setSessionRequestId,
        updateSessionId,
        markSessionLoaded,
        updateMessageCount,
        getMessageStore,
        clearAllSessions
    }
})
