<script setup lang="ts">
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInput,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuAction,
  useSidebar,
} from '@/components/ui/sidebar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import AppLogo from '@/components/AppLogo.vue'
import { Folder, Plus, MessageSquare, MoreHorizontal, Edit, Copy, Trash2, BarChart3 } from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'
import { useWorkspaceStore } from '@/stores/workspace'
import { useSessionStore } from '@/stores/session'
import { useSessionManagerStore } from '@/stores/session-manager'
import { useMessageStore } from '@/stores/message'
import { useSettingsStore } from '@/stores/settings'
import { useClipboard } from '@vueuse/core'
import { toast } from 'vue-sonner'
import type { Session, WorkspaceListItem } from '@workspace/shared'
import type { WorkspaceContextMenuAction } from '@/types/workspace'
import type { SessionInfo } from '@/stores/session-manager'

const workspaceStore = useWorkspaceStore()
const sessionStore = useSessionStore()
const sessionManager = useSessionManagerStore()
const messageStore = useMessageStore()
const settingsStore = useSettingsStore()
const { copy } = useClipboard()

const { setOpen } = useSidebar()

const emit = defineEmits<{
  openWorkspaceDialog: []
  openWorkspaceEditDialog: [workspace: WorkspaceListItem]
  openWorkspaceStatsDialog: [workspace: WorkspaceListItem]
}>()

// View state: 'workspaces' or 'sessions'
type ViewType = 'workspaces' | 'sessions'
const activeView = ref<ViewType>('sessions')

const filteredWorkspaces = computed(() => workspaceStore.filteredWorkspaces)
const currentWorkspace = computed(() => workspaceStore.currentWorkspace)

// 使用 SessionManagerStore 管理活躍的 Sessions
const activeSessions = computed(() => sessionManager.sessionList)
const activeSessionId = computed(() => sessionManager.activeSessionId)
const canQueryActiveSession = computed(() => sessionManager.canQuery)

// 歷史 Session（從 API 載入）
const historicalSessions = computed(() => sessionStore.sessions)

// 混合 Session 列表：整合活躍 + 歷史 Session
interface UnifiedSession extends SessionInfo {
  totalCost?: number
}

const unifiedSessions = computed<UnifiedSession[]>(() => {
  // 取得當前 Workspace 路徑
  const currentPath = currentWorkspace.value?.workspacePath

  // 如果沒有選擇 Workspace，返回空陣列
  if (!currentPath) {
    return []
  }

  // 1. 從活躍 Session 創建 UnifiedSession（篩選當前 Workspace）
  const activeMapped: UnifiedSession[] = activeSessions.value
    .filter(session => session.workspacePath === currentPath)
    .map(session => ({
      ...session
      // totalCost 已從 SessionManager 的 sessionList 取得（即時從 messageStore.sessionTotalCost 讀取）
    }))

  // 2. 從歷史 Session 創建 UnifiedSession（排除已在活躍列表中的，且篩選當前 Workspace）
  const activeIds = new Set(activeMapped.map(s => s.id))
  const historicalMapped: UnifiedSession[] = historicalSessions.value
    .filter(s => !activeIds.has(s.session_id)) // 去重：活躍優先
    .filter(s => s.workspace_path === currentPath) // 篩選當前 Workspace
    .map(s => {
      // 截斷 first_user_message 為最多 20 個字元
      let sessionName = s.first_user_message || `Session ${s.session_id.slice(0, 8)}`
      if (sessionName.length > 20) {
        sessionName = sessionName.slice(0, 20) + '...'
      }

      return {
        id: s.session_id,
        name: sessionName,
        status: s.status === 'running' ? 'running' : (s.status === 'error' ? 'error' : (s.status === 'completed' ? 'complete' : 'idle')),
        messageCount: s.message_count || 0,
        lastActivity: new Date(s.updated_at.replace(' ', 'T') + 'Z'),  // 轉換為 ISO 格式並標記為 UTC
        totalCost: s.total_cost_usd || 0,
        workspacePath: s.workspace_path || currentWorkspace.value?.workspacePath || '',
        isLoaded: false,
        currentRequestId: null
      }
    })

  // 3. 合併並排序：按最後活動時間降序（最新的在最上面）
  const combined = [...activeMapped, ...historicalMapped]
  return combined.sort((a, b) => {
    return b.lastActivity.getTime() - a.lastActivity.getTime()
  })
})

