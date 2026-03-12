<script setup lang="ts">
import { ref, onMounted, computed, h } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NGrid, NGi, NCard, NButton, NSpace, NInput, NText, NSpin, NEmpty,
  NModal, NForm, NFormItem, NTag, NDataTable, NSelect, NPopconfirm, NAlert
} from 'naive-ui'
import type { DataTableColumns, SelectOption } from 'naive-ui'
import { useModelsStore, type ProviderConfig, type ModelInfo } from '@renderer/stores/models'
import { useConnectionStore } from '@renderer/gateway/connection'
import { useGatewayRpc } from '@renderer/composables/useGatewayRpc'

const { t } = useI18n()
const store = useModelsStore()
const conn = useConnectionStore()

const addProviderOpen = ref(false)
const testingProvider = ref<string | null>(null)

const providerForm = ref<ProviderConfig>({
  id: '',
  type: '',
  name: '',
  apiKey: '',
  baseUrl: '',
  enabled: true,
})

const testRpc = useGatewayRpc<{ ok: boolean; error?: string }>('models.test')

/* ---------- Primary model ---------- */
const modelSelectOptions = computed<SelectOption[]>(() =>
  store.models.map(m => {
    // Gateway expects provider/model format (e.g. "openai/gpt-4o-mini")
    const fullId = m.provider ? `${m.provider}/${m.id}` : m.id
    return { label: `${m.name ?? m.id} (${m.provider ?? '?'})`, value: fullId }
  })
)

async function handleSetPrimary(modelId: string) {
  if (!modelId) return
  const ok = await store.setPrimaryModel(modelId)
  if (ok) console.log('[models] primary model set to:', modelId)
}

/* ---------- Provider presets ---------- */
interface ProviderPreset {
  id: string;
  label: string;
  type: string;
  baseUrl: string;
}

