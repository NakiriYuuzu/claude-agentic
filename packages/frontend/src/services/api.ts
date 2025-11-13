/**
 * API Service Layer
 * 統一封裝 WebSocket 和 REST API 調用
 *
 * 功能：
 * - WebSocket 連接管理與自動重連
 * - REST API 調用（Sessions、Workspaces、Health Check）
 * - 統一錯誤處理與日誌記錄
 * - TypeScript 完整型別支援
 *
 * @module services/api
 */

import type {
  WebSocketQueryRequest,
  WebSocketQueryOptions,
  WebSocketRequestCallbacks,
  WebSocketResponse,
  WebSocketMessageResponse,
  WebSocketCompleteResponse,
  WebSocketErrorResponse,
  WebSocketConnectedResponse,
  SDKMessage,
  ListSessionsQuery,
  ListSessionsResponse,
  GetSessionResponse,
  ListMessagesQuery,
  ListMessagesResponse,
  DeleteSessionResponse,
  SessionStats,
  SessionStatsQuery,
  WorkspaceSettings,
  CreateWorkspaceSettingsRequest,
  UpdateWorkspaceSettingsRequest,
  CreateWorkspaceSettingsResponse,
  GetWorkspaceSettingsResponse,
  UpdateWorkspaceSettingsResponse,
  DeleteWorkspaceSettingsResponse,
  ListWorkspacesResponse,
  SelectFolderResponse,
  HealthCheckResponse,
} from '@/types/api'

// ===========================
// 配置常數
// ===========================

/**
 * API 基礎 URL
 * 從環境變數讀取，預設為當前協議 + 主機
 */
const API_BASE_URL = import.meta.env.VITE_APP_API_BASE || `${window.location.protocol}//${window.location.host}`

/**
 * WebSocket 最大重連次數
 */
const MAX_RECONNECT_ATTEMPTS = 5

/**
 * WebSocket 重連基礎延遲（毫秒）
 */
const RECONNECT_BASE_DELAY = 1000

// ===========================
// WebSocket Service
// ===========================

/**
 * WebSocket 連線狀態
 */
export type WebSocketState = 'disconnected' | 'connecting' | 'connected' | 'error'

/**
 * WebSocket 事件監聽器
 */
export interface WebSocketEventListeners {
  /** 連接成功 */
  onConnected?: (connectionId: string) => void
  /** 連接斷開 */
  onDisconnected?: () => void
  /** 連接錯誤 */
  onError?: (error: Event | string) => void
  /** 狀態變更 */
  onStateChange?: (state: WebSocketState) => void
}

/**
 * WebSocket 服務類別
 *
 * 負責管理 WebSocket 連接、訊息發送與接收、自動重連機制
 *
 * @example
 * ```typescript
 * const wsService = new WebSocketService({
 *   onConnected: (id) => console.log('Connected:', id),
 *   onError: (err) => console.error('Error:', err)
 * })
 *
 * await wsService.connect()
 *
 * const requestId = wsService.sendQuery({
 *   workspacePath: '/path/to/workspace',
 *   prompt: 'What is TypeScript?',
 *   options: { model: 'claude-sonnet-4' }
 * })
 *
 * wsService.onMessage(requestId, {
 *   onMessage: (msg) => console.log('Message:', msg),
 *   onComplete: (res) => console.log('Complete:', res),
 *   onError: (err) => console.error('Error:', err)
 * })
 * ```
 */
export class WebSocketService {
  private ws: WebSocket | null = null
  private reconnectAttempts = 0
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private requestCallbacks = new Map<string, WebSocketRequestCallbacks>()
  private state: WebSocketState = 'disconnected'
  private eventListeners: WebSocketEventListeners
  private connectionId: string | null = null

  /**
   * 建立 WebSocket 服務實例
   *
   * @param listeners - 事件監聽器
   */
  constructor(listeners: WebSocketEventListeners = {}) {
    this.eventListeners = listeners
  }

