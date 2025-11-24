<script setup lang="ts">
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Edit, Copy, Trash2, BarChart3 } from 'lucide-vue-next'
import { ref } from 'vue'
import { useClipboard } from '@vueuse/core'
import { toast } from 'vue-sonner'
import type { WorkspaceListItem } from '@workspace/shared'
import type { WorkspaceContextMenuAction } from '@/types/workspace'

const props = defineProps<{
  workspace: WorkspaceListItem
}>()

const emit = defineEmits<{
  action: [action: WorkspaceContextMenuAction, workspace: WorkspaceListItem]
}>()

const { copy } = useClipboard()
const showDeleteDialog = ref(false)

const handleEdit = () => {
  emit('action', 'edit', props.workspace)
}

const handleCopyPath = async () => {
  try {
    await copy(props.workspace.workspacePath)
    toast.success('路徑已複製', {
      description: props.workspace.workspacePath,
    })
  } catch (err) {
    toast.error('複製失敗', {
      description: String(err),
    })
  }
}

const handleDeleteClick = () => {
  showDeleteDialog.value = true
}

const handleDeleteConfirm = () => {
  emit('action', 'delete', props.workspace)
  showDeleteDialog.value = false
}

const handleViewStats = () => {
  emit('action', 'view-stats', props.workspace)
}
</script>

<template>
  <ContextMenu>
    <ContextMenuTrigger as-child>
      <slot />
    </ContextMenuTrigger>
    <ContextMenuContent class="w-48">
      <ContextMenuItem @click="handleEdit">
        <Edit class="w-4 h-4 mr-2" />
        <span>編輯設定</span>
      </ContextMenuItem>
      <ContextMenuItem @click="handleCopyPath">
        <Copy class="w-4 h-4 mr-2" />
        <span>複製路徑</span>
      </ContextMenuItem>
      <ContextMenuItem @click="handleViewStats">
        <BarChart3 class="w-4 h-4 mr-2" />
        <span>查看統計</span>
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem @click="handleDeleteClick" class="text-destructive focus:text-destructive">
        <Trash2 class="w-4 h-4 mr-2" />
        <span>刪除</span>
      </ContextMenuItem>
    </ContextMenuContent>
  </ContextMenu>

  <!-- Delete Confirmation Dialog -->
  <AlertDialog v-model:open="showDeleteDialog">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>確定要刪除這個 Workspace 嗎？</AlertDialogTitle>
        <AlertDialogDescription>
          這將永久刪除 Workspace "<strong>{{ workspace.workspacePath }}</strong>"的所有設定。
          此操作無法復原。
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>取消</AlertDialogCancel>
        <AlertDialogAction @click="handleDeleteConfirm" class="bg-destructive text-destructive-foreground hover:bg-destructive/90">
          確定刪除
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
