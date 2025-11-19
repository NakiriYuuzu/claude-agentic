/**
 * WebSocket Service
 * 負責管理與後端 WebSocket 連接的低層通訊邏輯
 *
 * 提供功能：
 * - WebSocket 連接管理（建立、重連、斷開）
 * - 訊息發送和接收
 * - 請求-回應映射管理
 * - 自動重連機制（指數退避）
 *
 * 使用範例：
 * ```typescript
 * const ws = new WebSocketService()
 * ws.connect()
 * const { requestId, send } = ws.sendQuery(workspacePath, prompt, options)
 * send(
 *   (message) => console.log('Message:', message),
 *   (complete) => console.log('Complete:', complete),
 *   (error) => console.error('Error:', error)
 * )
 * ```
 */

import type {
  WebSocketQueryRequest,
  WebSocketQueryOptions,
  WebSocketResponse,
  WebSocketMessageResponse,
  WebSocketCompleteResponse,
  WebSocketErrorResponse,
  WebSocketConnectedResponse,
  WebSocketRequestCallbacks,
  SDKMessage
} from '@/types/api'

/**
 * WebSocket 連接狀態
 */
export type WebSocketState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting'

/**
 * WebSocket 事件回調
 */
export interface WebSocketEventHandlers {
  onConnected?: () => void
  onDisconnected?: () => void
  onError?: (error: Error) => void
  onReconnecting?: (attempt: number) => void
}

/**
 * WebSocket Service 類別
 */
export class WebSocketService {
  private ws: WebSocket | null = null
  private state: WebSocketState = 'disconnected'
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private requestCallbacks = new Map<string, WebSocketRequestCallbacks>()
  private eventHandlers: WebSocketEventHandlers = {}
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null

  /**
   * 建立 WebSocket 連接
   */
  connect(handlers?: WebSocketEventHandlers): void {
    if (this.state === 'connected' || this.state === 'connecting') {
      console.warn('[WebSocket] Already connected or connecting')
      return
    }

    // 儲存事件處理器
    if (handlers) {
      this.eventHandlers = { ...this.eventHandlers, ...handlers }
    }

    this.state = 'connecting'
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.host
    const wsUrl = `${protocol}//${host}/api/ws`

    console.log('[WebSocket] Connecting to:', wsUrl)

    try {
      this.ws = new WebSocket(wsUrl)

      this.ws.onopen = () => {
        console.log('[WebSocket] Connected')
        this.state = 'connected'
        this.reconnectAttempts = 0
        this.eventHandlers.onConnected?.()
      }

      this.ws.onmessage = (event) => {
        try {
          const data: WebSocketResponse = JSON.parse(event.data)
          this.handleMessage(data)
        } catch (error) {
          console.error('[WebSocket] Failed to parse message:', error)
        }
      }

      this.ws.onerror = (event) => {
        console.error('[WebSocket] Error:', event)
        const error = new Error('WebSocket connection error')
        this.eventHandlers.onError?.(error)
      }

      this.ws.onclose = () => {
        console.log('[WebSocket] Disconnected')
        const wasConnected = this.state === 'connected'
        this.state = 'disconnected'
        this.ws = null

        // 清理所有正在進行的請求，並觸發錯誤回調
        this.cleanupPendingRequests('WebSocket 連線已斷開')

        if (wasConnected) {
          this.eventHandlers.onDisconnected?.()
          this.attemptReconnect()
        }
      }
    } catch (error) {
      console.error('[WebSocket] Connection failed:', error)
      this.state = 'disconnected'
      this.eventHandlers.onError?.(error as Error)
    }
  }

  /**
   * 斷開 WebSocket 連接
   */
  disconnect(): void {
    console.log('[WebSocket] Disconnecting...')

    // 清除重連計時器
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }

    // 清理所有正在進行的請求
    this.cleanupPendingRequests('WebSocket 連線已主動斷開')

