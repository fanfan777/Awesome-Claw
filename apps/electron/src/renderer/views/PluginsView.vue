<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NCard, NButton, NSpace, NSpin, NEmpty, NText, NSwitch, NTag, NGrid, NGi
} from 'naive-ui'
import { useConfigStore } from '@renderer/stores/config'
import { useConnectionStore } from '@renderer/gateway/connection'

const { t } = useI18n()
const configStore = useConfigStore()
const conn = useConnectionStore()

interface PluginEntry {
  id: string
  name?: string
  enabled?: boolean
  version?: string
  description?: string
}

const plugins = computed<PluginEntry[]>(() => {
  const raw = configStore.config['plugins']
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return []
  return Object.entries(raw as Record<string, unknown>).map(([id, val]) => {
    const v = (val as Record<string, unknown>) ?? {}
    return {
      id,
      name: (v['name'] as string) ?? id,
      enabled: (v['enabled'] as boolean) ?? false,
      version: (v['version'] as string) ?? undefined,
      description: (v['description'] as string) ?? undefined,
    }
  })
})

async function togglePlugin(id: string, enabled: boolean) {
  await configStore.patchConfig(`plugins.${id}.enabled`, enabled)
  await configStore.fetchConfig()
}

onMounted(() => { if (conn.isConnected) configStore.fetchConfig() })
</script>

<template>
  <div class="plugins-view">
    <NSpace justify="space-between" align="center" style="margin-bottom:16px;">
      <NText strong style="font-size:16px;">{{ t('nav.plugins') }}</NText>
      <NButton size="small" secondary :loading="configStore.loading" @click="configStore.fetchConfig()">
        {{ t('common.refresh') }}
      </NButton>
    </NSpace>

    <NSpin :show="configStore.loading">
      <NEmpty v-if="!plugins.length && !configStore.loading" :description="t('common.noData')" />
      <NGrid v-else :cols="3" :x-gap="12" :y-gap="12">
        <NGi v-for="plugin in plugins" :key="plugin.id">
          <NCard size="small">
            <NSpace vertical :size="8">
              <NSpace justify="space-between" align="center">
                <NText strong>{{ plugin.name ?? plugin.id }}</NText>
                <NSwitch
                  :value="plugin.enabled ?? false"
                  size="small"
                  @update:value="togglePlugin(plugin.id, $event)"
                />
              </NSpace>
              <NText v-if="plugin.description" depth="2" style="font-size:12px;">
                {{ plugin.description }}
              </NText>
              <NTag v-if="plugin.version" size="tiny" type="default">
                v{{ plugin.version }}
              </NTag>
            </NSpace>
          </NCard>
        </NGi>
      </NGrid>
    </NSpin>
  </div>
</template>

<style scoped>
.plugins-view { padding: 16px; }
</style>
