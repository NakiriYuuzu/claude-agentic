<script setup lang="ts">
import { computed } from 'vue'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { useWebSocketStore } from '@/stores/websocket'
import { useWorkspaceStore } from '@/stores/workspace'
import { useSessionStore } from '@/stores/session'
import { colorMode } from '@/stores/settings'
import { Moon, Sun, Wifi, WifiOff, Folder, MessageSquare, Copy } from 'lucide-vue-next'
import { useClipboard } from '@vueuse/core'
import { toast } from 'vue-sonner'

const wsStore = useWebSocketStore()
const workspaceStore = useWorkspaceStore()
const sessionStore = useSessionStore()
const { copy } = useClipboard()

// Computed property for dark mode state
const isDark = computed(() => colorMode.value === 'dark')

// Toggle function
const toggleColorMode = () => {
  colorMode.value = colorMode.value === 'dark' ? 'light' : 'dark'
}

// Copy session ID
const copySessionId = async () => {
  if (!sessionStore.currentSession) return

  try {
    await copy(sessionStore.currentSession.session_id)
    toast.success('Session ID 已複製', {
      description: sessionStore.currentSession.session_id,
    })
  } catch (err) {
    toast.error('複製失敗', {
      description: String(err),
    })
  }
}
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
        <span class="truncate">{{ workspaceStore.currentWorkspacePath.split('/').pop() }}</span>
      </Badge>

      <Badge
        v-if="sessionStore.currentSession"
        variant="secondary"
        class="flex items-center gap-1"
      >
        <MessageSquare class="w-3 h-3" />
        <span class="font-mono text-xs">
          {{ sessionStore.currentSession.session_id }}
        </span>
        <Button
          variant="ghost"
          size="icon"
          class="h-4 w-4 ml-1 hover:bg-secondary-foreground/10"
          @click="copySessionId"
        >
          <Copy class="w-3 h-3" />
        </Button>
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
      <Button variant="ghost" size="icon" @click="toggleColorMode">
        <Moon v-if="!isDark" class="w-4 h-4" />
        <Sun v-else class="w-4 h-4" />
      </Button>
    </div>
  </div>
</template>
