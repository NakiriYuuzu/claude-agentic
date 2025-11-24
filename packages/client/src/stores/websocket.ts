/**
 * WebSocket Store (Composition API / Setup Store)
 * 使用 Pinia 管理 WebSocket 連接狀態和查詢流程
 *
 * 功能：
 * - WebSocket 連接狀態管理
 * - 查詢發送和流式回應處理
 * - 與 Message Store 協同工作（訊息更新）
 * - 與 Workspace Store 協同工作（取得當前 workspace）
 * - 與 Settings Store 協同工作（取得查詢選項）
 * - 錯誤處理和重連機制
 *
 * 使用範例：
 * ```typescript
 * const wsStore = useWebSocketStore()
 * await wsStore.connect()
 * await wsStore.sendQuery('你好，Claude！')
 * ```
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getWebSocketService, type WebSocketState } from '@/services/websocket.service'
import type { WebSocketQueryOptions, WebSocketCompleteResponse, SDKMessage } from '@/types/api'
import type { QueryOptions } from '@/types/message'
import { useToast } from '@/composables/useToast'

/**
 * 過濾物件中的 null 和 undefined 值
 *
 * @param obj 原始物件
 * @returns 過濾後的物件（不包含 null 和 undefined 的屬性）
 */
function filterNullish<T extends Record<string, any>>(obj: T): Partial<T> {
  return Object.entries(obj).reduce((acc, [key, value]) => {
    if (value !== undefined && value !== null) {
      acc[key] = value
    }
    return acc
  }, {} as any)
}

/**
 * WebSocket Store
 *
 * 使用 Composition API (Setup Store) 實作
 */
