<script setup lang="ts">
import { h, onMounted, ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NGrid, NGi, NCard, NButton, NSpace, NSpin, NEmpty, NText, NTag,
  NDataTable, NTabs, NTabPane, NPopconfirm, NModal, NInput, NSelect,
  NSwitch, NForm, NFormItem, NCollapse, NCollapseItem, NDynamicTags,
  NTooltip, NInputGroup
} from 'naive-ui'
import type { DataTableColumns, SelectOption } from 'naive-ui'
import {
  useNodesStore,
  type Node,
  type PairRequest,
  type DevicePair,
  type ExecApprovalRule,
  type ExecApprovalRequest,
} from '@renderer/stores/nodes'

import { useConnectionStore } from '@renderer/gateway/connection'

const { t } = useI18n()
const store = useNodesStore()
const conn = useConnectionStore()

/* ---------- State ---------- */
const rotatedToken = ref<string | null>(null)
const tokenModalOpen = ref(false)
const renameModalOpen = ref(false)
const renameTarget = ref<{ id: string; name: string }>({ id: '', name: '' })

/* Exec approvals */
const execTarget = ref('gateway')
const execRuleForm = ref<ExecApprovalRule>({
  enabled: false,
  mode: 'allowlist',
  allowPatterns: [],
  denyPatterns: [],
})

const execTargetOptions: SelectOption[] = [
  { label: t('nodes.gatewayAll'), value: 'gateway' },
]

/* dynamically add node/agent options */
const allExecTargetOptions = computed<SelectOption[]>(() => {
  const opts: SelectOption[] = [{ label: t('nodes.gatewayAll'), value: 'gateway' }]
  for (const n of store.nodes) {
    opts.push({ label: `Node: ${n.name ?? n.id}`, value: `node:${n.id}` })
  }
  return opts
})

/* ---------- Node columns ---------- */
const nodeColumns: DataTableColumns<Node> = [
  { title: 'ID', key: 'id', ellipsis: { tooltip: true }, width: 160 },
  { title: () => t('common.name'), key: 'name', ellipsis: { tooltip: true }, width: 140 },
  { title: () => t('nodes.ip'), key: 'ip', width: 130, render(r) { return r.ip ?? '--' } },
  { title: () => t('nodes.platform'), key: 'platform', width: 100, render(r) { return r.platform ?? r.type ?? '--' } },
  {
    title: () => t('nodes.uptime'),
    key: 'uptime',
    width: 100,
    render(r) {
      if (!r.uptime) return '--'
      const hours = Math.floor(r.uptime / 3600)
      const mins = Math.floor((r.uptime % 3600) / 60)
      return `${hours}h ${mins}m`
    },
  },
  {
    title: () => t('nodes.lastSeen'),
    key: 'lastSeen',
    width: 150,
    render(r) { return r.lastSeen ? new Date(r.lastSeen).toLocaleString() : '--' },
  },
  {
    title: () => t('common.status'),
    key: 'connected',
    width: 90,
    render(r) {
      return h(NTag, { type: r.connected ? 'success' : 'default', size: 'small' },
        () => r.connected ? t('nodes.online') : t('nodes.offline'))
    },
  },
  {
    title: '',
    key: 'actions',
    width: 120,
    render(row) {
      return h(NSpace, { size: 'small' }, () => [
        h(NButton, {
          size: 'tiny',
          secondary: true,
          onClick: () => openRename(row),
        }, () => t('nodes.rename')),
      ])
    },
  },
]

/* ---------- Pair request columns ---------- */
const pairColumns: DataTableColumns<PairRequest> = [
  { title: 'ID', key: 'id', ellipsis: { tooltip: true }, width: 160 },
  {
    title: () => t('common.name'),
    key: 'name',
    ellipsis: true,
    render(r) { return r.displayName ?? r.name ?? r.nodeId ?? '--' },
  },
  { title: () => t('nodes.ip'), key: 'ip', width: 130, render(r) { return r.ip ?? '--' } },
  {
    title: () => t('nodes.requestedAt'),
    key: 'requestedAt',
    width: 150,
    render(r) { return r.requestedAt ? new Date(r.requestedAt).toLocaleString() : '--' },
  },
  {
    title: () => t('common.actions'),
    key: 'actions',
    width: 180,
    render(row) {
      return h(NSpace, { size: 'small' }, () => [
        h(NPopconfirm, { onPositiveClick: () => store.approvePair(row.id) }, {
          trigger: () => h(NButton, { size: 'tiny', type: 'success' }, () => t('nodes.approve')),
          default: () => t('nodes.approveConfirm', { name: row.displayName ?? row.name ?? row.id }),
        }),
        h(NPopconfirm, { onPositiveClick: () => store.rejectPair(row.id) }, {
          trigger: () => h(NButton, { size: 'tiny', type: 'error', ghost: true }, () => t('nodes.reject')),
          default: () => t('nodes.rejectConfirm'),
        }),
      ])
    },
  },
]

