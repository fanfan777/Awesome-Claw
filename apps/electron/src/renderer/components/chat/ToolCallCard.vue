<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { NCard, NTag, NCollapse, NCollapseItem, NSpace, NText, NSpin } from 'naive-ui'
import type { ToolCall } from '@renderer/stores/chat'

const { t } = useI18n()

const props = defineProps<{
  toolCall: ToolCall
}>()

const OUTPUT_TRUNCATE = 500
const outputExpanded = ref(false)

const statusType = computed(() => {
  switch (props.toolCall.status) {
    case 'running': return 'warning'
    case 'complete': return 'success'
    case 'error': return 'error'
    default: return 'default'
  }
})

const statusLabel = computed(() => {
  switch (props.toolCall.status) {
    case 'running': return t('chat.running')
    case 'complete': return t('chat.done')
    case 'error': return t('common.error')
    default: return props.toolCall.status
  }
})

const formattedInput = computed(() => {
  if (props.toolCall.input == null) return null
  try {
    return JSON.stringify(props.toolCall.input, null, 2)
  } catch {
    return String(props.toolCall.input)
  }
})

const rawOutput = computed(() => {
  if (props.toolCall.output == null) return null
  try {
    return JSON.stringify(props.toolCall.output, null, 2)
  } catch {
    return String(props.toolCall.output)
  }
})

const outputTruncated = computed(() => {
  if (!rawOutput.value) return false
  return rawOutput.value.length > OUTPUT_TRUNCATE
})

const formattedOutput = computed(() => {
  if (!rawOutput.value) return null
  if (!outputTruncated.value || outputExpanded.value) return rawOutput.value
  return rawOutput.value.slice(0, OUTPUT_TRUNCATE) + '...'
})

const elapsedTime = computed(() => {
  if (!props.toolCall.startedAt) return null
  const start = new Date(props.toolCall.startedAt).getTime()
  const end = props.toolCall.completedAt
    ? new Date(props.toolCall.completedAt).getTime()
    : Date.now()
  const ms = end - start
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
})
</script>

<template>
  <NCard size="small" class="tool-call-card" :class="`tool-call-card--${toolCall.status}`">
    <template #header>
      <NSpace align="center" :size="8">
        <NSpin v-if="toolCall.status === 'running'" :size="14" />
        <span v-else-if="toolCall.status === 'complete'" class="tool-call-card__icon">&#10003;</span>
        <span v-else-if="toolCall.status === 'error'" class="tool-call-card__icon tool-call-card__icon--error">&#10007;</span>
        <NText strong style="font-size: 13px;">{{ toolCall.name }}</NText>
        <NTag :type="statusType" size="tiny" round>{{ statusLabel }}</NTag>
        <NText v-if="elapsedTime" depth="3" style="font-size: 11px;">{{ elapsedTime }}</NText>
      </NSpace>
    </template>
    <NCollapse :default-expanded-names="[]" arrow-placement="left">
      <NCollapseItem v-if="formattedInput" :title="t('chat.input')" name="input">
        <pre class="tool-call-card__code">{{ formattedInput }}</pre>
      </NCollapseItem>
      <NCollapseItem v-if="formattedOutput" :title="t('chat.output')" name="output">
        <pre class="tool-call-card__code">{{ formattedOutput }}</pre>
        <NText
          v-if="outputTruncated"
          class="tool-call-card__expand"
          type="primary"
          style="cursor: pointer; font-size: 12px;"
          @click="outputExpanded = !outputExpanded"
        >
          {{ outputExpanded ? t('chat.showLess') : t('chat.showMore') }}
        </NText>
      </NCollapseItem>
    </NCollapse>
  </NCard>
</template>

<style scoped>
.tool-call-card {
  margin: 6px 0;
  border-left: 3px solid var(--n-border-color);
}
.tool-call-card--running {
  border-left-color: #f0a020;
}
.tool-call-card--complete {
  border-left-color: #18a058;
}
.tool-call-card--error {
  border-left-color: #d03050;
}
.tool-call-card__icon {
  font-size: 14px;
  color: #18a058;
  font-weight: bold;
}
.tool-call-card__icon--error {
  color: #d03050;
}
.tool-call-card__code {
  font-family: monospace;
  font-size: 12px;
  white-space: pre-wrap;
  word-break: break-all;
  overflow-x: auto;
  background: rgba(128, 128, 128, 0.06);
  border-radius: 4px;
  padding: 8px;
  margin: 0;
  max-height: 300px;
  overflow-y: auto;
}
.tool-call-card__expand {
  display: inline-block;
  margin-top: 4px;
}
</style>
