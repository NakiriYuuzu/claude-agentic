<script setup lang="ts">
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useMessageStore } from '@/stores/message'
import { useWebSocketStore } from '@/stores/websocket'
import ChatMessage from './ChatMessage.vue'
import { ref, nextTick, defineExpose, computed } from 'vue'

const messageStore = useMessageStore()
const wsStore = useWebSocketStore()
const scrollAreaRef = ref()

// Auto-scroll to bottom
const scrollToBottom = () => {
    nextTick(() => {
        if (scrollAreaRef.value) {
            scrollAreaRef.value.scrollTop = scrollAreaRef.value.scrollHeight
        }
    })
}

// 創建包含 loading message 的訊息列表
const displayMessages = computed(() => {
    const msgs = [...messageStore.messages]

    // 根據實際流程：MessageStore 會在查詢時立即創建 assistant message
    // 所以我們需要檢查最後一條 assistant message 是否還在等待內容
    if (wsStore.isQuerying && msgs.length > 0) {
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

    return msgs
})

defineExpose({
    scrollToBottom
})
</script>

<template>
    <div ref="scrollAreaRef" class="flex-1 min-h-0 overflow-y-auto py-6">
        <div class="px-6 md:max-w-5xl mx-auto space-y-6">
            <!-- Session 狀態欄 -->
            <Alert v-if="messageStore.sessionStatus" variant="default">
                <AlertDescription class="text-sm">
                    狀態: {{ messageStore.sessionStatus }} |
                    訊息數: {{ messageStore.sessionMessageCount }} |
                    費用: ${{ messageStore.sessionTotalCost.toFixed(4) }}
                </AlertDescription>
            </Alert>

            <!-- 訊息列表 -->
            <ChatMessage
                v-for="(message, index) in displayMessages"
                :key="index"
                :message="message"
            />
        </div>
    </div>
</template>
