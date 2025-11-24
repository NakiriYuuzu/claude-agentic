<script setup lang="ts">
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useSessionManagerStore } from '@/stores/session-manager'
import { useWebSocketStore } from '@/stores/websocket'
import ChatMessage from './ChatMessage.vue'
import { ref, nextTick, defineExpose, computed, watch, watchEffect, shallowRef } from 'vue'

const sessionManager = useSessionManagerStore()
const wsStore = useWebSocketStore()
const scrollAreaRef = ref()

// 使用 shallowRef 追蹤當前顯示的 Session ID（防止 reactivity 混淆）
const displaySessionId = shallowRef<string | null>(null)

// 使用活躍 Session 的 MessageStore（添加 Session ID 驗證）
const activeMessageStore = computed(() => {
  const store = sessionManager.activeMessageStore
  const activeId = sessionManager.activeSessionId

  // 驗證 activeSessionId 與 displaySessionId 是否一致
  if (activeId !== displaySessionId.value) {
    console.log('[ChatMessages] Session ID mismatch, updating displaySessionId:', {
      old: displaySessionId.value,
      new: activeId
    })
    displaySessionId.value = activeId
  }

  return store
})

// Auto-scroll to bottom
const scrollToBottom = () => {
    nextTick(() => {
        if (scrollAreaRef.value) {
            scrollAreaRef.value.scrollTop = scrollAreaRef.value.scrollHeight
        }
    })
}

// 創建包含 loading message 的訊息列表（增強 Session ID 驗證）
const displayMessages = computed(() => {
    // Session ID 快照（防止計算過程中 Session 切換）
    const currentSessionId = displaySessionId.value

    // 檢查 activeMessageStore 是否存在
    if (!activeMessageStore.value) {
        console.log('[ChatMessages] No active message store')
        return []
    }

    // 二次驗證：確保 displaySessionId 與 activeSessionId 一致
    if (currentSessionId !== sessionManager.activeSessionId) {
        console.warn('[ChatMessages] Session ID changed during computation, aborting', {
            displaySessionId: currentSessionId,
            activeSessionId: sessionManager.activeSessionId
        })
        return []
    }

    // Debug: 輸出訊息數量
    console.log('[ChatMessages] Rendering messages for session:', currentSessionId, {
        messageCount: activeMessageStore.value.messages.length
    })

    const msgs = [...activeMessageStore.value.messages]

    // 檢查當前活躍 Session 是否正在查詢
    const activeSession = sessionManager.activeSession
    const isActiveSessionRunning = activeSession?.status === 'running'

    // 根據實際流程：MessageStore 會在查詢時立即創建 assistant message
    // 所以我們需要檢查最後一條 assistant message 是否還在等待內容
    if (isActiveSessionRunning && msgs.length > 0) {
        const lastMessage = msgs[msgs.length - 1]

        // 如果最後一條是 assistant 且內容為空，顯示 loading
        // 一旦有內容開始串流，就會自動顯示內容而不是 loading
        if (lastMessage?.type === 'assistant') {
            const content = (lastMessage as any).content || ''
            // 內容為空時顯示 loading
            if (content.trim() === '') {
                // 替換最後一條空的 assistant message 為 loading message
                msgs[msgs.length - 1] = {
                    ...lastMessage,
                    isLoading: true
                } as any
            }
        }
    }

    console.log('[ChatMessages] Display messages count:', msgs.length)
    return msgs
})

// Session 狀態資訊
const sessionInfo = computed(() => {
    if (!activeMessageStore.value) return null

    return {
        status: activeMessageStore.value.sessionStatus,
        messageCount: activeMessageStore.value.sessionMessageCount,
        totalCost: activeMessageStore.value.sessionTotalCost
    }
})

// 切換 Session 時清理過渡狀態並滾動到底部
watch(() => sessionManager.activeSessionId, (newSessionId, oldSessionId) => {
    if (newSessionId !== oldSessionId) {
        console.log('[ChatMessages] Session switched:', {
            from: oldSessionId,
            to: newSessionId
        })

        // 更新 displaySessionId
        displaySessionId.value = newSessionId

        // 使用 nextTick 確保 DOM 更新後再滾動
        nextTick(() => {
            scrollToBottom()
        })
    }
}, { immediate: true })

// 使用 watchEffect 清理快速切換時的過渡狀態
watchEffect(() => {
    const activeId = sessionManager.activeSessionId
    const displayId = displaySessionId.value

    // 如果兩者不一致，立即同步
    if (activeId !== displayId) {
        console.log('[ChatMessages] Syncing displaySessionId:', {
            from: displayId,
            to: activeId
        })
        displaySessionId.value = activeId
    }
})

defineExpose({
    scrollToBottom
})
</script>

<template>
    <div ref="scrollAreaRef" class="flex-1 min-h-0 overflow-y-auto py-6">
        <div class="px-6 md:max-w-5xl mx-auto space-y-6">
            <!-- Session 狀態欄 -->
            <Alert v-if="sessionInfo && sessionInfo.status" variant="default">
                <AlertDescription class="text-sm">
                    狀態: {{ sessionInfo.status }} |
                    訊息數: {{ sessionInfo.messageCount }} |
                    費用: ${{ sessionInfo.totalCost.toFixed(4) }}
                </AlertDescription>
            </Alert>

            <!-- 訊息列表 -->
            <ChatMessage
                v-for="(message, index) in displayMessages"
                :key="index"
                :message="message"
            />

            <!-- 無 Session 提示 -->
            <div v-if="!activeMessageStore" class="text-center text-muted-foreground py-12">
                <p class="text-lg font-medium">請先選擇或創建一個 Session</p>
            </div>
        </div>
    </div>
</template>
