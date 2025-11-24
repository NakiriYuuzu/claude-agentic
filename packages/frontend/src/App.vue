<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useMagicKeys, whenever } from '@vueuse/core'
import { Toaster } from 'vue-sonner'
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import TopBar from '@/components/TopBar.vue'
import ChatSidebar from '@/components/ChatSidebar.vue'
import ChatMessages from '@/components/ChatMessages.vue'
import ChatInput from '@/components/ChatInput.vue'
import WorkspaceDialog from '@/components/WorkspaceDialog.vue'
import WorkspaceEditDialog from '@/components/WorkspaceEditDialog.vue'
import TodoFloatingPanel from '@/components/TodoFloatingPanel.vue'
import { useWorkspaceStore } from '@/stores/workspace'
import type { WorkspaceListItem } from '@workspace/shared'
import { useSessionManagerStore } from '@/stores/session-manager'
import { useWebSocketStore } from '@/stores/websocket'
import { useSettingsStore } from '@/stores/settings'
import { useSessionStore } from '@/stores/session'
import { colorMode } from '@/stores/settings'
import { useTodoPanel } from '@/composables/useTodoPanel'
import { toast } from 'vue-sonner'
import 'vue-sonner/style.css'

// Stores
const workspaceStore = useWorkspaceStore()
const sessionManager = useSessionManagerStore()
const wsStore = useWebSocketStore()
const settingsStore = useSettingsStore()
const sessionStore = useSessionStore()

// Todo Panel
const { togglePanel } = useTodoPanel()

// 快捷鍵: Ctrl+T 或 Cmd+T 切換 Todo 面板
const keys = useMagicKeys()
whenever(keys['Ctrl+T'], togglePanel)
whenever(keys['Meta+T'], togglePanel)

// Refs
const chatMessagesRef = ref<InstanceType<typeof ChatMessages>>()

// Dialog states
const showWorkspaceDialog = ref(false)
const showWorkspaceEditDialog = ref(false)
const editingWorkspace = ref<WorkspaceListItem | null>(null)

// Computed
const hasMessages = computed(() => {
    const activeStore = sessionManager.activeMessageStore
    return activeStore ? activeStore.messages.length > 0 : false
})
const lastUserMessage = computed(() => {
    const activeStore = sessionManager.activeMessageStore
    if (!activeStore) return ''
    const userMessages = activeStore.messages.filter(m => m.type === 'user')
    return userMessages[userMessages.length - 1]?.text || ''
})

// Methods
const handleResize = () => {
    chatMessagesRef.value?.scrollToBottom()
}

const handleQuickPrompt = async (prompt: string) => {
    // 快照當前 activeSessionId，避免後續切換影響訊息歸屬
    let targetSessionId = sessionManager.activeSessionId

    // 檢查是否有活躍 Session，若無則自動創建
    if (!targetSessionId) {
        // 檢查是否有選擇工作空間
        if (!workspaceStore.currentWorkspacePath) {
            toast.error('請先選擇工作空間')
            return
        }

        // 自動創建新 Session 並保存 ID
        targetSessionId = sessionManager.createSession(workspaceStore.currentWorkspacePath)

        // 清除 resume 參數，因為這是全新的 Session
        settingsStore.setResume(null)

        console.log('[App] Auto-created session for quick prompt:', targetSessionId)
    }

    // 使用保存的 targetSessionId，而不是依賴 activeSessionId
    await wsStore.sendQuery(targetSessionId, prompt, settingsStore.queryOptions)
}

const handleEditLastMessage = () => {
    const activeStore = sessionManager.activeMessageStore
    if (!activeStore) return

    // Find last user message index
    const lastUserIndex = activeStore.messages.findLastIndex(m => m.type === 'user')
    if (lastUserIndex !== -1) {
        // Remove last user message and all messages after it
        activeStore.messages.splice(lastUserIndex)
    }
}

const handleOpenWorkspaceEditDialog = (workspace: WorkspaceListItem) => {
    editingWorkspace.value = workspace
    showWorkspaceEditDialog.value = true
}

const handleOpenWorkspaceStatsDialog = (workspace: WorkspaceListItem) => {
    // TODO: Implement workspace stats dialog
    console.log('Open workspace stats:', workspace)
}

const handleWorkspaceEditSuccess = () => {
    // Workspace updated successfully
    console.log('Workspace updated successfully')
}

// Watchers
watch(() => sessionManager.activeMessageStore?.messages, handleResize, { deep: true })

// Watch workspace changes to reload sessions
watch(
    () => workspaceStore.currentWorkspace,
    async (newWorkspace, oldWorkspace) => {
        if (newWorkspace && newWorkspace.workspacePath !== oldWorkspace?.workspacePath) {
            console.log('[App] Workspace changed, reloading sessions:', newWorkspace.workspacePath)
            // Clear old sessions
            sessionStore.clearSessions()
            // Load new sessions for the selected workspace
            await (sessionStore as any).fetchSessions({
                workspace_path: newWorkspace.workspacePath
            })
        }
    }
)

