        import { useWebSocket } from './composables/useWebSocket.js'
        import { useMessages } from './composables/useMessages.js'
        import { useSessions } from './composables/useSessions.js'
        import { useTools } from './composables/useTools.js'

        const { createApp, ref, computed, nextTick, onMounted } = Vue
        const { useLocalStorage } = VueUse

        createApp({
            setup() {
                // === Toast 相關（需要先定義以便在 composables 中使用） ===
                const toasts = ref([])
                const toastId = ref(0)

                function showToast(type, message) {
                    const id = toastId.value++
                    toasts.value.push({ id, type, message })

                    setTimeout(() => {
                        toasts.value = toasts.value.filter(t => t.id !== id)
                    }, 3000)
                }

                // === Composables ===
                const { ws, wsConnected, connectWebSocket, sendWebSocketQuery } = useWebSocket({
                    onConnected: () => showToast('success', 'WebSocket 已連接'),
                    onError: (error) => showToast('error', 'WebSocket 連接錯誤'),
                    onDisconnected: () => {}
                })
                const {
                    messages, isQuerying, currentSessionId,
                    sessionTotalCost, sessionMessageCount,
                    sessionStatus, sessionResult, hasStreamingMessage,
                    addUserMessage, createAssistantMessage, updateAssistantMessage,
                    markAssistantComplete, clearMessages, setMessages
                } = useMessages()
                const {
                    recentSessions, sessionStats,
                    fetchRecentSessions, loadSessionMessages, deleteSession: deleteSessionAPI,
                    fetchSessionStats, convertSessionMessages
                } = useSessions()
                const { parseToolBlocks, getToolIcon, toggleToolExpand, toggleMessageTools } = useTools()

                // === UI 狀態 ===
                const showSidebar = ref(window.innerWidth >= 768)
                const showWorkspacesModal = ref(false)
                const showStatsModal = ref(false)
                const showSettings = ref(false)
                const showCreateWorkspaceForm = ref(false)
                const showSettingsPanel = ref(false)
                const isDarkMode = ref(localStorage.getItem('darkMode') === 'true')
                const isSelectingFolder = ref(false)

                // === 聊天狀態 ===
                const inputMessage = ref('')
                const currentWorkspace = useLocalStorage('claude-agent-workspace', '')
                const messageInput = ref(null)
                const messagesContainer = ref(null)

                // === 資料 ===
                const workspaces = ref([])

                // === 表單 ===
                const newWorkspace = ref({
                    workspacePath: '',
                    systemPrompt: '',
                    settingSources: ['project']
                })

                // === 編輯工作空間 ===
                const showEditWorkspaceForm = ref(false)
                const editingWorkspace = ref(null)
                const editWorkspace = ref({
                    workspacePath: '',
                    systemPrompt: '',
                    allowedTools: [],
                    disallowedTools: [],
                    agents: {},
                    mcpServers: {},
                    hooks: {},
                    settingSources: ['project']
                })

                // === 工作空間詳細資訊 ===
                const showWorkspaceDetailsModal = ref(false)
                const selectedWorkspaceDetails = ref(null)

                // === 設定 ===
                const settings = useLocalStorage('claude-agent-settings', {
                    model: 'haiku',
                    permissionMode: 'default',
                    maxTurns: 50
                })

                // === 範例提示 ===
                const examplePrompts = ref([
                    { title: '列出檔案', prompt: '列出當前目錄的所有檔案' },
                    { title: '分析程式碼', prompt: '分析 src 目錄中的程式碼結構' },
                    { title: '執行測試', prompt: '執行所有單元測試' },
                    { title: '生成文件', prompt: '為專案生成 README 文件' }
                ])

                // === 方法 ===
                // WebSocket 方法已由 composable 提供

                // === UI 控制 ===
                function startNewChat() {
                    clearMessages()
                    inputMessage.value = ''
                }

                function useExamplePrompt(example) {
                    inputMessage.value = example.prompt
                    nextTick(() => {
                        messageInput.value?.focus()
                    })
                }

                function autoResizeTextarea() {
                    const textarea = messageInput.value
                    if (textarea) {
                        textarea.style.height = 'auto'
                        textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px'
                    }
                }

                function scrollToBottom() {
                    nextTick(() => {
                        const container = messagesContainer.value
                        if (container) {
                            container.scrollTop = container.scrollHeight
                        }
                    })
                }

                // === 訊息處理 ===
                async function sendMessage() {
                    if (!inputMessage.value.trim() || !currentWorkspace.value || isQuerying.value) return

                    if (!wsConnected.value) {
                        showToast('error', 'WebSocket 未連接，請稍後重試')
                        return
                    }

                    const userMessage = inputMessage.value.trim()
                    inputMessage.value = ''

                    // 添加用戶訊息
                    addUserMessage(userMessage)
                    scrollToBottom()
                    isQuerying.value = true

                    // 重置 textarea 高度
                    nextTick(() => {
                        const textarea = messageInput.value
                        if (textarea) {
                            textarea.style.height = 'auto'
                        }
                    })

                    // 準備選項
                    const options = {}

                    // Resume 功能：如果有當前 session，自動繼續該 session
                    if (currentSessionId.value) {
                        options.resume = currentSessionId.value
                    }

                    if (settings.value.model) options.model = settings.value.model
                    if (settings.value.permissionMode !== 'default') options.permissionMode = settings.value.permissionMode
                    if (settings.value.maxTurns) options.maxTurns = settings.value.maxTurns

                    try {
                        let assistantMessageIndex = -1

                        const query = sendWebSocketQuery(
                            currentWorkspace.value,
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
                                            currentSessionId.value = message.session_id
                                            sessionStatus.value = 'ready'
                                            console.log('Session initialized:', message.session_id)
                                        }
                                        break

                                    case 'assistant':
                                        // 第一次收到 assistant 訊息時創建容器
                                        if (assistantMessageIndex === -1) {
                                            console.log('[sendMessage] Creating NEW assistant bubble')
                                            assistantMessageIndex = createAssistantMessage()
                                        } else {
                                            console.log('[sendMessage] Updating EXISTING assistant bubble at index:', assistantMessageIndex)
                                        }

                                        // 更新 assistant 訊息內容
                                        if (message.message && message.message.content) {
                                            updateAssistantMessage(assistantMessageIndex, message.message.content)
                                            scrollToBottom()
                                        }
                                        break

                                    case 'result':
                                        // 標記訊息完成
                                        if (assistantMessageIndex !== -1) {
                                            markAssistantComplete(assistantMessageIndex, message)
                                        }

                                        // 更新 session 結果
                                        sessionStatus.value = 'completed'
                                        sessionResult.value = {
                                            success: !message.is_error,
                                            cost: message.total_cost_usd,
                                            turns: message.num_turns,
                                            duration: message.duration_ms
                                        }
                                        break
                                }
                            },
                            // onComplete
                            async (data) => {
                                console.log('Query completed:', data)
                                showToast('success', '查詢完成')
                                await fetchRecentSessions()
                            },
                            // onError
                            (error) => {
                                console.error('Query error:', error)
                                showToast('error', `查詢失敗: ${error}`)

                                // 添加錯誤訊息
                                messages.value.push({
                                    type: 'error',
                                    text: `錯誤: ${error}`
                                })
                            }
                        )

                    } catch (error) {
                        console.error('Failed to send query:', error)
                        showToast('error', error.message)

                        messages.value.push({
                            type: 'error',
                            text: `錯誤: ${error.message}`
                        })
                    } finally {
                        isQuerying.value = false
                        scrollToBottom()
                    }
                }

                // === 工作空間管理 ===
                async function fetchWorkspaces() {
                    try {
                        const response = await fetch('/api/workspaces')
                        const data = await response.json()
                        if (data.success) {
                            workspaces.value = data.data
                            if (workspaces.value.length > 0 && !currentWorkspace.value) {
                                currentWorkspace.value = workspaces.value[0].workspacePath
                            }
                        }
                    } catch (error) {
                        showToast('error', '載入工作空間失敗: ' + error.message)
                    }
                }

                async function openFolderDialog() {
                    isSelectingFolder.value = true
                    try {
                        const response = await fetch('/api/workspaces/select-folder', {
                            method: 'POST'
                        })
                        const data = await response.json()

                        if (data.success && data.data?.folderPath) {
                            newWorkspace.value.workspacePath = data.data.folderPath
                            showToast('success', '資料夾已選擇')
                        } else if (data.cancelled) {
                            // 使用者取消，不顯示錯誤
                        } else {
                            showToast('error', data.error || '無法開啟資料夾選擇器')
                        }
                    } catch (error) {
                        console.error('Failed to open folder dialog:', error)
                        showToast('error', '無法開啟資料夾選擇器: ' + error.message)
                    } finally {
                        isSelectingFolder.value = false
                    }
                }

                async function createWorkspace() {
                    if (!newWorkspace.value.workspacePath) {
                        showToast('error', '請輸入工作空間路徑')
                        return
                    }

                    try {
                        const response = await fetch('/api/workspaces', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(newWorkspace.value)
                        })
                        const data = await response.json()
                        if (data.success) {
                            showToast('success', '工作空間已建立')
                            await fetchWorkspaces()
                            currentWorkspace.value = newWorkspace.value.workspacePath
                            newWorkspace.value = { workspacePath: '', systemPrompt: '', settingSources: ['project'] }
                            showCreateWorkspaceForm.value = false
                        } else {
                            showToast('error', data.error || '建立失敗')
                        }
                    } catch (error) {
                        showToast('error', '建立失敗: ' + error.message)
                    }
                }

                async function deleteWorkspace(workspacePath) {
                    if (!confirm('確定要刪除此工作空間嗎？')) return

                    try {
                        const encodedPath = encodeURIComponent(workspacePath)
                        const response = await fetch(`/api/workspaces/${encodedPath}`, {
                            method: 'DELETE'
                        })
                        const data = await response.json()
                        if (data.success) {
                            showToast('success', '工作空間已刪除')
                            if (currentWorkspace.value === workspacePath) {
                                currentWorkspace.value = ''
                            }
                            await fetchWorkspaces()
                        } else {
                            showToast('error', data.error || '刪除失敗')
                        }
                    } catch (error) {
                        showToast('error', '刪除失敗: ' + error.message)
                    }
                }

                async function editWorkspaceStart(workspacePath) {
                    try {
                        const details = await fetchWorkspaceDetails(workspacePath)
                        if (details) {
                            editWorkspace.value = {
                                workspacePath: details.workspacePath,
                                systemPrompt: details.systemPrompt || '',
                                allowedTools: details.allowedTools || [],
                                disallowedTools: details.disallowedTools || [],
                                agents: details.agents || {},
                                mcpServers: details.mcpServers || {},
                                hooks: details.hooks || {},
                                settingSources: details.settingSources || ['project'],
                                allowedToolsText: (details.allowedTools || []).join(', '),
                                disallowedToolsText: (details.disallowedTools || []).join(', ')
                            }
                            editingWorkspace.value = workspacePath
                            showEditWorkspaceForm.value = true
                        }
                    } catch (error) {
                        showToast('error', '載入工作空間資訊失敗: ' + error.message)
                    }
                }

                async function fetchWorkspaceDetails(workspacePath) {
                    try {
                        const encodedPath = encodeURIComponent(workspacePath)
                        const response = await fetch(`/api/workspaces/${encodedPath}`)
                        const data = await response.json()
                        if (data.success) {
                            return data.data
                        } else {
                            showToast('error', data.error || '獲取工作空間資訊失敗')
                            return null
                        }
                    } catch (error) {
                        showToast('error', '獲取工作空間資訊失敗: ' + error.message)
                        return null
                    }
                }

                async function updateWorkspace() {
                    if (!editingWorkspace.value) return

                    try {
                        const allowedTools = editWorkspace.value.allowedToolsText
                            ? editWorkspace.value.allowedToolsText.split(',').map(t => t.trim()).filter(t => t)
                            : []
                        const disallowedTools = editWorkspace.value.disallowedToolsText
                            ? editWorkspace.value.disallowedToolsText.split(',').map(t => t.trim()).filter(t => t)
                            : []

                        const updateData = {}

                        if (editWorkspace.value.systemPrompt && editWorkspace.value.systemPrompt.trim()) {
                            updateData.systemPrompt = editWorkspace.value.systemPrompt
                        }

                        if (allowedTools.length > 0) {
                            updateData.allowedTools = allowedTools
                        }

                        if (disallowedTools.length > 0) {
                            updateData.disallowedTools = disallowedTools
                        }

                        if (editWorkspace.value.agents && Object.keys(editWorkspace.value.agents).length > 0) {
                            updateData.agents = editWorkspace.value.agents
                        }

                        if (editWorkspace.value.mcpServers && Object.keys(editWorkspace.value.mcpServers).length > 0) {
                            updateData.mcpServers = editWorkspace.value.mcpServers
                        }

                        if (editWorkspace.value.hooks && Object.keys(editWorkspace.value.hooks).length > 0) {
                            updateData.hooks = editWorkspace.value.hooks
                        }

                        if (editWorkspace.value.settingSources && editWorkspace.value.settingSources.length > 0) {
                            updateData.settingSources = editWorkspace.value.settingSources
                        }

                        const encodedPath = encodeURIComponent(editingWorkspace.value)
                        const response = await fetch(`/api/workspaces/${encodedPath}`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(updateData)
                        })
                        const data = await response.json()
                        if (data.success) {
                            showToast('success', '工作空間已更新')
                            await fetchWorkspaces()
                            showEditWorkspaceForm.value = false
                            editingWorkspace.value = null
                        } else {
                            showToast('error', data.error || '更新失敗')
                        }
                    } catch (error) {
                        showToast('error', '更新失敗: ' + error.message)
                    }
                }

                async function viewWorkspaceDetails(workspacePath) {
                    try {
                        const details = await fetchWorkspaceDetails(workspacePath)
                        if (details) {
                            selectedWorkspaceDetails.value = details
                            showWorkspaceDetailsModal.value = true
                        }
                    } catch (error) {
                        showToast('error', '載入工作空間資訊失敗: ' + error.message)
                    }
                }

                function onWorkspaceChange() {
                    // 可以在這裡加入工作空間切換時的邏輯
                }

                // === Sessions 管理 ===
                // fetchRecentSessions 已由 composable 提供

                async function loadSession(session) {
                    currentSessionId.value = session.session_id
                    currentWorkspace.value = session.workspace_path

                    try {
                        const sessionMessages = await loadSessionMessages(session.session_id)
                        const converted = convertSessionMessages(sessionMessages, parseToolBlocks)
                        setMessages(converted)
                        scrollToBottom()
                    } catch (error) {
                        showToast('error', '載入 session 失敗: ' + error.message)
                    }
                }

                async function deleteSessionWrapper(session) {
                    if (!confirm(`確定要刪除這個對話嗎？\n\n"${getSessionTitle(session)}"\n\n此操作無法復原。`)) {
                        return
                    }

                    try {
                        await deleteSessionAPI(session.session_id)
                        showToast('success', '對話已刪除')

                        // 如果刪除的是當前 session，清空訊息
                        if (currentSessionId.value === session.session_id) {
                            clearMessages()
                        }
                    } catch (error) {
                        console.error('Failed to delete session:', error)
                        showToast('error', '刪除失敗: ' + error.message)
                    }
                }

                // convertSessionMessages 已由 composable 提供

                function getSessionTitle(session) {
                    if (session.first_user_message) {
                        const message = session.first_user_message
                        return message.length > 60 ? message.substring(0, 60) + '...' : message
                    }
                    return session.workspace_path.split('/').pop() || '新對話'
                }

                function getWorkspaceName(workspacePath) {
                    return workspacePath.split('/').pop() || 'Unknown'
                }

                // === 工具函數 ===
                function renderMarkdown(content) {
                    if (!content) return ''
                    return marked.parse(content)
                }

                function formatDate(dateString) {
                    let date

                    if (!dateString.endsWith('Z') && !dateString.includes('+')) {
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

                    return date.toLocaleString('zh-TW', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                        timeZone: 'Asia/Taipei'
                    })
                }

                function openApiDocs() {
                    window.open('/swagger', '_blank')
                }

                function toggleDarkMode() {
                    isDarkMode.value = !isDarkMode.value
                    localStorage.setItem('darkMode', isDarkMode.value ? 'true' : 'false')
                }

                // 工具解析方法已由 composable 提供

                // === 生命週期 ===
                onMounted(async () => {
                    // WebSocket 連接已在 composable 中自動建立

                    // 初始化載入資料
                    await fetchWorkspaces()
                    await fetchRecentSessions()
                    await fetchSessionStats()

                    // 監聽視窗大小變化
                    window.addEventListener('resize', () => {
                        showSidebar.value = window.innerWidth >= 768
                    })
                })

                // === 返回給模板的所有內容 ===
                return {
                    // Composables 提供的內容
                    ws,
                    wsConnected,
                    messages,
                    isQuerying,
                    currentSessionId,
                    sessionTotalCost,
                    sessionMessageCount,
                    sessionStatus,
                    sessionResult,
                    hasStreamingMessage,
                    recentSessions,
                    sessionStats,
                    parseToolBlocks,
                    getToolIcon,
                    toggleToolExpand,
                    toggleMessageTools,

                    // UI 狀態
                    showSidebar,
                    showWorkspacesModal,
                    showStatsModal,
                    showSettings,
                    showCreateWorkspaceForm,
                    showSettingsPanel,
                    isDarkMode,
                    isSelectingFolder,

                    // 聊天狀態
                    inputMessage,
                    currentWorkspace,
                    messageInput,
                    messagesContainer,

                    // 資料
                    workspaces,

                    // 表單
                    newWorkspace,

                    // 編輯工作空間
                    showEditWorkspaceForm,
                    editingWorkspace,
                    editWorkspace,

                    // 工作空間詳細資訊
                    showWorkspaceDetailsModal,
                    selectedWorkspaceDetails,

                    // 設定
                    settings,

                    // Toast
                    toasts,

                    // 範例提示
                    examplePrompts,

                    // UI 方法
                    startNewChat,
                    useExamplePrompt,
                    autoResizeTextarea,
                    scrollToBottom,

                    // 訊息處理
                    sendMessage,

                    // 工作空間管理
                    fetchWorkspaces,
                    openFolderDialog,
                    createWorkspace,
                    deleteWorkspace,
                    editWorkspaceStart,
                    fetchWorkspaceDetails,
                    updateWorkspace,
                    viewWorkspaceDetails,
                    onWorkspaceChange,

                    // Session 管理
                    fetchRecentSessions,
                    loadSession,
                    deleteSession: deleteSessionWrapper,
                    fetchSessionStats,
                    getSessionTitle,
                    getWorkspaceName,

                    // 工具函數
                    renderMarkdown,
                    formatDate,
                    showToast,
                    openApiDocs,
                    toggleDarkMode
                }
            }
        }).mount('#app')
