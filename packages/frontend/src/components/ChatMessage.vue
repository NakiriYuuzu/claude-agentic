<script setup lang="ts">
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Card, CardContent } from '@/components/ui/card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import type { Message, AssistantMessage } from '@/types/message'
import { renderMarkdown } from '@/lib/markdown'
import { useCodeCopy } from '@/composables/useCodeCopy'
import ChatToolPanel from './ChatToolPanel.vue'
import { User, Bot, ChevronDown, Loader2 } from 'lucide-vue-next'
import { computed, ref } from 'vue'

const props = defineProps<{
    message: Message
}>()

// Code copy functionality
const { handleCodeCopy } = useCodeCopy()

// Tool panel expanded state
const toolsExpanded = ref(false)

// Check if this is a loading message
const isLoadingMessage = computed(() => {
    return (props.message as any).isLoading === true
})

// Render markdown
const renderedContent = computed(() => {
    if (props.message.type === 'user') {
        return renderMarkdown(props.message.text || props.message.content || '')
    } else if (props.message.type === 'assistant') {
        return renderMarkdown(props.message.content || '')
    } else if (props.message.type === 'system') {
        return renderMarkdown(props.message.text || '')
    } else if (props.message.type === 'error') {
        return renderMarkdown(props.message.text || '')
    }
    return ''
})

const isUserMessage = computed(() => props.message.type === 'user')
const isAssistantMessage = computed(() => props.message.type === 'assistant')

// Type guard for an assistant message
const assistantMessage = computed(() => {
    if (props.message.type === 'assistant') {
        return props.message as AssistantMessage
    }
    return null
})

// Check if has tools
const hasTools = computed(() => {
    return assistantMessage.value && assistantMessage.value.tools && assistantMessage.value.tools.length > 0
})
</script>

<template>
    <div class="flex gap-3" :class="isUserMessage ? 'flex-row-reverse' : ''">
        <!-- Avatar -->
        <Avatar class="w-8 h-8">
            <AvatarFallback :class="isUserMessage ? 'bg-blue-500' : 'bg-primary'">
                <User v-if="isUserMessage" class="w-4 h-4 text-white"/>
                <Bot v-else class="w-4 h-4 text-white"/>
            </AvatarFallback>
        </Avatar>

        <!-- Message content -->
        <div class="flex-1" :class="isUserMessage ? 'flex flex-col items-end' : ''">
            <Card :variant="isUserMessage ? 'outline' : 'default'" class="w-full py-0">
                <CardContent class="p-4">
                    <!-- Loading 狀態 -->
                    <div v-if="isLoadingMessage" class="flex items-center gap-2 text-muted-foreground">
                        <Loader2 class="w-4 h-4 animate-spin"/>
                        <span>Claude 正在思考...</span>
                    </div>

                    <!-- Markdown content with code copy handler -->
                    <div
                        v-else
                        v-html="renderedContent"
                        @click="handleCodeCopy"
                        class="markdown-content"
                    />

                    <!-- Tool blocks (Collapsible) -->
                    <Collapsible v-if="hasTools" v-model:open="toolsExpanded" class="mt-4">
                        <CollapsibleTrigger
                            class="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full justify-start">
                            <ChevronDown class="w-4 h-4 transition-transform"
                                         :class="toolsExpanded ? 'rotate-180' : ''"/>
                            🔧 已使用 {{ assistantMessage?.tools.length }} 個工具
                        </CollapsibleTrigger>
                        <CollapsibleContent class="mt-2">
                            <ChatToolPanel v-if="assistantMessage" :toolBlocks="assistantMessage.tools"/>
                        </CollapsibleContent>
                    </Collapsible>

                    <!-- Cost & Tokens info (assistant only) -->
                    <div v-if="assistantMessage && assistantMessage.result"
                         class="text-xs text-muted-foreground flex gap-4 mt-3 pt-3 border-t">
                        <span v-if="assistantMessage.result.total_cost_usd">💰 ${{
                                assistantMessage.result.total_cost_usd.toFixed(4)
                            }}</span>
                        <span v-if="assistantMessage.result.usage?.total_tokens">🔢 {{
                                assistantMessage.result.usage.total_tokens
                            }} tokens</span>
                        <span v-if="assistantMessage.result.duration_ms">⏱️ {{
                                (assistantMessage.result.duration_ms / 1000).toFixed(2)
                            }}s</span>
                    </div>
                </CardContent>
            </Card>
        </div>
    </div>
</template>
