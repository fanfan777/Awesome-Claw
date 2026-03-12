<script setup lang="ts">
import { ref, onMounted, h, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NDataTable, NButton, NSpace, NText, NSpin, NEmpty, NInput, NDrawer,
  NDrawerContent, NPopconfirm, NList, NListItem, NTag, NSelect,
  NForm, NFormItem, NCard, NAlert
} from 'naive-ui'
import type { DataTableColumns, PaginationProps } from 'naive-ui'
import { useSessionsStore, type Session, type SessionPreview, type SortField } from '@renderer/stores/sessions'
import { useConnectionStore } from '@renderer/gateway/connection'

const { t } = useI18n()
const store = useSessionsStore()
const conn = useConnectionStore()

const searchText = ref('')

// Preview drawer
const previewOpen = ref(false)
const previewData = ref<SessionPreview | null>(null)
const previewLoading = ref(false)
const previewSessionKey = ref('')

// Edit drawer
const editOpen = ref(false)
const editSession = ref<Session | null>(null)
const editForm = ref({
  title: '',
  thinkingLevel: null as string | null,
  verboseLevel: null as string | null,
  reasoningLevel: null as string | null,
})
const editSaving = ref(false)

// Sort options
const sortOptions = computed(() => [
  { label: t('sessions.recent'), value: 'recent' },
  { label: t('sessions.tokens'), value: 'tokens' },
  { label: t('sessions.messages'), value: 'messages' },
  { label: t('sessions.sessionKey'), value: 'sessionKey' },
  { label: t('sessions.channel'), value: 'channel' },
])

const thinkingOptions = computed(() => [
  { label: t('sessions.inheritFromAgent'), value: '' },
  { label: t('sessions.off'), value: 'off' },
  { label: t('sessions.minimal'), value: 'minimal' },
  { label: t('sessions.low'), value: 'low' },
  { label: t('sessions.medium'), value: 'medium' },
  { label: t('sessions.high'), value: 'high' },
  { label: t('sessions.xhigh'), value: 'xhigh' },
])

const verboseOptions = computed(() => [
  { label: t('sessions.inherit'), value: '' },
  { label: t('sessions.off'), value: 'off' },
  { label: t('sessions.on'), value: 'on' },
  { label: t('sessions.full'), value: 'full' },
])

const reasoningOptions = computed(() => [
  { label: t('sessions.inherit'), value: '' },
  { label: t('sessions.off'), value: 'off' },
  { label: t('sessions.on'), value: 'on' },
  { label: t('sessions.stream'), value: 'stream' },
])

const pageSizeOptions = computed(() => [
  { label: t('sessions.perPage', { n: 20 }), value: 20 },
  { label: t('sessions.perPage', { n: 50 }), value: 50 },
  { label: t('sessions.perPage', { n: 100 }), value: 100 },
])

// Pagination
const pagination = computed<PaginationProps>(() => ({
  page: store.page,
  pageSize: store.pageSize,
  showSizePicker: true,
  pageSizes: [20, 50, 100],
  itemCount: store.total,
  onChange(page: number) {
    store.setPage(page)
    loadPage()
  },
  onUpdatePageSize(size: number) {
    store.setPageSize(size)
    loadPage()
  },
}))

async function loadPage() {
  if (!conn.isConnected) return
  await store.fetchSessions({
    search: searchText.value || undefined,
    limit: store.pageSize,
  })
}

function handleSearchUpdate() {
  store.setPage(1)
  loadPage()
}

function handleSortChange(field: SortField) {
  store.setSort(field)
  loadPage()
}

// Preview
async function openPreview(sessionKey: string) {
  previewSessionKey.value = sessionKey
  previewLoading.value = true
  previewOpen.value = true
  previewData.value = await store.preview(sessionKey)
  previewLoading.value = false
}

// Edit
function openEdit(session: Session) {
  editSession.value = session
  editForm.value = {
    title: session.title ?? '',
    thinkingLevel: session.thinkingLevel ?? null,
    verboseLevel: session.verboseLevel ?? null,
    reasoningLevel: session.reasoningLevel ?? null,
  }
  editOpen.value = true
}

async function saveEdit() {
  if (!editSession.value) return
  editSaving.value = true
  const updates: Record<string, unknown> = {}
  if (editForm.value.title) updates.title = editForm.value.title
  if (editForm.value.thinkingLevel) updates.thinkingLevel = editForm.value.thinkingLevel
  if (editForm.value.verboseLevel) updates.verboseLevel = editForm.value.verboseLevel
  if (editForm.value.reasoningLevel) updates.reasoningLevel = editForm.value.reasoningLevel
  await store.patch(editSession.value.sessionKey, updates)
  editSaving.value = false
  editOpen.value = false
}

