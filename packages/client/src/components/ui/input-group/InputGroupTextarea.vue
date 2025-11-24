<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { cn } from "@/lib/utils"
import { Textarea } from '@/components/ui/textarea'
import { ref } from 'vue'

const props = defineProps<{
  class?: HTMLAttributes["class"]
}>()

// Get ref to inner Textarea component
const textareaComponent = ref()

// Expose the textarea element through the component ref
defineExpose({
  textareaElement: textareaComponent
})
</script>

<template>
  <Textarea
    ref="textareaComponent"
    data-slot="input-group-control"
    :class="cn(
      'flex-1 resize-none rounded-none border-0 bg-transparent py-3 shadow-none focus-visible:ring-0 dark:bg-transparent',
      props.class,
    )"
  />
</template>
