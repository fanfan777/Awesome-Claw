<script setup lang="ts">
import { h, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NCard, NSpace, NButton, NDataTable, NEmpty, NTag, NText, NStatistic,
} from 'naive-ui'
import type { DataTableColumns } from 'naive-ui'
import { useConnectionStore } from '@renderer/gateway/connection'
import { useInstancesStore, type ClientInstance } from '@renderer/stores/instances'
import { gatewayEventBus } from '@renderer/gateway/event-bus'

const { t } = useI18n()
const conn = useConnectionStore()
const store = useInstancesStore()

const columns: DataTableColumns<ClientInstance> = [
  {
    title: t('instances.clientId'),
    key: 'id',
    width: 200,
    ellipsis: true,
    render(row) {
      return h(NText, { code: true, style: 'font-size: 12px' }, { default: () => row.id })
    },
  },
  {
    title: t('instances.platform'),
    key: 'platform',
    width: 120,
    render(row) {
      if (!row.platform) return '-'
      return h(NTag, { size: 'small', bordered: false }, { default: () => row.platform })
    },
  },
  {
    title: t('instances.mode'),
    key: 'mode',
    width: 100,
    render(row) {
      return row.mode ?? '-'
    },
  },
  {
    title: t('instances.version'),
    key: 'version',
    width: 100,
    render(row) {
      return row.version ?? '-'
    },
  },
  {
    title: t('instances.lastSeen'),
    key: 'lastSeen',
    width: 180,
    render(row) {
      if (!row.lastSeen) return '-'
      return new Date(row.lastSeen).toLocaleString()
    },
  },
  {
    title: t('instances.ip'),
    key: 'ip',
    width: 140,
    render(row) {
      return row.ip ?? '-'
    },
  },
]

function onPresenceEvent(payload: unknown) {
  store.handlePresenceEvent(payload)
}

onMounted(() => {
  if (conn.isConnected) {
    store.fetchInstances()
  }
  gatewayEventBus.on('presence', onPresenceEvent)
})

onUnmounted(() => {
  gatewayEventBus.off('presence', onPresenceEvent)
})
</script>

<template>
  <div class="instances-view">
    <NSpace vertical :size="16">
      <NSpace justify="space-between" align="center">
        <NSpace align="center" :size="12">
          <NStatistic :label="t('instances.connected')" :value="store.totalCount" />
        </NSpace>
        <NButton
          size="small"
          secondary
          :loading="store.loading"
          :disabled="!conn.isConnected"
          @click="store.fetchInstances()"
        >
          {{ t('common.refresh') }}
        </NButton>
      </NSpace>

      <NCard size="small">
        <NText v-if="store.error" type="error" style="display: block; margin-bottom: 8px">
          {{ store.error }}
        </NText>
        <NEmpty v-if="!store.instances.length && !store.loading" :description="t('instances.noInstances')" />
        <NDataTable
          v-else
          :columns="columns"
          :data="store.instances"
          :pagination="false"
          :loading="store.loading"
          size="small"
          :max-height="500"
        />
      </NCard>
    </NSpace>
  </div>
</template>

<style scoped>
.instances-view {
  padding: 16px;
}
</style>