  /**
   * 取得當前連線狀態
   */
  public getState(): WebSocketState {
    return this.state
  }

  /**
   * 取得當前連線 ID
   */
  public getConnectionId(): string | null {
    return this.connectionId
  }

  /**
   * 是否已連接
   */
  public isConnected(): boolean {
    return this.state === 'connected' && this.ws?.readyState === WebSocket.OPEN
  }

  /**
   * 建立 WebSocket 連接
   *
   * @returns Promise<void> - 連接成功時 resolve
   * @throws 連接失敗時 reject
   */
  public async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // 如果已經連接，直接返回
        if (this.isConnected()) {
          resolve()
          return
        }

        this.setState('connecting')

        // 建立 WebSocket URL
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
        const host = window.location.host
        const wsUrl = `${protocol}//${host}/api/ws`

        console.log('[WebSocketService] Connecting to:', wsUrl)

        this.ws = new WebSocket(wsUrl)

        // 連接成功
        this.ws.onopen = () => {
          console.log('[WebSocketService] Connected')
          this.setState('connected')
          this.reconnectAttempts = 0

          // 等待伺服器確認訊息
          const tempHandler = (event: MessageEvent) => {
            try {
              const data = JSON.parse(event.data) as WebSocketResponse
              if ('type' in data && data.type === 'connected') {
                const connectedData = data as WebSocketConnectedResponse
                this.connectionId = connectedData.connectionId
                console.log('[WebSocketService] Server acknowledged, connectionId:', this.connectionId)

                if (this.eventListeners.onConnected) {
                  this.eventListeners.onConnected(this.connectionId)
                }

                // 移除臨時處理器，切換到正常訊息處理
                if (this.ws) {
                  this.ws.removeEventListener('message', tempHandler)
                  this.ws.addEventListener('message', this.handleMessage.bind(this))
                }

                resolve()
              }
            } catch (error) {
              console.error('[WebSocketService] Failed to parse initial message:', error)
            }
          }

          if (this.ws) {
            this.ws.addEventListener('message', tempHandler)
          }
        }

        // 連接錯誤
        this.ws.onerror = (error) => {
          console.error('[WebSocketService] Connection error:', error)
          this.setState('error')

          if (this.eventListeners.onError) {
            this.eventListeners.onError(error)
          }

          reject(error)
        }

