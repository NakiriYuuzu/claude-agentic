<script setup lang="ts">
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { useSettingsStore } from '@/stores/settings'
import { ref } from 'vue'
import { Plus, X } from 'lucide-vue-next'
import type { QueryOptions } from '@workspace/shared'

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const settingsStore = useSettingsStore()
const newPrompt = ref('')

// Model options
const modelOptions: Array<{ value: NonNullable<QueryOptions['model']>, label: string }> = [
  { value: 'sonnet', label: 'Sonnet' },
  { value: 'opus', label: 'Opus' },
  { value: 'haiku', label: 'Haiku' }
]

// Permission mode options
const permissionModeOptions: Array<{ value: NonNullable<QueryOptions['permissionMode']>, label: string, description: string }> = [
  { value: 'default', label: '預設模式', description: '需要確認所有操作' },
  { value: 'acceptEdits', label: '自動接受編輯', description: '自動接受檔案編輯' },
  { value: 'bypassPermissions', label: '略過權限', description: '自動執行所有操作' },
  { value: 'plan', label: '規劃模式', description: '僅規劃不執行' }
]

// Methods
const addQuickPrompt = () => {
  if (newPrompt.value.trim()) {
    settingsStore.addQuickPrompt(newPrompt.value.trim())
    newPrompt.value = ''
  }
}

const removeQuickPrompt = (index: number) => {
  settingsStore.removeQuickPrompt(index)
}
</script>

<template>
  <Sheet :open="open" @update:open="emit('update:open', $event)">
    <SheetContent class="w-[400px] sm:w-[540px] overflow-y-auto">
      <SheetHeader>
        <SheetTitle>設定</SheetTitle>
        <SheetDescription>
          調整 Claude Agent 的查詢選項和介面設定
        </SheetDescription>
      </SheetHeader>

      <div class="space-y-6 p-6">
        <!-- Model Selection -->
        <div class="space-y-2">
          <Label>模型</Label>
          <Select v-model="settingsStore.model">
            <SelectTrigger>
              <SelectValue placeholder="選擇模型" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="option in modelOptions"
                :key="option.value"
                :value="option.value"
              >
                {{ option.label }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <!-- Permission Mode -->
        <div class="space-y-2">
          <Label>權限模式</Label>
          <Select v-model="settingsStore.permissionMode">
            <SelectTrigger>
              <SelectValue placeholder="選擇權限模式" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="option in permissionModeOptions"
                :key="option.value"
                :value="option.value"
              >
                <div>
                  <div class="font-medium">{{ option.label }}</div>
                  <div class="text-xs text-gray-500">{{ option.description }}</div>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <!-- Max Turns -->
        <div class="space-y-2">
          <Label>最大回合數</Label>
          <Input
            v-model.number="settingsStore.maxTurns"
            type="number"
            min="1"
            max="100"
            placeholder="50"
          />
          <p class="text-xs text-gray-500">
            限制 Agent 的最大對話回合數（1-100）
          </p>
        </div>

        <!-- Sidebar Toggle -->
        <div class="flex items-center justify-between">
          <div class="space-y-0.5">
            <Label>顯示側邊欄</Label>
            <p class="text-xs text-gray-500">
              切換側邊欄的顯示狀態
            </p>
          </div>
          <Switch
            :checked="settingsStore.showSidebar"
            @update:checked="settingsStore.toggleSidebar"
          />
        </div>

        <!-- Quick Prompts -->
        <div class="space-y-3">
          <Label>快捷提示</Label>

          <!-- Add new prompt -->
          <div class="flex gap-2">
            <Input
              v-model="newPrompt"
              placeholder="新增快捷提示..."
              @keydown.enter="addQuickPrompt"
            />
            <Button @click="addQuickPrompt" size="icon">
              <Plus class="w-4 h-4" />
            </Button>
          </div>

          <!-- Prompt list -->
          <div class="space-y-2">
            <div
              v-for="(prompt, index) in settingsStore.quickPrompts"
              :key="index"
              class="flex items-center gap-2 p-2 rounded border"
            >
              <span class="flex-1 text-sm">{{ prompt }}</span>
              <Button
                variant="ghost"
                size="icon"
                @click="removeQuickPrompt(index)"
                class="h-6 w-6"
              >
                <X class="w-3 h-3" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </SheetContent>
  </Sheet>
</template>