const providerPresets: ProviderPreset[] = [
  { id: 'openai', label: 'OpenAI', type: 'openai', baseUrl: 'https://api.openai.com/v1' },
  { id: 'anthropic', label: 'Anthropic', type: 'anthropic', baseUrl: 'https://api.anthropic.com' },
  { id: 'google', label: 'Google', type: 'google', baseUrl: 'https://generativelanguage.googleapis.com' },
  { id: 'deepseek', label: 'DeepSeek', type: 'openai', baseUrl: 'https://api.deepseek.com/v1' },
  { id: 'qwen', label: 'Qwen (通义千问)', type: 'openai', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1' },
  { id: 'moonshot', label: 'Moonshot (月之暗面)', type: 'openai', baseUrl: 'https://api.moonshot.cn/v1' },
  { id: 'zhipu', label: 'Zhipu (智谱)', type: 'openai', baseUrl: 'https://open.bigmodel.cn/api/paas/v4' },
  { id: 'yi', label: 'Yi (零一万物)', type: 'openai', baseUrl: 'https://api.lingyiwanwu.com/v1' },
  { id: 'minimax', label: 'MiniMax', type: 'openai', baseUrl: 'https://api.minimax.chat/v1' },
  { id: 'openrouter', label: 'OpenRouter', type: 'openai', baseUrl: 'https://openrouter.ai/api/v1' },
  { id: 'ollama', label: 'Ollama', type: 'openai', baseUrl: 'http://127.0.0.1:11434/v1' },
  { id: 'custom', label: '自定义 / Custom', type: 'openai', baseUrl: '' },
]

const presetOptions = computed<SelectOption[]>(() =>
  providerPresets.map(p => ({ label: p.label, value: p.id })),
)

function applyPreset(presetId: string) {
  const preset = providerPresets.find(p => p.id === presetId)
  if (!preset) return
  providerForm.value.id = preset.id
  providerForm.value.type = preset.type
  providerForm.value.name = preset.label
  providerForm.value.baseUrl = preset.baseUrl
}

function detectProviderType(key: string): string {
  if (key.startsWith('sk-ant-')) return 'anthropic'
  if (key.startsWith('sk-')) return 'openai'
  if (key.startsWith('AIza')) return 'google'
  return ''
}

function handleApiKeyChange(val: string) {
  providerForm.value.apiKey = val
  const detected = detectProviderType(val)
  if (detected && !providerForm.value.type) {
    providerForm.value.type = detected
    if (!providerForm.value.id) providerForm.value.id = detected
    if (!providerForm.value.name) providerForm.value.name = detected.charAt(0).toUpperCase() + detected.slice(1)
  }
}

async function handleAddProvider() {
  await store.addProvider({ ...providerForm.value })
  addProviderOpen.value = false
  providerForm.value = { id: '', type: '', name: '', apiKey: '', baseUrl: '', enabled: true }
  await store.fetchModels()
}

async function testProvider(id: string) {
  testingProvider.value = id
  await testRpc.execute({ providerId: id })
  testingProvider.value = null
}

const modelColumns = computed<DataTableColumns<ModelInfo>>(() => [
  { title: t('common.id'), key: 'id', ellipsis: true },
  { title: t('common.name'), key: 'name', ellipsis: true },
  { title: t('models.provider'), key: 'provider', width: 120 },
  {
    title: t('models.context'),
    key: 'contextLength',
    width: 100,
    render(row) { return row.contextLength ? `${(row.contextLength / 1000).toFixed(0)}k` : '—' }
  },
  {
    title: t('models.action'),
    key: 'action',
    width: 120,
    render(row) {
      const fullId = row.provider ? `${row.provider}/${row.id}` : row.id
      return h(NButton, {
        size: 'tiny',
        secondary: true,
        onClick: async () => {
          const ok = await store.setPrimaryModel(fullId)
          if (ok) console.log('[models] primary model set to:', fullId)
        }
      }, () => t('models.setPrimary'))
    }
  }
])

onMounted(async () => {
  // Always load primary model from config file (works without gateway)
  await store.loadPrimaryModelFromFile()
  if (!conn.isConnected) return
  await Promise.all([store.fetchModels(), store.fetchProviders()])
})
</script>

<template>
  <div class="models-view">
    <NSpace vertical :size="16">
      <NAlert v-if="store.error" type="error" closable @close="store.error = null">
        {{ store.error }}
      </NAlert>

      <NSpace justify="space-between" align="center">
        <NText strong style="font-size:16px;">{{ t('models.modelsAndProviders') }}</NText>
        <NButton type="primary" size="small" @click="addProviderOpen = true">{{ t('models.addProvider') }}</NButton>
      </NSpace>

      <!-- Primary model selector -->
      <NCard size="small">
        <NSpace align="center" :size="8">
          <NText strong style="font-size:13px;">{{ t('models.primaryModel') }}:</NText>
          <NSelect
            v-if="store.models.length"
            :value="store.primaryModel || undefined"
            :options="modelSelectOptions"
            size="small"
            filterable
            tag
            style="width:320px;"
            :placeholder="t('models.selectPrimaryModel')"
            @update:value="handleSetPrimary"
          />
          <NInput
            v-else
            :value="store.primaryModel"
            size="small"
            style="width:320px;"
            placeholder="openai/gpt-4o-mini"
            @update:value="(v: string) => { store.primaryModel = v }"
            @blur="handleSetPrimary(store.primaryModel)"
          />
          <NTag v-if="store.primaryModel" size="small" type="success">{{ store.primaryModel }}</NTag>
        </NSpace>
      </NCard>

      <NSpin :show="store.loading">
        <NGrid :cols="3" :x-gap="12" :y-gap="12">
          <NGi v-for="p in store.providers" :key="p.id">
            <NCard size="small">
              <NSpace vertical :size="4">
                <NSpace justify="space-between" align="center">
                  <NText strong>{{ p.name ?? p.id }}</NText>
                  <NSpace size="small">
                    <NButton
                      size="tiny"
                      secondary
                      :loading="testingProvider === p.id"
                      @click="testProvider(p.id)"
                    >
                      {{ t('common.test') }}
                    </NButton>
                    <NPopconfirm @positive-click="store.removeProvider(p.id)">
                      <template #trigger>
                        <NButton size="tiny" type="error" ghost>{{ t('common.remove') }}</NButton>
                      </template>
                      {{ t('models.removeConfirm', { name: p.name ?? p.id }) }}
                    </NPopconfirm>
                  </NSpace>
                </NSpace>
                <NTag size="tiny" :type="p.enabled ? 'success' : 'default'">
                  {{ p.type }}
                </NTag>
                <NText v-if="p.baseUrl" depth="3" style="font-size:11px;word-break:break-all;">
                  {{ p.baseUrl }}
                </NText>
              </NSpace>
            </NCard>
          </NGi>
          <NGi v-if="!store.providers.length">
            <NEmpty :description="t('models.noProviders')" />
          </NGi>
        </NGrid>
      </NSpin>

      <NCard :title="t('models.availableModels')" size="small">
        <NSpin :show="store.loading">
          <NEmpty v-if="!store.models.length" :description="t('models.noModelsAvailable')" />
          <NDataTable
            v-else
            :columns="modelColumns"
            :data="store.models"
            :pagination="{ pageSize: 20 }"
            size="small"
          />
        </NSpin>
      </NCard>
    </NSpace>

    <NModal v-model:show="addProviderOpen" preset="card" :title="t('models.addProvider')" style="width:520px;">
      <NAlert v-if="store.error" type="error" style="margin-bottom:12px;" closable @close="store.error = null">
        {{ store.error }}
      </NAlert>
      <NForm label-placement="top" :model="providerForm">
        <NFormItem :label="t('models.providerPreset')">
          <NSelect
            :options="presetOptions"
            :placeholder="t('models.selectPreset')"
            @update:value="applyPreset"
            clearable
          />
        </NFormItem>
        <NFormItem :label="t('models.apiKey')" required>
          <NInput
            :value="providerForm.apiKey"
            type="password"
            show-password-on="click"
            placeholder="sk-ant-… / sk-… / AIza…"
            @update:value="handleApiKeyChange"
          />
        </NFormItem>
        <NFormItem :label="t('models.baseUrl')" required>
          <NInput v-model:value="providerForm.baseUrl" placeholder="https://api.openai.com/v1" />
        </NFormItem>
        <NFormItem :label="t('models.providerId')">
          <NInput v-model:value="providerForm.id" placeholder="openai / deepseek / custom" />
        </NFormItem>
        <NFormItem :label="t('models.providerType')">
          <NSelect
            v-model:value="providerForm.type"
            :options="[
              { label: 'OpenAI (compatible)', value: 'openai' },
              { label: 'Anthropic', value: 'anthropic' },
              { label: 'Google', value: 'google' },
            ]"
            :placeholder="t('models.providerType')"
          />
        </NFormItem>
      </NForm>
      <template #footer>
        <NSpace justify="end">
          <NButton @click="addProviderOpen = false">{{ t('common.cancel') }}</NButton>
          <NButton type="primary" :disabled="!providerForm.apiKey || !providerForm.id || !providerForm.baseUrl" @click="handleAddProvider">
            {{ t('common.add') }}
          </NButton>
        </NSpace>
      </template>
    </NModal>
  </div>
</template>

<style scoped>
.models-view { padding: 16px; }
</style>