        // 連接關閉
        this.ws.onclose = () => {
          console.log('[WebSocketService] Connection closed')
          this.setState('disconnected')
          this.connectionId = null

          if (this.eventListeners.onDisconnected) {
            this.eventListeners.onDisconnected()
          }

          // 嘗試重連
          this.attemptReconnect()
        }
      } catch (error) {
        console.error('[WebSocketService] Failed to create connection:', error)
        this.setState('error')
        reject(error)
      }
    })
  }

  /**
   * 斷開 WebSocket 連接
   */
  public disconnect(): void {
    console.log('[WebSocketService] Disconnecting...')

    // 清除重連計時器
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }

    // 關閉連接
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }

    // 清除回調
    this.requestCallbacks.clear()

    this.setState('disconnected')
    this.connectionId = null
  }

  /**
   * 發送查詢請求
   *
   * @param workspacePath - 工作空間路徑
   * @param prompt - 查詢提示
   * @param options - 查詢選項
   * @returns 請求 ID
   * @throws 如果未連接則拋出錯誤
   */
  public sendQuery(
    workspacePath: string,
    prompt: string,
    options?: WebSocketQueryOptions
  ): string {
    if (!this.isConnected()) {
      throw new Error('WebSocket is not connected')
    }

    // 生成唯一的 requestId
    const requestId = `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`

    const request: WebSocketQueryRequest = {
      type: 'query',
      requestId,
      workspacePath,
      prompt,
      options,
    }

    console.log('[WebSocketService] Sending query:', requestId)

    // 發送請求
    this.ws!.send(JSON.stringify(request))

    return requestId
  }

  /**
   * 註冊請求回調
   *
   * @param requestId - 請求 ID
   * @param callbacks - 回調函數
   */
  public onMessage(requestId: string, callbacks: WebSocketRequestCallbacks): void {
    this.requestCallbacks.set(requestId, callbacks)
  }

  /**
   * 取消請求回調
   *
   * @param requestId - 請求 ID
   */
  public offMessage(requestId: string): void {
    this.requestCallbacks.delete(requestId)
  }

  /**
   * 處理 WebSocket 訊息
   *
   * @param event - MessageEvent
   */
  private handleMessage(event: MessageEvent): void {
    try {
      const data = JSON.parse(event.data) as WebSocketResponse

      // 忽略連接確認訊息（已在 connect 中處理）
      if ('type' in data && data.type === 'connected') {
        return
      }

      // 取得 requestId
      const requestId = 'requestId' in data ? data.requestId : null
      if (!requestId) {
        console.warn('[WebSocketService] Received message without requestId:', data)
        return
      }

      // 取得對應的回調
      const callbacks = this.requestCallbacks.get(requestId)
      if (!callbacks) {
        console.warn('[WebSocketService] No callbacks found for requestId:', requestId)
        return
      }

      // 根據訊息類型呼叫回調
      if ('type' in data && data.type === 'complete') {
        const completeData = data as WebSocketCompleteResponse
        console.log('[WebSocketService] Query completed:', requestId)
        callbacks.onComplete(completeData)
        this.requestCallbacks.delete(requestId)
      } else if ('type' in data && data.type === 'error') {
        const errorData = data as WebSocketErrorResponse
        console.error('[WebSocketService] Query error:', requestId, errorData.error)
        callbacks.onError(errorData.error)
        this.requestCallbacks.delete(requestId)
      } else {
        // 訊息類型（streaming message）
        const messageData = data as WebSocketMessageResponse
        if (messageData.message) {
          callbacks.onMessage(messageData.message)
        }
      }
    } catch (error) {
      console.error('[WebSocketService] Failed to parse message:', error)
    }
  }

  /**
   * 嘗試重新連接
   */
  private attemptReconnect(): void {
    // 已達最大重連次數
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.error('[WebSocketService] Max reconnect attempts reached')

      if (this.eventListeners.onError) {
        this.eventListeners.onError('Max reconnect attempts reached')
      }

      return
    }

    // 計算延遲（指數退避）
    this.reconnectAttempts++
    const delay = RECONNECT_BASE_DELAY * Math.pow(2, this.reconnectAttempts - 1)

    console.log(
      `[WebSocketService] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`
    )

    // 設定重連計時器
    this.reconnectTimer = setTimeout(() => {
      this.connect().catch((error) => {
        console.error('[WebSocketService] Reconnection failed:', error)
      })
    }, delay)
  }

  /**
   * 設定連線狀態
   *
   * @param state - 新狀態
   */
  private setState(state: WebSocketState): void {
    if (this.state !== state) {
      this.state = state
      console.log('[WebSocketService] State changed:', state)

      if (this.eventListeners.onStateChange) {
        this.eventListeners.onStateChange(state)
      }
    }
  }
}

// ===========================
// REST API Service
// ===========================

/**
 * API 錯誤類別
 */
export class ApiError extends Error {
  statusCode?: number
  response?: any

  constructor(
    message: string,
    statusCode?: number,
    response?: any
  ) {
    super(message)
    this.name = 'ApiError'
    this.statusCode = statusCode
    this.response = response
  }
}

/**
 * REST API 服務類別
 *
 * 負責處理所有 REST API 調用（Sessions、Workspaces、Health Check）
 *
 * @example
 * ```typescript
 * const apiService = new ApiService()
 *
 * // 取得 Sessions
 * const sessions = await apiService.getSessions({ limit: 10 })
 *
 * // 取得 Session 訊息
 * const messages = await apiService.getSessionMessages('session-123')
 *
 * // 建立 Workspace
 * const workspace = await apiService.createWorkspace({
 *   workspacePath: '/path/to/workspace',
 *   systemPrompt: 'You are a helpful assistant'
 * })
 * ```
 */
