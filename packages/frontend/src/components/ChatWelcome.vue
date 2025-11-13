<script setup lang="ts">
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useWorkspaceStore } from '@/stores/workspace'
import { Sparkles, FolderOpen, MessageSquare, Zap } from 'lucide-vue-next'

const workspaceStore = useWorkspaceStore()

const emit = defineEmits<{
  selectWorkspace: []
  sendMessage: [message: string]
}>()

const examplePrompts = [
  '分析這個專案的架構',
  '幫我重構這段代碼',
  '找出潛在的性能問題',
  '生成 API 文檔'
]

const sendExample = (prompt: string) => {
  emit('sendMessage', prompt)
}
</script>

<template>
  <div class="flex-1 flex items-center justify-center p-6">
    <div class="max-w-2xl w-full space-y-8 text-center">
      <!-- Logo & Title -->
      <div class="space-y-3">
        <div class="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary">
          <Sparkles class="w-8 h-8 text-primary-foreground" />
        </div>
        <h1 class="text-3xl font-bold">歡迎使用 Claude Agent</h1>
        <p class="text-muted-foreground text-lg">
          你的 AI 程式碼助手，隨時準備協助開發
        </p>
      </div>

      <!-- Workspace prompt (if no workspace selected) -->
      <Card v-if="!workspaceStore.currentWorkspace" class="border-dashed border-2">
        <CardContent class="p-6">
          <FolderOpen class="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
          <p class="text-muted-foreground mb-4">開始前請先選擇工作空間</p>
          <Button @click="emit('selectWorkspace')">
            選擇工作空間
          </Button>
        </CardContent>
      </Card>

      <!-- Features (if workspace selected) -->
      <div v-else class="space-y-6">
        <!-- Feature cards -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent class="p-4 text-center">
              <MessageSquare class="w-8 h-8 mx-auto mb-2 text-primary" />
              <p class="font-medium text-sm">智能對話</p>
              <p class="text-xs text-muted-foreground mt-1">自然語言交互</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent class="p-4 text-center">
              <Zap class="w-8 h-8 mx-auto mb-2 text-primary" />
              <p class="font-medium text-sm">工具執行</p>
              <p class="text-xs text-muted-foreground mt-1">自動化程式碼操作</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent class="p-4 text-center">
              <FolderOpen class="w-8 h-8 mx-auto mb-2 text-primary" />
              <p class="font-medium text-sm">專案理解</p>
              <p class="text-xs text-muted-foreground mt-1">深度分析程式碼</p>
            </CardContent>
          </Card>
        </div>

        <!-- Example prompts -->
        <div class="space-y-3">
          <p class="text-sm text-muted-foreground font-medium">試試這些提示詞：</p>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
            <Button
              v-for="prompt in examplePrompts"
              :key="prompt"
              variant="outline"
              @click="sendExample(prompt)"
              class="justify-start text-left h-auto py-3"
            >
              <Sparkles class="w-4 h-4 mr-2 flex-shrink-0" />
              <span class="text-sm">{{ prompt }}</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
