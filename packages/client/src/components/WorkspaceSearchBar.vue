<script setup lang="ts">
import { Search, X } from 'lucide-vue-next'
import { SidebarInput } from '@/components/ui/sidebar'
import { Button } from '@/components/ui/button'
import { computed } from 'vue'

const props = defineProps<{
  modelValue: string
  placeholder?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  clear: []
}>()

const hasValue = computed(() => props.modelValue.length > 0)

const handleClear = () => {
  emit('update:modelValue', '')
  emit('clear')
}
</script>

<template>
  <div class="relative">
    <div class="flex items-center gap-2 px-2">
      <div class="relative flex-1">
        <Search class="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <SidebarInput
          :model-value="modelValue"
          @update:model-value="emit('update:modelValue', $event)"
          :placeholder="placeholder || 'Search workspaces...'"
          class="pl-8 pr-8"
        />
        <Button
          v-if="hasValue"
          variant="ghost"
          size="icon"
          class="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
          @click="handleClear"
        >
          <X class="w-3 h-3" />
        </Button>
      </div>
    </div>
  </div>
</template>
