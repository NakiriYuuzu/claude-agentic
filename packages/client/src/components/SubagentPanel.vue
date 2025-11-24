<script setup lang="ts">
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { SubagentPrompt } from '@/types/message'
import { Network } from 'lucide-vue-next'

const props = defineProps<{
  prompts: SubagentPrompt[]
}>()

// 截斷過長的文字
const truncateText = (text: string, maxLength: number = 100): string => {
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength) + '...'
}

// 格式化 parent_tool_use_id 為簡短標識
const formatToolId = (toolUseId: string): string => {
  return toolUseId.substring(0, 8)
}
</script>

<template>
  <Card class="mt-4 bg-muted/30 border-primary/20">
    <CardHeader class="pb-3">
      <CardTitle class="text-sm flex items-center gap-2 text-primary">
        <Network class="w-4 h-4" />
        🤖 Subagent 活動 ({{ prompts.length }})
      </CardTitle>
    </CardHeader>
    <CardContent class="pt-0">
      <div class="space-y-2">
        <div
          v-for="(prompt, index) in prompts"
          :key="prompt.parent_tool_use_id"
          class="flex items-start gap-3 p-3 rounded-md bg-background/50 border border-border/50 hover:border-primary/30 transition-colors"
        >
          <!-- 狀態圖示 -->
          <div class="flex-shrink-0 mt-0.5">
            <div class="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
          </div>

          <!-- Prompt 內容 -->
          <div class="flex-1 min-w-0">
            <p class="text-sm text-foreground leading-relaxed">
              {{ truncateText(prompt.text) }}
            </p>
          </div>

          <!-- Tool ID Badge -->
          <Badge variant="outline" class="flex-shrink-0 font-mono text-xs">
            {{ formatToolId(prompt.parent_tool_use_id) }}
          </Badge>
        </div>

        <!-- 空狀態 -->
        <div v-if="prompts.length === 0" class="text-center py-4 text-muted-foreground text-sm">
          暫無 Subagent 活動
        </div>
      </div>
    </CardContent>
  </Card>
</template>
