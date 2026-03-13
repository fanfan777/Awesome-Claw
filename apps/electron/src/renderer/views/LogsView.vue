<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NSpace, NButton, NInput, NSelect, NSpin, NEmpty, NScrollbar, NText,
  NSwitch, NTag
} from 'naive-ui'
import type { SelectOption } from 'naive-ui'
import { useLogsStore, type LogLevel } from '@renderer/stores/logs'
import { useConnectionStore } from '@renderer/gateway/connection'

const { t } = useI18n()
const store = useLogsStore()
const conn = useConnectionStore()

const scrollbarRef = ref<InstanceType<typeof NScrollbar> | null>(null)
const bottomRef = ref<HTMLElement | null>(null)

const levelOptions = computed<SelectOption[]>(() => [
  { label: t('logs.all'), value: '' },
  { label: t('logs.debug'), value: 'debug' },
  { label: t('logs.info'), value: 'info' },
  { label: t('logs.warn'), value: 'warn' },
  { label: t('logs.error'), value: 'error' },
])

function scrollToBottom() {
  nextTick(() => {
    bottomRef.value?.scrollIntoView({ behavior: 'smooth' })
  })
}

function handleLevelChange(val: string) {
  store.setLevelFilter(val ? (val as LogLevel) : null)
}

async function handleLoadMore() {
  await store.loadMore()
}

watch(
  () => store.entries.length,
  () => { if (store.autoFollow) scrollToBottom() }
)

function levelTagType(level: string): 'success' | 'info' | 'warning' | 'error' | 'default' {
  switch (level) {
    case 'error': return 'error'
    case 'warn': return 'warning'
    case 'info': return 'info'
    case 'debug': return 'default'
    default: return 'default'
  }
}

// Periodic polling interval (10s) as fallback for real-time log events
let pollTimer: ReturnType<typeof setInterval> | null = null

onMounted(async () => {
  if (!conn.isConnected) return
  await store.fetchLogs()
  scrollToBottom()

  // Start periodic polling
  pollTimer = setInterval(async () => {
    if (conn.isConnected && !store.loading) {
      await store.fetchLogs()
    }
  }, 10_000)
})

onUnmounted(() => {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
})
</script>

<template>
  <div class="logs-view">
    <NSpace align="center" style="margin-bottom:12px; flex-wrap:wrap;" :size="8">
      <NSelect
        :value="store.levelFilter ?? ''"
        :options="levelOptions"
        size="small"
        style="width:120px;"
        @update:value="handleLevelChange"
      />
      <NInput
        :value="store.searchText"
        :placeholder="t('logs.search')"
        size="small"
        clearable
        style="width:200px;"
        @update:value="store.setSearch($event)"
      />
      <NSpace align="center" :size="4">
        <NText depth="3" style="font-size:12px;">{{ t('logs.autoFollow') }}</NText>
        <NSwitch
          :value="store.autoFollow"
          size="small"
          @update:value="store.toggleAutoFollow"
        />
      </NSpace>
      <NButton size="small" secondary :loading="store.loading" @click="store.fetchLogs()">
        {{ t('common.refresh') }}
      </NButton>
      <NButton size="small" secondary @click="handleLoadMore">
        {{ t('logs.loadMore') }}
      </NButton>
    </NSpace>

    <NSpin :show="store.loading">
      <NScrollbar ref="scrollbarRef" style="height: calc(100vh - 160px);">
        <NEmpty v-if="!store.filteredLogs.length" :description="t('logs.noEntries')" style="margin-top:60px;" />
        <div v-else class="log-list">
          <div
            v-for="(entry, i) in store.filteredLogs"
            :key="entry.id ?? i"
            class="log-entry"
          >
            <NTag :type="levelTagType(entry.level)" size="tiny" class="log-level">
              {{ entry.level.toUpperCase() }}
            </NTag>
            <NText depth="3" style="font-size:11px; width:130px; flex-shrink:0;">
              {{ new Date(entry.timestamp).toLocaleTimeString() }}
            </NText>
            <NText v-if="entry.source" depth="3" style="font-size:11px; width:100px; flex-shrink:0; overflow:hidden; text-overflow:ellipsis;">
              [{{ entry.source }}]
            </NText>
            <NText style="font-size:12px; font-family:monospace; white-space:pre-wrap; word-break:break-all;">
              {{ entry.message }}
            </NText>
          </div>
          <div ref="bottomRef" />
        </div>
      </NScrollbar>
    </NSpin>
  </div>
</template>

<style scoped>
.logs-view { padding: 16px; }
.log-list { display: flex; flex-direction: column; gap: 2px; }
.log-entry {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 3px 4px;
  border-radius: 4px;
  font-size: 12px;
}
.log-entry:hover { background: rgba(128,128,128,0.06); }
.log-level { flex-shrink: 0; }
</style>
