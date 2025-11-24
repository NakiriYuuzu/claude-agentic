<script setup lang="ts">
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { useSessionStore } from '@/stores/session'
import { computed, watch } from 'vue'
import { BarChart3, DollarSign, Clock, CheckCircle, XCircle, Zap } from 'lucide-vue-next'
import { getToolIcon } from '@/lib/toolIcons'

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const sessionStore = useSessionStore()

// Fetch stats when dialog opens
watch(() => props.open, async (isOpen) => {
  if (isOpen && !sessionStore.stats) {
    await sessionStore.fetchStats()
  }
})

const stats = computed(() => sessionStore.stats)

// Calculate success rate
const successRate = computed(() => {
  if (!stats.value || stats.value.total_sessions === 0) return 0
  return (stats.value.completed_sessions / stats.value.total_sessions) * 100
})

// Calculate error rate
const errorRate = computed(() => {
  if (!stats.value || stats.value.total_sessions === 0) return 0
  return (stats.value.error_sessions / stats.value.total_sessions) * 100
})

// Format cost
const formatCost = (cost: number) => {
  return `$${cost.toFixed(4)}`
}

// Format duration
const formatDuration = (ms: number) => {
  if (ms < 1000) return `${ms.toFixed(0)}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${(ms / 60000).toFixed(1)}min`
}

// Average cost per session
const averageCostPerSession = computed(() => {
  if (!stats.value || stats.value.total_sessions === 0) return 0
  return stats.value.total_cost_usd / stats.value.total_sessions
})

