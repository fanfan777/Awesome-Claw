<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NCard, NButton, NSpace, NSpin, NText, NSwitch, NSelect, NInput,
  NFormItem, NForm, NAlert, NInputNumber
} from 'naive-ui'
import { useConfigStore } from '@renderer/stores/config'
import { useConnectionStore } from '@renderer/gateway/connection'

const { t } = useI18n()
const configStore = useConfigStore()
const conn = useConnectionStore()

const loading = ref(false)
const saving = ref(false)
const saveSuccess = ref(false)
const saveError = ref<string | null>(null)

/* ---------- Web Search Providers ---------- */
const SEARCH_PROVIDERS = [
  { label: 'Brave Search', value: 'brave', keyHint: 'BSA-xxxx', freeQuota: '2000/mo', url: 'https://api.search.brave.com/' },
  { label: 'Google Gemini', value: 'gemini', keyHint: 'AIza...', freeQuota: '1500/day', url: 'https://aistudio.google.com/apikey' },
  { label: 'Perplexity', value: 'perplexity', keyHint: 'pplx-...', freeQuota: '', url: 'https://www.perplexity.ai/settings/api' },
  { label: 'Grok (xAI)', value: 'grok', keyHint: 'xai-...', freeQuota: '', url: 'https://console.x.ai/' },
  { label: 'Kimi (Moonshot)', value: 'kimi', keyHint: 'sk-...', freeQuota: '', url: 'https://platform.moonshot.cn/console/api-keys' },
  { label: 'Tavily', value: 'tavily', keyHint: 'tvly-...', freeQuota: '1000/mo', url: 'https://tavily.com/' },
  { label: 'Serper (Google)', value: 'serper', keyHint: '', freeQuota: '2500/mo', url: 'https://serper.dev/' },
]

/* ---------- Local form state (all refs, no auto-save) ---------- */
const searchEnabled = ref(true)
const searchProvider = ref('')
const searchApiKey = ref('')
const searchMaxResults = ref(5)
const fetchEnabled = ref(true)

const selectedProviderInfo = computed(() =>
  SEARCH_PROVIDERS.find(p => p.value === searchProvider.value)
)

/* ---------- Dirty tracking ---------- */
function getConfigVal(path: string): unknown {
  return configStore.getValueByPath(path)
}

function providerKeyPath(provider: string): string {
  if (provider === 'brave') return 'tools.web.search.apiKey'
  return `tools.web.search.${provider}.apiKey`
}

const isDirty = computed(() => {
  const origEnabled = (getConfigVal('tools.web.search.enabled') as boolean) !== false
  const origProvider = (getConfigVal('tools.web.search.provider') as string) ?? ''
  const origMaxResults = (getConfigVal('tools.web.search.maxResults') as number) ?? 5
  const origFetchEnabled = (getConfigVal('tools.web.fetch.enabled') as boolean) !== false

  // API key: compare against stored value for current provider
  let origApiKey = ''
  if (searchProvider.value) {
    const path = providerKeyPath(searchProvider.value)
    origApiKey = (getConfigVal(path) as string) ?? ''
  }

  return (
    searchEnabled.value !== origEnabled ||
    searchProvider.value !== origProvider ||
    searchMaxResults.value !== origMaxResults ||
    fetchEnabled.value !== origFetchEnabled ||
    searchApiKey.value !== origApiKey
  )
})

/* ---------- Load from config ---------- */
function loadFromConfig() {
  searchEnabled.value = (getConfigVal('tools.web.search.enabled') as boolean) !== false
  searchProvider.value = (getConfigVal('tools.web.search.provider') as string) ?? ''
  searchMaxResults.value = (getConfigVal('tools.web.search.maxResults') as number) ?? 5
  fetchEnabled.value = (getConfigVal('tools.web.fetch.enabled') as boolean) !== false

  if (searchProvider.value) {
    const path = providerKeyPath(searchProvider.value)
    searchApiKey.value = (getConfigVal(path) as string) ?? ''
  } else {
    searchApiKey.value = ''
  }
}

/* When provider changes, load its API key from config */
watch(searchProvider, (newProvider) => {
  if (newProvider) {
    const path = providerKeyPath(newProvider)
    searchApiKey.value = (getConfigVal(path) as string) ?? ''
  } else {
    searchApiKey.value = ''
  }
})

