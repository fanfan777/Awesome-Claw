<script setup lang="ts">
import { onMounted, computed, ref, h } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NGrid, NGi, NCard, NStatistic, NSpin, NEmpty, NText, NSpace, NDataTable,
  NButton, NDatePicker, NSelect, NSwitch, NTag, NTooltip
} from 'naive-ui'
import type { DataTableColumns, SelectOption } from 'naive-ui'
import { useUsageStore, type SessionUsage } from '@renderer/stores/usage'
import { useConnectionStore } from '@renderer/gateway/connection'

const { t } = useI18n()
const store = useUsageStore()
const conn = useConnectionStore()

const dateRange = ref<[number, number] | null>(null)
const channelFilter = ref<string | null>(null)
const agentFilter = ref<string | null>(null)
const providerFilter = ref<string | null>(null)
const modelFilter = ref<string | null>(null)

/* ---------- Model table ---------- */
interface ModelRow {
  model: string
  provider: string
  inputTokens: number
  outputTokens: number
  cacheTokens: number
  totalTokens: number
  cost: number
}

const modelRows = computed<ModelRow[]>(() => {
  return store.modelRows.map((r) => ({
    model: r.model,
    provider: r.provider,
    inputTokens: r.tokens.input,
    outputTokens: r.tokens.output,
    cacheTokens: (r.tokens as { cacheRead?: number }).cacheRead ?? 0,
    totalTokens: r.tokens.total,
    cost: r.cost,
  }))
})

const modelTotalRow = computed<ModelRow>(() => ({
  model: 'TOTAL',
  provider: '',
  inputTokens: modelRows.value.reduce((s, r) => s + r.inputTokens, 0),
  outputTokens: modelRows.value.reduce((s, r) => s + r.outputTokens, 0),
  cacheTokens: modelRows.value.reduce((s, r) => s + r.cacheTokens, 0),
  totalTokens: modelRows.value.reduce((s, r) => s + r.totalTokens, 0),
  cost: modelRows.value.reduce((s, r) => s + r.cost, 0),
}))

const modelTableData = computed(() =>
  modelRows.value.length ? [...modelRows.value, modelTotalRow.value] : [],
)

const modelColumns = computed<DataTableColumns<ModelRow>>(() => [
  {
    title: t('usage.model'),
    key: 'model',
    ellipsis: { tooltip: true },
    sorter: (a, b) => a.model.localeCompare(b.model),
    render(row) {
      if (row.model === 'TOTAL') return h(NText, { strong: true }, () => t('usage.total'))
      return row.model
    },
  },
  { title: t('usage.provider'), key: 'provider', width: 110, ellipsis: true },
  {
    title: t('usage.input'),
    key: 'inputTokens',
    width: 110,
    sorter: (a, b) => a.inputTokens - b.inputTokens,
    render(r) { return r.inputTokens.toLocaleString() },
  },
  {
    title: t('usage.output'),
    key: 'outputTokens',
    width: 110,
    sorter: (a, b) => a.outputTokens - b.outputTokens,
    render(r) { return r.outputTokens.toLocaleString() },
  },
  {
    title: t('usage.cache'),
    key: 'cacheTokens',
    width: 100,
    render(r) { return r.cacheTokens ? r.cacheTokens.toLocaleString() : '--' },
  },
  {
    title: t('usage.total'),
    key: 'totalTokens',
    width: 110,
    sorter: (a, b) => a.totalTokens - b.totalTokens,
    render(r) {
      if (r.model === 'TOTAL') return h(NText, { strong: true }, () => r.totalTokens.toLocaleString())
      return r.totalTokens.toLocaleString()
    },
  },
  {
    title: t('usage.cost'),
    key: 'cost',
    width: 100,
    sorter: (a, b) => a.cost - b.cost,
    render(r) {
      const text = `$${r.cost.toFixed(4)}`
      if (r.model === 'TOTAL') return h(NText, { strong: true }, () => text)
      return text
    },
  },
])

/* ---------- Session table ---------- */
const sessions = computed(() => store.usage?.sessions ?? [])

const filteredSessions = computed(() => {
  let result = sessions.value
  if (channelFilter.value) {
    result = result.filter((s) => s.channel === channelFilter.value)
  }
  if (agentFilter.value) {
    result = result.filter((s) => s.agentId === agentFilter.value)
  }
  if (modelFilter.value) {
    result = result.filter((s) => s.model === modelFilter.value)
  }
  return result
})

const channelOptions = computed<SelectOption[]>(() => {
  const set = new Set(sessions.value.map((s) => s.channel).filter(Boolean))
  return [...set].sort().map((c) => ({ label: c!, value: c! }))
})

const agentOptions = computed<SelectOption[]>(() => {
  const set = new Set(sessions.value.map((s) => s.agentId).filter(Boolean))
  return [...set].sort().map((a) => ({ label: a!, value: a! }))
})

const sessionColumns = computed<DataTableColumns<SessionUsage>>(() => [
  { title: t('usage.session'), key: 'sessionKey', ellipsis: { tooltip: true }, width: 160 },
  { title: t('usage.channel'), key: 'channel', width: 100, ellipsis: true },
  { title: t('usage.agent'), key: 'agentId', width: 100, ellipsis: true },
  {
    title: t('usage.messages'),
    key: 'messageCount',
    width: 90,
    sorter: (a, b) => a.messageCount - b.messageCount,
  },
  {
    title: t('usage.totalTokens'),
    key: 'tokens',
    width: 100,
    sorter: (a, b) => a.tokens.total - b.tokens.total,
    render(r) { return r.tokens.total.toLocaleString() },
  },
  {
    title: t('usage.cost'),
    key: 'cost',
    width: 90,
    sorter: (a, b) => a.cost - b.cost,
    render(r) { return `$${r.cost.toFixed(4)}` },
  },
  {
    title: t('usage.errors'),
    key: 'errorCount',
    width: 80,
    render(r) {
      if (!r.errorCount) return h(NText, { depth: 3 }, () => '0')
      return h(NTag, { type: 'error', size: 'small' }, () => String(r.errorCount))
    },
  },
])