/* ---------- Device columns ---------- */
const deviceColumns: DataTableColumns<DevicePair> = [
  { title: 'ID', key: 'id', ellipsis: { tooltip: true }, width: 160 },
  {
    title: () => t('common.name'),
    key: 'name',
    ellipsis: true,
    render(r) { return r.displayName ?? r.name ?? '--' },
  },
  { title: () => t('nodes.role'), key: 'role', width: 90, render(r) { return r.role ?? '--' } },
  { title: () => t('nodes.platform'), key: 'platform', width: 100, render(r) { return r.platform ?? '--' } },
  {
    title: () => t('nodes.lastSeen'),
    key: 'lastSeen',
    width: 150,
    render(r) { return r.lastSeen ? new Date(r.lastSeen).toLocaleString() : '--' },
  },
  {
    title: () => t('nodes.paired'),
    key: 'pairedAt',
    width: 150,
    render(r) { return r.pairedAt ? new Date(r.pairedAt).toLocaleString() : '--' },
  },
  {
    title: () => t('common.actions'),
    key: 'actions',
    width: 260,
    render(row) {
      return h(NSpace, { size: 'small' }, () => [
        h(NButton, { size: 'tiny', secondary: true, onClick: () => handleRotate(row.id) },
          () => t('nodes.rotateToken')),
        h(NPopconfirm, { onPositiveClick: () => store.revokeToken(row.id) }, {
          trigger: () => h(NButton, { size: 'tiny', type: 'warning', ghost: true },
            () => t('nodes.revokeToken')),
          default: () => t('nodes.revokeConfirm'),
        }),
        h(NPopconfirm, { onPositiveClick: () => store.removeDevice(row.id) }, {
          trigger: () => h(NButton, { size: 'tiny', type: 'error', ghost: true },
            () => t('nodes.remove')),
          default: () => t('nodes.removeConfirm'),
        }),
      ])
    },
  },
]

/* ---------- Exec approval queue columns ---------- */
const execQueueColumns: DataTableColumns<ExecApprovalRequest> = [
  {
    title: () => t('nodes.requestedAt'),
    key: 'requestedAt',
    width: 150,
    render(r) { return new Date(r.requestedAt).toLocaleString() },
  },
  { title: () => t('nodes.tool'), key: 'tool', width: 140 },
  { title: () => t('nodes.agent'), key: 'agentId', width: 120, render(r) { return r.agentId ?? '--' } },
  { title: () => t('nodes.node'), key: 'nodeId', width: 120, render(r) { return r.nodeId ?? '--' } },
  {
    title: () => t('common.actions'),
    key: 'actions',
    width: 160,
    render(row) {
      return h(NSpace, { size: 'small' }, () => [
        h(NButton, { size: 'tiny', type: 'success', onClick: () => store.approveExec(row.id) },
          () => t('nodes.approve')),
        h(NButton, { size: 'tiny', type: 'error', ghost: true, onClick: () => store.denyExec(row.id) },
          () => t('nodes.reject')),
      ])
    },
  },
]

/* ---------- Actions ---------- */
async function handleRotate(id: string) {
  const token = await store.rotateToken(id)
  if (token) {
    rotatedToken.value = token
    tokenModalOpen.value = true
  }
}

function openRename(node: Node) {
  renameTarget.value = { id: node.id, name: node.name ?? '' }
  renameModalOpen.value = true
}

async function handleRename() {
  if (renameTarget.value.id) {
    await store.renameNode(renameTarget.value.id, renameTarget.value.name)
    renameModalOpen.value = false
  }
}

async function loadExecRules() {
  await store.fetchExecRules(execTarget.value)
  const rule = store.execRules[execTarget.value]
  if (rule) {
    execRuleForm.value = {
      enabled: rule.enabled ?? false,
      mode: rule.mode ?? 'allowlist',
      allowPatterns: rule.allowPatterns ? [...rule.allowPatterns] : [],
      denyPatterns: rule.denyPatterns ? [...rule.denyPatterns] : [],
    }
  } else {
    execRuleForm.value = { enabled: false, mode: 'allowlist', allowPatterns: [], denyPatterns: [] }
  }
}

async function saveExecRules() {
  await store.setExecRule(execTarget.value, execRuleForm.value)
}

const execModeOptions = computed<SelectOption[]>(() => [
  { label: t('nodes.allowlistMode'), value: 'allowlist' },
  { label: t('nodes.denylistMode'), value: 'denylist' },
  { label: t('nodes.askMode'), value: 'ask' },
])

onMounted(async () => {
  if (!conn.isConnected) return
  await Promise.all([
    store.fetchNodes(),
    store.fetchPairRequests(),
    store.fetchDevicePairs(),
    store.fetchExecRules(),
    store.fetchBindings(),
  ])
  loadExecRules()
})
</script>

