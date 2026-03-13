<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NCard, NButton, NSpace, NSpin, NText, NSwitch, NInput, NGrid, NGi,
  NTag, NTooltip, NAlert, NFormItem, NForm, NPopconfirm
} from 'naive-ui'
import { useSkillsStore } from '@renderer/stores/skills'
import { useConnectionStore } from '@renderer/gateway/connection'
import { MCP_CATALOG, MCP_CATEGORIES, type McpServerEntry } from '@renderer/data/mcp-catalog'

const { t, locale } = useI18n()
const skillsStore = useSkillsStore()
const conn = useConnectionStore()

const loading = ref(false)
const saving = ref(false)
const saveSuccess = ref(false)
const saveError = ref<string | null>(null)

/* ---------- MCP toggle (mcporter skill) ---------- */
const mcporterEnabled = computed(() => {
  const skill = skillsStore.skills.find(s => s.id === 'mcporter')
  return skill?.enabled ?? false
})

async function toggleMcporter(enable: boolean) {
  saving.value = true
  try {
    await skillsStore.toggleSkill('mcporter', enable)
  } finally {
    saving.value = false
  }
}

/* ---------- MCP Server Catalog ---------- */
const searchQuery = ref('')
const activeCategory = ref<string | null>(null)

const filteredServers = computed(() => {
  let servers = MCP_CATALOG as McpServerEntry[]
  if (activeCategory.value) {
    servers = servers.filter(s => s.category === activeCategory.value)
  }
  const q = searchQuery.value.toLowerCase().trim()
  if (q) {
    servers = servers.filter(s =>
      s.name.en.toLowerCase().includes(q) ||
      s.name.zh.includes(q) ||
      s.npmPackage.toLowerCase().includes(q) ||
      s.description.en.toLowerCase().includes(q) ||
      s.description.zh.includes(q)
    )
  }
  return servers
})

const categoryTabs = computed(() => [
  { id: null, label: t('common.all'), icon: '📋' },
  ...MCP_CATEGORIES.map(c => ({
    id: c.id,
    label: locale.value.startsWith('zh') ? c.label.zh : c.label.en,
    icon: c.icon,
  })),
])

function getName(server: McpServerEntry): string {
  return locale.value.startsWith('zh') ? server.name.zh : server.name.en
}

function getDesc(server: McpServerEntry): string {
  return locale.value.startsWith('zh') ? server.description.zh : server.description.en
}

function getCategoryLabel(catId: string): string {
  const cat = MCP_CATEGORIES.find(c => c.id === catId)
  if (!cat) return catId
  return locale.value.startsWith('zh') ? cat.label.zh : cat.label.en
}

/* ---------- Installed servers (from mcporter config via IPC) ---------- */
const installedServers = ref<Set<string>>(new Set())

async function loadInstalledServers() {
  try {
    const ids = await window.electronAPI?.mcp?.listServers() ?? []
    installedServers.value = new Set(ids)
  } catch {
    installedServers.value = new Set()
  }
}

function isInstalled(serverId: string): boolean {
  return installedServers.value.has(serverId)
}

/* ---------- Env var input for add flow ---------- */
const expandedEnv = ref<string | null>(null)
const envInput = ref('')

function toggleEnvInput(serverId: string) {
  if (expandedEnv.value === serverId) {
    expandedEnv.value = null
    envInput.value = ''
  } else {
    expandedEnv.value = serverId
    envInput.value = ''
  }
}

function parseEnvVars(text: string): Record<string, string> | undefined {
  if (!text.trim()) return undefined
  const env: Record<string, string> = {}
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const eq = trimmed.indexOf('=')
    if (eq > 0) {
      env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim()
    }
  }
  return Object.keys(env).length > 0 ? env : undefined
}

/* ---------- Add / Remove MCP Server ---------- */
async function addServer(server: McpServerEntry) {
  saving.value = true
  saveError.value = null
  saveSuccess.value = false
  try {
    const env = parseEnvVars(envInput.value)
    const result = await window.electronAPI?.mcp?.addServer(server.id, server.npmPackage, env)
    if (result?.ok) {
      installedServers.value.add(server.id)
      saveSuccess.value = true
      setTimeout(() => { saveSuccess.value = false }, 2000)
    } else {
      saveError.value = result?.error ?? t('common.error')
    }
  } catch (e) {
    saveError.value = e instanceof Error ? e.message : t('common.error')
  } finally {
    saving.value = false
    expandedEnv.value = null
    envInput.value = ''
  }
}

async function removeServer(server: McpServerEntry) {
  saving.value = true
  saveError.value = null
  try {
    const result = await window.electronAPI?.mcp?.removeServer(server.id)
    if (result?.ok) {
      installedServers.value.delete(server.id)
      saveSuccess.value = true
      setTimeout(() => { saveSuccess.value = false }, 2000)
    } else {
      saveError.value = result?.error ?? t('common.error')
    }
  } catch (e) {
    saveError.value = e instanceof Error ? e.message : t('common.error')
  } finally {
    saving.value = false
  }
}

/* ---------- Init ---------- */
onMounted(async () => {
  loading.value = true
  await Promise.all([
    conn.isConnected ? skillsStore.fetchStatus() : Promise.resolve(),
    loadInstalledServers(),
  ])
  loading.value = false
})
</script>

