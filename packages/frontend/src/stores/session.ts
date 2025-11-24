/**
 * Session Store (Composition API / Setup Store)
 *
 * 管理 Claude Agent SDK Session（會話）狀態
 * - 載入 Session 列表與詳情
 * - 載入 Session 訊息
 * - 刪除 Session
 * - Session 統計資訊
 *
 * 參考來源：
 * - packages/frontend/public/composables/useSessions.js
 * - packages/bun-vite-vue-templates/src/types/session.ts
 * - packages/bun-vite-vue-templates/src/types/api.ts
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type {
  Session,
  SessionMessage,
  SessionStats,
  ListSessionsOptions,
  ListMessagesOptions,
  ConvertedMessage,
  ToolCall,
  SessionStatsResponse,
  MessageListResponse,
  DeleteResponse
} from '@/types/session'
import type { ListSessionsResponse } from '@/types/api'
import type { Message, UserMessage, AssistantMessage } from '@/types/message'

/**
 * Session Store
 *
 * 提供 Session 管理功能，包含列表載入、詳情查詢、刪除和統計資訊
 * 使用 Composition API (Setup Store) 實作
 */
export const useSessionStore = defineStore('session', () => {
  // ===========================
  // State (使用 ref)
  // ===========================

  /** Session 列表 */
  const sessions = ref<Session[]>([])

  /** 當前選定的 Session */
  const currentSession = ref<Session | null>(null)

  /** Session 統計資訊 */
  const stats = ref<SessionStats | null>(null)

  /** 是否正在載入 */
  const isLoading = ref<boolean>(false)

  /** 錯誤訊息 */
  const error = ref<string | null>(null)

  /** 分頁資訊 */
  const pagination = ref({
    total: 0,
    limit: 50,
    offset: 0
  })

  // ===========================
  // Getters (使用 computed)
  // ===========================

  /**
   * 最近的 Sessions（前 20 筆）
   */
  const recentSessions = computed<Session[]>(() => {
    return sessions.value.slice(0, 20)
  })

  /**
   * 正在執行的 Sessions
   */
  const runningSessions = computed<Session[]>(() => {
    return sessions.value.filter((s) => s.status === 'running')
  })

  /**
   * 已完成的 Sessions
   */
  const completedSessions = computed<Session[]>(() => {
    return sessions.value.filter((s) => s.status === 'completed')
  })

  /**
   * 錯誤的 Sessions
   */
  const errorSessions = computed<Session[]>(() => {
    return sessions.value.filter((s) => s.status === 'error')
  })

  /**
   * 當前 Session ID
   */
  const currentSessionId = computed<string | null>(() => {
    return currentSession.value?.session_id ?? null
  })

  /**
   * 是否有更多資料可載入
   */
  const hasMore = computed<boolean>(() => {
    return pagination.value.offset + pagination.value.limit < pagination.value.total
  })

  /**
   * 總頁數
   */
  const totalPages = computed<number>(() => {
    return Math.ceil(pagination.value.total / pagination.value.limit)
  })

  /**
   * 當前頁數（從 1 開始）
   */
  const currentPage = computed<number>(() => {
    return Math.floor(pagination.value.offset / pagination.value.limit) + 1
  })

  // ===========================
  // Actions (普通函數)
  // ===========================

  /**
   * 載入 Sessions 列表
   *
   * @param options - 查詢選項
   * @returns Promise<void>
   */
  async function fetchSessions(options?: ListSessionsOptions): Promise<void> {
    isLoading.value = true
    error.value = null

    try {
      // 構建查詢參數
      const params = new URLSearchParams()
      const limit = options?.limit ?? 50
      const offset = options?.offset ?? 0

      params.append('limit', limit.toString())
      params.append('offset', offset.toString())

      if (options?.workspace_path) {
        params.append('workspace_path', options.workspace_path)
      }
      if (options?.status) {
        params.append('status', options.status)
      }
      if (options?.order_by) {
        params.append('order_by', options.order_by)
      }
      if (options?.order) {
        params.append('order', options.order)
      }

      // 發送請求
      const response = await fetch(`/api/sessions?${params.toString()}`)
      const data: ListSessionsResponse = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || '載入 Sessions 失敗')
      }

      // 更新 state
      if (data.data) {
        // 為每個 session 載入第一條使用者訊息（異步載入）
        const sessionsWithMessages = await Promise.all(
          data.data.sessions.map(async (session) => {
            try {
              const msgResponse = await fetch(
                `/api/sessions/${session.session_id}/messages?message_type=user&limit=1`
              )
              const msgData: MessageListResponse = await msgResponse.json()

              if (msgData.success && msgData.data && msgData.data.messages.length > 0) {
                const firstMsg = msgData.data.messages[0]
                if (!firstMsg) return session
                const content = JSON.parse(firstMsg.message_content)

                // 提取文字內容
                let text = ''
                if (content.message?.content) {
                  if (Array.isArray(content.message.content)) {
                    const textBlock = content.message.content.find(
                      (block: any) => block.type === 'text'
                    )
                    text = textBlock?.text || ''
                  } else if (typeof content.message.content === 'string') {
                    text = content.message.content
                  }
                }

                return { ...session, first_user_message: text }
              }
            } catch (err) {
              console.error(
                `無法載入 session ${session.session_id} 的第一條訊息:`,
                err
              )
            }
            return session
          })
        )

        sessions.value = sessionsWithMessages
        pagination.value = {
          total: data.data.total,
          limit: data.data.limit,
          offset: data.data.offset
        }
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : '未知錯誤'
      console.error('載入 Sessions 失敗:', err)
    } finally {
      isLoading.value = false
    }
  }

  /**
   * 載入單一 Session 詳情
   *
   * @param sessionId - Session ID
   * @returns Promise<void>
   */
  async function loadSession(sessionId: string): Promise<void> {
    isLoading.value = true
    error.value = null

    try {
      const response = await fetch(`/api/sessions/${sessionId}`)
      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || '載入 Session 失敗')
      }

      currentSession.value = data.data
    } catch (err) {
      error.value = err instanceof Error ? err.message : '未知錯誤'
      console.error('載入 Session 失敗:', err)
      throw err
    } finally {
      isLoading.value = false
    }
  }

  /**
   * 載入 Session 訊息列表
   *
   * @param sessionId - Session ID
   * @param options - 查詢選項
   * @returns Promise<SessionMessage[]>
   */
  async function loadSessionMessages(
    sessionId: string,
    options?: ListMessagesOptions
  ): Promise<SessionMessage[]> {
    try {
      const params = new URLSearchParams()

      if (options?.message_type) {
        params.append('message_type', options.message_type)
      }
      if (options?.limit) {
        params.append('limit', options.limit.toString())
      }
      if (options?.offset) {
        params.append('offset', options.offset.toString())
      }

      const response = await fetch(
        `/api/sessions/${sessionId}/messages?${params.toString()}`
      )
      const data: MessageListResponse = await response.json()

      if (!response.ok || !data.success) {
        throw new Error('載入訊息失敗')
      }

      return data.data?.messages || []
    } catch (err) {
      console.error('載入 Session 訊息失敗:', err)
      throw err
    }
  }

  /**
   * 刪除 Session
   *
   * @param sessionId - Session ID
   * @returns Promise<void>
   */
  async function deleteSession(sessionId: string): Promise<void> {
    isLoading.value = true
    error.value = null

    try {
      const response = await fetch(`/api/sessions/${sessionId}`, {
        method: 'DELETE'
      })
      const data: DeleteResponse = await response.json()

      if (!response.ok || !data.success) {
        throw new Error('刪除失敗')
      }

      // 從列表中移除
      sessions.value = sessions.value.filter((s) => s.session_id !== sessionId)

      // 如果是當前 Session，清除
      if (currentSession.value?.session_id === sessionId) {
        currentSession.value = null
      }

      // 重新載入統計資訊
      await fetchStats()
    } catch (err) {
      error.value = err instanceof Error ? err.message : '未知錯誤'
      console.error('刪除 Session 失敗:', err)
      throw err
    } finally {
      isLoading.value = false
    }
  }

  /**
   * 載入 Session 統計資訊
   *
   * @param workspacePath - 可選的工作空間路徑篩選
   * @returns Promise<void>
   */
  async function fetchStats(workspacePath?: string): Promise<void> {
    try {
      const params = new URLSearchParams()
      if (workspacePath) {
        params.append('workspace_path', workspacePath)
      }

      const response = await fetch(`/api/sessions/stats?${params.toString()}`)
      const data: SessionStatsResponse = await response.json()

      if (!response.ok || !data.success) {
        throw new Error('載入統計資訊失敗')
      }

      stats.value = data.data
    } catch (err) {
      console.error('載入統計資訊失敗:', err)
      throw err
    }
  }

  /**
   * 設定當前 Session
   *
   * @param session - Session 物件或 null
   */
  function setCurrentSession(session: Session | null): void {
    currentSession.value = session
  }

  /**
   * 清除所有 Sessions
   */
  function clearSessions(): void {
    sessions.value = []
    currentSession.value = null
    pagination.value = {
      total: 0,
      limit: 50,
      offset: 0
    }
  }

  /**
   * 重新載入當前頁面的 Sessions
   */
  async function refreshSessions(): Promise<void> {
    await fetchSessions({
      limit: pagination.value.limit,
      offset: pagination.value.offset
    })
  }

  /**
   * 載入下一頁
   */
  async function loadNextPage(): Promise<void> {
    if (!hasMore.value) {
      return
    }

    await fetchSessions({
      limit: pagination.value.limit,
      offset: pagination.value.offset + pagination.value.limit
    })
  }

  /**
   * 載入上一頁
   */
  async function loadPreviousPage(): Promise<void> {
    if (pagination.value.offset === 0) {
      return
    }

    await fetchSessions({
      limit: pagination.value.limit,
      offset: Math.max(0, pagination.value.offset - pagination.value.limit)
    })
  }

  /**
   * 轉換 Session 訊息為前端顯示格式
   *
   * 此方法參考 packages/frontend/public/composables/useSessions.js
   * 的 convertSessionMessages 實作
   *
   * @param messages - 原始 Session 訊息
   * @param parseToolBlocks - 解析 Tool Blocks 的函數
   * @returns ConvertedMessage[]
   */
  function convertSessionMessages(
    messages: SessionMessage[],
    parseToolBlocks: (content: any[]) => ToolCall[]
  ): ConvertedMessage[] {
    const converted: ConvertedMessage[] = []

    for (const msg of messages) {
      try {
        const content = JSON.parse(msg.message_content)

        // 跳過 system init 訊息
        if (msg.message_type === 'system' && msg.message_subtype === 'init') {
          continue
        }

        // 處理 user 訊息
        if (msg.message_type === 'user') {
          // 🔥 檢查是否為 subagent_task（檢查 parent_tool_use_id）
          if (msg.message_subtype === 'subagent_task' || content.parent_tool_use_id) {
            // 提取 prompt 資訊
            const message = content.message || content
            let text = ''

            if (message.content) {
              if (Array.isArray(message.content)) {
                text = message.content
                  .filter((block: any) => block.type === 'text')
                  .map((block: any) => block.text)
                  .join('\n\n')
              } else if (typeof message.content === 'string') {
                text = message.content
              }
            } else if (typeof message === 'string') {
              text = message
            }

            // 找到最後一個 assistant 訊息並添加 subagent prompt
            const lastAssistantIndex = converted
              .map((m, i) => (m.type === 'assistant' ? i : -1))
              .filter((i) => i >= 0)
              .pop()

            if (lastAssistantIndex !== undefined && converted[lastAssistantIndex]) {
              const lastAssistant = converted[lastAssistantIndex]
              if (!lastAssistant.subagentPrompts) {
                lastAssistant.subagentPrompts = []
              }
              lastAssistant.subagentPrompts.push({
                text: text,
                parent_tool_use_id: content.parent_tool_use_id || '',
                timestamp: msg.created_at
              })
            }

            // 跳過，不作為 UserMessage 加入
            continue
          }

          // 一般 user 訊息處理
          const message = content.message || content
          let text = ''

          if (message.content) {
            if (Array.isArray(message.content)) {
              text = message.content
                .filter((block: any) => block.type === 'text')
                .map((block: any) => block.text)
                .join('\n\n')
            } else if (typeof message.content === 'string') {
              text = message.content
            }
          } else if (typeof message === 'string') {
            text = message
          } else if (message.role === 'user' && Array.isArray(message.content)) {
            text = message.content
              .filter((block: any) => block.type === 'text')
              .map((block: any) => block.text)
              .join('\n\n')
          }

          if (text) {
            converted.push({
              type: 'user',
              text: text
            })
          }
        }

        // 處理 assistant 訊息
        if (msg.message_type === 'assistant') {
          const message = content.message || {}
          let text = ''
          let tools: ToolCall[] = []

          if (message.content) {
            text = message.content
              .filter((block: any) => block.type === 'text')
              .map((block: any) => block.text)
              .join('\n\n')

            tools = parseToolBlocks(message.content)
          }

          // 合併邏輯：如果上一條是 assistant 且沒有 result，則合併
          const lastMsg = converted[converted.length - 1]
          const shouldMerge =
            lastMsg && lastMsg.type === 'assistant' && !lastMsg.result

          if (shouldMerge && (text || tools.length > 0)) {
            // 合併訊息
            if (text) {
              lastMsg.content = lastMsg.content
                ? lastMsg.content + '\n\n' + text
                : text
            }

            // 合併工具（去重）
            if (tools.length > 0) {
              const existingIds = new Set(
                (lastMsg.tools || []).map((t: ToolCall) => t.id)
              )
              const newTools = tools.filter((t) => !existingIds.has(t.id))
              lastMsg.tools = [...(lastMsg.tools || []), ...newTools]
            }
          } else if (text || tools.length > 0) {
            // 建立新的 assistant 訊息
            converted.push({
              type: 'assistant',
              content: text,
              tools: tools,
              subagentPrompts: [],
              toolsExpanded: false,
              isStreaming: false,
              result: null,
              isHistorical: true
            })
          }
        }

        // 處理 result 訊息
        if (msg.message_type === 'result') {
          // 找到最後一條 assistant 訊息並附加 result
          const lastAssistantIndex = converted
            .map((m, i) => (m.type === 'assistant' ? i : -1))
            .filter((i) => i >= 0)
            .pop()

          if (lastAssistantIndex !== undefined && converted[lastAssistantIndex]) {
            converted[lastAssistantIndex].result = content
          }
        }
      } catch (e) {
        console.error('解析訊息失敗:', e)
      }
    }

    return converted
  }

  /**
   * 載入並顯示 Session 訊息
   *
   * 此方法從 API 載入指定 Session 的所有訊息，並轉換為前端顯示格式。
   * 訊息會同時更新到 message store 和 session store。
   *
   * @param sessionId - Session ID
   * @throws 若 API 呼叫失敗則拋出錯誤
   */
  async function loadMessages(sessionId: string): Promise<void> {
    isLoading.value = true
    error.value = null

    try {
      // 動態導入避免循環依賴
      const { useMessageStore } = await import('@/stores/message')
      const { useSettingsStore } = await import('@/stores/settings')
      const messageStore = useMessageStore()
      const settingsStore = useSettingsStore()

      // 從 API 載入 session 詳情
      await loadSession(sessionId)

      // 從 API 載入 session 訊息
      const rawMessages = await loadSessionMessages(sessionId)

      if (!Array.isArray(rawMessages)) {
        throw new Error('訊息列表格式不正確')
      }

      // 動態導入 parseToolBlocks 函數
      const { parseToolBlocks } = await import('@workspace/shared')

      // 轉換訊息為前端格式
      const convertedMessages = convertSessionMessages(
        rawMessages,
        parseToolBlocks as (content: any[]) => ToolCall[]
      )

      // 更新 message store
      const messagesToDisplay: Message[] = convertedMessages.map((msg): Message => {
        if (msg.type === 'user') {
          return {
            type: 'user',
            text: msg.text || '',
            content: msg.text || ''
          } as UserMessage
        } else {
          return {
            type: 'assistant',
            content: msg.content || '',
            tools: msg.tools || [],
            toolsExpanded: msg.toolsExpanded ?? false,
            isStreaming: false,
            isComplete: true,
            result: msg.result || null,
            isHistorical: true
          } as AssistantMessage
        }
      })

      messageStore.setMessages(messagesToDisplay)
      messageStore.setSessionId(sessionId)

      // 設置 resume 參數以繼續對話
      settingsStore.setResume(sessionId)

      console.log('[SessionStore] Loaded messages for session:', {
        sessionId,
        messageCount: messagesToDisplay.length,
        userMessages: messagesToDisplay.filter((m: any) => m.type === 'user').length,
        assistantMessages: messagesToDisplay.filter((m: any) => m.type === 'assistant').length,
        resumeSet: true
      })
    } catch (err) {
      error.value = err instanceof Error ? err.message : '載入訊息失敗'
      console.error('[SessionStore] Failed to load messages:', error.value)
      throw err
    } finally {
      isLoading.value = false
    }
  }

  // ===========================
  // Return (導出所有需要的屬性)
  // ===========================
  return {
    // State
    sessions,
    currentSession,
    stats,
    isLoading,
    error,
    pagination,

    // Getters
    recentSessions,
    runningSessions,
    completedSessions,
    errorSessions,
    currentSessionId,
    hasMore,
    totalPages,
    currentPage,

    // Actions
    fetchSessions,
    loadSession,
    loadSessionMessages,
    loadMessages,
    deleteSession,
    fetchStats,
    setCurrentSession,
    clearSessions,
    refreshSessions,
    loadNextPage,
    loadPreviousPage,
    convertSessionMessages
  }
})
