<script setup lang="ts">
import { ref, computed } from 'vue'
import { useDraggable, useElementSize } from '@vueuse/core'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { CheckSquare, Square, Loader2, Minimize2, Maximize2, X, GripVertical, GripHorizontal } from 'lucide-vue-next'
import { useTodoPanel } from '@/composables/useTodoPanel'
import type { TodoItem } from '@/types/message'

// 使用 Composable
const { config, todos, stats, toggleMinimize, closePanel, updateSize } = useTodoPanel()

// 拖曳功能
const panelRef = ref<HTMLElement>()
const handleRef = ref<HTMLElement>()
const resizeHandleRef = ref<HTMLElement>()

const { x, y } = useDraggable(panelRef, {
    handle: handleRef,
    initialValue: config.value.position,
    onEnd: () => {
        config.value.position = { x: x.value, y: y.value }
    }
})

// 調整大小功能
const isResizing = ref(false)
const startResize = (e: MouseEvent) => {
    e.preventDefault()
    isResizing.value = true

    const startX = e.clientX
    const startY = e.clientY
    const startWidth = config.value.size.width
    const startHeight = config.value.size.height

    const onMouseMove = (moveEvent: MouseEvent) => {
        const deltaX = moveEvent.clientX - startX
        const deltaY = moveEvent.clientY - startY

        // 最小尺寸限制
        const newWidth = Math.max(300, Math.min(800, startWidth + deltaX))
        const newHeight = Math.max(200, Math.min(600, startHeight + deltaY))

        updateSize(newWidth, newHeight)
    }

    const onMouseUp = () => {
        isResizing.value = false
        document.removeEventListener('mousemove', onMouseMove)
        document.removeEventListener('mouseup', onMouseUp)
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
}

// 根據狀態獲取圖示
const getStatusIcon = (status: TodoItem['status']) => {
    switch (status) {
        case 'completed':
            return CheckSquare
        case 'in_progress':
            return Loader2
        case 'pending':
        default:
            return Square
    }
}

// 根據狀態獲取樣式類名
const getStatusClass = (status: TodoItem['status']) => {
    switch (status) {
        case 'completed':
            return 'text-emerald-600 dark:text-emerald-400'
        case 'in_progress':
            return 'text-blue-600 dark:text-blue-400 animate-spin'
        case 'pending':
        default:
            return 'text-gray-400 dark:text-gray-600'
    }
}

// 計算顯示的標題
const displayTitle = computed(() => {
    if (stats.value.total === 0) return 'Todos'
    return `Todos (${stats.value.completed}/${stats.value.total})`
})
</script>

<template>
    <Teleport to="body">
        <div
            v-if="config.isOpen"
            ref="panelRef"
            :style="{
                left: `${x}px`,
                top: `${y}px`,
                width: config.isMinimized ? '300px' : `${config.size.width}px`,
                height: config.isMinimized ? 'auto' : `${config.size.height}px`,
                position: 'fixed',
                zIndex: 50
            }"
            class="todo-floating-panel"
        >
            <Card class="h-full flex flex-col shadow-2xl border-2 relative">
                <!-- Header (拖曳把手) -->
                <CardHeader
                    ref="handleRef"
                    class="flex flex-row items-center justify-between space-y-0 pb-3 cursor-move bg-muted/30 hover:bg-muted/50 transition-colors border-b"
                >
                    <div class="flex items-center gap-2 flex-1">
                        <GripVertical class="w-4 h-4 text-muted-foreground" />
                        <CheckSquare class="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        <CardTitle class="text-sm font-medium">{{ displayTitle }}</CardTitle>
                        <Badge v-if="stats.total > 0" variant="secondary" class="text-xs">
                            {{ stats.completionRate }}%
                        </Badge>
                    </div>
                    <div class="flex items-center gap-1">
                        <button
                            @click="toggleMinimize"
                            class="p-1 hover:bg-accent rounded transition-colors"
                            :title="config.isMinimized ? '展開' : '最小化'"
                        >
                            <Minimize2 v-if="!config.isMinimized" class="w-4 h-4" />
                            <Maximize2 v-else class="w-4 h-4" />
                        </button>
                        <button
                            @click="closePanel"
                            class="p-1 hover:bg-destructive/10 hover:text-destructive rounded transition-colors"
                            title="關閉"
                        >
                            <X class="w-4 h-4" />
                        </button>
                    </div>
                </CardHeader>

                <!-- Content -->
                <CardContent v-if="!config.isMinimized" class="flex-1 flex flex-col p-4 min-h-0">
                    <!-- 進度條區域 (固定不滾動) -->
                    <div v-if="stats.total > 0" class="mb-4 space-y-2 flex-shrink-0">
                        <Progress :model-value="stats.completionRate" class="h-2" />
                        <div class="flex justify-between text-xs text-muted-foreground">
                            <span>{{ stats.pending }} 待處理</span>
                            <span>{{ stats.inProgress }} 進行中</span>
                            <span>{{ stats.completed }} 已完成</span>
                        </div>
                    </div>

                    <!-- Todos 列表 (可滾動) -->
                    <div v-if="todos.length > 0" class="flex-1 min-h-0">
                        <ScrollArea class="h-full pr-4">
                            <div class="space-y-2">
                                <div
                                    v-for="(todo, index) in todos"
                                    :key="index"
                                    class="flex items-start gap-3 p-2 rounded-lg hover:bg-accent/50 transition-colors group"
                                >
                                    <!-- 狀態圖示 -->
                                    <component
                                        :is="getStatusIcon(todo.status)"
                                        :class="['w-5 h-5 flex-shrink-0 mt-0.5', getStatusClass(todo.status)]"
                                    />

                                    <!-- 任務文字 -->
                                    <div class="flex-1 min-w-0">
                                        <p
                                            :class="[
                                                'text-sm leading-relaxed break-words',
                                                todo.status === 'completed'
                                                    ? 'line-through text-muted-foreground'
                                                    : 'text-foreground'
                                            ]"
                                        >
                                            {{ todo.status === 'in_progress' ? todo.activeForm : todo.content }}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </ScrollArea>
                    </div>

                    <!-- 空狀態 -->
                    <div v-else class="flex-1 flex items-center justify-center text-center p-6 min-h-0">
                        <div class="space-y-2">
                            <CheckSquare class="w-12 h-12 mx-auto text-muted-foreground/50" />
                            <p class="text-sm text-muted-foreground">
                                目前沒有 Todos
                            </p>
                            <p class="text-xs text-muted-foreground/70">
                                當 AI Agent 使用 TodoWrite 工具時，任務會顯示在這裡
                            </p>
                        </div>
                    </div>
                </CardContent>

                <!-- 調整大小把手 -->
                <div
                    v-if="!config.isMinimized"
                    ref="resizeHandleRef"
                    @mousedown="startResize"
                    class="absolute bottom-0 right-0 w-6 h-6 cursor-nwse-resize flex items-center justify-center hover:bg-accent/50 transition-colors group"
                    title="拖曳調整大小"
                >
                    <GripHorizontal class="w-4 h-4 text-muted-foreground transform rotate-45 group-hover:text-foreground transition-colors" />
                </div>
            </Card>
        </div>
    </Teleport>
</template>

<style scoped>
.todo-floating-panel {
    /* 確保面板在最上層 */
    pointer-events: auto;
    /* 防止拖曳時選取文字 */
    user-select: none;
}

/* 拖曳時的視覺回饋 */
.todo-floating-panel:active {
    cursor: move;
}

/* 調整大小時的游標樣式 */
.cursor-nwse-resize {
    cursor: nwse-resize !important;
}

/* 調整大小把手的懸停效果 */
.resize-handle-hover {
    background: rgba(var(--accent), 0.5);
}

/* ScrollArea 優化 */
:deep(.scrollbar) {
    width: 8px;
}

:deep(.scrollbar-thumb) {
    background: rgba(var(--foreground), 0.2);
    border-radius: 4px;
}

:deep(.scrollbar-thumb:hover) {
    background: rgba(var(--foreground), 0.3);
}
</style>
