<script setup lang="ts">
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
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
import { Button } from '@/components/ui/button'
import NavUser from '@/components/NavUser.vue'
import AppLogo from '@/components/AppLogo.vue'
import { Folder, Plus, MessageSquare, MoreHorizontal, Edit, Copy, Trash2, BarChart3 } from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'
import { useWorkspaceStore } from '@/stores/workspace'
import { useSessionStore } from '@/stores/session'
import { useMessageStore } from '@/stores/message'
import { useSettingsStore } from '@/stores/settings'
import { useClipboard } from '@vueuse/core'
import { toast } from 'vue-sonner'
import type { Session, WorkspaceListItem } from '@workspace/shared'
import type { WorkspaceContextMenuAction } from '@/types/workspace'

const workspaceStore = useWorkspaceStore()
const sessionStore = useSessionStore()
const messageStore = useMessageStore()
const settingsStore = useSettingsStore()
const { copy } = useClipboard()

const { setOpen } = useSidebar()

const emit = defineEmits<{
  openWorkspaceDialog: []
  openWorkspaceEditDialog: [workspace: WorkspaceListItem]
  openWorkspaceStatsDialog: [workspace: WorkspaceListItem]
}>()

// Data
const user = {
  name: "Yuuzu",
  email: "yuuzu@example.com",
  avatar: "https://github.com/yuuzu.png",
}

// View state: 'workspaces' or 'sessions'
type ViewType = 'workspaces' | 'sessions'
const activeView = ref<ViewType>('sessions')

const filteredWorkspaces = computed(() => workspaceStore.filteredWorkspaces)
const sessions = computed(() => sessionStore.sessions)
const currentWorkspace = computed(() => workspaceStore.currentWorkspace)
const currentSession = computed(() => sessionStore.currentSession)

const filteredSessions = ref<Session[]>([])
const searchQuery = ref('')
const workspaceSearchQuery = computed({
  get: () => workspaceStore.searchQuery,
  set: (value: string) => workspaceStore.setSearchQuery(value)
})

// Methods
const selectWorkspace = async (workspace: WorkspaceListItem) => {
  await workspaceStore.selectWorkspace(workspace.workspacePath)
  await sessionStore.fetchSessions({ workspace_path: workspace.workspacePath })

  // 自動切換到 Session 視圖
  activeView.value = 'sessions'
  setOpen(true) // Open the second panel
}

const selectSession = async (session: Session) => {
  try {
    await sessionStore.loadMessages(session.session_id)
  } catch (err) {
    console.error('載入 Session 訊息失敗:', err)
  }
}

const newSession = () => {
  messageStore.clearMessages()
  sessionStore.setCurrentSession(null)
  settingsStore.clearResume()
}

const filterSessions = () => {
  if (!searchQuery.value) {
    filteredSessions.value = sessions.value
    return
  }
  filteredSessions.value = sessions.value.filter(session =>
    session.session_id.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
    new Date(session.created_at).toLocaleString().includes(searchQuery.value)
  )
}

watch(sessions, (newSessions) => {
  filteredSessions.value = newSessions
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

const handleWorkspaceDelete = async (workspace: WorkspaceListItem) => {
  if (!confirm(`確定要刪除 Workspace "${workspace.workspacePath}" 嗎？此操作無法復原。`)) {
    return
  }

  try {
    await workspaceStore.deleteWorkspace(workspace.workspacePath)
    toast.success('Workspace 已刪除', {
      description: workspace.workspacePath
    })
  } catch (err) {
    toast.error('刪除失敗', {
      description: String(err)
    })
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

      <SidebarFooter>
        <NavUser :user="user" />
      </SidebarFooter>
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
                        @click="handleWorkspaceDelete(workspace)"
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
              Sessions
            </div>
            <Button @click="newSession" size="sm">
              <Plus class="w-4 h-4 mr-2" /> New Chat
            </Button>
          </div>
          <SidebarInput placeholder="Search sessions..." v-model="searchQuery" />
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup class="px-0">
            <SidebarGroupContent>
              <a
                v-for="session in filteredSessions"
                :key="session.session_id"
                href="#"
                @click.prevent="selectSession(session)"
                class="flex flex-col items-start gap-2 whitespace-nowrap border-b p-4 text-sm leading-tight last:border-b-0 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                :class="{ 'bg-sidebar-accent text-sidebar-accent-foreground': currentSession?.session_id === session.session_id }"
              >
                <div class="flex w-full items-center gap-2">
                  <span class="font-medium truncate max-w-[180px]">{{ session.first_user_message || session.session_id }}</span>
                  <span class="ml-auto text-xs text-muted-foreground">{{ new Date(session.created_at).toLocaleDateString() }}</span>
                </div>
                <span class="line-clamp-2 whitespace-break-spaces text-xs text-muted-foreground">
                  {{ session.message_count }} messages
                </span>
              </a>
              <div v-if="sessions.length === 0" class="p-4 text-center text-sm text-muted-foreground">
                No sessions yet. Start a new chat!
              </div>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </template>
    </Sidebar>
  </Sidebar>
</template>
