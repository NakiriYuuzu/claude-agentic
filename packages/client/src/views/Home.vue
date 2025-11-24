<script setup lang="ts">

import { Button } from '@/components/ui/button'
import { ref } from 'vue'

const num = ref(0)
</script>

<template>
    <Button @click="num ++">{{num}}</Button>
</template>
