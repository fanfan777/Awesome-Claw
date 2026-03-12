<script setup lang="ts">
import { computed } from 'vue'
import { NTag } from 'naive-ui'

export type StatusType = 'online' | 'offline' | 'warning' | 'error'

const props = defineProps<{
  status: StatusType
  text?: string
}>()

const tagType = computed((): 'success' | 'error' | 'warning' | 'default' => {
  switch (props.status) {
    case 'online': return 'success'
    case 'error': return 'error'
    case 'warning': return 'warning'
    default: return 'default'
  }
})

const displayText = computed(() => {
  if (props.text) return props.text
  switch (props.status) {
    case 'online': return 'Online'
    case 'offline': return 'Offline'
    case 'warning': return 'Warning'
    case 'error': return 'Error'
    default: return props.status
  }
})
</script>

<template>
  <NTag :type="tagType" size="small" round>
    <template #icon>
      <span class="status-dot" :class="`status-dot--${status}`" />
    </template>
    {{ displayText }}
  </NTag>
</template>

<style scoped>
.status-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 4px;
}
.status-dot--online { background-color: #18a058; }
.status-dot--offline { background-color: #999; }
.status-dot--warning { background-color: #f0a020; }
.status-dot--error { background-color: #d03050; }
</style>