/* ---------- Unified save ---------- */
async function saveAll() {
  saving.value = true
  saveError.value = null
  saveSuccess.value = false

  try {
    // Refresh config first to get latest baseHash (required by gateway)
    await configStore.fetchConfig()
    // Build one merged patch object
    const patch: Record<string, unknown> = {
      tools: {
        web: {
          search: {
            enabled: searchEnabled.value,
            provider: searchProvider.value || undefined,
            maxResults: searchMaxResults.value,
          },
          fetch: {
            enabled: fetchEnabled.value,
          },
        },
      },
    }

    // Add API key to the correct path
    if (searchProvider.value && searchApiKey.value) {
      const searchPatch = (patch.tools as Record<string, unknown>).web as Record<string, unknown>
      const searchConfig = (searchPatch as Record<string, unknown>).search as Record<string, unknown>
      if (searchProvider.value === 'brave') {
        searchConfig.apiKey = searchApiKey.value
      } else {
        searchConfig[searchProvider.value] = { apiKey: searchApiKey.value }
      }
    }

    const ok = await configStore.patchConfig('tools', (patch as Record<string, unknown>).tools)
    if (ok) {
      saveSuccess.value = true
      setTimeout(() => { saveSuccess.value = false }, 2000)
    } else {
      saveError.value = configStore.error ?? t('common.saveFailed')
    }
  } catch (e) {
    saveError.value = e instanceof Error ? e.message : t('common.saveFailed')
  } finally {
    saving.value = false
  }
}

/* ---------- Init ---------- */
onMounted(async () => {
  if (!conn.isConnected) return
  loading.value = true
  await Promise.all([
    configStore.fetchConfig(),
  ])
  loadFromConfig()
  loading.value = false
})
</script>

<template>
  <div class="tools-view">
    <NSpace justify="space-between" align="center" style="margin-bottom: 12px;">
      <NText strong style="font-size: 16px;">{{ t('tools.title') }}</NText>
      <NSpace :size="8">
        <NButton
          type="primary"
          size="small"
          :loading="saving"
          :disabled="!isDirty"
          @click="saveAll"
        >
          {{ t('common.save') }}
        </NButton>
        <NButton size="small" secondary :loading="loading" @click="async () => { loading = true; await configStore.fetchConfig(); loadFromConfig(); loading = false; }">
          {{ t('common.refresh') }}
        </NButton>
      </NSpace>
    </NSpace>

    <NAlert v-if="saveSuccess" type="success" closable style="margin-bottom: 8px;">
      {{ t('common.success') }}
    </NAlert>
    <NAlert v-if="saveError" type="error" closable style="margin-bottom: 8px;" @close="saveError = null">
      {{ saveError }}
    </NAlert>

    <NSpin :show="loading">
      <!-- Web Search -->
      <NCard :title="t('tools.webSearchTitle')" size="small" style="margin-bottom: 12px;">
        <NForm label-placement="left" label-width="120" size="small">
          <NFormItem :label="t('common.enabled')">
            <NSwitch v-model:value="searchEnabled" />
          </NFormItem>

          <NFormItem :label="t('tools.searchProvider')">
            <NSelect
              v-model:value="searchProvider"
              :options="SEARCH_PROVIDERS.map(p => ({ label: `${p.label}${p.freeQuota ? ` (${t('tools.freeQuota')}: ${p.freeQuota})` : ''}`, value: p.value }))"
              style="width: 360px;"
              clearable
              :placeholder="t('tools.selectProvider')"
            />
          </NFormItem>

          <template v-if="searchProvider">
            <NFormItem label="API Key">
              <NInput
                v-model:value="searchApiKey"
                type="password"
                show-password-on="click"
                :placeholder="selectedProviderInfo?.keyHint ?? 'API Key'"
                style="width: 360px;"
              />
            </NFormItem>

            <NFormItem :label="t('tools.maxResults')">
              <NInputNumber
                v-model:value="searchMaxResults"
                :min="1"
                :max="10"
                style="width: 120px;"
              />
            </NFormItem>
          </template>
        </NForm>

        <NAlert v-if="selectedProviderInfo" type="info" style="margin-top: 8px;">
          <NText>
            {{ t('tools.getApiKey') }}
            <a :href="selectedProviderInfo.url" target="_blank" style="color: var(--n-text-color);">
              {{ selectedProviderInfo.url }}
            </a>
          </NText>
        </NAlert>

        <NAlert v-if="!searchProvider" type="warning" style="margin-top: 8px;">
          {{ t('tools.noSearchProvider') }}
        </NAlert>
      </NCard>

      <!-- Web Fetch -->
      <NCard :title="t('tools.webFetchTitle')" size="small" style="margin-bottom: 12px;">
        <NForm label-placement="left" label-width="120" size="small">
          <NFormItem :label="t('common.enabled')">
            <NSwitch v-model:value="fetchEnabled" />
          </NFormItem>
        </NForm>
        <NText depth="3" style="font-size: 12px;">
          {{ t('tools.webFetchHint') }}
        </NText>
      </NCard>

      <!-- Dirty indicator -->
      <NAlert v-if="isDirty" type="warning" style="margin-top: 8px;">
        {{ t('tools.unsavedChanges') }}
      </NAlert>
    </NSpin>
  </div>
</template>

<style scoped>
.tools-view {
  padding: 16px;
}
</style>