<template>
  <div class="mcp-view">
    <!-- Header -->
    <NSpace justify="space-between" align="center" style="margin-bottom: 12px;">
      <NText strong style="font-size: 16px;">{{ t('mcp.title') }}</NText>
      <NButton size="small" secondary :loading="loading" @click="async () => { loading = true; await Promise.all([skillsStore.fetchStatus(), loadInstalledServers()]); loading = false; }">
        {{ t('common.refresh') }}
      </NButton>
    </NSpace>

    <NAlert v-if="saveSuccess" type="success" closable style="margin-bottom: 8px;">
      {{ t('common.success') }}
    </NAlert>
    <NAlert v-if="saveError" type="error" closable style="margin-bottom: 8px;" @close="saveError = null">
      {{ saveError }}
    </NAlert>

    <NSpin :show="loading">
      <!-- MCP Enable toggle -->
      <NCard size="small" style="margin-bottom: 12px;">
        <NForm label-placement="left" label-width="120" size="small">
          <NFormItem :label="t('mcp.enableLabel')">
            <NSwitch :value="mcporterEnabled" :loading="saving" @update:value="toggleMcporter" />
          </NFormItem>
        </NForm>
        <NText depth="3" style="font-size: 12px;">
          {{ t('mcp.hint') }}
        </NText>
        <NAlert v-if="mcporterEnabled" type="success" style="margin-top: 8px;">
          {{ t('mcp.enabledMsg') }}
        </NAlert>
        <NAlert v-else type="info" style="margin-top: 8px;">
          {{ t('mcp.disabledMsg') }}
        </NAlert>
      </NCard>

      <!-- Server Catalog -->
      <NCard :title="t('mcp.servers')" size="small">
        <!-- Search -->
        <template #header-extra>
          <NInput
            v-model:value="searchQuery"
            :placeholder="t('common.search')"
            clearable
            size="small"
            style="width: 200px;"
          />
        </template>

        <!-- Category tabs -->
        <div class="mcp-category-tabs">
          <NButton
            v-for="tab in categoryTabs"
            :key="tab.id ?? '__all__'"
            :type="activeCategory === tab.id ? 'primary' : 'default'"
            :secondary="activeCategory === tab.id"
            :quaternary="activeCategory !== tab.id"
            size="tiny"
            @click="activeCategory = tab.id"
          >
            {{ tab.icon }} {{ tab.label }}
          </NButton>
        </div>

        <!-- Server grid -->
        <NGrid :cols="3" :x-gap="10" :y-gap="10" style="margin-top: 10px;">
          <NGi v-for="server in filteredServers" :key="server.id">
            <NCard size="small" style="height: 100%;" hoverable>
              <NSpace vertical :size="6">
                <NSpace justify="space-between" align="center">
                  <NText strong>{{ getName(server) }}</NText>
                  <NSpace :size="4">
                    <NTag v-if="server.official" size="tiny" type="success">Official</NTag>
                    <NTag v-if="isInstalled(server.id)" size="tiny" type="info">{{ t('mcp.installed') }}</NTag>
                  </NSpace>
                </NSpace>
                <NText depth="2" style="font-size: 12px;">
                  {{ getDesc(server) }}
                </NText>
                <NSpace align="center" :size="6">
                  <NTag size="tiny" type="info">{{ getCategoryLabel(server.category) }}</NTag>
                  <NTooltip>
                    <template #trigger>
                      <NText code style="font-size: 10px; cursor: help;">
                        {{ server.npmPackage }}
                      </NText>
                    </template>
                    npx -y {{ server.npmPackage }}
                  </NTooltip>
                </NSpace>

                <!-- Action buttons -->
                <NSpace :size="6" style="margin-top: 4px;">
                  <template v-if="isInstalled(server.id)">
                    <NPopconfirm @positive-click="removeServer(server)">
                      <template #trigger>
                        <NButton size="tiny" type="error" secondary :loading="saving">
                          {{ t('common.remove') }}
                        </NButton>
                      </template>
                      {{ t('mcp.removeConfirm', { name: getName(server) }) }}
                    </NPopconfirm>
                  </template>
                  <template v-else>
                    <NButton
                      size="tiny"
                      type="primary"
                      :loading="saving"
                      @click="addServer(server)"
                    >
                      {{ t('common.add') }}
                    </NButton>
                    <NButton
                      size="tiny"
                      quaternary
                      @click="toggleEnvInput(server.id)"
                    >
                      {{ t('mcp.envVars') }}
                    </NButton>
                  </template>
                </NSpace>

                <!-- Env var input (expandable) -->
                <div v-if="expandedEnv === server.id" style="margin-top: 4px;">
                  <NInput
                    v-model:value="envInput"
                    type="textarea"
                    :rows="2"
                    :placeholder="t('mcp.envVarsHint')"
                    style="font-size: 11px;"
                  />
                </div>
              </NSpace>
            </NCard>
          </NGi>
        </NGrid>

        <NText v-if="filteredServers.length === 0" depth="3" style="display: block; text-align: center; padding: 24px; font-size: 12px;">
          {{ t('common.noData') }}
        </NText>
      </NCard>
    </NSpin>
  </div>
</template>

<style scoped>
.mcp-view {
  padding: 16px;
}
.mcp-category-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
</style>
