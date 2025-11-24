<script setup lang="ts">
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useWorkspaceStore } from '@/stores/workspace'
import { Folder, FolderPlus, Check } from 'lucide-vue-next'
import { computed } from 'vue'
import type { WorkspaceListItem } from '@workspace/shared'

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const workspaceStore = useWorkspaceStore()

const workspaces = computed(() => workspaceStore.workspaces)
const currentPath = computed(() => workspaceStore.currentWorkspacePath)

const selectWorkspace = async (workspace: WorkspaceListItem) => {
  await workspaceStore.selectWorkspace(workspace.workspacePath)
  emit('update:open', false)
}

const browseAndCreate = async () => {
  const path = await workspaceStore.browseFolder()
  if (path) {
    await workspaceStore.createWorkspace({ workspacePath: path })
    emit('update:open', false)
  }
}
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="max-w-2xl max-h-[80vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>選擇工作空間</DialogTitle>
        <DialogDescription>
          選擇現有工作空間或瀏覽新資料夾來創建工作空間
        </DialogDescription>
      </DialogHeader>

      <div class="space-y-4 py-4">
        <!-- Browse new folder button -->
        <Button @click="browseAndCreate" class="w-full" variant="outline">
          <FolderPlus class="w-4 h-4 mr-2" />
          瀏覽資料夾
        </Button>

        <!-- Workspace list -->
        <div class="space-y-2">
          <p class="text-sm font-medium text-gray-700 dark:text-gray-300">
            現有工作空間 ({{ workspaces.length }})
          </p>

          <div v-if="workspaces.length === 0" class="text-center py-8 text-gray-500">
            <Folder class="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>尚無工作空間</p>
            <p class="text-xs">點擊上方按鈕瀏覽資料夾</p>
          </div>

          <Card
            v-for="workspace in workspaces"
            :key="workspace.workspacePath"
            @click="selectWorkspace(workspace)"
            class="cursor-pointer transition-all hover:shadow-md py-0"
            :class="{ 'ring-2 ring-[#10A37F]': workspace.workspacePath === currentPath }"
          >
            <CardContent class="p-4 flex items-center justify-between">
              <div class="flex items-center gap-3">
                <Folder class="w-5 h-5 text-gray-500" />
                <div>
                  <p class="font-medium">{{ workspace.workspacePath }}</p>
                  <p class="text-xs text-gray-500">
                    創建於 {{ new Date(workspace.createdAt).toLocaleDateString() }}
                  </p>
                </div>
              </div>

              <Check
                v-if="workspace.workspacePath === currentPath"
                class="w-5 h-5 text-[#10A37F]"
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>
