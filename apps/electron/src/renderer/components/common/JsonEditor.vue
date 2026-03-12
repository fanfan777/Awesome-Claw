<script setup lang="ts">
import { ref, watch } from 'vue'
import { NInput, NAlert } from 'naive-ui'

const props = defineProps<{
  modelValue: string
  readonly?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const validationError = ref<string | null>(null)
const localValue = ref(props.modelValue)

watch(() => props.modelValue, (v) => {
  localValue.value = v
})

function handleUpdate(val: string) {
  localValue.value = val
  validationError.value = null
  try {
    JSON.parse(val)
    emit('update:modelValue', val)
  } catch (e) {
    validationError.value = e instanceof Error ? e.message : 'Invalid JSON'
  }
}
</script>

<template>
  <div class="json-editor">
    <NInput
      :value="localValue"
      type="textarea"
      :readonly="readonly"
      :autosize="{ minRows: 6, maxRows: 20 }"
      :status="validationError ? 'error' : undefined"
      placeholder='{ "key": "value" }'
      style="font-family: monospace; font-size: 13px;"
      @update:value="handleUpdate"
    />
    <NAlert v-if="validationError" type="error" :show-icon="false" style="margin-top: 4px;">
      {{ validationError }}
    </NAlert>
  </div>
</template>

<style scoped>
.json-editor { display: flex; flex-direction: column; gap: 4px; }
</style>