export const useWebSocketStore = defineStore('websocket', () => {
  // ===========================
  // State (使用 ref)
  // ===========================

  /** WebSocket 連接狀態 */
  const state = ref<WebSocketState>('disconnected')

  /** requestId → sessionId 映射表（多 Session 支援） */
  const requestSessionMap = ref<Map<string, string>>(new Map())

  /** sessionId → Set<requestId> 反向映射表（用於快速清理） */
  const sessionRequestMap = ref<Map<string, Set<string>>>(new Map())

  /** 重連嘗試次數 */
  const reconnectAttempts = ref<number>(0)

  // ===========================
  // Getters (使用 computed)
  // ===========================

  /**
   * 檢查是否已連接
   */
  const connected = computed<boolean>(() => {
    return state.value === 'connected'
  })

  /**
   * 檢查是否可以發送查詢
   * 必須已連接
   */
  const canQuery = computed<boolean>(() => {
    return state.value === 'connected'
  })

  /**
   * 取得連接狀態描述
   */
  const statusText = computed<string>(() => {
    switch (state.value) {
      case 'disconnected':
        return '未連接'
      case 'connecting':
        return '連接中...'
      case 'connected':
        return '已連接'
      case 'reconnecting':
        return `重新連接中 (${reconnectAttempts.value}/5)...`
      default:
        return '未知狀態'
    }
  })

  // ===========================
  // Actions (普通函數)
  // ===========================

  /**
   * 建立 WebSocket 連接
   */
  async function connect(): Promise<void> {
    const ws = getWebSocketService()
    const toast = useToast()

    // 如果已經連接，不重複連接
    if (ws.isConnected()) {
      console.log('[WebSocketStore] Already connected')
      return
    }

    return new Promise((resolve, reject) => {
      ws.connect({
        onConnected: () => {
          console.log('[WebSocketStore] Connected')
          state.value = 'connected'
          reconnectAttempts.value = 0
          toast.success('WebSocket 已連線')
          resolve()
        },
        onDisconnected: () => {
          console.log('[WebSocketStore] Disconnected')
          state.value = 'disconnected'
          toast.warning('WebSocket 已斷線')
        },
        onError: (error) => {
          console.error('[WebSocketStore] Error:', error)
          toast.error('WebSocket 連線錯誤', error.message)
          reject(error)
        },
        onReconnecting: (attempt) => {
          console.log('[WebSocketStore] Reconnecting, attempt:', attempt)
          state.value = 'reconnecting'
          reconnectAttempts.value = attempt
          toast.info('重新連線中', `嘗試第 ${attempt} 次...`)
        }
      })

      // 設定連接超時（10 秒）
      setTimeout(() => {
        if (state.value !== 'connected') {
          toast.error('WebSocket 連線逾時', '無法建立連線')
          reject(new Error('WebSocket connection timeout'))
        }
      }, 10000)
    })
  }

  /**
   * 斷開 WebSocket 連接
   */
  function disconnect(): void {
    const ws = getWebSocketService()
    ws.disconnect()
    state.value = 'disconnected'
    reconnectAttempts.value = 0

    // 清理所有映射
    requestSessionMap.value.clear()
    sessionRequestMap.value.clear()

    console.log('[WebSocketStore] Disconnected')
  }

  /**
   * 發送查詢（多 Session 支援）
   *
   * @param sessionId Session ID（必填，用於路由訊息）
   * @param prompt 使用者提示
   * @param options 查詢選項（可選）
   * @returns Promise，在查詢完成時 resolve
   */
  async function sendQuery(sessionId: string, prompt: string, options?: QueryOptions): Promise<void> {
    const toast = useToast()

    // 檢查連接狀態
    if (state.value !== 'connected') {
      const error = 'WebSocket 未連接，無法發送查詢'
      toast.error('無法發送查詢', error)
      throw new Error(error)
    }

    // 動態引入 stores（避免循環依賴）
    const { useSessionManagerStore } = await import('./session-manager')
    const { useWorkspaceStore } = await import('./workspace')

    const sessionManager = useSessionManagerStore()
    const workspaceStore = useWorkspaceStore()

    // 檢查 Session 是否存在
    const session = sessionManager.sessions.get(sessionId)
    if (!session) {
      const error = `Session 不存在: ${sessionId}`
      toast.error('無法發送查詢', error)
      throw new Error(error)
    }

    // 檢查 Session 是否正在執行查詢
    if (session.status === 'running') {
      const error = '此 Session 已有查詢正在進行中'
      toast.error('無法發送查詢', error)
      throw new Error(error)
    }

    // 取得 Session 的 MessageStore
    const messageStore = session.messageStore

    // 取得當前 workspace 路徑
    const workspacePath = workspaceStore.currentWorkspacePath
    if (!workspacePath) {
      toast.error('未選擇工作空間', '請先選擇一個工作空間')
      throw new Error('未選擇工作空間')
    }

    // 建立 WebSocket 查詢選項（過濾 null 和 undefined 值）
    const wsOptions: WebSocketQueryOptions = filterNullish({
      model: options?.model,
      permissionMode: options?.permissionMode,
      maxTurns: options?.maxTurns,
      resume: options?.resume
    })

    // 添加使用者訊息
    messageStore.addUserMessage(prompt)

    // 如果是第一個 user message，自動更新 Session 名稱
    if (messageStore.userMessages.length === 1) {
      sessionManager.updateSessionName(sessionId, prompt)
    }

    // 建立助手訊息（流式更新）
    const assistantMessageIndex = messageStore.createAssistantMessage()

    // 發送查詢
    const ws = getWebSocketService()
    const { requestId, send } = ws.sendQuery(workspacePath, prompt, wsOptions)

    // 註冊雙向映射
    requestSessionMap.value.set(requestId, sessionId)
    if (!sessionRequestMap.value.has(sessionId)) {
      sessionRequestMap.value.set(sessionId, new Set())
    }
    sessionRequestMap.value.get(sessionId)!.add(requestId)

    // 更新 Session 狀態
    sessionManager.setSessionRequestId(sessionId, requestId)
    sessionManager.updateSessionStatus(sessionId, 'running')

    return new Promise((resolve, reject) => {
      send(
        // onMessage: 處理流式訊息
        (message: SDKMessage) => {
          handleMessage(message, assistantMessageIndex, sessionId)
        },

        // onComplete: 查詢完成
        (response: WebSocketCompleteResponse) => {
          handleComplete(response, assistantMessageIndex, sessionId)
          resolve()
        },

        // onError: 查詢錯誤
        (error: string) => {
          handleError(error, assistantMessageIndex, sessionId)
          reject(new Error(error))
        }
      )
    })
  }

  /**
   * 處理流式訊息（多 Session 支援）
   *
   * @param message SDK 訊息
   * @param messageIndex 助手訊息索引
   * @param sessionId Session ID
   */
  function handleMessage(message: SDKMessage, messageIndex: number, sessionId: string): void {
    // 動態引入 SessionManagerStore
    import('./session-manager')
      .then(({ useSessionManagerStore }) => {
        const sessionManager = useSessionManagerStore()
        const session = sessionManager.sessions.get(sessionId)

        if (!session) {
          console.error('[WebSocketStore] Session not found:', sessionId)
          return
        }

        const messageStore = session.messageStore

        console.log("[handleMessage]Full Original Message", message)

        // 根據訊息類型處理
        if (message.type === 'user' && message.subtype === 'subagent_task') {
          // 🔥 處理 Subagent Prompt（不加入訊息列表，而是存入當前 Assistant 訊息）
          console.log('[WebSocketStore] Subagent task detected:', {
            parent_tool_use_id: message.parent_tool_use_id,
            text_length: message.message?.content?.length || 0
          })

          messageStore.addSubagentPrompt(messageIndex, {
            text: message.message?.content || '',
            parent_tool_use_id: message.parent_tool_use_id || '',
            timestamp: new Date().toISOString()
          })
        } else if (message.type === 'assistant' && message.message?.content) {
          // 更新助手訊息內容
          messageStore.updateAssistantMessage(messageIndex, message.message.content)
        } else if (message.type === 'result') {
          // 處理查詢結果（統計資訊）
          messageStore.markAssistantComplete(messageIndex, {
            total_cost_usd: message.total_cost_usd,
            num_turns: message.num_turns,
            duration_ms: message.duration_ms,
            is_error: message.is_error,
            usage: message.usage
          })
        } else if (message.type === 'error') {
          // 處理錯誤訊息
          console.error('[WebSocketStore] Message error:', message.error)
        }

        // 更新 Session 訊息數量
        sessionManager.updateMessageCount(sessionId)
      })
      .catch((error) => {
        console.error('[WebSocketStore] Failed to import session manager:', error)
      })
  }

  /**
   * 處理查詢完成（多 Session 支援）
   *
   * @param response 完成回應
   * @param messageIndex 助手訊息索引
   * @param sessionId Session ID
   */
  function handleComplete(response: WebSocketCompleteResponse, messageIndex: number, sessionId: string): void {
    console.log('[WebSocketStore] Query complete:', response)
    const toast = useToast()

    // 清除雙向映射（使用反向映射快速查找）
    const requestIds = sessionRequestMap.value.get(sessionId)
    if (requestIds) {
      requestIds.forEach(reqId => {
        requestSessionMap.value.delete(reqId)
      })
      sessionRequestMap.value.delete(sessionId)
    }

    // 顯示查詢完成通知
    toast.success('查詢完成', '已收到回應')

    // 動態引入 stores
    Promise.all([
      import('./session-manager'),
      import('./settings'),
      import('./session'),
      import('./workspace')
    ])
      .then(([{ useSessionManagerStore }, { useSettingsStore }, { useSessionStore }, { useWorkspaceStore }]) => {
        const sessionManager = useSessionManagerStore()
        const settingsStore = useSettingsStore()
        const sessionStore = useSessionStore()
        const workspaceStore = useWorkspaceStore()

        const session = sessionManager.sessions.get(sessionId)
        if (!session) {
          console.error('[WebSocketStore] Session not found:', sessionId)
          return
        }

        // 更新 Session 狀態為 complete
        sessionManager.updateSessionStatus(sessionId, 'complete')
        sessionManager.setSessionRequestId(sessionId, null)

        // 如果有 SDK 返回的 session ID，更新 Session 的真實 ID
        if (response.sessionId && response.sessionId !== sessionId) {
          sessionManager.updateSessionId(sessionId, response.sessionId)
          // 更新 sessionId 引用
          sessionId = response.sessionId
        }

        // 設置 MessageStore 的 sessionId
        session.messageStore.setSessionId(response.sessionId || sessionId)

        // 設置 resume 參數以繼續對話
        settingsStore.setResume(response.sessionId || sessionId)

        // 重新載入 session 列表以顯示新建立的 session
        if (workspaceStore.currentWorkspacePath) {
          sessionStore.fetchSessions({
            workspace_path: workspaceStore.currentWorkspacePath
          }).catch((error) => {
            console.error('[WebSocketStore] Failed to fetch sessions:', error)
          })
        }

        // 更新 Session 訊息數量
        sessionManager.updateMessageCount(sessionId)
      })
      .catch((error) => {
        console.error('[WebSocketStore] Failed to import stores:', error)
      })
  }

  /**
   * 處理查詢錯誤（多 Session 支援）
   *
   * @param error 錯誤訊息
   * @param messageIndex 助手訊息索引
   * @param sessionId Session ID
   */
  function handleError(error: string, messageIndex: number, sessionId: string): void {
    console.error('[WebSocketStore] Query error:', error)
    const toast = useToast()

    // 清除雙向映射（使用反向映射快速查找）
    const requestIds = sessionRequestMap.value.get(sessionId)
    if (requestIds) {
      requestIds.forEach(reqId => {
        requestSessionMap.value.delete(reqId)
      })
      sessionRequestMap.value.delete(sessionId)
    }

    // 顯示錯誤通知（除非是斷線錯誤，已經由 onDisconnected 處理）
    if (!error.includes('連線已斷開') && !error.includes('連線已主動斷開')) {
      toast.error('查詢失敗', error)
    }

    // 動態引入 SessionManagerStore
    import('./session-manager')
      .then(({ useSessionManagerStore }) => {
        const sessionManager = useSessionManagerStore()
        const session = sessionManager.sessions.get(sessionId)

        if (!session) {
          console.error('[WebSocketStore] Session not found:', sessionId)
          return
        }

        const messageStore = session.messageStore

        // 更新 Session 狀態為 error
        sessionManager.updateSessionStatus(sessionId, 'error')
        sessionManager.setSessionRequestId(sessionId, null)

        // 標記助手訊息為錯誤狀態
        const msg = messageStore.messages[messageIndex]
        if (msg && msg.type === 'assistant') {
          msg.isStreaming = false
          msg.isComplete = true
          msg.result = {
            total_cost_usd: 0,
            num_turns: 0,
            duration_ms: 0,
            is_error: true,
            usage: { total_tokens: 0, input_tokens: 0, output_tokens: 0 }
          }
          // 如果是斷線錯誤，顯示更友善的訊息
          if (error.includes('連線已斷開') || error.includes('連線已主動斷開')) {
            msg.content = '查詢已中斷（WebSocket 連線已斷開）'
          } else {
            msg.content = `錯誤: ${error}`
          }
        }

        // 更新 Session 訊息數量
        sessionManager.updateMessageCount(sessionId)
      })
      .catch((err) => {
        console.error('[WebSocketStore] Failed to import session manager:', err)
      })
  }

  /**
   * 取消指定 Session 的查詢
   *
   * @param sessionId - Session ID
   */
  function cancelQuery(sessionId?: string): void {
    const ws = getWebSocketService()

    if (sessionId) {
      // 取消指定 Session 的所有查詢
      const requestIds = sessionRequestMap.value.get(sessionId)
      if (!requestIds || requestIds.size === 0) {
        console.warn('[WebSocketStore] No active query to cancel for session:', sessionId)
        return
      }

      requestIds.forEach(requestId => {
        console.log('[WebSocketStore] Cancelling query:', requestId)
        ws.cancelQuery(requestId)
      })
    } else {
      // 取消所有查詢（舊版 API，向後兼容）
      console.warn('[WebSocketStore] Cancelling all active queries')
      requestSessionMap.value.forEach((_, requestId) => {
        ws.cancelQuery(requestId)
      })
    }

    // 注意：狀態重置會在收到 cancelled 回應後由 handleError 處理
  }

  /**
   * 重置 Store 狀態
   */
  function reset(): void {
    disconnect()
  }

  // ===========================
  // Return (導出所有需要的屬性)
  // ===========================
  return {
    // State
    state,
    reconnectAttempts,
    requestSessionMap,
    sessionRequestMap,

    // Getters
    connected,
    canQuery,
    statusText,

    // Actions
    connect,
    disconnect,
    sendQuery,
    cancelQuery,
    handleMessage,
    handleComplete,
    handleError,
    reset
  }
})
