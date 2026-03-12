<script setup lang="ts">
import { ref, computed, onMounted, h, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NDataTable, NButton, NSpace, NDrawer, NDrawerContent, NForm, NFormItem,
  NInput, NSpin, NEmpty, NPopconfirm, NText, NSwitch, NTabs, NTabPane, NTag,
  NSelect, NRadioGroup, NRadio, NInputNumber, NDatePicker, NCollapse,
  NCollapseItem, NTooltip, NBadge, NInputGroup
} from 'naive-ui'
import type { DataTableColumns, SelectOption } from 'naive-ui'
import {
  useCronStore,
  type CronJob,
  type CronRun,
  type CronJobParams,
  type CronJobSchedule,
  type CronJobPayload,
  type CronJobDelivery,
  type CronJobFailureAlert,
} from '@renderer/stores/cron'

import { useConnectionStore } from '@renderer/gateway/connection'

const { t } = useI18n()
const store = useCronStore()
const conn = useConnectionStore()

const drawerOpen = ref(false)
const editingJob = ref<CronJob | null>(null)
const activeTab = ref('jobs')
const searchQuery = ref('')
const filterEnabled = ref<string | null>(null)
const filterScheduleKind = ref<string | null>(null)
const filterLastStatus = ref<string | null>(null)
const runsFilterStatus = ref<string | null>(null)
const selectedRunJobId = ref<string | null>(null)

/* ---------- Form state ---------- */
interface FormState {
  name: string
  description: string
  agentId: string
  enabled: boolean
  scheduleKind: 'at' | 'every' | 'cron'
  scheduleAt: number | null
  everyAmount: number
  everyUnit: string
  cronExpr: string
  timezone: string
  exact: boolean
  staggerAmount: number
  staggerUnit: string
  sessionTarget: 'main' | 'isolated'
  wakeMode: string
  payloadKind: 'systemEvent' | 'agentTurn'
  payloadText: string
  timeout: number | null
  modelOverride: string
  thinkingLevel: string
  deliveryMode: 'announce' | 'webhook' | 'none'
  deliveryChannel: string
  deliveryTo: string
  webhookUrl: string
  bestEffort: boolean
  deleteAfterRun: boolean
  failureThreshold: number | null
  failureCooldown: number | null
}

const defaultForm = (): FormState => ({
  name: '',
  description: '',
  agentId: '',
  enabled: true,
  scheduleKind: 'every',
  scheduleAt: null,
  everyAmount: 1,
  everyUnit: 'hours',
  cronExpr: '',
  timezone: '',
  exact: false,
  staggerAmount: 0,
  staggerUnit: 'seconds',
  sessionTarget: 'main',
  wakeMode: 'now',
  payloadKind: 'agentTurn',
  payloadText: '',
  timeout: null,
  modelOverride: '',
  thinkingLevel: '',
  deliveryMode: 'none',
  deliveryChannel: '',
  deliveryTo: '',
  webhookUrl: '',
  bestEffort: false,
  deleteAfterRun: false,
  failureThreshold: null,
  failureCooldown: null,
})

const form = ref<FormState>(defaultForm())

/* ---------- Validation ---------- */
const formErrors = computed(() => {
  const errs: string[] = []
  if (!form.value.name.trim()) errs.push(`${t('cron.name')} is required`)
  if (form.value.scheduleKind === 'cron' && !form.value.cronExpr.trim()) {
    errs.push(`${t('cron.cronExpr')} is required`)
  }
  if (form.value.scheduleKind === 'every' && form.value.everyAmount <= 0) {
    errs.push(`${t('cron.interval')} must be positive`)
  }
  if (form.value.scheduleKind === 'at' && !form.value.scheduleAt) {
    errs.push(`${t('cron.dateTime')} is required`)
  }
  if (form.value.deliveryMode === 'webhook' && !form.value.webhookUrl.trim()) {
    errs.push(`${t('cron.webhookUrl')} is required`)
  }
  return errs
})

const hasErrors = computed(() => formErrors.value.length > 0)

/* ---------- Options ---------- */
const unitOptions = computed<SelectOption[]>(() => [
  { label: t('cron.minutes'), value: 'minutes' },
  { label: t('cron.hours'), value: 'hours' },
  { label: t('cron.days'), value: 'days' },
])

