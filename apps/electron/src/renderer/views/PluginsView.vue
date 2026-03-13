<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NCard, NButton, NSpace, NSpin, NEmpty, NText, NSwitch, NTag, NGrid, NGi,
  NInput, NDrawer, NDrawerContent, NAlert, NRadioGroup, NRadioButton, NModal
} from 'naive-ui'
import { useConfigStore, type ConfigValue } from '@renderer/stores/config'
import { useConnectionStore } from '@renderer/gateway/connection'

const { t } = useI18n()
const configStore = useConfigStore()
const conn = useConnectionStore()

/* ---------- Types ---------- */
interface PluginEntry {
  id: string
  name?: string
  enabled?: boolean
  description?: string
  source: 'extension' | 'config'
  category?: string
  path?: string
  config?: Record<string, unknown>
}

type CategoryId = 'all' | 'channel' | 'memory' | 'feature' | 'auth' | 'ops' | 'context' | 'other'

/* ---------- Category classification ---------- */
const CATEGORY_KEYWORDS: Record<Exclude<CategoryId, 'all' | 'other'>, string[]> = {
  channel: ['msteams', 'matrix', 'line', 'zalo', 'voice-call', 'telegram', 'discord', 'slack', 'whatsapp', 'signal', 'feishu', 'lark', 'wechat', 'imessage', 'bluebubbles', 'channel'],
  memory: ['memory'],
  feature: ['tts', 'stt', 'browser', 'media', 'canvas', 'search', 'cron', 'tool', 'skill'],
  auth: ['auth', 'oauth', 'saml', 'ldap', 'sso'],
  ops: ['monitor', 'health', 'metric', 'otel', 'log', 'diagnostic', 'ops'],
  context: ['context', 'legacy-context', 'custom-context'],
}

const MEMORY_SLOT_IDS = ['memory-core', 'memory-lancedb', 'memory']

function classifyPlugin(id: string): CategoryId {
  const lower = id.toLowerCase()
  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(kw => lower.includes(kw))) return cat as CategoryId
  }
  return 'other'
}

/* ---------- State ---------- */
const searchQuery = ref('')
const activeCategory = ref<CategoryId>('all')
const addModalOpen = ref(false)
const addPathInput = ref('')
const addLoading = ref(false)
const configDrawerOpen = ref(false)
const configPluginId = ref<string | null>(null)
const configFields = ref<Array<{ key: string; value: string }>>([])
const errorMsg = ref<string | null>(null)

/* ---------- Parse plugins from config ---------- */
function getPluginsRaw(): Record<string, unknown> {
  const raw = configStore.config['plugins']
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  return raw as Record<string, unknown>
}

const loadPaths = computed<string[]>(() => {
  const pluginsObj = getPluginsRaw()
  const load = pluginsObj['load'] as Record<string, unknown> | undefined
  if (!load) return []
  const paths = load['paths']
  return Array.isArray(paths) ? (paths as string[]) : []
})

const allPlugins = computed<PluginEntry[]>(() => {
  const pluginsObj = getPluginsRaw()
  const result: PluginEntry[] = []
  const seen = new Set<string>()

  // 1. Parse plugins.entries
  const entries = pluginsObj['entries']
  if (entries && typeof entries === 'object' && !Array.isArray(entries)) {
    for (const [id, val] of Object.entries(entries as Record<string, unknown>)) {
      seen.add(id)
      const v = (val as Record<string, unknown>) ?? {}
      // Determine source: if this id matches a load path basename, it's an extension
      const matchPath = loadPaths.value.find(p => p.endsWith(`/${id}`) || p.endsWith(`\\${id}`))
      result.push({
        id,
        name: (v['name'] as string) ?? id,
        enabled: (v['enabled'] as boolean) ?? false,
        description: (v['description'] as string) ?? undefined,
        source: matchPath ? 'extension' : 'config',
        category: classifyPlugin(id),
        path: matchPath,
        config: (v['config'] as Record<string, unknown>) ?? undefined,
      })
    }
  }

  // 2. Extensions from load.paths not yet in entries
  for (const p of loadPaths.value) {
    const name = p.split('/').pop() ?? p.split('\\').pop() ?? p
    if (seen.has(name)) continue
    result.push({
      id: name,
      name,
      enabled: true,
      source: 'extension',
      category: classifyPlugin(name),
      path: p,
    })
  }

  // Filter out channel extensions — they belong in ChannelsView, not here
  return result.filter(p => p.category !== 'channel')
})

const enabledCount = computed(() => allPlugins.value.filter(p => p.enabled).length)

