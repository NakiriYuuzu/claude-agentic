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

  /** 當前查詢的請求 ID */
  const currentRequestId = ref<string | null>(null)

  /** 是否正在查詢中 */
  const isQuerying = ref<boolean>(false)

  /** 重連嘗試次數 */
  const reconnectAttempts = ref<number>(0)

  /** 最後的錯誤訊息 */
  const lastError = ref<string | null>(null)

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
   * 必須已連接且沒有正在進行的查詢
   */
  const canQuery = computed<boolean>(() => {
    return state.value === 'connected' && !isQuerying.value
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
        return isQuerying.value ? '查詢中...' : '已連接'
      case 'reconnecting':
        return `重新連接中 (${reconnectAttempts.value}/5)...`
      default:
        return '未知狀態'
    }
  })

  /**
   * 檢查是否有錯誤
   */
  const hasError = computed<boolean>(() => {
    return lastError.value !== null
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
          lastError.value = null
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
          lastError.value = error.message
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
    currentRequestId.value = null
    isQuerying.value = false
    reconnectAttempts.value = 0
    console.log('[WebSocketStore] Disconnected')
  }

  /**
   * 發送查詢
   *
   * @param prompt 使用者提示
   * @param options 查詢選項（可選）
   * @returns Promise，在查詢完成時 resolve
   */
  async function sendQuery(prompt: string, options?: QueryOptions): Promise<void> {
    const toast = useToast()

    // 檢查連接狀態
    if (!canQuery.value) {
      const error =
        state.value !== 'connected'
          ? 'WebSocket 未連接，無法發送查詢'
          : '已有查詢正在進行中'
      toast.error('無法發送查詢', error)
      throw new Error(error)
    }

    // 動態引入其他 stores（避免循環依賴）
    const { useWorkspaceStore } = await import('./workspace')
    const { useMessageStore } = await import('./message')

    const workspaceStore = useWorkspaceStore()
    const messageStore = useMessageStore()

    // 取得當前 workspace 路徑
    const workspacePath = workspaceStore.currentWorkspacePath
    if (!workspacePath) {
      toast.error('未選擇工作空間', '請先選擇一個工作空間')
      throw new Error('未選擇工作空間')
    }

    // 建立 WebSocket 查詢選項
    const wsOptions: WebSocketQueryOptions = {
      model: options?.model,
      permissionMode: options?.permissionMode,
      maxTurns: options?.maxTurns,
      resume: options?.resume
    }

    // 添加使用者訊息
    messageStore.addUserMessage(prompt)

    // 建立助手訊息（流式更新）
    const assistantMessageIndex = messageStore.createAssistantMessage()

    // 發送查詢
    const ws = getWebSocketService()
    const { requestId, send } = ws.sendQuery(workspacePath, prompt, wsOptions)

    currentRequestId.value = requestId
    isQuerying.value = true
    lastError.value = null

    return new Promise((resolve, reject) => {
      send(
        // onMessage: 處理流式訊息
        (message: SDKMessage) => {
          handleMessage(message, assistantMessageIndex)
        },

        // onComplete: 查詢完成
        (response: WebSocketCompleteResponse) => {
          handleComplete(response, assistantMessageIndex)
          resolve()
        },

        // onError: 查詢錯誤
        (error: string) => {
          handleError(error, assistantMessageIndex)
          reject(new Error(error))
        }
      )
    })
  }

  /**
   * 處理流式訊息
   *
   * @param message SDK 訊息
   * @param messageIndex 助手訊息索引
   */
  function handleMessage(message: SDKMessage, messageIndex: number): void {
    // 動態引入 Message Store
    import('./message')
      .then(({ useMessageStore }) => {
        const messageStore = useMessageStore()

        // 根據訊息類型處理
        if (message.type === 'assistant' && message.message?.content) {
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
      })
      .catch((error) => {
        console.error('[WebSocketStore] Failed to import message store:', error)
      })
  }

  /**
   * 處理查詢完成
   *
   * @param response 完成回應
   * @param messageIndex 助手訊息索引
   */
  function handleComplete(response: WebSocketCompleteResponse, messageIndex: number): void {
    console.log('[WebSocketStore] Query complete:', response)
    const toast = useToast()

    // 標記查詢結束
    isQuerying.value = false
    currentRequestId.value = null

    // 顯示查詢完成通知
    toast.success('查詢完成', '已收到回應')

    // 動態引入 Message Store
    import('./message')
      .then(({ useMessageStore }) => {
        const messageStore = useMessageStore()

        // 標記助手訊息完成（已在 handleMessage 處理 result 時完成）
        // 這裡不需要再次調用 markAssistantComplete

        // 如果有 session ID，更新當前 session
        if (response.sessionId) {
          messageStore.setSessionId(response.sessionId)
        }
      })
      .catch((error) => {
        console.error('[WebSocketStore] Failed to import message store:', error)
      })
  }

  /**
   * 處理查詢錯誤
   *
   * @param error 錯誤訊息
   * @param messageIndex 助手訊息索引
   */
  function handleError(error: string, messageIndex: number): void {
    console.error('[WebSocketStore] Query error:', error)

    // 標記查詢結束
    isQuerying.value = false
    currentRequestId.value = null
    lastError.value = error

    // 動態引入 Message Store
    import('./message')
      .then(({ useMessageStore }) => {
        const messageStore = useMessageStore()

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
          msg.content = `錯誤: ${error}`
        }
      })
      .catch((err) => {
        console.error('[WebSocketStore] Failed to import message store:', err)
      })
  }

  /**
   * 清除最後的錯誤
   */
  function clearError(): void {
    lastError.value = null
  }

  /**
   * 重置 Store 狀態
   */
  function reset(): void {
    disconnect()
    lastError.value = null
  }

  // ===========================
  // Return (導出所有需要的屬性)
  // ===========================
  return {
    // State
    state,
    currentRequestId,
    isQuerying,
    reconnectAttempts,
    lastError,

    // Getters
    connected,
    canQuery,
    statusText,
    hasError,

    // Actions
    connect,
    disconnect,
    sendQuery,
    handleMessage,
    handleComplete,
    handleError,
    clearError,
    reset
  }
})