// Average turns per session
const averageTurnsPerSession = computed(() => {
  if (!stats.value || stats.value.total_sessions === 0) return 0
  return stats.value.total_turns / stats.value.total_sessions
})
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="max-w-3xl max-h-[80vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2">
          <BarChart3 class="w-5 h-5" />
          Session 統計資訊
        </DialogTitle>
        <DialogDescription>
          查看所有 Session 的統計數據和使用情況
        </DialogDescription>
      </DialogHeader>

      <div v-if="stats" class="space-y-6 py-4">
        <!-- Overview Cards -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
          <!-- Total Sessions -->
          <Card class="border border-slate-200 dark:border-slate-700">
            <CardContent class="p-4">
              <div class="flex items-center justify-between">
                <div>
                  <p class="text-xs text-slate-500 dark:text-slate-400">總數</p>
                  <p class="text-2xl font-bold">{{ stats.total_sessions }}</p>
                </div>
                <BarChart3 class="w-8 h-8 text-blue-500 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <!-- Completed -->
          <Card class="border border-slate-200 dark:border-slate-700">
            <CardContent class="p-4">
              <div class="flex items-center justify-between">
                <div>
                  <p class="text-xs text-slate-500 dark:text-slate-400">完成</p>
                  <p class="text-2xl font-bold text-green-600 dark:text-green-400">{{ stats.completed_sessions }}</p>
                </div>
                <CheckCircle class="w-8 h-8 text-green-500 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <!-- Errors -->
          <Card class="border border-slate-200 dark:border-slate-700">
            <CardContent class="p-4">
              <div class="flex items-center justify-between">
                <div>
                  <p class="text-xs text-slate-500 dark:text-slate-400">錯誤</p>
                  <p class="text-2xl font-bold text-red-600 dark:text-red-400">{{ stats.error_sessions }}</p>
                </div>
                <XCircle class="w-8 h-8 text-red-500 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <!-- Total Cost -->
          <Card class="border border-slate-200 dark:border-slate-700">
            <CardContent class="p-4">
              <div class="flex items-center justify-between">
                <div>
                  <p class="text-xs text-slate-500 dark:text-slate-400">總費用</p>
                  <p class="text-2xl font-bold">{{ formatCost(stats.total_cost_usd) }}</p>
                </div>
                <DollarSign class="w-8 h-8 text-[#10A37F] opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>

        <!-- Stats Grid: Success Rate, Error Rate, Avg Cost, Avg Turns -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
          <!-- Success Rate -->
          <Card class="border border-slate-200 dark:border-slate-700">
            <CardContent class="p-4">
              <div class="space-y-2">
                <p class="text-xs text-slate-500 dark:text-slate-400">成功率</p>
                <p class="text-2xl font-bold text-green-600 dark:text-green-400">{{ successRate.toFixed(1) }}%</p>
                <div class="w-full bg-gray-200 dark:bg-gray-700 rounded h-1.5">
                  <div
                    class="bg-green-500 h-1.5 rounded transition-all"
                    :style="{ width: successRate + '%' }"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <!-- Error Rate -->
          <Card class="border border-slate-200 dark:border-slate-700">
            <CardContent class="p-4">
              <div class="space-y-2">
                <p class="text-xs text-slate-500 dark:text-slate-400">錯誤率</p>
                <p class="text-2xl font-bold text-red-600 dark:text-red-400">{{ errorRate.toFixed(1) }}%</p>
                <div class="w-full bg-gray-200 dark:bg-gray-700 rounded h-1.5">
                  <div
                    class="bg-red-500 h-1.5 rounded transition-all"
                    :style="{ width: errorRate + '%' }"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <!-- Average Cost Per Session -->
          <Card class="border border-slate-200 dark:border-slate-700">
            <CardContent class="p-4">
              <div>
                <p class="text-xs text-slate-500 dark:text-slate-400">平均費用/次</p>
                <p class="text-2xl font-bold text-amber-600 dark:text-amber-400">
                  {{ formatCost(averageCostPerSession) }}
                </p>
              </div>
            </CardContent>
          </Card>

          <!-- Average Turns Per Session -->
          <Card class="border border-slate-200 dark:border-slate-700">
            <CardContent class="p-4">
              <div>
                <p class="text-xs text-slate-500 dark:text-slate-400">平均回合/次</p>
                <p class="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {{ averageTurnsPerSession.toFixed(1) }}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <!-- Average Duration -->
        <Card class="border border-slate-200 dark:border-slate-700">
          <CardHeader>
            <CardTitle class="text-base flex items-center gap-2">
              <Clock class="w-4 h-4" />
              平均執行時間
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div class="space-y-3">
              <p class="text-3xl font-bold">
                {{ formatDuration(stats.average_duration_ms) }}
              </p>
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <p class="text-xs text-slate-500 dark:text-slate-400">總回合數</p>
                  <p class="text-xl font-bold">{{ stats.total_turns }}</p>
                </div>
                <div>
                  <p class="text-xs text-slate-500 dark:text-slate-400">總執行時間</p>
                  <p class="text-xl font-bold">
                    {{ formatDuration(stats.average_duration_ms * stats.total_sessions) }}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <!-- Most Used Tools -->
        <Card class="border border-slate-200 dark:border-slate-700">
          <CardHeader>
            <CardTitle class="text-base flex items-center gap-2">
              <Zap class="w-4 h-4" />
              最常用工具 Top 10
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div class="space-y-4">
              <div v-if="stats.most_used_tools.length > 0">
                <div
                  v-for="(item, index) in stats.most_used_tools.slice(0, 10)"
                  :key="item.tool"
                  class="flex items-center gap-3 pb-3 border-b border-slate-200 dark:border-slate-700 last:border-b-0 last:pb-0"
                >
                  <span class="text-sm font-medium text-slate-500 dark:text-slate-400 w-6 text-center">
                    {{ index + 1 }}
                  </span>

                  <!-- Tool Icon -->
                  <div class="flex-shrink-0">
                    <component
                      :is="getToolIcon(item.tool).icon"
                      :class="['w-5 h-5', getToolIcon(item.tool).colorClass]"
                    />
                  </div>

                  <div class="flex-1 min-w-0">
                    <div class="flex items-center justify-between gap-2 mb-1">
                      <span class="text-sm font-medium truncate">{{ item.tool }}</span>
                      <Badge variant="secondary" class="flex-shrink-0">
                        {{ item.count }} 次
                      </Badge>
                    </div>
                    <Progress
                      :model-value="stats.most_used_tools[0] ? (item.count / stats.most_used_tools[0].count) * 100 : 0"
                      class="h-1.5"
                    />
                  </div>
                </div>
              </div>

              <p v-else class="text-sm text-slate-500 dark:text-slate-400 text-center py-4">
                尚無工具使用記錄
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <!-- Loading state -->
      <div v-else class="py-12 text-center text-gray-500">
        <div class="animate-spin-slow inline-block mb-2">⏳</div>
        <p>載入統計資料中...</p>
      </div>
    </DialogContent>
  </Dialog>
</template>
