<script setup lang="ts">
import { InputGroup, InputGroupAddon, InputGroupTextarea } from '@/components/ui/input-group'
import { Button } from '@/components/ui/button'
import { useWebSocketStore } from '@/stores/websocket'
import { useSessionManagerStore } from '@/stores/session-manager'
import { useSettingsStore } from '@/stores/settings'
import { useWorkspaceStore } from '@/stores/workspace'
import SettingsSheet from './SettingsSheet.vue'
import { ref, computed, defineEmits } from 'vue'
import { Send, StopCircle, Settings } from 'lucide-vue-next'
import { toast } from 'vue-sonner'

const props = defineProps<{
  lastUserMessage?: string
}>()

const wsStore = useWebSocketStore()
const sessionManager = useSessionManagerStore()
const settingsStore = useSettingsStore()
const workspaceStore = useWorkspaceStore()

const emit = defineEmits(['resize', 'edit-last-message'])

const inputText = ref('')
const textareaRef = ref()
const showSettings = ref(false)
let lastTextareaHeight = ''

// Computed
const canSend = computed(() => {
  const hasWorkspace = workspaceStore.currentWorkspacePath !== null
  const isConnected = wsStore.state === 'connected'
  const hasInput = inputText.value.trim().length > 0
  const hasActiveSession = sessionManager.activeSessionId !== null
  const canQuerySession = sessionManager.canQuery // 檢查活躍 Session 是否可查詢（status !== 'running'）

  // 非查詢中：需要有輸入內容、workspace
  // 如果沒有 active session，會在 handleSend 中自動創建
  // 如果有 active session，需要確認狀態為 idle 或 error（可查詢）
  return isConnected && hasInput && hasWorkspace && (!hasActiveSession || canQuerySession)
})

const canStop = computed(() => {
  // 查詢中時可以停止
  const hasWorkspace = workspaceStore.currentWorkspacePath !== null
  const isConnected = wsStore.state === 'connected'
  const activeSession = sessionManager.activeSession

  // 當前活躍 Session 正在執行查詢時可以停止
  return isConnected && hasWorkspace && activeSession?.status === 'running'
})

// 取得活躍 Session 的最後一條使用者訊息（用於 ArrowUp 編輯）
const activeSessionLastUserMessage = computed(() => {
  const activeStore = sessionManager.activeMessageStore
  if (!activeStore) return undefined

  const lastMsg = activeStore.lastUserMessage
  return lastMsg?.text || lastMsg?.content
})

// Methods
const handleSend = async () => {
  // 🔒 立刻快照當前 activeSessionId，避免後續切換影響訊息歸屬
  let targetSessionId = sessionManager.activeSessionId

  // 檢查是否有活躍 Session，若無則自動創建
  if (!targetSessionId) {
    // 檢查是否有選擇工作空間
    if (!workspaceStore.currentWorkspacePath) {
      toast.error('請先選擇工作空間')
      return
    }

    // 自動創建新 Session
    targetSessionId = sessionManager.createSession(workspaceStore.currentWorkspacePath)

    // 清除 resume 參數，因為這是全新的 Session
    settingsStore.setResume(null)

    console.log('[ChatInput] Auto-created session for first message:', targetSessionId)
  }

  // 防止在查詢中重複發送（使用快照的 targetSessionId）
  const targetSession = sessionManager.sessions.get(targetSessionId)
  if (targetSession?.status === 'running') {
    toast.error('此 Session 正在執行查詢中，請稍候')
    return
  }

  if (!canSend.value) return

  // 保留完整訊息（包含換行），只 trim 前後空白
  const message = inputText.value.trim()
  if (!message) return

  inputText.value = ''
  // Manually trigger resize after clearing text
  autoResize()

  try {
    // 使用快照的 targetSessionId 發送查詢，確保訊息發送到「點擊發送時」的 session
    await wsStore.sendQuery(targetSessionId, message, settingsStore.queryOptions)
    console.log('[ChatInput] Query sent to session:', targetSessionId)
  } catch (error) {
    console.error('[ChatInput] Send query failed:', error)
    toast.error('發送查詢失敗', String(error))
  }
}

const handleStop = () => {
  wsStore.cancelQuery()
}

const handleKeydown = (e: KeyboardEvent) => {
  // ArrowUp in empty input = edit last message
  if (e.key === 'ArrowUp' && inputText.value === '' && activeSessionLastUserMessage.value) {
    e.preventDefault()
    inputText.value = activeSessionLastUserMessage.value
    emit('edit-last-message')
    autoResize()
    return
  }

  // Enter without Shift = send
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    handleSend()
  }
  // Shift+Enter = newline (default behavior)
}

// Auto-resize textarea
const autoResize = (event?: Event) => {
  // Get the actual textarea element
  // textareaRef.value is the InputGroupTextarea component
  // which exposes textareaElement that points to the Textarea component
  // which exposes textareaElement that points to the actual textarea DOM element
  let element: HTMLTextAreaElement | null = null

  if (event?.target) {
    element = event.target as HTMLTextAreaElement
  } else if (textareaRef.value?.textareaElement?.textareaElement) {
    element = textareaRef.value.textareaElement.textareaElement as HTMLTextAreaElement
  }

  if (!element || !element.style) return

  element.style.height = 'auto'
  const newHeight = Math.min(element.scrollHeight, 200) + 'px'
  element.style.height = newHeight

  if (lastTextareaHeight !== newHeight) {
    lastTextareaHeight = newHeight
    emit('resize')
  }
}
</script>

<template>
  <div class="border-t">
    <!-- Input Group -->
    <div class="px-6 py-4">
      <InputGroup>
        <!-- Settings button (left) -->
        <InputGroupAddon>
          <Button
            variant="ghost"
            size="icon"
            @click="showSettings = true"
          >
            <Settings class="w-4 h-4" />
          </Button>
        </InputGroupAddon>

        <!-- Textarea (center) -->
        <InputGroupTextarea
          ref="textareaRef"
          v-model="inputText"
          @keydown="handleKeydown"
          @input="autoResize"
          :placeholder="workspaceStore.currentWorkspacePath
            ? '輸入訊息... (Enter 發送，Shift+Enter 換行)'
            : '請先選擇工作空間'"
          :disabled="!wsStore.connected || !workspaceStore.currentWorkspacePath"
          rows="1"
          class="resize-none min-h-[40px] max-h-[200px]"
        />

        <!-- Send/Stop button (right) -->
        <InputGroupAddon align="inline-end">
          <!-- 停止按鈕 (活躍 Session 正在執行時顯示) -->
          <Button
            v-if="sessionManager.activeSession?.status === 'running'"
            @click="handleStop"
            :disabled="!canStop"
            size="icon"
            variant="destructive"
            class="active-press"
          >
            <StopCircle class="w-5 h-5" />
          </Button>
          <!-- 發送按鈕 (非查詢中時顯示) -->
          <Button
            v-else
            @click="handleSend"
            :disabled="!canSend"
            size="icon"
            class="active-press"
          >
            <Send class="w-5 h-5" />
          </Button>
        </InputGroupAddon>
      </InputGroup>
    </div>

    <!-- Settings Sheet -->
    <SettingsSheet v-model:open="showSettings" />
  </div>
</template>
