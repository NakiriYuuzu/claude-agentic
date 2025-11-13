<script setup lang="ts">
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { ToolBlock } from '@/types/message'
import { Loader2, CheckCircle, XCircle, Clock } from 'lucide-vue-next'
import { getToolIcon } from '@/lib/toolIcons'

const props = defineProps<{
  toolBlocks: ToolBlock[]
}>()

// Status icon mapping
const getStatusIcon = (status: ToolBlock['status']) => {
  switch (status) {
    case 'pending': return Clock
    case 'running': return Loader2
    case 'success': return CheckCircle
    case 'error': return XCircle
    default: return Clock
  }
}

// Status color mapping (using Tailwind classes)
const getStatusClass = (status: ToolBlock['status']) => {
  switch (status) {
    case 'pending': return 'text-muted-foreground'
    case 'running': return 'text-blue-500 animate-spin'
    case 'success': return 'text-green-500'
    case 'error': return 'text-destructive'
    default: return 'text-muted-foreground'
  }
}

// Badge variant mapping
const getBadgeVariant = (status: ToolBlock['status']) => {
  switch (status) {
    case 'running': return 'default'
    case 'success': return 'default'
    case 'error': return 'destructive'
    default: return 'outline'
  }
}

// Format JSON for display
const formatJson = (obj: any) => {
  return JSON.stringify(obj, null, 2)
}
</script>

<template>
  <div class="space-y-2">
    <Accordion type="multiple" class="w-full space-y-2">
      <AccordionItem
        v-for="block in toolBlocks"
        :key="block.id"
        :value="block.id"
        class="border rounded-lg"
      >
        <AccordionTrigger class="hover:no-underline px-4 py-3">
          <div class="flex items-center gap-3 flex-1">
            <!-- Tool icon -->
            <component
              :is="getToolIcon(block.name).icon"
              class="w-4 h-4"
              :class="getToolIcon(block.name).colorClass"
            />

            <!-- Tool name -->
            <Badge variant="outline" class="font-mono text-xs">
              {{ block.name }}
            </Badge>

            <!-- Status icon -->
            <component
              :is="getStatusIcon(block.status)"
              class="w-3.5 h-3.5"
              :class="getStatusClass(block.status)"
            />

            <!-- Status badge -->
            <Badge :variant="getBadgeVariant(block.status)" class="text-xs">
              {{ block.status }}
            </Badge>
          </div>
        </AccordionTrigger>

        <AccordionContent class="px-4 pb-3">
          <div class="space-y-3">
            <!-- Input -->
            <div>
              <p class="text-xs font-semibold mb-1 text-muted-foreground">Input:</p>
              <ScrollArea class="h-[150px] rounded-md border">
                <pre class="text-xs p-3 font-mono">{{ formatJson(block.input) }}</pre>
              </ScrollArea>
            </div>

            <!-- Result (if available) -->
            <div v-if="block.result">
              <p class="text-xs font-semibold mb-1 text-muted-foreground">Result:</p>
              <ScrollArea class="h-[150px] rounded-md border">
                <pre class="text-xs p-3 font-mono">{{ formatJson(block.result) }}</pre>
              </ScrollArea>
            </div>

            <!-- Error (if any) -->
            <div v-if="block.is_error" class="p-3 bg-destructive/10 rounded-md border border-destructive/20">
              <p class="text-xs font-semibold mb-1 text-destructive">Error:</p>
              <p class="text-xs text-destructive">{{ block.result || 'Unknown error' }}</p>
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  </div>
</template>