const staggerUnitOptions = computed<SelectOption[]>(() => [
  { label: t('cron.seconds'), value: 'seconds' },
  { label: t('cron.minutes'), value: 'minutes' },
])

const wakeModeOptions = computed<SelectOption[]>(() => [
  { label: t('cron.nowMode'), value: 'now' },
  { label: t('cron.nextHeartbeat'), value: 'nextHeartbeat' },
])

const thinkingOptions = computed<SelectOption[]>(() => [
  { label: t('cron.systemDefault'), value: '' },
  { label: t('cron.off'), value: 'off' },
  { label: t('cron.low'), value: 'low' },
  { label: t('cron.medium'), value: 'medium' },
  { label: t('cron.high'), value: 'high' },
])

const timezoneOptions = computed<SelectOption[]>(() => [
  { label: t('cron.systemDefault'), value: '' },
  { label: 'UTC', value: 'UTC' },
  { label: 'US/Eastern', value: 'US/Eastern' },
  { label: 'US/Central', value: 'US/Central' },
  { label: 'US/Pacific', value: 'US/Pacific' },
  { label: 'Europe/London', value: 'Europe/London' },
  { label: 'Europe/Berlin', value: 'Europe/Berlin' },
  { label: 'Asia/Tokyo', value: 'Asia/Tokyo' },
  { label: 'Asia/Shanghai', value: 'Asia/Shanghai' },
  { label: 'Australia/Sydney', value: 'Australia/Sydney' },
])

const enabledFilterOptions = computed<SelectOption[]>(() => [
  { label: t('common.all'), value: '' },
  { label: t('cron.enabled'), value: 'enabled' },
  { label: t('cron.disabled'), value: 'disabled' },
])

const scheduleKindFilterOptions = computed<SelectOption[]>(() => [
  { label: t('common.all'), value: '' },
  { label: t('cron.at'), value: 'at' },
  { label: t('cron.every'), value: 'every' },
  { label: t('cron.cronExpr'), value: 'cron' },
])

const statusFilterOptions = computed<SelectOption[]>(() => [
  { label: t('common.all'), value: '' },
  { label: t('common.ok'), value: 'ok' },
  { label: t('common.error'), value: 'error' },
  { label: 'Skipped', value: 'skipped' },
])

/* ---------- Helpers ---------- */
function jobToForm(job: CronJob): FormState {
  const s = job.schedule ?? { kind: 'every' }
  const p = job.payload ?? { kind: 'agentTurn' }
  const d = job.delivery
  const fa = job.failureAlert
  return {
    name: job.name ?? '',
    description: job.description ?? '',
    agentId: job.agentId ?? '',
    enabled: job.enabled ?? true,
    scheduleKind: s.kind ?? 'every',
    scheduleAt: s.at ? new Date(s.at).getTime() : null,
    everyAmount: s.every?.amount ?? 1,
    everyUnit: s.every?.unit ?? 'hours',
    cronExpr: s.cron ?? '',
    timezone: s.tz ?? '',
    exact: s.exact ?? false,
    staggerAmount: s.stagger?.amount ?? 0,
    staggerUnit: s.stagger?.unit ?? 'seconds',
    sessionTarget: job.session?.target ?? 'main',
    wakeMode: job.wakeMode ?? 'now',
    payloadKind: p.kind ?? 'agentTurn',
    payloadText: p.text ?? '',
    timeout: p.timeout ?? null,
    modelOverride: p.model ?? '',
    thinkingLevel: p.thinking ?? '',
    deliveryMode: d?.mode ?? 'none',
    deliveryChannel: d?.channel ?? '',
    deliveryTo: d?.to ?? '',
    webhookUrl: d?.webhookUrl ?? '',
    bestEffort: d?.bestEffort ?? false,
    deleteAfterRun: job.deleteAfterRun ?? false,
    failureThreshold: fa?.threshold ?? null,
    failureCooldown: fa?.cooldown ?? null,
  }
}

