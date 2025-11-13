<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { VueMonacoEditor } from '@guolao/vue-monaco-editor'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle } from 'lucide-vue-next'

const props = withDefaults(
  defineProps<{
    modelValue: string | object
    height?: string
    placeholder?: string
    readonly?: boolean
    schema?: object
  }>(),
  {
    height: '400px',
    placeholder: '{}',
    readonly: false
  }
)

const emit = defineEmits<{
  'update:modelValue': [value: string | object]
}>()

// 轉換 modelValue 為 JSON 字符串
const jsonString = ref<string>('')
const validationError = ref<string | null>(null)

// 初始化時將 modelValue 轉換為 JSON 字符串
const initializeValue = () => {
  try {
    if (typeof props.modelValue === 'string') {
      // 驗證是否為有效 JSON
      JSON.parse(props.modelValue)
      jsonString.value = props.modelValue
    } else if (props.modelValue) {
      jsonString.value = JSON.stringify(props.modelValue, null, 2)
    } else {
      jsonString.value = props.placeholder
    }
    validationError.value = null
  } catch (err) {
    validationError.value = `無效的 JSON 格式: ${err}`
    jsonString.value = props.placeholder
  }
}

// 監聽外部 modelValue 變化
watch(() => props.modelValue, initializeValue, { immediate: true })

// 處理編輯器內容變化
const handleChange = (value: string | undefined) => {
  if (!value) {
    emit('update:modelValue', {})
    validationError.value = null
    return
  }

  try {
    // 驗證 JSON 格式
    const parsed = JSON.parse(value)
    validationError.value = null

    // 發送更新事件
    emit('update:modelValue', parsed)
  } catch (err) {
    // 保留錯誤但不阻止輸入
    if (err instanceof Error) {
      validationError.value = `JSON 格式錯誤: ${err.message}`
    } else {
      validationError.value = 'JSON 格式錯誤'
    }
  }
}

// Monaco Editor 選項
const editorOptions = computed(() => ({
  automaticLayout: true,
  formatOnType: true,
  formatOnPaste: true,
  readOnly: props.readonly,
  minimap: { enabled: false },
  scrollBeyondLastLine: false,
  fontSize: 13,
  lineNumbers: 'on',
  roundedSelection: false,
  scrollbar: {
    verticalScrollbarSize: 8,
    horizontalScrollbarSize: 8
  },
  tabSize: 2,
  wordWrap: 'on'
}))
</script>

<template>
  <div class="space-y-2">
    <div class="border rounded-md overflow-hidden">
      <VueMonacoEditor
        v-model:value="jsonString"
        language="json"
        :height="height"
        :options="editorOptions"
        @change="handleChange"
        theme="vs-dark"
      />
    </div>

    <Alert v-if="validationError" variant="destructive" class="py-2">
      <AlertCircle class="h-4 w-4" />
      <AlertDescription class="text-sm">
        {{ validationError }}
      </AlertDescription>
    </Alert>
  </div>
</template>
