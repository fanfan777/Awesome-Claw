<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, h } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NCard, NSpace, NButton, NSelect, NInput, NSpin, NCode, NText,
  NDataTable, NEmpty, NTag, NTabs, NTabPane, NCollapse, NCollapseItem,
  NStatistic, NGrid, NGi,
} from 'naive-ui'
import type { DataTableColumns, SelectOption } from 'naive-ui'
import { useConnectionStore } from '@renderer/gateway/connection'
import { useDebugStore, type DebugEvent, type RpcCall } from '@renderer/stores/debug'

const { t } = useI18n()
const conn = useConnectionStore()
const debug = useDebugStore()

// RPC caller state
const selectedMethod = ref<string | null>(null)
const rpcParams = ref('{}')

const methodOptions = computed<SelectOption[]>(() =>
  conn.availableMethods.map((m) => ({ label: m, value: m })),
)

async function callRpc() {
  if (!selectedMethod.value) return
  let params: unknown = {}
  try {
    params = JSON.parse(rpcParams.value)
  } catch {
    debug.lastRpcError = 'Invalid JSON params'
    return
  }
  await debug.callRpc(selectedMethod.value, params)
}

// Models catalog
const modelsCatalogResult = ref<unknown>(null)
const modelsCatalogLoading = ref(false)

async function fetchModelsCatalog() {
  modelsCatalogLoading.value = true
  try {
    const client = conn.client
    if (!client) return
    modelsCatalogResult.value = await client.request<unknown>('models.list')
  } catch (err) {
    modelsCatalogResult.value = { error: err instanceof Error ? err.message : String(err) }
  } finally {
    modelsCatalogLoading.value = false
  }
}

function formatJson(val: unknown): string {
  if (val === null || val === undefined) return ''
  try {
    return JSON.stringify(val, null, 2)
  } catch {
    return String(val)
  }
}

function truncatePayload(payload: unknown, maxLen = 120): string {
  const s = JSON.stringify(payload)
  if (!s) return ''
  return s.length > maxLen ? s.slice(0, maxLen) + '...' : s
}

// Event log columns
const eventColumns = computed<DataTableColumns<DebugEvent>>(() => [
  {
    title: t('debug.time'),
    key: 'timestamp',
    width: 180,
    render(row) {
      return new Date(row.timestamp).toLocaleTimeString()
    },
  },
  {
    title: t('debug.event'),
    key: 'eventName',
    width: 200,
    render(row) {
      return h(NTag, { size: 'small', bordered: false }, { default: () => row.eventName })
    },
  },
  {
    title: t('debug.payload'),
    key: 'payload',
    ellipsis: true,
    render(row) {
      return h(NText, { depth: 3, style: 'font-family: monospace; font-size: 12px' }, {
        default: () => truncatePayload(row.payload),
      })
    },
  },
])

// Call history columns
const callHistoryColumns = computed<DataTableColumns<RpcCall>>(() => [
  {
    title: t('debug.time'),
    key: 'timestamp',
    width: 100,
    render(row) {
      return new Date(row.timestamp).toLocaleTimeString()
    },
  },
  {
    title: t('debug.method'),
    key: 'method',
    width: 180,
    ellipsis: true,
  },
  {
    title: t('debug.duration'),
    key: 'duration',
    width: 80,
    render(row) {
      return `${row.duration}ms`
    },
  },
  {
    title: t('common.status'),
    key: 'error',
    width: 80,
    render(row) {
      return h(
        NTag,
        { size: 'small', type: row.error ? 'error' : 'success' },
        { default: () => (row.error ? t('common.error') : t('debug.ok')) },
      )
    },
  },
])

// Security audit placeholder
const securityAudit = computed(() => {
  if (!debug.statusSnapshot || typeof debug.statusSnapshot !== 'object') return null
  const snap = debug.statusSnapshot as Record<string, unknown>
  if (snap.security && typeof snap.security === 'object') {
    return snap.security as Record<string, number>
  }
  return null
})

onMounted(() => {
  if (conn.isConnected) {
    debug.fetchStatus()
    debug.fetchHealth()
    debug.fetchHeartbeat()
  }
})
</script>