// Lifecycle
onMounted(async () => {
    console.log('[App] Initializing application...')

    // 1. Connect WebSocket
    await wsStore.connect()

    // 2. Load workspaces
    await (workspaceStore as any).fetchWorkspaces()

    // 3. Load historical sessions from Backend Database
    if (workspaceStore.currentWorkspace) {
        await (sessionStore as any).fetchSessions({
            workspace_path: workspaceStore.currentWorkspace.workspacePath
        })

        // 4. Restore sessions to SessionManager from Backend
        // 將 Backend 的 Session 添加到 SessionManager（不載入完整訊息）
        for (const session of sessionStore.sessions) {
            const firstMessage = session.first_user_message || 'New Chat'
            const name = firstMessage.slice(0, 30) + (firstMessage.length > 30 ? '...' : '')

            sessionManager.addHistoricalSession(
                session.session_id,
                workspaceStore.currentWorkspace.workspacePath,
                name,
                session.message_count || 0,
                new Date(session.updated_at.replace(' ', 'T') + 'Z')  // 轉換為 ISO 格式並標記為 UTC
            )
        }

        console.log('[App] Restored', sessionStore.sessions.length, 'sessions from Backend Database')
    }

    console.log('[App] Initialization complete')
})
</script>

<template>
    <div class="bg-background text-foreground">
        <SidebarProvider
            :default-open="true"
            :style="{
        '--sidebar-width': '450px',
      }"
        >
            <!-- Sidebar -->
            <ChatSidebar
                @open-workspace-dialog="showWorkspaceDialog = true"
                @open-workspace-edit-dialog="handleOpenWorkspaceEditDialog"
                @open-workspace-stats-dialog="handleOpenWorkspaceStatsDialog"
            />

            <!-- Main Content Area -->
            <SidebarInset>
                <div class="h-screen flex flex-col overflow-hidden">
                    <!-- Top Bar -->
                    <TopBar/>

                    <!-- Chat Area -->
                    <div class="flex-1 flex flex-col overflow-hidden">
                        <!-- Welcome Message -->
                        <div v-if="!hasMessages" class="flex-1 flex items-center justify-center p-6">
                            <div class="text-center space-y-6 max-w-2xl">
                                <!-- 標題：從下方淡入 -->
                                <div class="space-y-2">
                                    <h1 class="text-4xl font-bold animate-fade-in-up delay-200">歡迎使用 Claude Agent</h1>
                                    <p class="text-lg text-muted-foreground animate-fade-in-up delay-400">
                                        選擇工作空間開始對話
                                    </p>
                                </div>

                                <!-- 按鈕：縮放彈跳 + 光暈 -->
                                <div v-if="!workspaceStore.currentWorkspace" class="pt-4 animate-scale-bounce delay-600">
                                    <button
                                        @click="showWorkspaceDialog = true"
                                        class="px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-all font-medium active-press hover-lift"
                                    >
                                        選擇工作空間
                                    </button>
                                </div>

                                <div v-else class="pt-4 space-y-4">
                                    <p class="text-sm text-muted-foreground animate-fade-in-up delay-600">
                                        當前工作空間: {{ workspaceStore.currentWorkspace.workspacePath }}
                                    </p>
                                    <p class="text-muted-foreground animate-fade-in-up delay-800">
                                        選擇下方建議開始對話
                                    </p>

                                    <!-- 快速提示按鈕 (2 列佈局) - 錯落淡入 -->
                                    <div v-if="settingsStore.quickPrompts.length > 0" class="grid grid-cols-2 gap-3 max-w-md mx-auto">
                                        <button
                                            v-for="(prompt, index) in settingsStore.quickPrompts"
                                            :key="index"
                                            @click="handleQuickPrompt(prompt)"
                                            class="px-4 py-2.5 border border-input bg-background hover:bg-accent hover:text-accent-foreground rounded-lg transition-all text-sm inline-flex items-center gap-2 justify-center hover-lift active-press animate-fade-in-up"
                                            :class="`delay-${1000 + index * 100}`"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                                <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>
                                            </svg>
                                            {{ prompt }}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Messages -->
                        <template v-else>
                            <ChatMessages ref="chatMessagesRef"/>
                        </template>

                        <!-- Input -->
                        <ChatInput
                            :lastUserMessage="lastUserMessage"
                            @resize="handleResize"
                            @edit-last-message="handleEditLastMessage"
                        />
                    </div>
                </div>
            </SidebarInset>

            <!-- Dialogs -->
            <WorkspaceDialog v-model:open="showWorkspaceDialog"/>
            <WorkspaceEditDialog
                v-if="editingWorkspace"
                v-model:open="showWorkspaceEditDialog"
                :workspace-path="editingWorkspace.workspacePath"
                @success="handleWorkspaceEditSuccess"
            />

            <!-- Todo Floating Panel -->
            <TodoFloatingPanel />

            <!-- Toast Notifications -->
            <Toaster
                :theme="colorMode === 'dark' ? 'dark' : 'light'"
                position="bottom-right"
                :rich-colors="true"
            />
        </SidebarProvider>
    </div>
</template>
