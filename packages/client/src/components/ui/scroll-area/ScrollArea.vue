<script setup lang="ts">
import type { ScrollAreaRootProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { reactiveOmit } from '@vueuse/core'
import {
    ScrollAreaCorner,
    ScrollAreaRoot,

    ScrollAreaViewport
} from 'reka-ui'
import { cn } from '@/lib/utils'
import ScrollBar from './ScrollBar.vue'
import { ref, onMounted } from 'vue'

const props = defineProps<ScrollAreaRootProps & { class?: HTMLAttributes['class'] }>()

const delegatedProps = reactiveOmit(props, 'class')

// Create refs for the viewport
const scrollAreaRootRef = ref()
const viewportElement = ref<HTMLElement>()

// After mount, get the actual viewport DOM element
onMounted(() => {
    if (scrollAreaRootRef.value?.$el) {
        viewportElement.value = scrollAreaRootRef.value.$el.querySelector('[data-slot="scroll-area-viewport"]')
    }
})

// Expose the viewport element for parent components
defineExpose({
    viewport: viewportElement,
    scrollToBottom: () => {
        if (viewportElement.value) {
            viewportElement.value.scrollTop = viewportElement.value.scrollHeight
        }
    }
})
</script>

<template>
    <ScrollAreaRoot
        ref="scrollAreaRootRef"
        data-slot="scroll-area"
        v-bind="delegatedProps"
        :class="cn('relative', props.class)"
    >
        <ScrollAreaViewport
            data-slot="scroll-area-viewport"
            class="focus-visible:ring-ring/50 size-full rounded-[inherit] transition-[color,box-shadow] outline-none focus-visible:ring-[3px] focus-visible:outline-1"
        >
            <slot/>
        </ScrollAreaViewport>
        <ScrollBar/>
        <ScrollAreaCorner/>
    </ScrollAreaRoot>
</template>