const filteredSessions = ref<UnifiedSession[]>([])
const searchQuery = ref('')
const editingSessionId = ref<string | null>(null)
const editingName = ref('')

// AlertDialog 狀態
const showDeleteSessionDialog = ref(false)
const showDeleteWorkspaceDialog = ref(false)
const sessionToDelete = ref<UnifiedSession | null>(null)
const workspaceToDelete = ref<WorkspaceListItem | null>(null)

const workspaceSearchQuery = computed({
  get: () => workspaceStore.searchQuery,
  set: (value: string) => workspaceStore.setSearchQuery(value)
})

// ===========================
// 工具函數
// ===========================

/**
 * 格式化相對時間（使用 UTC+8 時區）
 * @param date - Date 物件或 ISO 字串
 * @returns 相對時間字串（例如：「剛剛」、「5 分鐘前」、「昨天」）
 */
const formatRelativeTime = (date: Date | string): string => {
  // 使用 UTC+8（台灣時區）
  const now = new Date()
  const target = typeof date === 'string' ? new Date(date) : date

  // 計算時間差（使用本地時間，瀏覽器會自動處理時區）
  const diffMs = now.getTime() - target.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)

  // 如果時間很接近，顯示相對時間
  if (diffSec < 10) return '剛剛'
  if (diffSec < 60) return `${diffSec} 秒前`
  if (diffMin < 60) return `${diffMin} 分鐘前`
  if (diffHour < 24) return `${diffHour} 小時前`
  if (diffDay === 1) return '昨天'
  if (diffDay < 7) return `${diffDay} 天前`

  // 超過一週，顯示完整日期時間（使用 UTC+8 格式）
  return target.toLocaleString('zh-TW', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })
}

/**
 * 格式化費用
 * @param cost - 費用（美元）
 * @returns 格式化的費用字串
 */
const formatCost = (cost: number): string => {
  if (cost === 0) return '$0.00'
  if (cost < 0.01) return '<$0.01'
  return `$${cost.toFixed(4)}`
}

// ===========================
// Methods
// ===========================
const selectWorkspace = async (workspace: WorkspaceListItem) => {
  // ==========================================
  // Phase 1: 清理當前 Workspace 的狀態
  // ==========================================

  // 1.1 取消所有正在執行的查詢（如果有）
  if (sessionManager.runningSessionCount > 0) {
    console.log('[Sidebar] Cancelling running queries before workspace switch')
    // 取消所有活躍 Session 的查詢
    sessionManager.sessionList
      .filter(s => s.status === 'running')
      .forEach(s => {
        wsStore.cancelQuery(s.id)
      })
  }

  // 1.2 清除 resume 參數（避免跨 Workspace resume 錯誤）
  settingsStore.clearResume()
  console.log('[Sidebar] Cleared resume parameter')

  // 1.3 清空所有 Sessions（包括它們的 MessageStore）
  sessionManager.clearAllSessions()
  console.log('[Sidebar] Cleared all sessions')

  // ==========================================
  // Phase 2: 切換到新 Workspace
  // ==========================================

  // 2.1 選擇新 Workspace（載入設定）
  await workspaceStore.selectWorkspace(workspace.workspacePath)
  console.log('[Sidebar] Workspace selected:', workspace.workspacePath)

  // 2.2 載入新 Workspace 的歷史 Sessions
  await sessionStore.fetchSessions({ workspace_path: workspace.workspacePath })
  console.log('[Sidebar] Sessions loaded for workspace:', workspace.workspacePath)

  // ==========================================
  // Phase 3: UI 更新
  // ==========================================

  // 3.1 切換到 Session 視圖
  activeView.value = 'sessions'

  // 3.2 打開側邊欄第二面板
  setOpen(true)
}

