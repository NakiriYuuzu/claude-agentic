        const { createApp } = Vue

        createApp({
            data() {
                return {
                    // UI 狀態
                    showSidebar: window.innerWidth >= 768,
                    showWorkspacesModal: false,
                    showStatsModal: false,
                    showSettings: false,
                    showCreateWorkspaceForm: false,
                    showSettingsPanel: false,
                    isDarkMode: localStorage.getItem('darkMode') === 'true',
                    isSelectingFolder: false,

                    // 聊天狀態
                    messages: [],
                    inputMessage: '',
                    isQuerying: false,
                    currentSessionId: null,
                    currentWorkspace: '',

                    // Session 狀態欄
                    sessionStatus: '', // 'initializing', 'ready', 'completed'
                    sessionResult: null, // { cost, turns, duration, success }

                    // Session 統計（用於 Topbar 顯示）
                    sessionTotalCost: 0,
                    sessionMessageCount: 0,

                    // 資料
                    workspaces: [],
                    recentSessions: [],
                    sessionStats: null,

                    // 表單
                    newWorkspace: {
                        workspacePath: '',
                        systemPrompt: '',
                        settingSources: ['project']
                    },

                    // 編輯工作空間
                    showEditWorkspaceForm: false,
                    editingWorkspace: null,
                    editWorkspace: {
                        workspacePath: '',
                        systemPrompt: '',
                        allowedTools: [],
                        disallowedTools: [],
                        agents: {},
                        mcpServers: {},
                        hooks: {},
                        settingSources: ['project']
                    },

                    // 工作空間詳細資訊
                    showWorkspaceDetailsModal: false,
                    selectedWorkspaceDetails: null,

                    // 設定
                    settings: {
                        model: '',
                        permissionMode: 'default',
                        maxTurns: 10
                    },

                    // Toast
                    toasts: [],
                    toastId: 0,

                    // WebSocket 連接
                    ws: null,
                    wsConnected: false,
                    wsReconnectAttempts: 0,
                    wsMaxReconnectAttempts: 5,
                    wsRequestCallbacks: new Map(), // requestId -> callbacks

                    // 範例提示
                    examplePrompts: [
                        { title: '列出檔案', prompt: '列出當前目錄的所有檔案' },
                        { title: '分析程式碼', prompt: '分析 src 目錄中的程式碼結構' },
                        { title: '執行測試', prompt: '執行所有單元測試' },
                        { title: '生成文件', prompt: '為專案生成 README 文件' }
                    ]
                }
            },

            computed: {
                hasStreamingMessage() {
                    return this.messages.some(m => m.isStreaming)
                }
            },

            methods: {
                // === WebSocket 連接管理 ===
                connectWebSocket() {
                    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
                    const host = window.location.host
                    const wsUrl = `${protocol}//${host}/api/ws`

                    console.log('Connecting to WebSocket:', wsUrl)
                    this.ws = new WebSocket(wsUrl)

                    this.ws.onopen = () => {
                        console.log('WebSocket connected')
                        this.wsConnected = true
                        this.wsReconnectAttempts = 0
                        this.showToast('success', 'WebSocket 已連接')
                    }

                    this.ws.onmessage = (event) => {
                        try {
                            const data = JSON.parse(event.data)
                            this.handleWebSocketMessage(data)
                        } catch (error) {
                            console.error('Failed to parse WebSocket message:', error)
                        }
                    }

                    this.ws.onerror = (error) => {
                        console.error('WebSocket error:', error)
                        this.showToast('error', 'WebSocket 連接錯誤')
                    }

                    this.ws.onclose = () => {
                        console.log('WebSocket disconnected')
                        this.wsConnected = false
                        this.attemptWebSocketReconnect()
                    }
                },

                attemptWebSocketReconnect() {
                    if (this.wsReconnectAttempts >= this.wsMaxReconnectAttempts) {
                        console.error('Max WebSocket reconnect attempts reached')
                        this.showToast('error', '無法重新連接 WebSocket')
                        return
                    }

                    this.wsReconnectAttempts++
                    const delay = 1000 * Math.pow(2, this.wsReconnectAttempts - 1)

                    console.log(`WebSocket reconnecting in ${delay}ms (attempt ${this.wsReconnectAttempts})`)

                    setTimeout(() => {
                        this.connectWebSocket()
                    }, delay)
                },

                handleWebSocketMessage(data) {
                    if (data.type === 'connected') {
                        console.log('WebSocket server acknowledged')
                        return
                    }

                    const requestId = data.requestId
                    if (!requestId) {
                        console.warn('Received message without requestId:', data)
                        return
                    }

                    const callbacks = this.wsRequestCallbacks.get(requestId)
                    if (!callbacks) {
                        console.warn('No callbacks found for requestId:', requestId)
                        return
                    }

                    if (data.type === 'complete') {
                        callbacks.onComplete(data)
                        this.wsRequestCallbacks.delete(requestId)
                    } else if (data.type === 'error') {
                        callbacks.onError(data.error)
                        this.wsRequestCallbacks.delete(requestId)
                    } else if (data.message) {
                        callbacks.onMessage(data.message)
                    }
                },

                sendWebSocketQuery(workspacePath, prompt, options = {}) {
                    if (!this.wsConnected) {
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
                            this.wsRequestCallbacks.set(requestId, {
                                onMessage,
                                onComplete,
                                onError
                            })

                            this.ws.send(JSON.stringify(request))
                        }
                    }
                },

                // === UI 控制 ===
                startNewChat() {
                    this.messages = []
                    this.currentSessionId = null
                    this.inputMessage = ''
                    this.sessionStatus = ''
                    this.sessionResult = null
                    this.sessionTotalCost = 0
                    this.sessionMessageCount = 0
                },

                useExamplePrompt(example) {
                    this.inputMessage = example.prompt
                    this.$nextTick(() => {
                        this.$refs.messageInput.focus()
                    })
                },

                autoResizeTextarea() {
                    const textarea = this.$refs.messageInput
                    if (textarea) {
                        textarea.style.height = 'auto'
                        textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px'
                    }
                },

                scrollToBottom() {
                    this.$nextTick(() => {
                        const container = this.$refs.messagesContainer
                        if (container) {
                            container.scrollTop = container.scrollHeight
                        }
                    })
                },

                // === 訊息處理 ===
                async sendMessage() {
                    if (!this.inputMessage.trim() || !this.currentWorkspace || this.isQuerying) return

                    if (!this.wsConnected) {
                        this.showToast('error', 'WebSocket 未連接，請稍後重試')
                        return
                    }

                    const userMessage = this.inputMessage.trim()
                    this.inputMessage = ''

                    // 添加用戶訊息
                    this.messages.push({
                        type: 'user',
                        text: userMessage
                    })

                    this.scrollToBottom()
                    this.isQuerying = true

                    // 重置 textarea 高度
                    this.$nextTick(() => {
                        const textarea = this.$refs.messageInput
                        if (textarea) {
                            textarea.style.height = 'auto'
                        }
                    })

                    // 準備選項
                    const options = {}

                    // Resume 功能：如果有當前 session，自動繼續該 session
                    if (this.currentSessionId) {
                        options.resume = this.currentSessionId
                    }

                    if (this.settings.model) options.model = this.settings.model
                    if (this.settings.permissionMode !== 'default') options.permissionMode = this.settings.permissionMode
                    if (this.settings.maxTurns) options.maxTurns = this.settings.maxTurns

                    try {
                        let assistantMessageIndex = -1

                        const query = this.sendWebSocketQuery(
                            this.currentWorkspace,
                            userMessage,
                            options
                        )

                        query.send(
                            // onMessage
                            (message) => {
                                console.log('SDK Message:', message.type, message)

                                // 處理不同類型的 SDK 訊息
                                switch (message.type) {
                                    case 'system':
                                        if (message.subtype === 'init' && message.session_id) {
                                            this.currentSessionId = message.session_id
                                            this.sessionStatus = 'ready'
                                            console.log('Session initialized:', message.session_id)
                                        }
                                        break

                                    case 'assistant':
                                        // 第一次收到 assistant 訊息時創建容器
                                        if (assistantMessageIndex === -1) {
                                            this.messages.push({
                                                type: 'assistant',
                                                text: '',
                                                isStreaming: true
                                            })
                                            assistantMessageIndex = this.messages.length - 1
                                        }

                                        // 更新 assistant 訊息內容
                                        if (message.message && message.message.content) {
                                            const content = message.message.content
                                            let text = this.messages[assistantMessageIndex].text

                                            for (const block of content) {
                                                if (block.type === 'text') {
                                                    text += block.text
                                                } else if (block.type === 'tool_use') {
                                                    text += `\n\n🔧 **Tool**: ${block.name}\n\`\`\`json\n${JSON.stringify(block.input, null, 2)}\n\`\`\`\n`
                                                }
                                            }

                                            this.messages[assistantMessageIndex].text = text
                                            this.scrollToBottom()
                                        }
                                        break

                                    case 'result':
                                        // 標記訊息完成
                                        if (assistantMessageIndex !== -1) {
                                            this.messages[assistantMessageIndex].isStreaming = false
                                        }

                                        // 更新 session 結果
                                        this.sessionStatus = 'completed'
                                        this.sessionResult = {
                                            success: !message.is_error,
                                            cost: message.total_cost_usd,
                                            turns: message.num_turns,
                                            duration: message.duration_ms
                                        }

                                        if (message.total_cost_usd) {
                                            this.sessionTotalCost = message.total_cost_usd
                                        }

                                        const status = message.is_error ? '❌ 錯誤' : '✅ 完成'
                                        const cost = message.total_cost_usd ? ` ($${message.total_cost_usd.toFixed(4)})` : ''
                                        const turns = message.num_turns ? ` - ${message.num_turns} turns` : ''

                                        if (assistantMessageIndex !== -1) {
                                            this.messages[assistantMessageIndex].text += `\n\n${status}${cost}${turns}`
                                        }
                                        break
                                }
                            },
                            // onComplete
                            async (data) => {
                                console.log('Query completed:', data)
                                this.showToast('success', '查詢完成')
                                await this.fetchRecentSessions()
                            },
                            // onError
                            (error) => {
                                console.error('Query error:', error)
                                this.showToast('error', `查詢失敗: ${error}`)

                                // 添加錯誤訊息
                                this.messages.push({
                                    type: 'error',
                                    text: `錯誤: ${error}`
                                })
                            }
                        )

                    } catch (error) {
                        console.error('Failed to send query:', error)
                        this.showToast('error', error.message)

                        this.messages.push({
                            type: 'error',
                            text: `錯誤: ${error.message}`
                        })
                    } finally {
                        this.isQuerying = false
                        this.scrollToBottom()
                    }
                },

                handleSSEMessage(event, data, assistantMessageIndex) {
                    switch(event) {
                        case 'init':
                            // 更新狀態欄而不是添加消息
                            this.sessionStatus = 'initializing'
                            this.sessionResult = null
                            break

                        case 'session_init':
                            this.currentSessionId = data.session_id
                            // 更新狀態欄而不是添加消息
                            this.sessionStatus = 'ready'
                            break

                        case 'assistant_message':
                            let content = ''
                            let tools = []

                            if (data.content && Array.isArray(data.content)) {
                                // 提取文字內容
                                content = data.content
                                    .filter(block => block.type === 'text')
                                    .map(block => block.text)
                                    .join('\n\n')

                                // 提取工具使用信息
                                tools = this.parseToolBlocks(data.content)
                            }

                            if (assistantMessageIndex >= 0 && this.messages[assistantMessageIndex]) {
                                // 更新現有訊息
                                this.messages[assistantMessageIndex].content += content
                                // 合併工具信息
                                if (tools.length > 0) {
                                    const existingTools = this.messages[assistantMessageIndex].tools || []
                                    this.messages[assistantMessageIndex].tools = [...existingTools, ...tools]
                                }
                                this.messages[assistantMessageIndex].isStreaming = false
                            } else {
                                // 創建新訊息
                                this.messages.push({
                                    type: 'assistant',
                                    content: content,
                                    tools: tools,
                                    isStreaming: false
                                })
                            }
                            break

                        case 'result':
                            // 將 result 資料附加到最後一個 assistant 訊息
                            const lastAssistantIndex = this.messages.map((m, i) => m.type === 'assistant' ? i : -1).filter(i => i >= 0).pop()
                            if (lastAssistantIndex !== undefined && this.messages[lastAssistantIndex]) {
                                this.messages[lastAssistantIndex].result = data
                            }

                            // 更新 session 統計
                            this.sessionTotalCost += (data.total_cost_usd || 0)
                            this.sessionMessageCount = this.messages.filter(m => m.type === 'user' || m.type === 'assistant').length

                            // 更新狀態欄顯示結果統計
                            this.sessionStatus = ''
                            this.sessionResult = {
                                cost: data.total_cost_usd?.toFixed(4) || '0.0000',
                                turns: data.num_turns || 0,
                                duration: data.duration_ms || 0,
                                success: !data.is_error
                            }
                            this.showToast('success', '查詢完成')
                            break

                        case 'complete':
                            break

                        case 'heartbeat':
                            // 心跳事件，不做處理（用於保持連線）
                            break

                        case 'error':
                            this.messages.push({
                                type: 'system',
                                text: '錯誤: ' + data.error
                            })
                            this.showToast('error', '查詢錯誤: ' + data.error)
                            break
                    }

                    this.scrollToBottom()
                },

                // === 工作空間管理 ===
                async fetchWorkspaces() {
                    try {
                        const response = await fetch('/api/workspaces')
                        const data = await response.json()
                        if (data.success) {
                            this.workspaces = data.data
                            if (this.workspaces.length > 0 && !this.currentWorkspace) {
                                this.currentWorkspace = this.workspaces[0].workspacePath
                            }
                        }
                    } catch (error) {
                        this.showToast('error', '載入工作空間失敗: ' + error.message)
                    }
                },

                // 開啟資料夾選擇對話框（調用後端 API）
                async openFolderDialog() {
                    this.isSelectingFolder = true
                    try {
                        const response = await fetch('/api/workspaces/select-folder', {
                            method: 'POST'
                        })
                        const data = await response.json()

                        if (data.success && data.data?.folderPath) {
                            this.newWorkspace.workspacePath = data.data.folderPath
                            this.showToast('success', '資料夾已選擇')
                        } else if (data.cancelled) {
                            // 使用者取消，不顯示錯誤
                        } else {
                            this.showToast('error', data.error || '無法開啟資料夾選擇器')
                        }
                    } catch (error) {
                        console.error('Failed to open folder dialog:', error)
                        this.showToast('error', '無法開啟資料夾選擇器: ' + error.message)
                    } finally {
                        this.isSelectingFolder = false
                    }
                },

                async createWorkspace() {
                    if (!this.newWorkspace.workspacePath) {
                        this.showToast('error', '請輸入工作空間路徑')
                        return
                    }

                    try {
                        const response = await fetch('/api/workspaces', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(this.newWorkspace)
                        })
                        const data = await response.json()
                        if (data.success) {
                            this.showToast('success', '工作空間已建立')
                            await this.fetchWorkspaces()
                            this.currentWorkspace = this.newWorkspace.workspacePath
                            this.newWorkspace = { workspacePath: '', systemPrompt: '', settingSources: ['project'] }
                            this.showCreateWorkspaceForm = false
                        } else {
                            this.showToast('error', data.error || '建立失敗')
                        }
                    } catch (error) {
                        this.showToast('error', '建立失敗: ' + error.message)
                    }
                },

                async deleteWorkspace(workspacePath) {
                    if (!confirm('確定要刪除此工作空間嗎？')) return

                    try {
                        const encodedPath = encodeURIComponent(workspacePath)
                        const response = await fetch(`/api/workspaces/${encodedPath}`, {
                            method: 'DELETE'
                        })
                        const data = await response.json()
                        if (data.success) {
                            this.showToast('success', '工作空間已刪除')
                            if (this.currentWorkspace === workspacePath) {
                                this.currentWorkspace = ''
                            }
                            await this.fetchWorkspaces()
                        } else {
                            this.showToast('error', data.error || '刪除失敗')
                        }
                    } catch (error) {
                        this.showToast('error', '刪除失敗: ' + error.message)
                    }
                },

                async editWorkspaceStart(workspacePath) {
                    try {
                        // 獲取工作空間完整資訊
                        const details = await this.fetchWorkspaceDetails(workspacePath)
                        if (details) {
                            // 填充編輯表單
                            this.editWorkspace = {
                                workspacePath: details.workspacePath,
                                systemPrompt: details.systemPrompt || '',
                                allowedTools: details.allowedTools || [],
                                disallowedTools: details.disallowedTools || [],
                                agents: details.agents || {},
                                mcpServers: details.mcpServers || {},
                                hooks: details.hooks || {},
                                settingSources: details.settingSources || ['project'],
                                // 用於顯示的文字格式
                                allowedToolsText: (details.allowedTools || []).join(', '),
                                disallowedToolsText: (details.disallowedTools || []).join(', ')
                            }
                            this.editingWorkspace = workspacePath
                            this.showEditWorkspaceForm = true
                        }
                    } catch (error) {
                        this.showToast('error', '載入工作空間資訊失敗: ' + error.message)
                    }
                },

                async fetchWorkspaceDetails(workspacePath) {
                    try {
                        const encodedPath = encodeURIComponent(workspacePath)
                        const response = await fetch(`/api/workspaces/${encodedPath}`)
                        const data = await response.json()
                        if (data.success) {
                            return data.data
                        } else {
                            this.showToast('error', data.error || '獲取工作空間資訊失敗')
                            return null
                        }
                    } catch (error) {
                        this.showToast('error', '獲取工作空間資訊失敗: ' + error.message)
                        return null
                    }
                },

                async updateWorkspace() {
                    if (!this.editingWorkspace) return

                    try {
                        // 將文字格式轉換為陣列
                        const allowedTools = this.editWorkspace.allowedToolsText
                            ? this.editWorkspace.allowedToolsText.split(',').map(t => t.trim()).filter(t => t)
                            : []
                        const disallowedTools = this.editWorkspace.disallowedToolsText
                            ? this.editWorkspace.disallowedToolsText.split(',').map(t => t.trim()).filter(t => t)
                            : []

                        // 只傳送有值的欄位，避免傳送 null
                        const updateData = {}

                        // System Prompt - 只有非空字串才加入
                        if (this.editWorkspace.systemPrompt && this.editWorkspace.systemPrompt.trim()) {
                            updateData.systemPrompt = this.editWorkspace.systemPrompt
                        }

                        // Allowed Tools - 只有非空陣列才加入
                        if (allowedTools.length > 0) {
                            updateData.allowedTools = allowedTools
                        }

                        // Disallowed Tools - 只有非空陣列才加入
                        if (disallowedTools.length > 0) {
                            updateData.disallowedTools = disallowedTools
                        }

                        // Agents - 只有非空物件才加入
                        if (this.editWorkspace.agents && Object.keys(this.editWorkspace.agents).length > 0) {
                            updateData.agents = this.editWorkspace.agents
                        }

                        // MCP Servers - 只有非空物件才加入
                        if (this.editWorkspace.mcpServers && Object.keys(this.editWorkspace.mcpServers).length > 0) {
                            updateData.mcpServers = this.editWorkspace.mcpServers
                        }

                        // Hooks - 只有非空物件才加入
                        if (this.editWorkspace.hooks && Object.keys(this.editWorkspace.hooks).length > 0) {
                            updateData.hooks = this.editWorkspace.hooks
                        }

                        // Setting Sources - 永遠傳送（如果有值）
                        if (this.editWorkspace.settingSources && this.editWorkspace.settingSources.length > 0) {
                            updateData.settingSources = this.editWorkspace.settingSources
                        }

                        const encodedPath = encodeURIComponent(this.editingWorkspace)
                        const response = await fetch(`/api/workspaces/${encodedPath}`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(updateData)
                        })
                        const data = await response.json()
                        if (data.success) {
                            this.showToast('success', '工作空間已更新')
                            await this.fetchWorkspaces()
                            this.showEditWorkspaceForm = false
                            this.editingWorkspace = null
                        } else {
                            this.showToast('error', data.error || '更新失敗')
                        }
                    } catch (error) {
                        this.showToast('error', '更新失敗: ' + error.message)
                    }
                },

                async viewWorkspaceDetails(workspacePath) {
                    try {
                        const details = await this.fetchWorkspaceDetails(workspacePath)
                        if (details) {
                            this.selectedWorkspaceDetails = details
                            this.showWorkspaceDetailsModal = true
                        }
                    } catch (error) {
                        this.showToast('error', '載入工作空間資訊失敗: ' + error.message)
                    }
                },

                onWorkspaceChange() {
                    // 可以在這裡加入工作空間切換時的邏輯
                },

                // === Sessions 管理 ===
                async fetchRecentSessions() {
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
                            this.recentSessions = sessionsWithMessages
                        }
                    } catch (error) {
                        console.error('Failed to fetch sessions:', error)
                    }
                },

                async loadSession(session) {
                    this.currentSessionId = session.session_id
                    this.currentWorkspace = session.workspace_path

                    // 重置 session 統計
                    this.sessionTotalCost = 0
                    this.sessionMessageCount = 0

                    // 載入 session 訊息
                    try {
                        const response = await fetch(`/api/sessions/${session.session_id}/messages`)
                        const data = await response.json()
                        if (data.success) {
                            // 轉換訊息格式為聊天格式
                            this.messages = this.convertSessionMessages(data.data.messages)

                            // 計算總成本和訊息數
                            this.messages.forEach(msg => {
                                if (msg.result && msg.result.total_cost_usd) {
                                    this.sessionTotalCost += msg.result.total_cost_usd
                                }
                            })
                            this.sessionMessageCount = this.messages.filter(m => m.type === 'user' || m.type === 'assistant').length

                            this.scrollToBottom()
                        }
                    } catch (error) {
                        this.showToast('error', '載入 session 失敗: ' + error.message)
                    }
                },

                async deleteSession(session) {
                    // 確認刪除
                    if (!confirm(`確定要刪除這個對話嗎？\n\n"${this.getSessionTitle(session)}"\n\n此操作無法復原。`)) {
                        return
                    }

                    try {
                        const response = await fetch(`/api/sessions/${session.session_id}`, {
                            method: 'DELETE'
                        })
                        const data = await response.json()

                        if (data.success) {
                            this.showToast('success', '對話已刪除')

                            // 如果刪除的是當前 session，清空訊息
                            if (this.currentSessionId === session.session_id) {
                                this.messages = []
                                this.currentSessionId = null
                            }

                            // 重新載入 sessions 列表
                            await this.fetchRecentSessions()

                            // 刷新統計資料
                            await this.fetchSessionStats()
                        } else {
                            this.showToast('error', data.error || '刪除失敗')
                        }
                    } catch (error) {
                        console.error('Failed to delete session:', error)
                        this.showToast('error', '刪除失敗: ' + error.message)
                    }
                },

                convertSessionMessages(messages) {
                    const converted = []

                    for (const msg of messages) {
                        try {
                            const content = JSON.parse(msg.message_content)

                            if (msg.message_type === 'system' && msg.message_subtype === 'init') {
                                // 跳過 system init 消息（已改為狀態欄顯示）
                                continue
                            } else if (msg.message_type === 'user') {
                                // 處理用戶消息
                                // 支援多種資料格式：SDKUserMessage、字串、Anthropic API 標準格式
                                const message = content.message || content
                                let text = ''

                                if (message.content) {
                                    if (Array.isArray(message.content)) {
                                        // Claude SDK 格式：[{type: 'text', text: '...'}]
                                        text = message.content
                                            .filter(block => block.type === 'text')
                                            .map(block => block.text)
                                            .join('\n\n')
                                    } else if (typeof message.content === 'string') {
                                        // 字串格式
                                        text = message.content
                                    }
                                } else if (typeof message === 'string') {
                                    // 直接是字串
                                    text = message
                                } else if (message.role === 'user' && Array.isArray(message.content)) {
                                    // Anthropic API 標準格式
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
                                    // 提取文字內容
                                    text = message.content
                                        .filter(block => block.type === 'text')
                                        .map(block => block.text)
                                        .join('\n\n')

                                    // 提取工具使用信息
                                    tools = this.parseToolBlocks(message.content)
                                }

                                if (text || tools.length > 0) {
                                    converted.push({
                                        type: 'assistant',
                                        content: text,
                                        tools: tools
                                    })
                                }
                            } else if (msg.message_type === 'result') {
                                // 將 result 附加到最後一個 assistant 訊息
                                const lastAssistantIndex = converted.map((m, i) => m.type === 'assistant' ? i : -1).filter(i => i >= 0).pop()
                                if (lastAssistantIndex !== undefined && converted[lastAssistantIndex]) {
                                    converted[lastAssistantIndex].result = content
                                }
                            }
                        } catch (e) {
                            console.error('Failed to parse message:', e)
                        }
                    }

                    return converted
                },

                getSessionTitle(session) {
                    // 從 session metadata 提取第一條使用者訊息作為標題
                    // 如果沒有，使用 workspace 名稱
                    if (session.first_user_message) {
                        // 截斷過長的訊息，最多顯示 60 個字元
                        const message = session.first_user_message
                        return message.length > 60 ? message.substring(0, 60) + '...' : message
                    }
                    return session.workspace_path.split('/').pop() || '新對話'
                },

                getWorkspaceName(workspacePath) {
                    // 從路徑中提取 workspace 名稱
                    return workspacePath.split('/').pop() || 'Unknown'
                },

                // === 統計資訊 ===
                async fetchSessionStats() {
                    try {
                        const response = await fetch('/api/sessions/stats')
                        const data = await response.json()
                        if (data.success) {
                            this.sessionStats = data.data
                        }
                    } catch (error) {
                        console.error('Failed to fetch stats:', error)
                    }
                },

                // === 工具函數 ===
                renderMarkdown(content) {
                    if (!content) return ''
                    return marked.parse(content)
                },

                formatDate(dateString) {
                    // 確保正確解析 UTC 時間並轉換為 Asia/Taipei 時區
                    let date

                    // 處理不同的時間格式，統一轉換為 ISO 8601 格式
                    if (!dateString.endsWith('Z') && !dateString.includes('+')) {
                        // 如果沒有時區標記，假設是 UTC 時間
                        // 將 '2025-11-03 05:53:27' 轉換為 '2025-11-03T05:53:27Z'
                        const normalizedString = dateString.replace(' ', 'T') + 'Z'
                        date = new Date(normalizedString)
                    } else {
                        date = new Date(dateString)
                    }

                    const now = new Date()
                    const diff = now - date

                    if (diff < 60000) return '剛剛'
                    if (diff < 3600000) return Math.floor(diff / 60000) + ' 分鐘前'
                    if (diff < 86400000) return Math.floor(diff / 3600000) + ' 小時前'
                    if (diff < 604800000) return Math.floor(diff / 86400000) + ' 天前'

                    // 使用完整的日期時間格式，自動轉換為 Asia/Taipei 時區
                    return date.toLocaleString('zh-TW', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                        timeZone: 'Asia/Taipei'
                    })
                },

                showToast(type, message) {
                    const id = this.toastId++
                    this.toasts.push({ id, type, message })

                    setTimeout(() => {
                        this.toasts = this.toasts.filter(t => t.id !== id)
                    }, 3000)
                },

                // === API Docs ===
                openApiDocs() {
                    window.open('/swagger', '_blank')
                },

                // === 深色模式切換 ===
                toggleDarkMode() {
                    this.isDarkMode = !this.isDarkMode
                    localStorage.setItem('darkMode', this.isDarkMode ? 'true' : 'false')
                },

                // === 工具解析 ===
                parseToolBlocks(contentBlocks) {
                    if (!contentBlocks || !Array.isArray(contentBlocks)) {
                        return []
                    }

                    const tools = []
                    const toolUseMap = new Map()
                    const toolResultMap = new Map()

                    for (const block of contentBlocks) {
                        if (block.type === 'tool_use') {
                            toolUseMap.set(block.id, {
                                id: block.id,
                                name: block.name,
                                input: block.input
                            })
                        } else if (block.type === 'tool_result') {
                            toolResultMap.set(block.tool_use_id, {
                                content: block.content,
                                is_error: block.is_error
                            })
                        }
                    }

                    for (const [id, toolUse] of toolUseMap) {
                        const toolResult = toolResultMap.get(id)
                        tools.push({
                            id,
                            name: toolUse.name,
                            input: toolUse.input,
                            result: toolResult ? toolResult.content : null,
                            is_error: toolResult ? toolResult.is_error : false,
                            expanded: false
                        })
                    }

                    return tools
                },

                getToolIcon(toolName) {
                    const icons = {
                        'Read': {
                            icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
                            color: 'text-blue-600 bg-blue-50'
                        },
                        'Edit': {
                            icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
                            color: 'text-green-600 bg-green-50'
                        },
                        'Write': {
                            icon: 'M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z',
                            color: 'text-purple-600 bg-purple-50'
                        },
                        'Bash': {
                            icon: 'M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
                            color: 'text-gray-700 bg-gray-50'
                        },
                        'Glob': {
                            icon: 'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z',
                            color: 'text-yellow-600 bg-yellow-50'
                        },
                        'Grep': {
                            icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
                            color: 'text-orange-600 bg-orange-50'
                        }
                    }

                    return icons[toolName] || {
                        icon: 'M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4',
                        color: 'text-indigo-600 bg-indigo-50'
                    }
                },

                toggleToolExpand(tool) {
                    tool.expanded = !tool.expanded
                }
            },

            async mounted() {
                // 建立 WebSocket 連接
                this.connectWebSocket()

                // 初始化載入資料
                await this.fetchWorkspaces()
                await this.fetchRecentSessions()
                await this.fetchSessionStats()

                // 監聽視窗大小變化
                window.addEventListener('resize', () => {
                    this.showSidebar = window.innerWidth >= 768
                })
            }
        }).mount('#app')