<template>
  <div class="nodes-view">
    <NSpace justify="space-between" align="center" style="margin-bottom:16px;">
      <NText strong style="font-size:16px;">{{ t('nodes.title') }}</NText>
      <NButton size="small" secondary :loading="store.loading" @click="store.fetchNodes()">
        {{ t('common.refresh') }}
      </NButton>
    </NSpace>

    <NSpin :show="store.loading">
      <NTabs type="line" animated>
        <!-- Nodes Tab -->
        <NTabPane name="nodes" :tab="t('nodes.nodes')">
          <NEmpty v-if="!store.nodes.length" :description="t('nodes.noNodes')" />
          <NDataTable
            v-else
            :columns="nodeColumns"
            :data="store.nodes"
            size="small"
            :pagination="{ pageSize: 20 }"
            :scroll-x="900"
          />
        </NTabPane>

        <!-- Pair Requests Tab -->
        <NTabPane name="pairs" :tab="`${t('nodes.pairApproval')} (${store.pairRequests.length})`">
          <NEmpty v-if="!store.pairRequests.length" :description="t('nodes.noPairRequests')" />
          <template v-else>
            <NDataTable :columns="pairColumns" :data="store.pairRequests" size="small" :scroll-x="700" />
          </template>
        </NTabPane>

        <!-- Devices Tab -->
        <NTabPane name="devices" :tab="t('nodes.devices')">
          <NEmpty v-if="!store.devicePairRequests.length" :description="t('nodes.noPairedDevices')" />
          <NDataTable
            v-else
            :columns="deviceColumns"
            :data="store.devicePairRequests"
            size="small"
            :pagination="{ pageSize: 20 }"
            :scroll-x="900"
          />
        </NTabPane>
      </NTabs>
    </NSpin>

    <!-- Exec Approvals Section -->
    <NCard :title="t('nodes.execApprovals')" size="small" style="margin-top:20px;">
      <NSpace vertical :size="12">
        <!-- Target selector + rules editor -->
        <NSpace align="center" :size="8">
          <NText depth="2" style="font-size:13px;">{{ t('nodes.target') }}:</NText>
          <NSelect
            v-model:value="execTarget"
            :options="allExecTargetOptions"
            size="small"
            style="width:220px;"
            @update:value="loadExecRules"
          />
        </NSpace>

        <NForm label-placement="left" :model="execRuleForm" size="small">
          <NFormItem :label="t('nodes.enabled')">
            <NSwitch v-model:value="execRuleForm.enabled" />
          </NFormItem>
          <NFormItem :label="t('nodes.mode')">
            <NSelect v-model:value="execRuleForm.mode" :options="execModeOptions" style="width:160px;" />
          </NFormItem>
          <NFormItem v-if="execRuleForm.mode === 'allowlist' || execRuleForm.mode === 'ask'" :label="t('nodes.allowPatterns')">
            <NDynamicTags v-model:value="execRuleForm.allowPatterns" />
          </NFormItem>
          <NFormItem v-if="execRuleForm.mode === 'denylist' || execRuleForm.mode === 'ask'" :label="t('nodes.denyPatterns')">
            <NDynamicTags v-model:value="execRuleForm.denyPatterns" />
          </NFormItem>
        </NForm>

        <NSpace>
          <NButton size="small" type="primary" @click="saveExecRules">
            {{ t('common.save') }}
          </NButton>
        </NSpace>

        <!-- Approval Queue -->
        <template v-if="store.execQueue.length">
          <NText strong style="display:block;margin-top:8px;">{{ t('nodes.pendingApprovals') }} ({{ store.execQueue.length }})</NText>
          <NDataTable
            :columns="execQueueColumns"
            :data="store.execQueue"
            size="small"
            :scroll-x="600"
          />
        </template>
        <NText v-else depth="3" style="font-size:12px;">{{ t('nodes.noPendingApprovals') }}</NText>
      </NSpace>
    </NCard>

    <!-- Token Modal -->
    <NModal v-model:show="tokenModalOpen" preset="card" :title="t('nodes.newToken')" style="width:480px;">
      <NText depth="2" style="display:block;margin-bottom:8px;font-size:13px;">
        {{ t('nodes.copyWarning') }}
      </NText>
      <NInput :value="rotatedToken ?? ''" readonly style="font-family:monospace;" />
      <template #footer>
        <NSpace justify="end">
          <NButton type="primary" @click="tokenModalOpen = false">{{ t('common.close') }}</NButton>
        </NSpace>
      </template>
    </NModal>

    <!-- Rename Modal -->
    <NModal v-model:show="renameModalOpen" preset="card" :title="t('nodes.rename')" style="width:400px;">
      <NForm label-placement="top">
        <NFormItem :label="t('nodes.newName')">
          <NInput v-model:value="renameTarget.name" :placeholder="t('nodes.nodeNamePlaceholder')" />
        </NFormItem>
      </NForm>
      <template #footer>
        <NSpace justify="end">
          <NButton @click="renameModalOpen = false">{{ t('common.cancel') }}</NButton>
          <NButton type="primary" @click="handleRename">{{ t('common.save') }}</NButton>
        </NSpace>
      </template>
    </NModal>
  </div>
</template>

<style scoped>
.nodes-view { padding: 16px; }
</style>