function formToParams(): CronJobParams {
  const f = form.value
  const schedule: CronJobSchedule = { kind: f.scheduleKind }
  if (f.scheduleKind === 'at' && f.scheduleAt) {
    schedule.at = new Date(f.scheduleAt).toISOString()
  }
  if (f.scheduleKind === 'every') {
    schedule.every = { amount: f.everyAmount, unit: f.everyUnit }
  }
  if (f.scheduleKind === 'cron') {
    schedule.cron = f.cronExpr
  }
  if (f.timezone) schedule.tz = f.timezone
  if (f.exact) schedule.exact = true
  if (f.staggerAmount > 0) {
    schedule.stagger = { amount: f.staggerAmount, unit: f.staggerUnit }
  }

  const payload: CronJobPayload = { kind: f.payloadKind }
  if (f.payloadText) payload.text = f.payloadText
  if (f.modelOverride) payload.model = f.modelOverride
  if (f.thinkingLevel) payload.thinking = f.thinkingLevel
  if (f.timeout && f.timeout > 0) payload.timeout = f.timeout

  const delivery: CronJobDelivery = { mode: f.deliveryMode }
  if (f.deliveryMode === 'announce') {
    if (f.deliveryChannel) delivery.channel = f.deliveryChannel
    if (f.deliveryTo) delivery.to = f.deliveryTo
    delivery.bestEffort = f.bestEffort
  }
  if (f.deliveryMode === 'webhook') {
    delivery.webhookUrl = f.webhookUrl
  }

  const failureAlert: CronJobFailureAlert = {}
  if (f.failureThreshold !== null && f.failureThreshold > 0)
    failureAlert.threshold = f.failureThreshold
  if (f.failureCooldown !== null && f.failureCooldown > 0)
    failureAlert.cooldown = f.failureCooldown

  const params: CronJobParams = {
    name: f.name,
    description: f.description || undefined,
    agentId: f.agentId || undefined,
    enabled: f.enabled,
    schedule,
    payload,
    session: { target: f.sessionTarget },
    wakeMode: f.wakeMode,
    delivery,
    deleteAfterRun: f.deleteAfterRun || undefined,
    failureAlert:
      failureAlert.threshold || failureAlert.cooldown
        ? failureAlert
        : undefined,
  }
  return params
}

function getScheduleLabel(job: CronJob): string {
  if (!job.schedule) return job.command ?? ''
  const s = job.schedule
  if (s.kind === 'at' && s.at) return `at ${new Date(s.at).toLocaleString()}`
  if (s.kind === 'every' && s.every) return `every ${s.every.amount} ${s.every.unit}`
  if (s.kind === 'cron' && s.cron) return s.cron
  return s.kind ?? ''
}

function getLastRunStatus(job: CronJob): string {
  if (job.lastRun?.status) return job.lastRun.status
  if (job.status) return job.status
  return ''
}

function getLastRunStatusType(status: string): 'success' | 'error' | 'warning' | 'default' {
  if (status === 'ok' || status === 'success') return 'success'
  if (status === 'error') return 'error'
  if (status === 'skipped' || status === 'running') return 'warning'
  return 'default'
}

/* ---------- Filtered jobs ---------- */
const filteredJobs = computed(() => {
  let result = store.jobs
  const q = searchQuery.value.toLowerCase().trim()
  if (q) {
    result = result.filter(
      (j) =>
        (j.name ?? '').toLowerCase().includes(q) ||
        (j.agentId ?? '').toLowerCase().includes(q) ||
        (j.description ?? '').toLowerCase().includes(q),
    )
  }
  if (filterEnabled.value === 'enabled') {
    result = result.filter((j) => j.enabled)
  } else if (filterEnabled.value === 'disabled') {
    result = result.filter((j) => !j.enabled)
  }
  if (filterScheduleKind.value) {
    result = result.filter((j) => j.schedule?.kind === filterScheduleKind.value)
  }
  if (filterLastStatus.value) {
    result = result.filter((j) => getLastRunStatus(j) === filterLastStatus.value)
  }
  return result
})

/* ---------- Actions ---------- */
function openCreate() {
  editingJob.value = null
  form.value = defaultForm()
  drawerOpen.value = true
}

function openEdit(job: CronJob) {
  editingJob.value = job
  form.value = jobToForm(job)
  drawerOpen.value = true
}

async function handleSave() {
  if (hasErrors.value) return
  const params = formToParams()
  if (editingJob.value) {
    await store.updateJob(editingJob.value.id, params)
  } else {
    await store.addJob(params)
  }
  drawerOpen.value = false
}

async function handleToggle(job: CronJob) {
  await store.updateJob(job.id, { enabled: !job.enabled })
}

async function handleClone(job: CronJob) {
  await store.cloneJob(job.id)
}