export class ApiService {
  private baseURL: string

  /**
   * 建立 API 服務實例
   *
   * @param baseURL - API 基礎 URL（可選，預設為當前協議 + 主機）
   */
  constructor(baseURL?: string) {
    this.baseURL = baseURL || API_BASE_URL
  }

  // ===========================
  // Sessions API
  // ===========================

  /**
   * 取得 Sessions 列表
   *
   * @param query - 查詢參數
   * @returns Sessions 列表回應
   * @throws {ApiError} API 錯誤
   */
  public async getSessions(query?: ListSessionsQuery): Promise<ListSessionsResponse> {
    const params = new URLSearchParams()

    if (query) {
      if (query.workspace_path) params.append('workspace_path', query.workspace_path)
      if (query.status) params.append('status', query.status)
      if (query.limit) params.append('limit', query.limit.toString())
      if (query.offset) params.append('offset', query.offset.toString())
      if (query.order_by) params.append('order_by', query.order_by)
      if (query.order) params.append('order', query.order)
    }

    const url = params.toString() ? `/api/sessions?${params.toString()}` : '/api/sessions'

    return this.fetch<ListSessionsResponse>(url)
  }

  /**
   * 取得單一 Session
   *
   * @param sessionId - Session ID
   * @returns Session 回應
   * @throws {ApiError} API 錯誤
   */
  public async getSession(sessionId: string): Promise<GetSessionResponse> {
    return this.fetch<GetSessionResponse>(`/api/sessions/${sessionId}`)
  }

  /**
   * 取得 Session 訊息列表
   *
   * @param sessionId - Session ID
   * @param query - 查詢參數
   * @returns 訊息列表回應
   * @throws {ApiError} API 錯誤
   */
  public async getSessionMessages(
    sessionId: string,
    query?: ListMessagesQuery
  ): Promise<ListMessagesResponse> {
    const params = new URLSearchParams()

    if (query) {
      if (query.message_type) params.append('message_type', query.message_type)
      if (query.limit) params.append('limit', query.limit.toString())
      if (query.offset) params.append('offset', query.offset.toString())
    }

    const url = params.toString()
      ? `/api/sessions/${sessionId}/messages?${params.toString()}`
      : `/api/sessions/${sessionId}/messages`

    return this.fetch<ListMessagesResponse>(url)
  }

  /**
   * 取得 Session 統計資訊
   *
   * @param query - 查詢參數
   * @returns Session 統計資訊
   * @throws {ApiError} API 錯誤
   */
  public async getSessionStats(query?: SessionStatsQuery): Promise<SessionStats> {
    const params = new URLSearchParams()

    if (query) {
      if (query.workspace_path) params.append('workspace_path', query.workspace_path)
      if (query.date_from) params.append('date_from', query.date_from)
      if (query.date_to) params.append('date_to', query.date_to)
    }

    const url = params.toString() ? `/api/sessions/stats?${params.toString()}` : '/api/sessions/stats'

    const response = await this.fetch<{ success: boolean; data?: SessionStats; error?: string }>(url)

    if (!response.success || !response.data) {
      throw new ApiError(response.error || 'Failed to fetch session stats')
    }

    return response.data
  }

  /**
   * 刪除 Session
   *
   * @param sessionId - Session ID
   * @returns 刪除結果
   * @throws {ApiError} API 錯誤
   */
  public async deleteSession(sessionId: string): Promise<DeleteSessionResponse> {
    return this.fetch<DeleteSessionResponse>(`/api/sessions/${sessionId}`, {
      method: 'DELETE',
    })
  }

  // ===========================
  // Workspaces API
  // ===========================

  /**
   * 取得所有 Workspaces
   *
   * @returns Workspaces 列表回應
   * @throws {ApiError} API 錯誤
   */
  public async getWorkspaces(): Promise<ListWorkspacesResponse> {
    return this.fetch<ListWorkspacesResponse>('/api/workspaces')
  }