/* ---------- Export ---------- */
function downloadCsv(content: string, filename: string) {
  if (!content) return
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function exportSessions() {
  downloadCsv(store.exportSessionsCsv(), `usage-sessions-${Date.now()}.csv`)
}

function exportModels() {
  downloadCsv(store.exportModelsCsv(), `usage-models-${Date.now()}.csv`)
}

/* ---------- Refresh ---------- */
async function handleRefresh() {
  const filter: Record<string, string> = {}
  if (dateRange.value) {
    filter.startDate = new Date(dateRange.value[0]).toISOString()
    filter.endDate = new Date(dateRange.value[1]).toISOString()
  }
  await store.fetchUsage(filter)
}

onMounted(async () => {
  if (!conn.isConnected) return
  await Promise.all([store.fetchUsage(), store.fetchStatus()])
})
</script>

<template>
  <div class="usage-view">
    <NSpace justify="space-between" align="center" style="margin-bottom:16px;">
      <NText strong style="font-size:16px;">{{ t('usage.title') }}</NText>
      <NSpace :size="8" align="center">
        <NDatePicker
          v-model:value="dateRange"
          type="daterange"
          clearable
          size="small"
          style="width:280px;"
          @update:value="handleRefresh"
        />
        <NTooltip>
          <template #trigger>
            <NSwitch v-model:value="store.useUtc" size="small" />
          </template>
          {{ store.useUtc ? t('usage.utc') : t('usage.localTime') }}
        </NTooltip>
        <NButton size="small" secondary :loading="store.loading" @click="handleRefresh">
          {{ t('common.refresh') }}
        </NButton>
      </NSpace>
    </NSpace>

    <NSpin :show="store.loading">
      <NSpace vertical :size="16">
        <!-- Summary Cards -->
        <NGrid :cols="4" :x-gap="12">
          <NGi>
            <NCard size="small">
              <NStatistic :label="t('usage.totalTokens')" :value="store.totalTokens.total" />
            </NCard>
          </NGi>
          <NGi>
            <NCard size="small">
              <NStatistic
                :label="t('usage.totalCost')"
                :value="store.totalCost"
                :precision="4"
                prefix="$"
              />
            </NCard>
          </NGi>
          <NGi>
            <NCard size="small">
              <NStatistic :label="t('usage.sessions')" :value="store.sessionCount" />
            </NCard>
          </NGi>
          <NGi>
            <NCard size="small">
              <NStatistic :label="t('usage.errors')" :value="store.errorCount" />
            </NCard>
          </NGi>
        </NGrid>

        <!-- Token Breakdown -->
        <NCard v-if="store.totalTokens.total > 0" :title="t('usage.tokenBreakdown')" size="small">
          <NGrid :cols="4" :x-gap="12">
            <NGi>
              <NStatistic :label="t('usage.inputTokens')" :value="store.totalTokens.input" />
            </NGi>
            <NGi>
              <NStatistic :label="t('usage.outputTokens')" :value="store.totalTokens.output" />
            </NGi>
            <NGi>
              <NStatistic :label="t('usage.cacheRead')" :value="store.totalTokens.cacheRead ?? 0" />
            </NGi>
            <NGi>
              <NStatistic :label="t('usage.cacheWrite')" :value="store.totalTokens.cacheWrite ?? 0" />
            </NGi>
          </NGrid>
        </NCard>

        <!-- Per-Model Breakdown -->
        <NCard size="small">
          <template #header>
            <NSpace justify="space-between" align="center">
              <NText>{{ t('usage.byModel') }}</NText>
              <NButton size="tiny" secondary @click="exportModels" :disabled="!modelRows.length">
                {{ t('usage.exportCsv') }}
              </NButton>
            </NSpace>
          </template>
          <NEmpty v-if="!modelRows.length" :description="t('usage.noUsageData')" />
          <NDataTable
            v-else
            :columns="modelColumns"
            :data="modelTableData"
            size="small"
            :scroll-x="700"
            :row-class-name="(row: ModelRow) => row.model === 'TOTAL' ? 'total-row' : ''"
          />
        </NCard>

        <!-- Session Usage -->
        <NCard size="small">
          <template #header>
            <NSpace justify="space-between" align="center">
              <NText>{{ t('usage.sessionUsage') }}</NText>
              <NButton size="tiny" secondary @click="exportSessions" :disabled="!sessions.length">
                {{ t('usage.exportCsv') }}
              </NButton>
            </NSpace>
          </template>

          <NSpace style="margin-bottom:8px;" :size="8" align="center" v-if="sessions.length">
            <NSelect
              v-model:value="channelFilter"
              :options="channelOptions"
              size="small"
              style="width:140px;"
              :placeholder="t('usage.channel')"
              clearable
            />
            <NSelect
              v-model:value="agentFilter"
              :options="agentOptions"
              size="small"
              style="width:140px;"
              :placeholder="t('usage.agent')"
              clearable
            />
          </NSpace>

          <NEmpty v-if="!sessions.length" :description="t('usage.noSessionData')" />
          <NDataTable
            v-else
            :columns="sessionColumns"
            :data="filteredSessions"
            :pagination="{ pageSize: 20 }"
            size="small"
            :scroll-x="700"
          />
        </NCard>
      </NSpace>
    </NSpin>
  </div>
</template>

<style scoped>
.usage-view { padding: 16px; }
:deep(.total-row td) { font-weight: 600; }
</style>