// Session 切換（支援活躍 + 歷史 Session，Lazy Loading）
const selectSession = async (session: UnifiedSession) => {
  // 檢查是否為活躍 Session（已在 SessionManager 中）
  if (sessionManager.sessions.has(session.id)) {
    // 1. 活躍 Session：直接切換
    sessionManager.switchSession(session.id)

    // 設置 resume 參數，以便繼續在此 Session 對話
    settingsStore.setResume(session.id)

    // Lazy Loading：如果訊息未載入，從資料庫載入歷史訊息
    // 注意：新建立的 Session（temp- 開頭）不從資料庫載入
    if (!session.isLoaded && !session.id.startsWith('temp-')) {
      console.log('[Sidebar] Lazy loading messages for active session:', session.id)
      toast.info('載入歷史訊息中...')

      try {
        const response = await fetch(`/api/sessions/${session.id}/messages?limit=100`)
        const data = await response.json()

        if (!data.success || !data.data) {
          throw new Error(data.error || '載入訊息失敗')
        }

        const messages = data.data.messages || []
        console.log('[Sidebar] Loaded messages:', messages.length)

        if (messages.length > 0) {
          const { parseToolBlocks } = await import('@workspace/shared')
          const convertedMessages = sessionStore.convertSessionMessages(messages, parseToolBlocks as any)

          const activeMessageStore = sessionManager.activeMessageStore
          if (activeMessageStore) {
            activeMessageStore.setMessages(convertedMessages as any)
          }
        }

        sessionManager.markSessionLoaded(session.id)

        // 設置 resume 參數，以便繼續在此 Session 對話
        settingsStore.setResume(session.id)

        toast.success('歷史訊息已載入', {
          description: `載入了 ${messages.length} 條訊息`
        })
      } catch (error) {
        console.error('[Sidebar] Failed to load messages:', error)
        toast.error('載入歷史訊息失敗', {
          description: String(error)
        })
      }
    }
  } else {
    // 2. 歷史 Session：從 API 載入訊息（只讀模式）
    // 注意：新建立的 Session（temp- 開頭）不從資料庫載入
    if (session.id.startsWith('temp-')) {
      console.log('[Sidebar] Skipping database load for new session:', session.id)
      return
    }

    console.log('[Sidebar] Loading historical session:', session.id)
    toast.info('載入歷史 Session 中...')

    try {
      const response = await fetch(`/api/sessions/${session.id}/messages?limit=100`)
      const data = await response.json()

      if (!data.success || !data.data) {
        throw new Error(data.error || '載入訊息失敗')
      }

      const messages = data.data.messages || []
      console.log('[Sidebar] Loaded historical messages:', messages.length)

      if (messages.length > 0) {
        const { parseToolBlocks } = await import('@workspace/shared')
        const convertedMessages = sessionStore.convertSessionMessages(messages, parseToolBlocks as any)

        // 直接添加歷史 Session 到 SessionManager（使用真實 ID）
        sessionManager.addHistoricalSession(
          session.id,              // 使用真實 Session ID
          session.workspacePath,
          session.name,
          session.messageCount,
          session.lastActivity
        )

        // **重要**：明確切換到這個 Session（設置 activeSessionId）
        sessionManager.switchSession(session.id)

        // 設置訊息到 MessageStore
        const messageStore = sessionManager.activeMessageStore
        if (messageStore) {
          messageStore.setMessages(convertedMessages as any)
        }

        // 標記為已載入
        sessionManager.markSessionLoaded(session.id)

        // 設置 resume 參數，以便繼續在此 Session 對話
        settingsStore.setResume(session.id)

        toast.success('歷史 Session 已載入', {
          description: `載入了 ${messages.length} 條訊息`
        })
      }
    } catch (error) {
      console.error('[Sidebar] Failed to load historical session:', error)
      toast.error('載入歷史 Session 失敗', {
        description: String(error)
      })
    }
  }
}

// 創建新 Session
const newSession = () => {
  if (!currentWorkspace.value) {
    toast.error('請先選擇工作空間')
    return
  }

  const sessionId = sessionManager.createSession(currentWorkspace.value.workspacePath)

  // 清除 resume 參數，因為這是全新的 Session
  settingsStore.setResume(null)

  toast.success('新 Session 已建立', {
    description: 'New Chat'
  })
}

// Session 搜尋過濾（支援混合列表）
const filterSessions = () => {
  if (!searchQuery.value) {
    filteredSessions.value = unifiedSessions.value
    return
  }
  const query = searchQuery.value.toLowerCase()
  filteredSessions.value = unifiedSessions.value.filter(session =>
    session.name.toLowerCase().includes(query) ||
    session.id.toLowerCase().includes(query)
  )
}

// Session 重新命名
const startEditing = (session: UnifiedSession) => {
  editingSessionId.value = session.id
  editingName.value = session.name
}

