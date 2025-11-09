/**
 * useWebSocket Composable
 * WebSocket 連接與訊息處理
 */

const { ref, onMounted, onUnmounted } = Vue

export function useWebSocket(options = {}) {
    // 響應式狀態
    const ws = ref(null)
    const wsConnected = ref(false)
    const wsReconnectAttempts = ref(0)
    const wsMaxReconnectAttempts = 5
    const wsRequestCallbacks = new Map()

    // 可選的回調函數
    const { onConnected, onError, onDisconnected } = options

    /**
     * 建立 WebSocket 連接
     */
    function connectWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
        const host = window.location.host
        const wsUrl = `${protocol}//${host}/api/ws`

        console.log('Connecting to WebSocket:', wsUrl)
        ws.value = new WebSocket(wsUrl)

        ws.value.onopen = () => {
            console.log('WebSocket connected')
            wsConnected.value = true
            wsReconnectAttempts.value = 0
            if (onConnected) onConnected()
        }

        ws.value.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data)
                handleWebSocketMessage(data)
            } catch (error) {
                console.error('Failed to parse WebSocket message:', error)
            }
        }

        ws.value.onerror = (error) => {
            console.error('WebSocket error:', error)
            if (onError) onError(error)
        }

        ws.value.onclose = () => {
            console.log('WebSocket disconnected')
            wsConnected.value = false
            if (onDisconnected) onDisconnected()
            attemptWebSocketReconnect()
        }
    }

    /**
     * WebSocket 重連
     */
    function attemptWebSocketReconnect() {
        if (wsReconnectAttempts.value >= wsMaxReconnectAttempts) {
            console.error('Max WebSocket reconnect attempts reached')
            if (onError) onError(new Error('無法重新連接 WebSocket'))
            return
        }

        wsReconnectAttempts.value++
        const delay = 1000 * Math.pow(2, wsReconnectAttempts.value - 1)

        console.log(`WebSocket reconnecting in ${delay}ms (attempt ${wsReconnectAttempts.value})`)

        setTimeout(() => {
            connectWebSocket()
        }, delay)
    }

    /**
     * 處理 WebSocket 訊息
     */
    function handleWebSocketMessage(data) {
        if (data.type === 'connected') {
            console.log('WebSocket server acknowledged')
            return
        }

        const requestId = data.requestId
        if (!requestId) {
            console.warn('Received message without requestId:', data)
            return
        }

        const callbacks = wsRequestCallbacks.get(requestId)
        if (!callbacks) {
            console.warn('No callbacks found for requestId:', requestId)
            return
        }

        if (data.type === 'complete') {
            callbacks.onComplete(data)
            wsRequestCallbacks.delete(requestId)
        } else if (data.type === 'error') {
            callbacks.onError(data.error)
            wsRequestCallbacks.delete(requestId)
        } else if (data.message) {
            callbacks.onMessage(data.message)
        }
    }

    /**
     * 發送 WebSocket 查詢
     */
    function sendWebSocketQuery(workspacePath, prompt, options = {}) {
        if (!wsConnected.value) {
            throw new Error('WebSocket not connected')
        }

        const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

        const request = {
            type: 'query',
            requestId,
            workspacePath,
            prompt,
            options
        }

        return {
            requestId,
            send: (onMessage, onComplete, onError) => {
                wsRequestCallbacks.set(requestId, {
                    onMessage,
                    onComplete,
                    onError
                })

                ws.value.send(JSON.stringify(request))
            }
        }
    }

    // 生命週期
    onMounted(() => {
        connectWebSocket()
    })

    onUnmounted(() => {
        if (ws.value) {
            ws.value.close()
        }
    })

    return {
        ws,
        wsConnected,
        wsReconnectAttempts,
        connectWebSocket,
        sendWebSocketQuery
    }
}