<template>
  <div class="debug-view">
    <NTabs type="line" animated>
      <!-- Manual RPC Caller -->
      <NTabPane :name="t('debug.rpc')" :tab="t('debug.rpc')">
        <NSpace vertical :size="16">
          <NCard :title="t('debug.rpcCaller')" size="small">
            <NSpace vertical :size="12">
              <NSpace align="center" :size="8">
                <NSelect
                  v-model:value="selectedMethod"
                  :options="methodOptions"
                  filterable
                  :placeholder="t('debug.selectMethod')"
                  style="min-width: 300px"
                />
                <NButton
                  type="primary"
                  :loading="debug.rpcLoading"
                  :disabled="!selectedMethod || !conn.isConnected"
                  @click="callRpc"
                >
                  {{ t('debug.call') }}
                </NButton>
              </NSpace>

              <NInput
                v-model:value="rpcParams"
                type="textarea"
                :placeholder="t('debug.paramsPlaceholder')"
                :autosize="{ minRows: 3, maxRows: 8 }"
                style="font-family: monospace;"
              />

              <!-- Result display -->
              <NCard v-if="debug.lastRpcResult !== null" size="small" :title="t('debug.result')">
                <pre class="json-output">{{ formatJson(debug.lastRpcResult) }}</pre>
              </NCard>

              <!-- Error display -->
              <NCard v-if="debug.lastRpcError" size="small">
                <NText type="error">{{ debug.lastRpcError }}</NText>
              </NCard>
            </NSpace>
          </NCard>

          <!-- Call History -->
          <NCard :title="t('debug.callHistory')" size="small">
            <template #header-extra>
              <NButton
                v-if="debug.callHistory.length"
                size="small"
                quaternary
                @click="debug.clearCallHistory()"
              >
                {{ t('common.delete') }}
              </NButton>
            </template>
            <NEmpty v-if="!debug.callHistory.length" :description="t('common.noData')" />
            <NDataTable
              v-else
              :columns="callHistoryColumns"
              :data="debug.callHistory"
              :pagination="false"
              size="small"
              :max-height="200"
            />
          </NCard>
        </NSpace>
      </NTabPane>

      <!-- Snapshots -->
      <NTabPane :name="t('debug.snapshots')" :tab="t('debug.snapshots')">
        <NSpace vertical :size="16">
          <!-- Security audit summary -->
          <NGrid v-if="securityAudit" :cols="3" :x-gap="12">
            <NGi>
              <NCard size="small">
                <NStatistic :label="t('debug.critical')" :value="securityAudit.critical ?? 0" />
              </NCard>
            </NGi>
            <NGi>
              <NCard size="small">
                <NStatistic :label="t('debug.warnings')" :value="securityAudit.warn ?? 0" />
              </NCard>
            </NGi>
            <NGi>
              <NCard size="small">
                <NStatistic :label="t('common.info')" :value="securityAudit.info ?? 0" />
              </NCard>
            </NGi>
          </NGrid>

          <NCard size="small">
            <template #header>
              <NSpace align="center" :size="8">
                <NText>{{ t('debug.statusSnapshot') }}</NText>
                <NButton size="tiny" secondary :loading="debug.statusLoading" @click="debug.fetchStatus()">
                  {{ t('common.refresh') }}
                </NButton>
              </NSpace>
            </template>
            <NSpin :show="debug.statusLoading">
              <pre v-if="debug.statusSnapshot" class="json-output">{{ formatJson(debug.statusSnapshot) }}</pre>
              <NEmpty v-else :description="t('common.noData')" />
            </NSpin>
          </NCard>

          <NCard size="small">
            <template #header>
              <NSpace align="center" :size="8">
                <NText>{{ t('debug.healthSnapshot') }}</NText>
                <NButton size="tiny" secondary :loading="debug.healthLoading" @click="debug.fetchHealth()">
                  {{ t('common.refresh') }}
                </NButton>
              </NSpace>
            </template>
            <NSpin :show="debug.healthLoading">
              <pre v-if="debug.healthSnapshot" class="json-output">{{ formatJson(debug.healthSnapshot) }}</pre>
              <NEmpty v-else :description="t('common.noData')" />
            </NSpin>
          </NCard>

          <NCard size="small">
            <template #header>
              <NSpace align="center" :size="8">
                <NText>{{ t('debug.lastHeartbeat') }}</NText>
                <NButton size="tiny" secondary :loading="debug.heartbeatLoading" @click="debug.fetchHeartbeat()">
                  {{ t('common.refresh') }}
                </NButton>
              </NSpace>
            </template>
            <NSpin :show="debug.heartbeatLoading">
              <pre v-if="debug.lastHeartbeat" class="json-output">{{ formatJson(debug.lastHeartbeat) }}</pre>
              <NEmpty v-else :description="t('common.noData')" />
            </NSpin>
          </NCard>
        </NSpace>
      </NTabPane>

      <!-- Event Log -->
      <NTabPane :name="t('debug.events')" :tab="t('debug.events')">
        <NSpace vertical :size="12">
          <NSpace justify="space-between" align="center">
            <NInput
              v-model:value="debug.eventSearch"
              :placeholder="t('common.search')"
              clearable
              style="width: 300px"
            />
            <NSpace :size="8">
              <NText depth="3">{{ debug.filteredEvents.length }} {{ t('debug.eventsCount') }}</NText>
              <NButton
                size="small"
                quaternary
                :disabled="!debug.events.length"
                @click="debug.clearEvents()"
              >
                {{ t('debug.clearEvents') }}
              </NButton>
            </NSpace>
          </NSpace>

          <NDataTable
            :columns="eventColumns"
            :data="debug.filteredEvents"
            :pagination="false"
            size="small"
            :max-height="500"
            virtual-scroll
          />
        </NSpace>
      </NTabPane>

      <!-- Models Catalog -->
      <NTabPane :name="t('debug.modelsCatalog')" :tab="t('debug.modelsCatalog')">
        <NSpace vertical :size="12">
          <NButton
            type="primary"
            :loading="modelsCatalogLoading"
            :disabled="!conn.isConnected"
            @click="fetchModelsCatalog"
          >
            {{ t('debug.fetchModels') }}
          </NButton>

          <NCard v-if="modelsCatalogResult" size="small">
            <NCollapse>
              <NCollapseItem :title="t('debug.rawJson')" name="raw">
                <pre class="json-output">{{ formatJson(modelsCatalogResult) }}</pre>
              </NCollapseItem>
            </NCollapse>
          </NCard>
        </NSpace>
      </NTabPane>
    </NTabs>
  </div>
</template>

<style scoped>
.debug-view {
  padding: 16px;
}

.json-output {
  margin: 0;
  padding: 8px;
  background: var(--n-color-embedded, #f5f5f5);
  border-radius: 4px;
  font-family: monospace;
  font-size: 12px;
  line-height: 1.5;
  overflow: auto;
  max-height: 400px;
  white-space: pre-wrap;
  word-break: break-all;
}
</style>