const finishEditing = (sessionId: string) => {
  if (editingName.value.trim()) {
    sessionManager.renameSession(sessionId, editingName.value.trim())
    toast.success('Session 已重新命名')
  }
  editingSessionId.value = null
  editingName.value = ''
}

const cancelEditing = () => {
  editingSessionId.value = null
  editingName.value = ''
}

// Session 刪除 - 顯示確認對話框
const promptDeleteSession = (session: UnifiedSession) => {
  sessionToDelete.value = session
  showDeleteSessionDialog.value = true
}

// Session 刪除 - 確認執行
const confirmDeleteSession = async () => {
  const session = sessionToDelete.value
  if (!session) return

  try {
    // 1. 先調用後端 API 刪除資料庫中的 Session
    const response = await fetch(`/api/sessions/${session.id}`, {
      method: 'DELETE'
    })
    const data = await response.json()

    if (!response.ok || !data.success) {
      throw new Error(data.error || '刪除失敗')
    }

    // 2. 從前端記憶體中刪除（sessionManager）
    sessionManager.deleteSession(session.id)

    // 3. 從歷史記錄中刪除（sessionStore）
    // 使用 filter 更新 sessions 陣列，確保 UI 立即更新
    sessionStore.sessions = sessionStore.sessions.filter(s => s.session_id !== session.id)

    toast.success('Session 已刪除')
  } catch (err) {
    console.error('[Sidebar] Failed to delete session:', err)
    toast.error('刪除失敗', {
      description: String(err)
    })
  } finally {
    // 4. 關閉對話框並清除狀態
    showDeleteSessionDialog.value = false
    sessionToDelete.value = null
  }
}

// 監聽混合列表變化，自動過濾
watch(unifiedSessions, () => {
  filterSessions()
}, { immediate: true })

watch(searchQuery, filterSessions)

// Workspace Actions
const handleWorkspaceEdit = (workspace: WorkspaceListItem) => {
  emit('openWorkspaceEditDialog', workspace)
}

const handleWorkspaceCopyPath = async (workspace: WorkspaceListItem) => {
  try {
    await copy(workspace.workspacePath)
    toast.success('路徑已複製', {
      description: workspace.workspacePath,
    })
  } catch (err) {
    toast.error('複製失敗', {
      description: String(err),
    })
  }
}

// Workspace 刪除 - 顯示確認對話框
const promptDeleteWorkspace = (workspace: WorkspaceListItem) => {
  workspaceToDelete.value = workspace
  showDeleteWorkspaceDialog.value = true
}

// Workspace 刪除 - 確認執行
const confirmDeleteWorkspace = async () => {
  const workspace = workspaceToDelete.value
  if (!workspace) return

  try {
    await workspaceStore.deleteWorkspace(workspace.workspacePath)
    toast.success('Workspace 已刪除', {
      description: workspace.workspacePath
    })
  } catch (err) {
    toast.error('刪除失敗', {
      description: String(err)
    })
  } finally {
    // 關閉對話框並清除狀態
    showDeleteWorkspaceDialog.value = false
    workspaceToDelete.value = null
  }
}

const handleWorkspaceStats = (workspace: WorkspaceListItem) => {
  emit('openWorkspaceStatsDialog', workspace)
}

</script>

