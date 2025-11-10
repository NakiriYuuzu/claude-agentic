/**
 * useSessions Composable
 * Session 管理與歷史記錄載入
 */

const { ref } = Vue

export function useSessions() {
    // 響應式狀態
    const recentSessions = ref([])
    const sessionStats = ref(null)

    /**
     * 載入最近的 Sessions
     */
    async function fetchRecentSessions() {
        try {
            const response = await fetch('/api/sessions?limit=10&offset=0')
            const data = await response.json()
            if (data.success) {
                // 為每個 session 獲取第一條使用者訊息
                const sessionsWithMessages = await Promise.all(
                    data.data.sessions.map(async (session) => {
                        try {
                            const msgResponse = await fetch(`/api/sessions/${session.session_id}/messages?message_type=user&limit=1`)
                            const msgData = await msgResponse.json()
                            if (msgData.success && msgData.data.messages.length > 0) {
                                const firstMsg = msgData.data.messages[0]
                                const content = JSON.parse(firstMsg.message_content)

                                // 提取文字內容
                                let text = ''
                                if (content.message?.content) {
                                    if (Array.isArray(content.message.content)) {
                                        const textBlock = content.message.content.find(block => block.type === 'text')
                                        text = textBlock?.text || ''
                                    } else if (typeof content.message.content === 'string') {
                                        text = content.message.content
                                    }
                                }

                                session.first_user_message = text
                            }
                        } catch (error) {
                            console.error(`Failed to fetch first message for session ${session.session_id}:`, error)
                        }
                        return session
                    })
                )
                recentSessions.value = sessionsWithMessages
            }
        } catch (error) {
            console.error('Failed to fetch sessions:', error)
        }
    }

    /**
     * 載入 Session 訊息
     */
    async function loadSessionMessages(sessionId) {
        try {
            const response = await fetch(`/api/sessions/${sessionId}/messages`)
            const data = await response.json()
            if (data.success) {
                return data.data.messages
            }
        } catch (error) {
            console.error('Failed to load session messages:', error)
        }
        return []
    }

    /**
     * 刪除 Session
     */
    async function deleteSession(sessionId) {
        try {
            const response = await fetch(`/api/sessions/${sessionId}`, {
                method: 'DELETE'
            })
            const data = await response.json()

            if (data.success) {
                await fetchRecentSessions()
                await fetchSessionStats()
                return true
            } else {
                throw new Error(data.error || '刪除失敗')
            }
        } catch (error) {
            console.error('Failed to delete session:', error)
            throw error
        }
    }

    /**
     * 載入 Session 統計
     */
    async function fetchSessionStats() {
        try {
            const response = await fetch('/api/sessions/stats')
            const data = await response.json()
            if (data.success) {
                sessionStats.value = data.data
            }
        } catch (error) {
            console.error('Failed to fetch stats:', error)
        }
    }

    /**
     * 轉換 Session 訊息為顯示格式
     */
    function convertSessionMessages(messages, parseToolBlocks) {
        const converted = []

        for (const msg of messages) {
            try {
                const content = JSON.parse(msg.message_content)

                if (msg.message_type === 'system' && msg.message_subtype === 'init') {
                    continue
                } else if (msg.message_type === 'user') {
                    const message = content.message || content
                    let text = ''

                    if (message.content) {
                        if (Array.isArray(message.content)) {
                            text = message.content
                                .filter(block => block.type === 'text')
                                .map(block => block.text)
                                .join('\n\n')
                        } else if (typeof message.content === 'string') {
                            text = message.content
                        }
                    } else if (typeof message === 'string') {
                        text = message
                    } else if (message.role === 'user' && Array.isArray(message.content)) {
                        text = message.content
                            .filter(block => block.type === 'text')
                            .map(block => block.text)
                            .join('\n\n')
                    }

                    if (text) {
                        converted.push({
                            type: 'user',
                            text: text
                        })
                    }
                } else if (msg.message_type === 'assistant') {
                    const message = content.message || {}
                    let text = ''
                    let tools = []

                    if (message.content) {
                        text = message.content
                            .filter(block => block.type === 'text')
                            .map(block => block.text)
                            .join('\n\n')

                        tools = parseToolBlocks(message.content)
                    }

                    // 合併邏輯
                    const lastMsg = converted[converted.length - 1]
                    const shouldMerge = lastMsg &&
                                        lastMsg.type === 'assistant' &&
                                        !lastMsg.result

                    if (shouldMerge && (text || tools.length > 0)) {
                        console.log('[convertSession] Merging assistant message')

                        if (text) {
                            lastMsg.content = lastMsg.content
                                ? lastMsg.content + '\n\n' + text
                                : text
                        }

                        if (tools.length > 0) {
                            const existingIds = new Set(lastMsg.tools.map(t => t.id))
                            const newTools = tools.filter(t => !existingIds.has(t.id))
                            lastMsg.tools = [...lastMsg.tools, ...newTools]
                            console.log('[convertSession] Merged tools:', newTools.map(t => t.name))
                        }
                    } else if (text || tools.length > 0) {
                        console.log('[convertSession] Creating NEW assistant bubble')
                        converted.push({
                            type: 'assistant',
                            content: text,
                            tools: tools,
                            toolsExpanded: false,
                            isStreaming: false,
                            result: null,
                            isHistorical: true  // 標記為歷史訊息
                        })
                    }
                } else if (msg.message_type === 'result') {
                    const lastAssistantIndex = converted
                        .map((m, i) => m.type === 'assistant' ? i : -1)
                        .filter(i => i >= 0)
                        .pop()

                    if (lastAssistantIndex !== undefined && converted[lastAssistantIndex]) {
                        converted[lastAssistantIndex].result = content
                        console.log('[convertSession] Attached result to assistant')
                    }
                }
            } catch (e) {
                console.error('Failed to parse message:', e)
            }
        }

        console.log('[convertSession] Final converted messages:', converted.length)
        return converted
    }

    return {
        // 狀態
        recentSessions,
        sessionStats,

        // 方法
        fetchRecentSessions,
        loadSessionMessages,
        deleteSession,
        fetchSessionStats,
        convertSessionMessages
    }
}
