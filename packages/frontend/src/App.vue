<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { Toaster } from 'vue-sonner'
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import TopBar from '@/components/TopBar.vue'
import ChatSidebar from '@/components/ChatSidebar.vue'
import ChatMessages from '@/components/ChatMessages.vue'
import ChatInput from '@/components/ChatInput.vue'
import WorkspaceDialog from '@/components/WorkspaceDialog.vue'
import WorkspaceEditDialog from '@/components/WorkspaceEditDialog.vue'
import { useWorkspaceStore } from '@/stores/workspace'
import type { WorkspaceListItem } from '@workspace/shared'
import { useMessageStore } from '@/stores/message'
import { useWebSocketStore } from '@/stores/websocket'
import { useSettingsStore } from '@/stores/settings'
import { useSessionStore } from '@/stores/session'
import { isDark } from '@/stores/settings'
import 'vue-sonner/style.css'

// Stores
const workspaceStore = useWorkspaceStore()
const messageStore = useMessageStore()
const wsStore = useWebSocketStore()
const settingsStore = useSettingsStore()
const sessionStore = useSessionStore()

// Refs
const chatMessagesRef = ref<InstanceType<typeof ChatMessages>>()

// Dialog states
const showWorkspaceDialog = ref(false)
const showWorkspaceEditDialog = ref(false)
const editingWorkspace = ref<WorkspaceListItem | null>(null)

// Computed
const hasMessages = computed(() => messageStore.messages.length > 0)
const showSidebar = computed(() => settingsStore.showSidebar)
const lastUserMessage = computed(() => {
    const userMessages = messageStore.messages.filter(m => m.type === 'user')
    return userMessages[userMessages.length - 1]?.text || ''
})

// Methods
const handleResize = () => {
    chatMessagesRef.value?.scrollToBottom()
}

const handleQuickPrompt = async (prompt: string) => {
    // Send the prompt directly
    await wsStore.sendQuery(prompt, settingsStore.queryOptions)
}

const handleEditLastMessage = () => {
    // Find last user message index
    const lastUserIndex = messageStore.messages.findLastIndex(m => m.type === 'user')
    if (lastUserIndex !== -1) {
        // Remove last user message and all messages after it
        messageStore.messages.splice(lastUserIndex)
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
watch(() => messageStore.messages, handleResize, { deep: true })

// Lifecycle
onMounted(async () => {
    // Connect WebSocket
    await wsStore.connect()

    // Load workspaces
    await (workspaceStore as any).fetchWorkspaces()

    // Load sessions if workspace selected
    if (workspaceStore.currentWorkspace) {
        await (sessionStore as any).fetchSessions()
    }
})
</script>

<template>
    <div class="bg-background text-foreground">
        <SidebarProvider
            :default-open="showSidebar"
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
                                <div class="space-y-2">
                                    <h1 class="text-4xl font-bold">歡迎使用 Claude Agent</h1>
                                    <p class="text-lg text-muted-foreground">
                                        選擇工作空間開始對話
                                    </p>
                                </div>

                                <div v-if="!workspaceStore.currentWorkspace" class="pt-4">
                                    <button
                                        @click="showWorkspaceDialog = true"
                                        class="px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium"
                                    >
                                        選擇工作空間
                                    </button>
                                </div>

                                <div v-else class="pt-4 space-y-4">
                                    <p class="text-sm text-muted-foreground">
                                        當前工作空間: {{ workspaceStore.currentWorkspace.workspacePath }}
                                    </p>
                                    <p class="text-muted-foreground">
                                        選擇下方建議開始對話
                                    </p>

                                    <!-- 快速提示按鈕 (2 列佈局) -->
                                    <div v-if="settingsStore.quickPrompts.length > 0" class="grid grid-cols-2 gap-3 max-w-md mx-auto">
                                        <button
                                            v-for="(prompt, index) in settingsStore.quickPrompts"
                                            :key="index"
                                            @click="handleQuickPrompt(prompt)"
                                            class="px-4 py-2.5 border border-input bg-background hover:bg-accent hover:text-accent-foreground rounded-lg transition-colors text-sm inline-flex items-center gap-2 justify-center"
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

            <!-- Toast Notifications -->
            <Toaster
                :theme="isDark ? 'dark' : 'light'"
                position="bottom-right"
                :rich-colors="true"
            />
        </SidebarProvider>
    </div>
</template>