<template>
  <Sidebar
    class="overflow-hidden [&>[data-sidebar=sidebar]]:flex-row"
    collapsible="icon"
  >
    <!-- First sidebar: Icon switcher -->
    <Sidebar
      collapsible="none"
      class="!w-[calc(var(--sidebar-width-icon)_+_1px)] border-r"
    >
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" class="md:h-8 md:p-0">
              <div class="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <AppLogo class="size-5" />
              </div>
              <div class="grid flex-1 text-left text-sm leading-tight">
                <span class="truncate font-semibold">Claude Agent</span>
                <span class="truncate text-xs">Version 0.5.0</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent class="px-1.5 md:px-0">
            <SidebarMenu>
              <!-- Workspace Icon -->
              <SidebarMenuItem>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger as-child>
                      <SidebarMenuButton
                        :is-active="activeView === 'workspaces'"
                        class="px-2.5 md:px-2"
                        @click="activeView = 'workspaces'"
                      >
                        <Folder />
                        <span>Workspaces</span>
                      </SidebarMenuButton>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      工作空間
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </SidebarMenuItem>

              <!-- Session Icon -->
              <SidebarMenuItem>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger as-child>
                      <SidebarMenuButton
                        :is-active="activeView === 'sessions'"
                        class="px-2.5 md:px-2"
                        @click="activeView = 'sessions'"
                      >
                        <MessageSquare />
                        <span>Sessions</span>
                      </SidebarMenuButton>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      對話記錄
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>

    <!-- Second sidebar: Content based on activeView -->
    <Sidebar collapsible="none" class="hidden flex-1 md:flex">
      <!-- Workspaces View -->
      <template v-if="activeView === 'workspaces'">
        <SidebarHeader class="gap-3.5 border-b p-4">
          <div class="flex w-full items-center justify-between">
            <div class="text-base font-medium text-foreground">
              Workspaces
            </div>
            <Button @click="emit('openWorkspaceDialog')" size="sm">
              <Plus class="w-4 h-4 mr-2" /> New
            </Button>
          </div>
          <SidebarInput
            placeholder="Search workspaces..."
            v-model="workspaceSearchQuery"
          />
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup class="px-0">
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem v-for="workspace in filteredWorkspaces" :key="workspace.workspacePath">
                  <SidebarMenuButton
                    :is-active="currentWorkspace?.workspacePath === workspace.workspacePath"
                    @click="() => selectWorkspace(workspace)"
                  >
                    <Folder />
                    <span class="truncate">{{ workspace.workspacePath.split('/').pop() }}</span>
                  </SidebarMenuButton>

                  <!-- Action Dropdown -->
                  <DropdownMenu>
                    <DropdownMenuTrigger as-child>
                      <SidebarMenuAction>
                        <MoreHorizontal />
                        <span class="sr-only">更多操作</span>
                      </SidebarMenuAction>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent side="right" align="start" class="w-48">
                      <DropdownMenuItem @click="handleWorkspaceEdit(workspace)">
                        <Edit class="w-4 h-4 mr-2" />
                        <span>編輯設定</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem @click="handleWorkspaceCopyPath(workspace)">
                        <Copy class="w-4 h-4 mr-2" />
                        <span>複製路徑</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem @click="handleWorkspaceStats(workspace)">
                        <BarChart3 class="w-4 h-4 mr-2" />
                        <span>查看統計</span>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        @click="promptDeleteWorkspace(workspace)"
                        class="text-destructive focus:text-destructive"
                      >
                        <Trash2 class="w-4 h-4 mr-2" />
                        <span>刪除</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </SidebarMenuItem>
              </SidebarMenu>

              <div v-if="filteredWorkspaces.length === 0" class="p-4 text-center text-sm text-muted-foreground">
                {{ workspaceSearchQuery ? '找不到匹配的工作空間' : '尚無工作空間，點擊 New 建立' }}
              </div>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </template>

      <!-- Sessions View -->
      <template v-else-if="activeView === 'sessions'">
        <SidebarHeader class="gap-3.5 border-b p-4">
          <div class="flex w-full items-center justify-between">
            <div class="text-base font-medium text-foreground">
              Active Sessions
            </div>
            <Button @click="newSession" size="sm" :disabled="!currentWorkspace">
              <Plus class="w-4 h-4 mr-2" /> New
            </Button>
          </div>
          <SidebarInput placeholder="Search sessions..." v-model="searchQuery" />
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup class="px-0">
            <SidebarGroupContent>
              <!-- Session 列表 -->
              <SidebarMenu>
                <SidebarMenuItem v-for="session in filteredSessions" :key="session.id">
                  <SidebarMenuButton
                    :is-active="activeSessionId === session.id"
                    @click="() => selectSession(session)"
                    class="group/session h-auto py-2.5"
                  >
                    <!-- 狀態點 -->
                    <div
                      class="session-status-dot"
                      :class="{
                        'selected': activeSessionId === session.id,
                        'running': activeSessionId !== session.id && session.status === 'running',
                        'complete': activeSessionId !== session.id && session.status === 'complete',
                        'error': activeSessionId !== session.id && session.status === 'error',
                        'idle': activeSessionId !== session.id && session.status === 'idle'
                      }"
                      :title="
                        activeSessionId === session.id ? '選擇中' :
                        (session.status === 'running' ? '執行中' :
                        (session.status === 'complete' ? '已完成' :
                        (session.status === 'error' ? '錯誤' : '閒置')))
                      "
                    ></div>

                    <!-- Session 內容區域 -->
                    <div class="flex-1 flex flex-col items-start gap-1 min-w-0">
                      <!-- Session 名稱（可編輯） -->
                      <div v-if="editingSessionId === session.id" class="w-full flex items-center gap-1" @click.stop>
                        <input
                          v-model="editingName"
                          @keydown.enter="finishEditing(session.id)"
                          @keydown.esc="cancelEditing"
                          @blur="finishEditing(session.id)"
                          class="flex-1 bg-transparent border-b border-primary outline-none text-sm px-1"
                          autofocus
                        />
                      </div>
                      <div
                        v-else
                        class="w-full flex items-center gap-1.5"
                        @dblclick.stop="startEditing(session)"
                      >
                        <span class="truncate font-medium text-sm flex-1">{{ session.name }}</span>
                      </div>

                      <!-- Session 統計資訊 -->
                      <div class="w-full flex items-center gap-2 text-[11px] text-muted-foreground">
                        <!-- 訊息計數 -->
                        <span class="shrink-0">{{ session.messageCount }} 則</span>

                        <!-- 分隔符 -->
                        <span class="shrink-0">•</span>

                        <!-- 最後活動時間 -->
                        <span class="shrink-0" :title="session.lastActivity.toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })">
                          {{ formatRelativeTime(session.lastActivity) }}
                        </span>

                        <!-- 費用（如果有） -->
                        <template v-if="session.totalCost && session.totalCost > 0">
                          <span class="shrink-0">•</span>
                          <span class="shrink-0" :title="`總費用: ${formatCost(session.totalCost)}`">
                            {{ formatCost(session.totalCost) }}
                          </span>
                        </template>

                        <!-- 執行狀態文字（running 時顯示） -->
                        <template v-if="session.status === 'running'">
                          <span class="shrink-0">•</span>
                          <span class="text-blue-500 font-medium shrink-0">執行中</span>
                        </template>
                      </div>
                    </div>
                  </SidebarMenuButton>

                  <!-- Action Dropdown -->
                  <DropdownMenu>
                    <DropdownMenuTrigger as-child>
                      <SidebarMenuAction>
                        <MoreHorizontal />
                        <span class="sr-only">更多操作</span>
                      </SidebarMenuAction>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent side="right" align="start" class="w-48">
                      <DropdownMenuItem @click="startEditing(session)">
                        <Edit class="w-4 h-4 mr-2" />
                        <span>重新命名</span>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        @click="promptDeleteSession(session)"
                        class="text-destructive focus:text-destructive"
                      >
                        <Trash2 class="w-4 h-4 mr-2" />
                        <span>刪除</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </SidebarMenuItem>
              </SidebarMenu>

              <!-- 空狀態提示 -->
              <div v-if="filteredSessions.length === 0 && !searchQuery" class="p-4 text-center text-sm text-muted-foreground">
                {{ currentWorkspace ? '點擊 New 創建第一個 Session' : '請先選擇工作空間' }}
              </div>
              <div v-else-if="filteredSessions.length === 0 && searchQuery" class="p-4 text-center text-sm text-muted-foreground">
                找不到匹配的 Session
              </div>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </template>
    </Sidebar>
  </Sidebar>

  <!-- Session 刪除確認對話框 -->
  <AlertDialog v-model:open="showDeleteSessionDialog">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>確定要刪除此 Session？</AlertDialogTitle>
        <AlertDialogDescription>
          您即將刪除 Session "<strong>{{ sessionToDelete?.name }}</strong>"。
          此操作無法復原，所有相關的訊息記錄將永久刪除。
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>取消</AlertDialogCancel>
        <AlertDialogAction
          @click="confirmDeleteSession"
          class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
        >
          確認刪除
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>

  <!-- Workspace 刪除確認對話框 -->
  <AlertDialog v-model:open="showDeleteWorkspaceDialog">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>確定要刪除此 Workspace？</AlertDialogTitle>
        <AlertDialogDescription>
          您即將刪除 Workspace "<strong>{{ workspaceToDelete?.workspacePath }}</strong>"。
          此操作無法復原，所有相關的設定和 Session 記錄將永久刪除。
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>取消</AlertDialogCancel>
        <AlertDialogAction
          @click="confirmDeleteWorkspace"
          class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
        >
          確認刪除
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
