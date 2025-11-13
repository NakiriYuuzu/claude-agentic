<script setup lang="ts">
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { useWebSocketStore } from '@/stores/websocket'
import { useWorkspaceStore } from '@/stores/workspace'
import { useSessionStore } from '@/stores/session'
import { isDark, toggleDark } from '@/stores/settings'
import { Moon, Sun, Wifi, WifiOff, Folder, MessageSquare } from 'lucide-vue-next'

const wsStore = useWebSocketStore()
const workspaceStore = useWorkspaceStore()
const sessionStore = useSessionStore()
</script>

<template>
  <div class="h-14 border-b px-6 flex items-center justify-between">
    <!-- Left: Sidebar trigger + Workspace info -->
    <div class="flex items-center gap-3">
      <SidebarTrigger />

      <h1 class="font-semibold text-lg">Claude Agent</h1>

      <Badge
        v-if="workspaceStore.currentWorkspacePath"
        variant="outline"
        class="max-w-xs"
      >
        <Folder class="w-3 h-3 mr-1" />
        <span class="truncate">{{ workspaceStore.currentWorkspacePath }}</span>
      </Badge>

      <Badge
        v-if="sessionStore.currentSession"
        variant="secondary"
        class="max-w-[250px]"
      >
        <MessageSquare class="w-3 h-3 mr-1" />
        <span class="truncate">
          {{ sessionStore.currentSession.first_user_message || sessionStore.currentSession.session_id }}
        </span>
      </Badge>
    </div>

    <!-- Right: Connection status + Dark mode -->
    <div class="flex items-center gap-4">
      <!-- Connection status -->
      <Badge :variant="wsStore.connected ? 'default' : 'destructive'">
        <component :is="wsStore.connected ? Wifi : WifiOff" class="w-3 h-3 mr-1" />
        {{ wsStore.connected ? '已連線' : '未連線' }}
      </Badge>

      <!-- Dark mode toggle -->
      <Button variant="ghost" size="icon" @click="toggleDark">
        <Moon v-if="!isDark" class="w-4 h-4" />
        <Sun v-else class="w-4 h-4" />
      </Button>
    </div>
  </div>
</template>