// Actions
async function handleReset(sessionKey: string) {
  await store.reset(sessionKey)
  await loadPage()
}

async function handleDelete(sessionKey: string) {
  if (!sessionKey) return
  await store.deleteSession(sessionKey)
  await loadPage()
}

async function handleCompact(sessionKey: string) {
  await store.compact(sessionKey)
  await loadPage()
}

// Role color mapping
function roleTagType(role: string): 'info' | 'success' | 'warning' | 'error' | 'default' {
  switch (role) {
    case 'user': return 'info'
    case 'assistant': return 'success'
    case 'system': return 'warning'
    case 'tool': return 'default'
    default: return 'default'
  }
}

// Table columns
const columns: DataTableColumns<Session> = [
  {
    title: () => t('sessions.sessionKey'),
    key: 'sessionKey',
    ellipsis: true,
    width: 180,
    sorter: true,
    render(row) {
      return h(NSpace, { size: 4, align: 'center', wrap: false }, () => [
        row.pinned ? h(NTag, { size: 'tiny', type: 'warning', bordered: false }, () => t('sessions.pinned')) : null,
        h(NText, { style: 'font-family: monospace; font-size: 12px;' }, () => row.sessionKey),
      ])
    },
  },
  {
    title: () => t('sessions.channel'),
    key: 'channel',
    width: 100,
    ellipsis: true,
    sorter: true,
    render(row) {
      return row.channel ? h(NTag, { size: 'tiny', bordered: false }, () => row.channel) : h(NText, { depth: 3 }, () => '--')
    },
  },
  {
    title: () => t('sessions.agent'),
    key: 'agentId',
    ellipsis: true,
    width: 120,
    sorter: true,
  },
  {
    title: () => t('sessions.messageCount'),
    key: 'messageCount',
    width: 90,
    sorter: true,
    render(row) {
      return row.messageCount != null ? String(row.messageCount) : '--'
    },
  },
  {
    title: () => t('sessions.tokens'),
    key: 'tokenCount',
    width: 90,
    sorter: true,
    render(row) {
      if (row.tokenCount == null) return '--'
      return row.tokenCount > 1000
        ? `${(row.tokenCount / 1000).toFixed(1)}k`
        : String(row.tokenCount)
    },
  },
  {
    title: () => t('sessions.updated'),
    key: 'updatedAt',
    width: 150,
    sorter: true,
    render(r) { return r.updatedAt ? new Date(r.updatedAt).toLocaleString() : '--' },
  },
  {
    title: () => t('common.actions'),
    key: 'actions',
    width: 280,
    render(row) {
      return h(NSpace, { size: 'small', wrap: false }, () => [
        h(NButton, { size: 'tiny', secondary: true, onClick: () => openPreview(row.sessionKey) }, () => t('sessions.preview')),
        h(NButton, { size: 'tiny', secondary: true, onClick: () => openEdit(row) }, () => t('common.edit')),
        h(NPopconfirm, { onPositiveClick: () => handleCompact(row.sessionKey) }, {
          trigger: () => h(NButton, { size: 'tiny', ghost: true }, () => t('sessions.compact')),
          default: () => t('sessions.compactConfirm'),
        }),
        h(NPopconfirm, { onPositiveClick: () => handleReset(row.sessionKey) }, {
          trigger: () => h(NButton, { size: 'tiny', ghost: true }, () => t('sessions.reset')),
          default: () => t('sessions.resetConfirm'),
        }),
        h(NPopconfirm, { onPositiveClick: () => handleDelete(row.sessionKey) }, {
          trigger: () => h(NButton, { size: 'tiny', type: 'error', ghost: true }, () => t('sessions.delete')),
          default: () => t('sessions.deleteConfirm'),
        }),
      ])
    },
  },
]

function handleSorterChange(sorter: { columnKey: string; order: 'ascend' | 'descend' | false }) {
  if (!sorter.order) return
  const fieldMap: Record<string, SortField> = {
    sessionKey: 'sessionKey',
    channel: 'channel',
    messageCount: 'messages',
    tokenCount: 'tokens',
    updatedAt: 'recent',
  }
  const field = fieldMap[sorter.columnKey]
  if (field) {
    store.sortBy = field
    store.sortDir = sorter.order === 'ascend' ? 'asc' : 'desc'
    loadPage()
  }
}

onMounted(() => loadPage())
</script>

