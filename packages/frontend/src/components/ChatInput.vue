<script setup lang="ts">
import { InputGroup, InputGroupAddon, InputGroupTextarea } from '@/components/ui/input-group'
import { Button } from '@/components/ui/button'
import { useWebSocketStore } from '@/stores/websocket'
import { useSettingsStore } from '@/stores/settings'
import { useWorkspaceStore } from '@/stores/workspace'
import SettingsSheet from './SettingsSheet.vue'
import { ref, computed, defineEmits } from 'vue'
import { Send, Loader2, Settings } from 'lucide-vue-next'

const props = defineProps<{
  lastUserMessage?: string
}>()

const wsStore = useWebSocketStore()
const settingsStore = useSettingsStore()
const workspaceStore = useWorkspaceStore()

const emit = defineEmits(['resize', 'edit-last-message'])

const inputText = ref('')
const textareaRef = ref()
const showSettings = ref(false)
let lastTextareaHeight = ''

// Computed
const canSend = computed(() => {
  return wsStore.canQuery &&
         inputText.value.trim().length > 0 &&
         workspaceStore.currentWorkspacePath !== null
})

// Methods
const handleSend = async () => {
  if (!canSend.value) return

  // 保留完整訊息（包含換行），只 trim 前後空白
  const message = inputText.value.trim()
  if (!message) return

  inputText.value = ''
  // Manually trigger resize after clearing text
  autoResize()

  await wsStore.sendQuery(message, settingsStore.queryOptions)
}

const handleKeydown = (e: KeyboardEvent) => {
  // ArrowUp in empty input = edit last message
  if (e.key === 'ArrowUp' && inputText.value === '' && props.lastUserMessage) {
    e.preventDefault()
    inputText.value = props.lastUserMessage
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
          placeholder="輸入訊息... (Enter 發送，Shift+Enter 換行)"
          :disabled="!wsStore.canQuery || !workspaceStore.currentWorkspacePath"
          rows="1"
          class="resize-none min-h-[40px] max-h-[200px]"
        />

        <!-- Send button (right) -->
        <InputGroupAddon align="inline-end">
          <Button
            @click="handleSend"
            :disabled="!canSend"
            size="icon"
          >
            <Loader2 v-if="wsStore.isQuerying" class="w-5 h-5 animate-spin" />
            <Send v-else class="w-5 h-5" />
          </Button>
        </InputGroupAddon>
      </InputGroup>
    </div>

    <!-- Settings Sheet -->
    <SettingsSheet v-model:open="showSettings" />
  </div>
</template>