async function openRuns(jobId?: string) {
  selectedRunJobId.value = jobId ?? null
  await store.fetchRuns({ jobId, limit: 20 })
  activeTab.value = 'runs'
}

async function loadMoreRuns() {
  await store.loadMoreRuns({ jobId: selectedRunJobId.value ?? undefined, limit: 20 })
}

async function filterRuns() {
  await store.fetchRuns({
    jobId: selectedRunJobId.value ?? undefined,
    status: runsFilterStatus.value ?? undefined,
    limit: 20,
  })
}

watch(runsFilterStatus, () => { filterRuns() })

/* ---------- Job columns ---------- */
const jobColumns = computed<DataTableColumns<CronJob>>(() => [
  {
    title: t('cron.name'),
    key: 'name',
    sorter: (a, b) => (a.name ?? '').localeCompare(b.name ?? ''),
    ellipsis: { tooltip: true },
  },
  {
    title: t('cron.schedule'),
    key: 'schedule',
    width: 180,
    render(row) { return getScheduleLabel(row) },
  },
  {
    title: t('cron.agent'),
    key: 'agentId',
    width: 120,
    ellipsis: { tooltip: true },
  },
  {
    title: t('cron.enabled'),
    key: 'enabled',
    width: 80,
    sorter: (a, b) => (a.enabled ? 1 : 0) - (b.enabled ? 1 : 0),
    render(row) {
      return h(NSwitch, {
        value: row.enabled ?? false,
        size: 'small',
        onUpdateValue: () => handleToggle(row),
      })
    },
  },
  {
    title: t('cron.status'),
    key: 'lastStatus',
    width: 100,
    sorter: (a, b) => getLastRunStatus(a).localeCompare(getLastRunStatus(b)),
    render(row) {
      const status = getLastRunStatus(row)
      if (!status) return h(NText, { depth: 3 }, () => '--')
      return h(NTag, { type: getLastRunStatusType(status), size: 'small' }, () => status)
    },
  },
  {
    title: t('cron.nextRun'),
    key: 'nextRunAtMs',
    width: 160,
    sorter: (a, b) => (a.nextRunAtMs ?? 0) - (b.nextRunAtMs ?? 0),
    render(row) {
      const next = row.nextRunAt ?? (row.nextRunAtMs ? new Date(row.nextRunAtMs).toISOString() : null)
      return next ? new Date(next).toLocaleString() : '--'
    },
  },
  {
    title: t('cron.lastRun'),
    key: 'lastRun',
    width: 160,
    render(row) {
      const at = row.lastRun?.at ?? row.lastRunAt
      return at ? new Date(at).toLocaleString() : '--'
    },
  },
  {
    title: '',
    key: 'actions',
    width: 260,
    render(row) {
      return h(NSpace, { size: 'small', wrap: false }, () => [
        h(NTooltip, null, {
          trigger: () => h(NButton, { size: 'tiny', secondary: true, onClick: () => { store.runJob(row.id); openRuns(row.id) } }, () => t('cron.run')),
          default: () => t('cron.runNow'),
        }),
        h(NButton, { size: 'tiny', onClick: () => openEdit(row) }, () => t('common.edit')),
        h(NButton, { size: 'tiny', secondary: true, onClick: () => handleClone(row) }, () => t('common.clone')),
        h(NButton, { size: 'tiny', secondary: true, onClick: () => openRuns(row.id) }, () => t('cron.history')),
        h(NPopconfirm, { onPositiveClick: () => store.removeJob(row.id) }, {
          trigger: () => h(NButton, { size: 'tiny', type: 'error', ghost: true }, () => t('common.delete')),
          default: () => t('cron.deleteConfirm'),
        }),
      ])
    },
  },
])

