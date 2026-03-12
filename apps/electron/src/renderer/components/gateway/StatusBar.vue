<script setup lang="ts">
import { computed } from 'vue'
import { useConnectionStore } from '@renderer/gateway/connection'
import { ConnectionStatus } from '@renderer/gateway/types'

const conn = useConnectionStore()

const dotClass = computed(() => {
  switch (conn.status) {
    case ConnectionStatus.Connected: return 'dot--connected'
    case ConnectionStatus.Connecting:
    case ConnectionStatus.Reconnecting: return 'dot--connecting'
    case ConnectionStatus.Error: return 'dot--error'
    default: return 'dot--disconnected'
  }
})

const statusText = computed(() => {
  switch (conn.status) {
    case ConnectionStatus.Connected: return 'Connected'
    case ConnectionStatus.Connecting: return 'Connecting…'
    case ConnectionStatus.Reconnecting: return 'Reconnecting…'
    case ConnectionStatus.Error: return conn.errorMessage ?? 'Error'
    default: return 'Disconnected'
  }
})
</script>

<template>
  <div class="status-bar">
    <span class="dot" :class="dotClass" />
    <span class="status-text">{{ statusText }}</span>
    <span v-if="conn.serverVersion" class="version">v{{ conn.serverVersion }}</span>
    <span class="url">{{ conn.url }}</span>
  </div>
</template>

<style scoped>
.status-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 12px;
  font-size: 12px;
  color: var(--n-text-color-3);
  border-top: 1px solid var(--n-border-color);
  background: var(--n-color);
}
.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.dot--connected { background: #18a058; }
.dot--connecting { background: #f0a020; animation: pulse 1s infinite; }
.dot--error { background: #d03050; }
.dot--disconnected { background: #aaa; }
.status-text { font-weight: 500; }
.version { color: var(--n-text-color-3); }
.url { margin-left: auto; opacity: 0.7; }
@keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
</style>