  /**
   * 取得單一 Workspace
   *
   * @param path - Workspace 路徑
   * @returns Workspace 回應
   * @throws {ApiError} API 錯誤
   */
  public async getWorkspace(path: string): Promise<GetWorkspaceSettingsResponse> {
    const encodedPath = encodeURIComponent(path)
    return this.fetch<GetWorkspaceSettingsResponse>(`/api/workspaces/${encodedPath}`)
  }

  /**
   * 建立 Workspace
   *
   * @param data - 建立請求資料
   * @returns 建立後的 Workspace
   * @throws {ApiError} API 錯誤
   */
  public async createWorkspace(
    data: CreateWorkspaceSettingsRequest
  ): Promise<CreateWorkspaceSettingsResponse> {
    return this.fetch<CreateWorkspaceSettingsResponse>('/api/workspaces', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  /**
   * 更新 Workspace
   *
   * @param path - Workspace 路徑
   * @param data - 更新請求資料
   * @returns 更新後的 Workspace
   * @throws {ApiError} API 錯誤
   */
  public async updateWorkspace(
    path: string,
    data: UpdateWorkspaceSettingsRequest
  ): Promise<UpdateWorkspaceSettingsResponse> {
    const encodedPath = encodeURIComponent(path)
    return this.fetch<UpdateWorkspaceSettingsResponse>(`/api/workspaces/${encodedPath}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  /**
   * 刪除 Workspace
   *
   * @param path - Workspace 路徑
   * @returns 刪除結果
   * @throws {ApiError} API 錯誤
   */
  public async deleteWorkspace(path: string): Promise<DeleteWorkspaceSettingsResponse> {
    const encodedPath = encodeURIComponent(path)
    return this.fetch<DeleteWorkspaceSettingsResponse>(`/api/workspaces/${encodedPath}`, {
      method: 'DELETE',
    })
  }

  /**
   * 選擇資料夾
   *
   * @returns 選擇資料夾結果
   * @throws {ApiError} API 錯誤
   */
  public async selectFolder(): Promise<SelectFolderResponse> {
    return this.fetch<SelectFolderResponse>('/api/workspaces/select-folder', {
      method: 'POST',
    })
  }

  // ===========================
  // Health Check API
  // ===========================

  /**
   * 健康檢查
   *
   * @returns 健康狀態
   * @throws {ApiError} API 錯誤
   */
  public async healthCheck(): Promise<HealthCheckResponse> {
    return this.fetch<HealthCheckResponse>('/api/health')
  }

  // ===========================
  // 通用方法
  // ===========================

  /**
   * 通用 fetch 包裝器
   *
   * @param endpoint - API 端點
   * @param options - Fetch 選項
   * @returns 回應資料
   * @throws {ApiError} API 錯誤
   */
  private async fetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const url = `${this.baseURL}${endpoint}`

    try {
      console.log(`[ApiService] ${options?.method || 'GET'} ${url}`)

      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
      })

      // 嘗試解析 JSON
      let data: any
      try {
        data = await response.json()
      } catch (error) {
        // 如果不是 JSON，使用文字
        data = { error: await response.text() }
      }

      // 檢查 HTTP 狀態碼
      if (!response.ok) {
        const errorMessage = data.error || data.message || `HTTP ${response.status}`
        throw new ApiError(errorMessage, response.status, data)
      }

      return data as T
    } catch (error) {
      // 如果已經是 ApiError，直接拋出
      if (error instanceof ApiError) {
        throw error
      }

      // 網路錯誤或其他錯誤
      console.error('[ApiService] Request failed:', error)
      throw new ApiError(
        error instanceof Error ? error.message : 'Unknown error',
        undefined,
        error
      )
    }
  }
}

// ===========================
// 匯出單例實例
// ===========================

/**
 * 全域 WebSocket 服務實例
 */
export const wsService = new WebSocketService()

/**
 * 全域 API 服務實例
 */
export const apiService = new ApiService()