/* ---------- Run columns ---------- */
const runColumns = computed<DataTableColumns<CronRun>>(() => [
  {
    title: t('cron.time'),
    key: 'startedAt',
    width: 170,
    sorter: (a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime(),
    render(r) { return new Date(r.startedAt).toLocaleString() },
  },
  {
    title: t('cron.status'),
    key: 'status',
    width: 100,
    render(r) {
      const type = r.status === 'ok' || r.status === 'success'
        ? 'success'
        : r.status === 'error'
          ? 'error'
          : 'warning'
      return h(NTag, { type, size: 'small' }, () => r.status)
    },
  },
  {
    title: t('cron.duration'),
    key: 'duration',
    width: 100,
    render(r) {
      if (r.duration === undefined || r.duration === null) return '--'
      if (r.duration < 1000) return `${r.duration}ms`
      return `${(r.duration / 1000).toFixed(1)}s`
    },
  },
  {
    title: t('cron.delivery'),
    key: 'delivery',
    width: 120,
    render(r) {
      if (!r.delivery) return '--'
      const type = r.delivery.status === 'ok' || r.delivery.status === 'delivered' ? 'success' : 'warning'
      return h(NTag, { type, size: 'small' }, () => r.delivery!.status + (r.delivery!.channel ? ` (${r.delivery!.channel})` : ''))
    },
  },
  {
    title: t('cron.summary'),
    key: 'summary',
    ellipsis: { tooltip: true },
    render(r) {
      return r.summary ?? r.output ?? (r.error ? r.error : '--')
    },
  },
  {
    title: t('cron.job'),
    key: 'jobName',
    width: 120,
    ellipsis: { tooltip: true },
    render(r) { return r.jobName ?? r.jobId ?? '--' },
  },
])

onMounted(async () => {
  if (!conn.isConnected) return
  await store.fetchJobs()
  await store.fetchStatus()
})
</script>

<template>
  <div class="cron-view">
    <NSpace justify="space-between" align="center" style="margin-bottom:16px;">
      <NText strong style="font-size:16px;">{{ t('cron.title') }}</NText>
      <NButton type="primary" size="small" @click="openCreate">+ {{ t('cron.addJob') }}</NButton>
    </NSpace>

    <NTabs v-model:value="activeTab" type="line" animated>
      <!-- Jobs Tab -->
      <NTabPane name="jobs" :tab="t('nav.cron')">
        <!-- Filters -->
        <NSpace style="margin-bottom:12px;" align="center" :size="8">
          <NInput
            v-model:value="searchQuery"
            :placeholder="t('common.search')"
            clearable
            size="small"
            style="width:200px;"
          />
          <NSelect
            v-model:value="filterEnabled"
            :options="enabledFilterOptions"
            size="small"
            style="width:120px;"
            :placeholder="t('cron.enabled')"
            clearable
          />
          <NSelect
            v-model:value="filterScheduleKind"
            :options="scheduleKindFilterOptions"
            size="small"
            style="width:120px;"
            :placeholder="t('cron.schedule')"
            clearable
          />
          <NSelect
            v-model:value="filterLastStatus"
            :options="statusFilterOptions"
            size="small"
            style="width:120px;"
            :placeholder="t('cron.status')"
            clearable
          />
        </NSpace>

        <NSpin :show="store.loading">
          <NEmpty v-if="!filteredJobs.length && !store.loading" :description="t('cron.noJobs')" />
          <NDataTable
            v-else
            :columns="jobColumns"
            :data="filteredJobs"
            :pagination="{ pageSize: 20 }"
            size="small"
            :scroll-x="1000"
          />
        </NSpin>
      </NTabPane>

      <!-- Run History Tab -->
      <NTabPane name="runs" :tab="t('cron.history')">
        <NSpace style="margin-bottom:12px;" align="center" :size="8">
          <NSelect
            v-model:value="runsFilterStatus"
            :options="statusFilterOptions"
            size="small"
            style="width:140px;"
            :placeholder="t('cron.filterStatus')"
            clearable
          />
          <NButton size="small" secondary @click="() => openRuns(selectedRunJobId ?? undefined)">
            {{ t('common.refresh') }}
          </NButton>
        </NSpace>

        <NSpin :show="store.runsLoading">
          <NEmpty v-if="!store.runs.length && !store.runsLoading" :description="t('cron.noRuns')" />
          <template v-else>
            <NDataTable
              :columns="runColumns"
              :data="store.runs"
              size="small"
              :scroll-x="800"
            />
            <NSpace justify="center" style="margin-top:12px;" v-if="store.runsHasMore">
              <NButton size="small" secondary :loading="store.runsLoading" @click="loadMoreRuns">
                {{ t('common.loadMore') }}
              </NButton>
            </NSpace>
          </template>
        </NSpin>
      </NTabPane>
    </NTabs>

    <!-- Job Editor Drawer -->
    <NDrawer v-model:show="drawerOpen" :width="520" placement="right">
      <NDrawerContent
        :title="editingJob ? t('cron.editJob') : t('cron.newJob')"
        closable
      >
        <NForm label-placement="top" :model="form">
          <!-- Basics -->
          <NText strong style="display:block;margin-bottom:8px;">{{ t('cron.basics') }}</NText>
          <NFormItem :label="t('cron.name')" required :validation-status="!form.name.trim() ? 'error' : undefined">
            <NInput v-model:value="form.name" :placeholder="t('cron.jobNamePlaceholder')" />
          </NFormItem>
          <NFormItem :label="t('cron.description')">
            <NInput v-model:value="form.description" :placeholder="t('cron.optionalDesc')" />
          </NFormItem>
          <NFormItem :label="t('cron.agentId')">
            <NInput v-model:value="form.agentId" :placeholder="t('cron.agentToRun')" />
          </NFormItem>
          <NFormItem :label="t('cron.enabled')">
            <NSwitch v-model:value="form.enabled" />
          </NFormItem>

          <!-- Schedule -->
          <NText strong style="display:block;margin:16px 0 8px;">{{ t('cron.schedule') }}</NText>
          <NFormItem :label="t('cron.scheduleKind')">
            <NRadioGroup v-model:value="form.scheduleKind">
              <NRadio value="at">{{ t('cron.at') }}</NRadio>
              <NRadio value="every">{{ t('cron.every') }}</NRadio>
              <NRadio value="cron">{{ t('cron.cronExpr') }}</NRadio>
            </NRadioGroup>
          </NFormItem>

          <NFormItem v-if="form.scheduleKind === 'at'" :label="t('cron.dateTime')">
            <NDatePicker
              v-model:value="form.scheduleAt"
              type="datetime"
              clearable
              style="width:100%;"
            />
          </NFormItem>

          <NFormItem v-if="form.scheduleKind === 'every'" :label="t('cron.interval')">
            <NInputGroup>
              <NInputNumber
                v-model:value="form.everyAmount"
                :min="1"
                style="width:120px;"
                :placeholder="t('cron.interval')"
              />
              <NSelect
                v-model:value="form.everyUnit"
                :options="unitOptions"
                style="width:140px;"
              />
            </NInputGroup>
          </NFormItem>

          <NFormItem v-if="form.scheduleKind === 'cron'" :label="t('cron.cronExpr')">
            <NInput v-model:value="form.cronExpr" placeholder="0 9 * * *" />
            <template #feedback>
              <NText depth="3" style="font-size:11px;">
                {{ t('cron.cronHelp') }}
              </NText>
            </template>
          </NFormItem>

          <NFormItem :label="t('cron.timezone')">
            <NSelect
              v-model:value="form.timezone"
              :options="timezoneOptions"
              filterable
              tag
              clearable
              :placeholder="t('cron.systemDefault')"
            />
          </NFormItem>

          <NSpace :size="16">
            <NFormItem :label="t('cron.exactTiming')">
              <NSwitch v-model:value="form.exact" />
            </NFormItem>
          </NSpace>

          <NFormItem v-if="!form.exact" :label="t('cron.staggerWindow')">
            <NInputGroup>
              <NInputNumber
                v-model:value="form.staggerAmount"
                :min="0"
                style="width:120px;"
                placeholder="0"
              />
              <NSelect
                v-model:value="form.staggerUnit"
                :options="staggerUnitOptions"
                style="width:140px;"
              />
            </NInputGroup>
          </NFormItem>

          <!-- Execution -->
          <NText strong style="display:block;margin:16px 0 8px;">{{ t('cron.execution') }}</NText>
          <NFormItem :label="t('cron.sessionTarget')">
            <NRadioGroup v-model:value="form.sessionTarget">
              <NRadio value="main">{{ t('cron.main') }}</NRadio>
              <NRadio value="isolated">{{ t('cron.isolated') }}</NRadio>
            </NRadioGroup>
          </NFormItem>

          <NFormItem :label="t('cron.wakeMode')">
            <NSelect v-model:value="form.wakeMode" :options="wakeModeOptions" />
          </NFormItem>

          <NFormItem :label="t('cron.payloadKind')">
            <NRadioGroup v-model:value="form.payloadKind">
              <NRadio value="systemEvent">{{ t('cron.systemEvent') }}</NRadio>
              <NRadio value="agentTurn">{{ t('cron.agentTurn') }}</NRadio>
            </NRadioGroup>
          </NFormItem>

          <NFormItem
            :label="form.payloadKind === 'systemEvent' ? t('cron.systemEventText') : t('cron.agentTaskPrompt')"
          >
            <NInput
              v-model:value="form.payloadText"
              type="textarea"
              :autosize="{ minRows: 3 }"
              :placeholder="form.payloadKind === 'systemEvent' ? t('cron.eventPayload') : t('cron.taskPrompt')"
            />
          </NFormItem>

          <NFormItem :label="t('cron.timeoutSeconds')">
            <NInputNumber
              v-model:value="form.timeout"
              :min="0"
              clearable
              :placeholder="t('cron.noTimeout')"
              style="width:100%;"
            />
          </NFormItem>

          <NFormItem :label="t('cron.modelOverride')">
            <NInput v-model:value="form.modelOverride" :placeholder="t('cron.useDefaultModel')" />
          </NFormItem>

          <NFormItem :label="t('cron.thinkingLevel')">
            <NSelect v-model:value="form.thinkingLevel" :options="thinkingOptions" />
          </NFormItem>

          <!-- Delivery -->
          <NText strong style="display:block;margin:16px 0 8px;">{{ t('cron.delivery') }}</NText>
          <NFormItem :label="t('cron.resultDelivery')">
            <NRadioGroup v-model:value="form.deliveryMode">
              <NRadio value="none">{{ t('cron.none') }}</NRadio>
              <NRadio value="announce">{{ t('cron.announce') }}</NRadio>
              <NRadio value="webhook">{{ t('cron.webhook') }}</NRadio>
            </NRadioGroup>
          </NFormItem>

          <template v-if="form.deliveryMode === 'announce'">
            <NFormItem :label="t('cron.channel')">
              <NInput v-model:value="form.deliveryChannel" :placeholder="t('cron.channelName')" />
            </NFormItem>
            <NFormItem :label="t('cron.recipient')">
              <NInput v-model:value="form.deliveryTo" :placeholder="t('cron.inherit')" />
            </NFormItem>
            <NFormItem :label="t('cron.bestEffort')">
              <NSwitch v-model:value="form.bestEffort" />
            </NFormItem>
          </template>

          <NFormItem v-if="form.deliveryMode === 'webhook'" :label="t('cron.webhookUrl')">
            <NInput
              v-model:value="form.webhookUrl"
              placeholder="https://..."
              :status="form.deliveryMode === 'webhook' && !form.webhookUrl.trim() ? 'error' : undefined"
            />
          </NFormItem>

          <NFormItem :label="t('cron.deleteAfterRun')">
            <NSwitch v-model:value="form.deleteAfterRun" />
          </NFormItem>

          <!-- Advanced -->
          <NCollapse style="margin-top:8px;">
            <NCollapseItem :title="t('cron.advanced')" name="advanced">
              <NFormItem :label="t('cron.failureThreshold')">
                <NInputNumber
                  v-model:value="form.failureThreshold"
                  :min="0"
                  clearable
                  :placeholder="t('cron.disabled')"
                  style="width:100%;"
                />
              </NFormItem>
              <NFormItem :label="t('cron.failureCooldown')">
                <NInputNumber
                  v-model:value="form.failureCooldown"
                  :min="0"
                  clearable
                  :placeholder="t('cron.systemDefault')"
                  style="width:100%;"
                />
              </NFormItem>
            </NCollapseItem>
          </NCollapse>
        </NForm>

        <template #footer>
          <NSpace justify="space-between" align="center" style="width:100%;">
            <NText v-if="hasErrors" type="error" style="font-size:12px;">
              {{ formErrors.length }} {{ t('cron.errors') }}
            </NText>
            <span v-else />
            <NSpace>
              <NButton @click="drawerOpen = false">{{ t('common.cancel') }}</NButton>
              <NBadge :value="formErrors.length" :show="hasErrors" :offset="[-4, -4]">
                <NButton
                  type="primary"
                  :loading="store.saving"
                  :disabled="hasErrors"
                  @click="handleSave"
                >
                  {{ t('common.save') }}
                </NButton>
              </NBadge>
            </NSpace>
          </NSpace>
        </template>
      </NDrawerContent>
    </NDrawer>
  </div>
</template>

<style scoped>
.cron-view { padding: 16px; }
</style>