<template>
  <div class="sessions-view">
    <!-- Header -->
    <NSpace justify="space-between" align="center" style="margin-bottom: 12px;">
      <NText strong style="font-size: 16px;">{{ t('sessions.title') }} ({{ store.total }})</NText>
      <NSpace :size="8" align="center">
        <NSelect
          :value="store.sortBy"
          :options="sortOptions"
          size="small"
          style="width: 140px;"
          @update:value="handleSortChange"
        />
        <NButton
          size="small"
          secondary
          @click="store.sortDir = store.sortDir === 'asc' ? 'desc' : 'asc'; loadPage()"
        >
          {{ store.sortDir === 'asc' ? t('sessions.asc') : t('sessions.desc') }}
        </NButton>
        <NInput
          v-model:value="searchText"
          :placeholder="t('common.search')"
          size="small"
          clearable
          style="width: 200px;"
          @update:value="handleSearchUpdate"
        />
        <NButton size="small" secondary :loading="store.loading" @click="loadPage">
          {{ t('common.refresh') }}
        </NButton>
      </NSpace>
    </NSpace>

    <!-- Error -->
    <NAlert v-if="store.error" type="error" closable style="margin-bottom: 8px;">
      {{ store.error }}
    </NAlert>

    <!-- Table -->
    <NSpin :show="store.loading">
      <NEmpty v-if="!store.sessions.length && !store.loading" :description="t('sessions.noSessions')" />
      <NDataTable
        v-else
        :columns="columns"
        :data="store.sessions"
        :pagination="pagination"
        remote
        size="small"
        @update:sorter="handleSorterChange"
      />
    </NSpin>

    <!-- Preview Drawer -->
    <NDrawer v-model:show="previewOpen" :width="520" placement="right">
      <NDrawerContent :title="`${t('sessions.sessionPreview')}: ${previewSessionKey}`" closable>
        <NSpin :show="previewLoading">
          <NEmpty v-if="!previewLoading && !previewData?.messages?.length" :description="t('sessions.noMessages')" />
          <NList v-else bordered style="max-height: calc(100vh - 160px); overflow-y: auto;">
            <NListItem
              v-for="(msg, i) in previewData?.messages ?? []"
              :key="i"
            >
              <NSpace vertical :size="4">
                <NSpace :size="8" align="center">
                  <NTag size="tiny" :type="roleTagType(msg.role)">{{ msg.role }}</NTag>
                  <NText v-if="msg.timestamp" depth="3" style="font-size: 11px;">
                    {{ new Date(msg.timestamp).toLocaleString() }}
                  </NText>
                </NSpace>
                <NText style="font-size: 13px; white-space: pre-wrap; word-break: break-word;">
                  {{ msg.content }}
                </NText>
              </NSpace>
            </NListItem>
          </NList>
        </NSpin>
      </NDrawerContent>
    </NDrawer>

    <!-- Edit Drawer -->
    <NDrawer v-model:show="editOpen" :width="440" placement="right">
      <NDrawerContent :title="t('sessions.overrides')" closable>
        <NForm v-if="editSession" label-placement="top" :model="editForm" size="small">
          <NFormItem :label="t('sessions.sessionKey')">
            <NText code>{{ editSession.sessionKey }}</NText>
          </NFormItem>

          <NFormItem :label="t('sessions.label')">
            <NInput v-model:value="editForm.title" :placeholder="t('sessions.customName')" clearable />
          </NFormItem>

          <NFormItem :label="t('sessions.thinkingLevel')">
            <NSelect
              v-model:value="editForm.thinkingLevel"
              :options="thinkingOptions"
              clearable
              :placeholder="t('sessions.inheritFromAgent')"
            />
          </NFormItem>

          <NFormItem :label="t('sessions.verboseLevel')">
            <NSelect
              v-model:value="editForm.verboseLevel"
              :options="verboseOptions"
              clearable
              :placeholder="t('sessions.inherit')"
            />
          </NFormItem>

          <NFormItem :label="t('sessions.reasoningLevel')">
            <NSelect
              v-model:value="editForm.reasoningLevel"
              :options="reasoningOptions"
              clearable
              :placeholder="t('sessions.inherit')"
            />
          </NFormItem>
        </NForm>

        <template #footer>
          <NSpace justify="end">
            <NButton @click="editOpen = false">{{ t('common.cancel') }}</NButton>
            <NButton type="primary" :loading="editSaving" @click="saveEdit">
              {{ t('common.save') }}
            </NButton>
          </NSpace>
        </template>
      </NDrawerContent>
    </NDrawer>
  </div>
</template>

<style scoped>
.sessions-view {
  padding: 16px;
}
</style>
