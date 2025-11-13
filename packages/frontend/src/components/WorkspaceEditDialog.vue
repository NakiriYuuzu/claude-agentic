<script setup lang="ts">
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  TagsInput,
  TagsInputInput,
  TagsInputItem,
  TagsInputItemDelete,
  TagsInputItemText,
} from '@/components/ui/tags-input'
import JsonEditorField from '@/components/JsonEditorField.vue'
import { useWorkspaceStore } from '@/stores/workspace'
import { ref, computed, watch } from 'vue'
import { AlertCircle } from 'lucide-vue-next'
import type {
  UpdateWorkspaceSettingsRequest,
  SettingSource,
  AgentDefinition,
  McpServerConfig,
  HookMatcher,
  HookEvent
} from '@workspace/shared'
import type { WorkspaceEditTabName } from '@/types/workspace'

interface Props {
    open: boolean
    workspacePath: string
}

interface Emits {
    (e: 'update:open', value: boolean): void
    (e: 'success'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const workspaceStore = useWorkspaceStore()

// 當前 Tab
const currentTab = ref<WorkspaceEditTabName>('basic')

// 表單資料
const formData = ref({
    systemPrompt: '',
    allowedTools: [] as string[],
    disallowedTools: [] as string[],
    settingSources: ['project'] as SettingSource[],
    agents: {} as Record<string, AgentDefinition>,
    mcpServers: {} as Record<string, McpServerConfig>,
    hooks: {} as Partial<Record<HookEvent, HookMatcher[]>>
})

// UI 狀態
const isLoading = ref(false)
const error = ref<string | null>(null)

// Setting sources 選項
const settingSourcesOptions: Array<{ value: SettingSource, label: string }> = [
    { value: 'user', label: '使用者設定 (user)' },
    { value: 'project', label: '專案設定 (project)' },
    { value: 'local', label: '本地設定 (local)' }
]

// 計算是否有效
const isValid = computed(() => {
    return props.workspacePath.trim().length > 0
})

// 監聽對話框打開，載入工作空間設定
watch(
    () => props.open,
    async (newVal) => {
        if (newVal && props.workspacePath) {
            await loadWorkspaceDetails()
        }
    },
    { immediate: true }  // 組件創建時立即執行
)

// 載入工作空間詳細資訊
async function loadWorkspaceDetails() {
    error.value = null
    isLoading.value = true

    try {
        // 直接呼叫 API 獲取該 workspace 的完整設定
        // 不依賴 store 的 currentSettings（可能是不同的 workspace）
        await workspaceStore.selectWorkspace(props.workspacePath)

        const settings = workspaceStore.currentSettings

        if (settings) {
            formData.value = {
                systemPrompt: settings.systemPrompt || '',
                allowedTools: settings.allowedTools || [],
                disallowedTools: settings.disallowedTools || [],
                settingSources: settings.settingSources || ['project'],
                agents: settings.agents || {},
                mcpServers: settings.mcpServers || {},
                hooks: settings.hooks || {}
            }
        }
    } catch (err) {
        error.value = err instanceof Error ? err.message : '載入工作空間資訊失敗'
        console.error('[WorkspaceEditDialog] loadWorkspaceDetails error:', err)
    } finally {
        isLoading.value = false
    }
}

// 驗證表單
function validateForm(): boolean {
    if (!props.workspacePath.trim()) {
        error.value = '工作空間路徑不能為空'
        return false
    }

    return true
}

// 提交表單
async function handleSubmit() {
    if (!validateForm()) {
        return
    }

    error.value = null
    isLoading.value = true

    try {
        // 構建更新請求
        const updateData: UpdateWorkspaceSettingsRequest = {}

        if (formData.value.systemPrompt.trim()) {
            updateData.systemPrompt = formData.value.systemPrompt
        }

        if (formData.value.allowedTools.length > 0) {
            updateData.allowedTools = formData.value.allowedTools
        }

        if (formData.value.disallowedTools.length > 0) {
            updateData.disallowedTools = formData.value.disallowedTools
        }

        if (formData.value.settingSources.length > 0) {
            updateData.settingSources = formData.value.settingSources
        }

        if (Object.keys(formData.value.agents).length > 0) {
            updateData.agents = formData.value.agents
        }

        if (Object.keys(formData.value.mcpServers).length > 0) {
            updateData.mcpServers = formData.value.mcpServers
        }

        if (Object.keys(formData.value.hooks).length > 0) {
            updateData.hooks = formData.value.hooks
        }

        // 呼叫 store 的更新方法
        await workspaceStore.updateWorkspace(props.workspacePath, updateData)

        // 關閉對話框並發送成功事件
        emit('update:open', false)
        emit('success')
    } catch (err) {
        error.value = err instanceof Error ? err.message : '更新失敗'
        console.error('[WorkspaceEditDialog] handleSubmit error:', err)
    } finally {
        isLoading.value = false
    }
}

// 取消編輯
function handleCancel() {
    error.value = null
    emit('update:open', false)
}

// 切換 setting source
function toggleSettingSource(source: SettingSource) {
    const index = formData.value.settingSources.indexOf(source)

    if (index > -1) {
        formData.value.settingSources.splice(index, 1)
    } else {
        formData.value.settingSources.push(source)
    }
}

// 檢查 setting source 是否被選中
function isSettingSourceSelected(source: SettingSource): boolean {
    return formData.value.settingSources.includes(source)
}

// 範例模板
const agentTemplate = {
    'example-agent': {
        description: 'Example agent description',
        prompt: 'Your agent prompt here',
        tools: ['bash', 'file_editor'],
        model: 'sonnet'
    }
}

const mcpTemplate = {
    'example-mcp': {
        type: 'stdio',
        command: 'python',
        args: ['-m', 'mcp_server']
    }
}

const hooksTemplate = {
    'PreToolUse': [
        {
            matcher: '.*',
            command: 'echo',
            args: ['Pre-tool hook']
        }
    ]
}
</script>

<template>
    <Dialog :open="open" @update:open="emit('update:open', $event)">
        <DialogContent class="max-w-4xl max-h-[90vh] flex flex-col">
            <DialogHeader>
                <DialogTitle>編輯工作空間設定</DialogTitle>
                <DialogDescription>
                    {{ workspacePath }}
                </DialogDescription>
            </DialogHeader>

            <!-- 錯誤訊息 -->
            <div v-if="error" class="flex gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                <AlertCircle class="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                <p class="text-sm text-destructive">{{ error }}</p>
            </div>

            <!-- Tabs -->
            <Tabs v-model="currentTab" class="flex-1 overflow-hidden flex flex-col">
                <TabsList class="grid w-full grid-cols-5">
                    <TabsTrigger value="basic">基本設定</TabsTrigger>
                    <TabsTrigger value="tools">Tools</TabsTrigger>
                    <TabsTrigger value="agents">Agents</TabsTrigger>
                    <TabsTrigger value="mcp">MCP Servers</TabsTrigger>
                    <TabsTrigger value="hooks">Hooks</TabsTrigger>
                </TabsList>

                <div class="flex-1 overflow-y-auto py-4">
                    <!-- Tab 1: 基本設定 -->
                    <TabsContent value="basic" class="space-y-6 mt-0">
                        <!-- System Prompt -->
                        <div class="space-y-2">
                            <Label for="system-prompt">系統提示詞</Label>
                            <Textarea
                                id="system-prompt"
                                v-model="formData.systemPrompt"
                                placeholder="輸入全域系統提示詞（可選）"
                                class="min-h-[150px] resize-vertical"
                            />
                            <p class="text-xs text-muted-foreground">
                                此提示詞將應用於此工作空間中的所有查詢
                            </p>
                        </div>

                        <!-- Setting Sources -->
                        <div class="space-y-3">
                            <Label>設定來源</Label>
                            <p class="text-xs text-muted-foreground">
                                選擇此工作空間的設定來源優先級
                            </p>

                            <div class="space-y-2">
                                <div
                                    v-for="option in settingSourcesOptions"
                                    :key="option.value"
                                    class="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent cursor-pointer transition-colors"
                                    @click="toggleSettingSource(option.value)"
                                >
                                    <Checkbox
                                        :model-value="isSettingSourceSelected(option.value)"
                                        @update:model-value="() => toggleSettingSource(option.value)"
                                    />
                                    <div class="flex-1">
                                        <p class="text-sm font-medium">{{ option.label }}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </TabsContent>

                    <!-- Tab 2: Tools -->
                    <TabsContent value="tools" class="space-y-6 mt-0">
                        <!-- Allowed Tools -->
                        <div class="space-y-2">
                            <Label>允許的工具</Label>
                            <TagsInput v-model="formData.allowedTools">
                                <TagsInputItem v-for="tool in formData.allowedTools" :key="tool" :value="tool">
                                    <TagsInputItemText />
                                    <TagsInputItemDelete />
                                </TagsInputItem>
                                <TagsInputInput placeholder="輸入工具名稱並按 Enter..." />
                            </TagsInput>
                            <p class="text-xs text-muted-foreground">
                                留空表示允許所有工具
                            </p>
                        </div>

                        <!-- Disallowed Tools -->
                        <div class="space-y-2">
                            <Label>不允許的工具</Label>
                            <TagsInput v-model="formData.disallowedTools">
                                <TagsInputItem v-for="tool in formData.disallowedTools" :key="tool" :value="tool">
                                    <TagsInputItemText />
                                    <TagsInputItemDelete />
                                </TagsInputItem>
                                <TagsInputInput placeholder="輸入工具名稱並按 Enter..." />
                            </TagsInput>
                            <p class="text-xs text-muted-foreground">
                                列出禁止使用的工具
                            </p>
                        </div>
                    </TabsContent>

                    <!-- Tab 3: Agents -->
                    <TabsContent value="agents" class="space-y-4 mt-0">
                        <div class="flex justify-between items-center">
                            <Label>Agent 定義</Label>
                            <Button
                                variant="outline"
                                size="sm"
                                @click="formData.agents = { ...agentTemplate }"
                            >
                                載入範例
                            </Button>
                        </div>
                        <JsonEditorField
                            v-model="formData.agents"
                            height="500px"
                            placeholder="{}"
                        />
                        <p class="text-xs text-muted-foreground">
                            定義自訂 Agent 的配置，包括 description、prompt、tools 等
                        </p>
                    </TabsContent>

                    <!-- Tab 4: MCP Servers -->
                    <TabsContent value="mcp" class="space-y-4 mt-0">
                        <div class="flex justify-between items-center">
                            <Label>MCP Server 設定</Label>
                            <Button
                                variant="outline"
                                size="sm"
                                @click="formData.mcpServers = { ...mcpTemplate }"
                            >
                                載入範例
                            </Button>
                        </div>
                        <JsonEditorField
                            v-model="formData.mcpServers"
                            height="500px"
                            placeholder="{}"
                        />
                        <p class="text-xs text-muted-foreground">
                            配置 MCP Server，包括 type、command、args、env 等
                        </p>
                    </TabsContent>

                    <!-- Tab 5: Hooks -->
                    <TabsContent value="hooks" class="space-y-4 mt-0">
                        <div class="flex justify-between items-center">
                            <Label>事件鉤子配置</Label>
                            <Button
                                variant="outline"
                                size="sm"
                                @click="formData.hooks = { ...hooksTemplate }"
                            >
                                載入範例
                            </Button>
                        </div>
                        <JsonEditorField
                            v-model="formData.hooks"
                            height="500px"
                            placeholder="{}"
                        />
                        <p class="text-xs text-muted-foreground">
                            配置事件鉤子，支援 PreToolUse、PostToolUse、SessionStart、SessionEnd、UserPromptSubmit
                        </p>
                    </TabsContent>
                </div>
            </Tabs>

            <!-- 按鈕組 -->
            <div class="flex justify-end gap-2 pt-4 border-t">
                <Button
                    variant="outline"
                    @click="handleCancel"
                    :disabled="isLoading"
                >
                    取消
                </Button>
                <Button
                    @click="handleSubmit"
                    :disabled="!isValid || isLoading"
                >
                    {{ isLoading ? '儲存中...' : '儲存' }}
                </Button>
            </div>
        </DialogContent>
    </Dialog>
</template>