/* ---------- Category tabs ---------- */
const CATEGORY_ORDER: CategoryId[] = ['all', 'channel', 'memory', 'feature', 'auth', 'ops', 'context', 'other']

const categoryTabs = computed(() => {
  const icons: Record<CategoryId, string> = {
    all: '', channel: '', memory: '', feature: '',
    auth: '', ops: '', context: '', other: '',
  }
  return CATEGORY_ORDER
    .filter(cat => cat === 'all' || allPlugins.value.some(p => p.category === cat))
    .map(cat => ({
      id: cat,
      label: t(`plugins.categories.${cat}`),
      icon: icons[cat],
      count: cat === 'all'
        ? allPlugins.value.length
        : allPlugins.value.filter(p => p.category === cat).length,
    }))
})

/* ---------- Filtered + grouped ---------- */
const filteredPlugins = computed(() => {
  let list = allPlugins.value
  if (activeCategory.value !== 'all') {
    list = list.filter(p => p.category === activeCategory.value)
  }
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase()
    list = list.filter(p =>
      p.id.toLowerCase().includes(q) ||
      (p.name?.toLowerCase().includes(q)) ||
      (p.path?.toLowerCase().includes(q)),
    )
  }
  return list
})

const groupedPlugins = computed(() => {
  const catOrder = CATEGORY_ORDER.filter(c => c !== 'all')
  const groups: Array<{ category: CategoryId; label: string; plugins: PluginEntry[] }> = []
  for (const cat of catOrder) {
    const plugins = filteredPlugins.value.filter(p => p.category === cat)
    if (plugins.length) {
      groups.push({ category: cat, label: t(`plugins.categories.${cat}`), plugins })
    }
  }
  return groups
})

const memoryPlugins = computed(() =>
  allPlugins.value.filter(p => MEMORY_SLOT_IDS.some(mid => p.id.includes(mid))),
)

const activeMemoryId = computed(() =>
  memoryPlugins.value.find(p => p.enabled)?.id ?? null,
)

/* ---------- Actions ---------- */
async function togglePlugin(id: string, enabled: boolean) {
  errorMsg.value = null
  const ok = await configStore.patchConfig(`plugins.entries.${id}.enabled`, enabled)
  if (ok) await configStore.fetchConfig()
  else errorMsg.value = configStore.error
}

async function switchMemoryPlugin(newId: string) {
  errorMsg.value = null
  for (const mp of memoryPlugins.value) {
    if (mp.id !== newId && mp.enabled) {
      await configStore.patchConfig(`plugins.entries.${mp.id}.enabled`, false)
    }
  }
  await configStore.patchConfig(`plugins.entries.${newId}.enabled`, true)
  await configStore.fetchConfig()
}

function isMemoryPlugin(id: string): boolean {
  return MEMORY_SLOT_IDS.some(mid => id.includes(mid))
}

async function handleAddExtension() {
  const path = addPathInput.value.trim()
  if (!path) return
  addLoading.value = true
  errorMsg.value = null
  try {
    // Add path to plugins.load.paths via config.patch
    const currentPaths = [...loadPaths.value]
    if (!currentPaths.includes(path)) {
      currentPaths.push(path)
    }
    await configStore.patchConfig('plugins.load.paths', currentPaths as unknown as ConfigValue)
    // Also enable it in entries
    const name = path.split('/').pop() ?? path.split('\\').pop() ?? path
    await configStore.patchConfig(`plugins.entries.${name}.enabled`, true)
    addPathInput.value = ''
    addModalOpen.value = false
    await configStore.fetchConfig()
  } catch (err) {
    errorMsg.value = err instanceof Error ? err.message : 'Failed to add extension'
  } finally {
    addLoading.value = false
  }
}

function openConfigDrawer(plugin: PluginEntry) {
  configPluginId.value = plugin.id
  const cfg = plugin.config ?? {}
  configFields.value = Object.entries(cfg).map(([key, value]) => ({
    key,
    value: typeof value === 'string' ? value : JSON.stringify(value),
  }))
  if (configFields.value.length === 0) {
    configFields.value.push({ key: '', value: '' })
  }
  configDrawerOpen.value = true
}

async function savePluginConfig() {
  if (!configPluginId.value) return
  errorMsg.value = null
  const configObj: Record<string, unknown> = {}
  for (const field of configFields.value) {
    if (field.key.trim()) {
      try { configObj[field.key.trim()] = JSON.parse(field.value) }
      catch { configObj[field.key.trim()] = field.value }
    }
  }
  const ok = await configStore.patchConfig(`plugins.entries.${configPluginId.value}.config`, configObj)
  if (ok) {
    configDrawerOpen.value = false
    await configStore.fetchConfig()
  } else {
    errorMsg.value = configStore.error
  }
}