    // 關閉連接
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }

    // 清理狀態
    this.state = 'disconnected'
    this.reconnectAttempts = 0
  }

  /**
   * 嘗試重連（指數退避）
   */
  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[WebSocket] Max reconnect attempts reached')
      const error = new Error('無法重新連接 WebSocket，已達最大重試次數')
      this.eventHandlers.onError?.(error)
      return
    }

    this.reconnectAttempts++
    this.state = 'reconnecting'

    // 指數退避算法：1s, 2s, 4s, 8s, 16s
    const delay = 1000 * Math.pow(2, this.reconnectAttempts - 1)

    console.log(`[WebSocket] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`)
    this.eventHandlers.onReconnecting?.(this.reconnectAttempts)

    this.reconnectTimer = setTimeout(() => {
      this.connect()
    }, delay)
  }

  /**
   * 處理接收到的訊息
   */
  private handleMessage(data: WebSocketResponse): void {
    // 處理連接確認訊息
    if ('type' in data && data.type === 'connected') {
      const connectedData = data as WebSocketConnectedResponse
      console.log('[WebSocket] Server acknowledged:', connectedData.message)
      return
    }

    // 其他訊息必須有 requestId
    const { requestId } = data as WebSocketMessageResponse | WebSocketCompleteResponse | WebSocketErrorResponse

    if (!requestId) {
      console.warn('[WebSocket] Received message without requestId:', data)
      return
    }

    const callbacks = this.requestCallbacks.get(requestId)
    if (!callbacks) {
      console.warn('[WebSocket] No callbacks found for requestId:', requestId)
      return
    }

    // 處理不同類型的訊息
    if ('type' in data && data.type === 'complete') {
      const completeData = data as WebSocketCompleteResponse
      callbacks.onComplete(completeData)
      this.requestCallbacks.delete(requestId)
    } else if ('type' in data && data.type === 'error') {
      const errorData = data as WebSocketErrorResponse
      callbacks.onError(errorData.error)
      this.requestCallbacks.delete(requestId)
    } else {
      // 流式訊息
      const messageData = data as WebSocketMessageResponse
      if (messageData.message) {
        callbacks.onMessage(messageData.message)
      }
    }
  }

  /**
   * 發送 WebSocket 查詢
   *
   * @param workspacePath 工作空間路徑
   * @param prompt 使用者提示
   * @param options 查詢選項
   * @returns 包含 requestId 和 send 方法的物件
   */
  sendQuery(
    workspacePath: string,
    prompt: string,
    options?: WebSocketQueryOptions
  ): {
    requestId: string
    send: (
      onMessage: (message: SDKMessage) => void,
      onComplete: (response: WebSocketCompleteResponse) => void,
      onError: (error: string) => void
    ) => void
  } {
    if (!this.ws || this.state !== 'connected') {
      throw new Error('WebSocket not connected')
    }

    // 生成唯一請求 ID
    const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    // 建立查詢請求
    const request: WebSocketQueryRequest = {
      type: 'query',
      requestId,
      workspacePath,
      prompt,
      options
    }

    return {
      requestId,
      send: (onMessage, onComplete, onError) => {
        // 註冊回調
        this.requestCallbacks.set(requestId, {
          onMessage,
          onComplete,
          onError
        })

        // 發送請求
        try {
          this.ws!.send(JSON.stringify(request))
          console.log('[WebSocket] Query sent:', requestId)
        } catch (error) {
          console.error('[WebSocket] Failed to send query:', error)
          this.requestCallbacks.delete(requestId)
          throw error
        }
      }
    }
  }

  /**
   * 取得當前連接狀態
   */
  getState(): WebSocketState {
    return this.state
  }

  /**
   * 檢查是否已連接
   */
  isConnected(): boolean {
    return this.state === 'connected'
  }

  /**
   * 取得重連嘗試次數
   */
  getReconnectAttempts(): number {
    return this.reconnectAttempts
  }

  /**
   * 重設重連計數器（用於測試）
   */
  resetReconnectAttempts(): void {
    this.reconnectAttempts = 0
  }

  /**
   * 清理所有正在進行的請求回調
   *
   * @param errorMessage 錯誤訊息
   */
  private cleanupPendingRequests(errorMessage: string): void {
    if (this.requestCallbacks.size > 0) {
      console.log(`[WebSocket] Cleaning up ${this.requestCallbacks.size} pending requests`)

      // 觸發所有請求的錯誤回調
      this.requestCallbacks.forEach((callbacks, requestId) => {
        console.log(`[WebSocket] Cancelling request: ${requestId}`)
        callbacks.onError(errorMessage)
      })

      // 清空回調映射
      this.requestCallbacks.clear()
    }
  }
}

/**
 * 單例實例（可選）
 */
let instance: WebSocketService | null = null

/**
 * 取得 WebSocket Service 單例
 */
export function getWebSocketService(): WebSocketService {
  if (!instance) {
    instance = new WebSocketService()
  }
  return instance
}

/**
 * 重置單例（用於測試）
 */
export function resetWebSocketService(): void {
  if (instance) {
    instance.disconnect()
    instance = null
  }
}
