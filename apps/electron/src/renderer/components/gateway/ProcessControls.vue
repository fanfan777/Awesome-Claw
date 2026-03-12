<script setup lang="ts">
import { onMounted } from 'vue'
import { NSpace, NButton, NTag, NText } from 'naive-ui'
import { useGatewayLifecycleStore } from '@renderer/stores/gateway-lifecycle'

const lifecycle = useGatewayLifecycleStore()

onMounted(() => lifecycle.getStatus())

const stateTagType = (state: string): 'success' | 'warning' | 'error' | 'default' => {
  switch (state) {
    case 'running':
    case 'attached': return 'success'
    case 'starting':
    case 'stopping': return 'warning'
    case 'failed': return 'error'
    default: return 'default'
  }
}
</script>

<template>
  <div class="process-controls">
    <NSpace align="center">
      <NTag :type="stateTagType(lifecycle.processState)" size="small">
        {{ lifecycle.processState }}
      </NTag>
      <NText v-if="lifecycle.pid" depth="3" style="font-size:12px;">
        PID {{ lifecycle.pid }}
      </NText>
      <NText v-if="lifecycle.error" type="error" style="font-size:12px;">
        {{ lifecycle.error }}
      </NText>
    </NSpace>
    <NSpace>
      <NButton
        size="small"
        type="primary"
        :disabled="lifecycle.processState === 'running' || lifecycle.processState === 'starting'"
        @click="lifecycle.spawn()"
      >
        Start
      </NButton>
      <NButton
        size="small"
        :disabled="lifecycle.processState === 'stopped' || lifecycle.processState === 'stopping'"
        @click="lifecycle.stop()"
      >
        Stop
      </NButton>
      <NButton
        size="small"
        :disabled="lifecycle.processState !== 'running' && lifecycle.processState !== 'attached'"
        @click="lifecycle.restart()"
      >
        Restart
      </NButton>
    </NSpace>
  </div>
</template>

<style scoped>
.process-controls {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}
</style>
