<script setup lang="ts">
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { ToolBlock } from '@/types/message'
import { getToolIcon } from '@/lib/toolIcons'

const props = defineProps<{
  toolBlocks: ToolBlock[]
}>()

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
          </div>
        </AccordionTrigger>

        <AccordionContent class="px-4 pb-3">
          <div class="space-y-3">
            <!-- Input -->
            <div>
              <p class="text-xs font-semibold mb-1 text-muted-foreground">Input:</p>
              <ScrollArea class="rounded-md border">
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