onMounted(() => {
  if (conn.isConnected) configStore.fetchConfig()
})
</script>

<template>
  <div class="plugins-view">
    <NAlert v-if="errorMsg" type="error" closable style="margin-bottom:12px;" @close="errorMsg = null">
      {{ errorMsg }}
    </NAlert>

    <!-- Header -->
    <NSpace justify="space-between" align="center" style="margin-bottom:16px;">
      <NSpace align="center" :size="12">
        <NText strong style="font-size:16px;">{{ t('plugins.title') }}</NText>
        <NTag size="small" round>{{ t('plugins.enabledCount', { count: enabledCount }) }}</NTag>
      </NSpace>
      <NSpace :size="8">
        <NButton size="small" type="primary" @click="addModalOpen = true">
          {{ t('plugins.addExtension') }}
        </NButton>
        <NButton size="small" secondary :loading="configStore.loading" @click="configStore.fetchConfig()">
          {{ t('common.refresh') }}
        </NButton>
      </NSpace>
    </NSpace>

    <!-- Load paths info -->
    <NAlert v-if="loadPaths.length" type="info" style="margin-bottom:12px;">
      <NText depth="2" style="font-size: 12px;">
        {{ t('plugins.loadPaths') }}: {{ loadPaths.join(', ') }}
      </NText>
    </NAlert>

    <!-- Category tabs -->
    <div v-if="categoryTabs.length > 1" class="category-tabs">
      <NButton
        v-for="tab in categoryTabs"
        :key="tab.id"
        :type="activeCategory === tab.id ? 'primary' : 'default'"
        :secondary="activeCategory === tab.id"
        :quaternary="activeCategory !== tab.id"
        size="small"
        @click="activeCategory = tab.id"
      >
        {{ tab.label }} ({{ tab.count }})
      </NButton>
    </div>

    <!-- Search -->
    <NSpace style="margin-bottom:12px;" :size="8" align="center">
      <NInput
        v-model:value="searchQuery"
        :placeholder="t('plugins.searchPlaceholder')"
        clearable
        size="small"
        style="width:260px;"
      />
    </NSpace>

    <!-- Content -->
    <NSpin :show="configStore.loading">
      <NEmpty v-if="!filteredPlugins.length && !configStore.loading" :description="t('plugins.noPlugins')" />

      <!-- Flat list when no categories -->
      <NGrid v-if="!groupedPlugins.length && filteredPlugins.length" :cols="3" :x-gap="12" :y-gap="12">
        <NGi v-for="plugin in filteredPlugins" :key="plugin.id">
          <NCard size="small" :class="{ 'plugin-disabled': !plugin.enabled }">
            <NSpace vertical :size="8">
              <NSpace justify="space-between" align="center">
                <NText strong>{{ plugin.name ?? plugin.id }}</NText>
                <NSwitch
                  :value="plugin.enabled ?? false"
                  size="small"
                  @update:value="togglePlugin(plugin.id, $event)"
                />
              </NSpace>
              <NText v-if="plugin.path" depth="3" style="font-size:11px; word-break: break-all;">
                {{ plugin.path }}
              </NText>
              <NSpace align="center" :size="6" wrap>
                <NTag size="tiny" :type="plugin.source === 'extension' ? 'warning' : 'default'">
                  {{ plugin.source === 'extension' ? t('plugins.extension') : t('plugins.builtIn') }}
                </NTag>
                <NTag size="tiny" :bordered="false" type="info">
                  {{ t(`plugins.categories.${plugin.category ?? 'other'}`) }}
                </NTag>
              </NSpace>
              <NButton
                v-if="plugin.enabled"
                size="tiny"
                secondary
                @click="openConfigDrawer(plugin)"
              >
                {{ t('plugins.configure') }}
              </NButton>
            </NSpace>
          </NCard>
        </NGi>
      </NGrid>

      <!-- Grouped by category -->
      <NSpace v-else vertical :size="20">
        <template v-for="group in groupedPlugins" :key="group.category">
          <div>
            <NSpace align="center" :size="8" style="margin-bottom:8px;">
              <NText strong depth="2" style="font-size:13px;">
                {{ group.label }} ({{ group.plugins.length }})
              </NText>
              <NTag v-if="group.category === 'memory'" size="tiny" type="warning">
                {{ t('plugins.memorySlotHint') }}
              </NTag>
            </NSpace>

            <!-- Memory plugins: radio selection -->
            <template v-if="group.category === 'memory' && memoryPlugins.length > 1">
              <NCard size="small" style="margin-bottom:12px;">
                <NSpace vertical :size="8">
                  <NText strong style="font-size:13px;">{{ t('plugins.memorySlot') }}</NText>
                  <NRadioGroup :value="activeMemoryId" @update:value="switchMemoryPlugin">
                    <NRadioButton v-for="mp in memoryPlugins" :key="mp.id" :value="mp.id">
                      {{ mp.name ?? mp.id }}
                    </NRadioButton>
                  </NRadioGroup>
                </NSpace>
              </NCard>
            </template>

            <NGrid :cols="3" :x-gap="12" :y-gap="12">
              <NGi v-for="plugin in group.plugins" :key="plugin.id">
                <NCard size="small" :class="{ 'plugin-disabled': !plugin.enabled }">
                  <NSpace vertical :size="8">
                    <NSpace justify="space-between" align="center">
                      <NText strong>{{ plugin.name ?? plugin.id }}</NText>
                      <NSwitch
                        v-if="!isMemoryPlugin(plugin.id) || memoryPlugins.length <= 1"
                        :value="plugin.enabled ?? false"
                        size="small"
                        @update:value="togglePlugin(plugin.id, $event)"
                      />
                      <NTag v-else size="tiny" :type="plugin.enabled ? 'success' : 'default'">
                        {{ plugin.enabled ? t('plugins.enabled') : t('plugins.disabled') }}
                      </NTag>
                    </NSpace>
                    <NText v-if="plugin.path" depth="3" style="font-size:11px; word-break: break-all;">
                      {{ plugin.path }}
                    </NText>
                    <NSpace align="center" :size="6" wrap>
                      <NTag size="tiny" :type="plugin.source === 'extension' ? 'warning' : 'default'">
                        {{ plugin.source === 'extension' ? t('plugins.extension') : t('plugins.builtIn') }}
                      </NTag>
                    </NSpace>
                    <NButton
                      v-if="plugin.enabled"
                      size="tiny"
                      secondary
                      @click="openConfigDrawer(plugin)"
                    >
                      {{ t('plugins.configure') }}
                    </NButton>
                  </NSpace>
                </NCard>
              </NGi>
            </NGrid>
          </div>
        </template>
      </NSpace>
    </NSpin>

    <!-- Add Extension Modal -->
    <NModal v-model:show="addModalOpen" preset="card" :title="t('plugins.addExtension')" style="width:520px;">
      <NSpace vertical :size="12">
        <NText depth="2">{{ t('plugins.addExtensionHint') }}</NText>
        <NInput
          v-model:value="addPathInput"
          :placeholder="t('plugins.addExtensionPlaceholder')"
          @keyup.enter="handleAddExtension"
        />
        <NSpace justify="end">
          <NButton @click="addModalOpen = false">{{ t('common.cancel') }}</NButton>
          <NButton
            type="primary"
            :loading="addLoading"
            :disabled="!addPathInput.trim()"
            @click="handleAddExtension"
          >
            {{ t('common.confirm') }}
          </NButton>
        </NSpace>
      </NSpace>
    </NModal>

    <!-- Config Drawer -->
    <NDrawer v-model:show="configDrawerOpen" :width="480" placement="right">
      <NDrawerContent :title="t('plugins.configTitle', { name: configPluginId ?? '' })" closable>
        <NSpace vertical :size="12">
          <NText v-if="configFields.length === 1 && !configFields[0].key" depth="3">
            {{ t('plugins.noConfig') }}
          </NText>
          <div v-for="(field, idx) in configFields" :key="idx" class="config-row">
            <NSpace :size="8" align="center">
              <NInput v-model:value="field.key" :placeholder="t('plugins.configKey')" size="small" style="width:160px;" />
              <NInput v-model:value="field.value" :placeholder="t('plugins.configValue')" size="small" style="flex:1;min-width:180px;" />
              <NButton size="tiny" quaternary @click="configFields.splice(idx, 1)">
                {{ t('common.delete') }}
              </NButton>
            </NSpace>
          </div>
          <NButton size="small" dashed @click="configFields.push({ key: '', value: '' })">
            {{ t('common.create') }}
          </NButton>
        </NSpace>
        <template #footer>
          <NSpace justify="end">
            <NButton @click="configDrawerOpen = false">{{ t('common.cancel') }}</NButton>
            <NButton type="primary" @click="savePluginConfig">{{ t('common.save') }}</NButton>
          </NSpace>
        </template>
      </NDrawerContent>
    </NDrawer>
  </div>
</template>

<style scoped>
.plugins-view { padding: 16px; }
.plugin-disabled { opacity: 0.7; }
.category-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 12px;
}
.config-row { padding: 4px 0; }
</style>
