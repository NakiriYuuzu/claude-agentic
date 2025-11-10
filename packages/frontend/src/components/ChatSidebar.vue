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
  useSidebar,
} from '@/components/ui/sidebar'
import { Button } from '@/components/ui/button'
import NavUser from '@/components/NavUser.vue'
import AppLogo from '@/components/AppLogo.vue'
import { Folder, Plus } from 'lucide-vue-next'
import { computed, ref, h, watch } from 'vue'
import { useWorkspaceStore } from '@/stores/workspace'
import { useSessionStore } from '@/stores/session'
import { useMessageStore } from '@/stores/message'
import type { Session, WorkspaceListItem } from '@workspace/shared'

const workspaceStore = useWorkspaceStore()
const sessionStore = useSessionStore()
const messageStore = useMessageStore()

const { setOpen } = useSidebar()

const emit = defineEmits<{
  openWorkspaceDialog: []
}>()

// Data
const user = {
  name: "Yuuzu",
  email: "yuuzu@example.com",
  avatar: "https://github.com/yuuzu.png",
}

const workspaces = computed(() => workspaceStore.workspaces)
const sessions = computed(() => sessionStore.sessions)
const currentWorkspace = computed(() => workspaceStore.currentWorkspace)
const currentSession = computed(() => sessionStore.currentSession)

const filteredSessions = ref<Session[]>([])
const searchQuery = ref('')

// Methods
const selectWorkspace = async (workspace: WorkspaceListItem) => {
  await workspaceStore.selectWorkspace(workspace.workspacePath)
  await sessionStore.fetchSessions({ workspace_path: workspace.workspacePath })
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

</script>

<template>
  <Sidebar
    class="overflow-hidden [&>[data-sidebar=sidebar]]:flex-row"
    collapsible="icon"
  >
    <!-- First sidebar for workspaces -->
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
              <SidebarMenuItem v-for="workspace in workspaces" :key="workspace.workspacePath">
                <SidebarMenuButton
                  :tooltip="h('div', { hidden: false }, workspace.workspacePath.split('/').pop())"
                  :is-active="currentWorkspace?.workspacePath === workspace.workspacePath"
                  class="px-2.5 md:px-2"
                  @click="() => selectWorkspace(workspace)"
                >
                  <Folder />
                  <span>{{ workspace.workspacePath.split('/').pop() }}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
               <SidebarMenuItem>
                <SidebarMenuButton
                  tooltip="Add Workspace"
                  class="px-2.5 md:px-2"
                  @click="emit('openWorkspaceDialog')"
                >
                  <Plus />
                  <span>Add Workspace</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <NavUser :user="user" />
      </SidebarFooter>
    </Sidebar>

    <!-- Second sidebar for sessions -->
    <Sidebar collapsible="none" class="hidden flex-1 md:flex">
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
                <span class="font-medium truncate">{{ session.session_id }}</span>
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
    </Sidebar>
  </Sidebar>
</template>
