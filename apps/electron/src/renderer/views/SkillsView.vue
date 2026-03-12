<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NGrid, NGi, NCard, NButton, NSpace, NSpin, NEmpty, NText, NSwitch, NTag,
  NInput, NSelect, NCollapse, NCollapseItem, NTooltip, NPopconfirm, NAlert
} from 'naive-ui'
import type { SelectOption } from 'naive-ui'
import { useSkillsStore, type SkillStatus } from '@renderer/stores/skills'
import { useConnectionStore } from '@renderer/gateway/connection'

const { t, locale } = useI18n()
const store = useSkillsStore()
const conn = useConnectionStore()

/* ---------- State ---------- */
const statusFilter = ref<string | null>(null)
const apiKeyInputs = ref<Record<string, string>>({})
const activeCategoryId = ref<string | null>(null)

/* ---------- Filter options ---------- */
const statusFilterOptions = computed<SelectOption[]>(() => [
  { label: t('common.all'), value: '' },
  { label: t('skills.enabled'), value: 'enabled' },
  { label: t('skills.available'), value: 'available' },
  { label: t('skills.incompatible'), value: 'incompatible' },
])

/* ---------- Computed ---------- */
const lang = computed(() => locale.value.startsWith('zh') ? 'zh' : 'en')

const filteredCategoryGroups = computed(() => {
  let groups = store.groupedByCategory
  // Filter by active category tab
  if (activeCategoryId.value) {
    groups = groups.filter(g => g.category.id === activeCategoryId.value)
  }
  // Filter by status
  if (!statusFilter.value) return groups
  return groups.map(g => ({
    ...g,
    skills: g.skills.filter((s) => {
      if (statusFilter.value === 'enabled') return s.enabled
      if (statusFilter.value === 'available') return s.installed && !s.incompatible
      if (statusFilter.value === 'incompatible') return s.incompatible
      return true
    }),
  })).filter(g => g.skills.length > 0)
})

const hasAnySkills = computed(() =>
  filteredCategoryGroups.value.some(g => g.skills.length > 0),
)

const categoryTabs = computed(() => {
  return [
    { id: null, label: t('common.all'), icon: '📋' },
    ...store.groupedByCategory.map(g => ({
      id: g.category.id,
      label: g.category.label[lang.value],
      icon: g.category.icon,
    })),
  ]
})

const sourceBadgeType: Record<string, 'success' | 'info' | 'warning' | 'default'> = {
  'built-in': 'default',
  managed: 'info',
  workspace: 'warning',
}

const sourceLabels = computed<Record<string, string>>(() => ({
  'built-in': t('skills.builtIn'),
  managed: t('skills.managed'),
  workspace: t('skills.workspace'),
  'openclaw-extra': t('skills.managed'),
}))

/* ---------- Actions ---------- */
async function handleToggle(skillId: string, enabled: boolean) {
  await store.toggleSkill(skillId, enabled)
}

async function handleInstall(skillId: string) {
  await store.install(skillId)
}

async function handleSaveApiKey(skillId: string) {
  const key = apiKeyInputs.value[skillId]
  if (key !== undefined) {
    await store.setApiKey(skillId, key)
    delete apiKeyInputs.value[skillId]
  }
}

async function handleClearApiKey(skillId: string) {
  await store.clearApiKey(skillId)
}

function getSkillDisplayName(skill: SkillStatus): string {
  const emoji = skill.emoji ? `${skill.emoji} ` : ''
  const catItem = store.skillCatalogMap[skill.id]
  const name = catItem ? catItem.name[lang.value] : (skill.name ?? skill.id)
  return `${emoji}${name}`
}

function getSkillDescription(skill: SkillStatus): string {
  const catItem = store.skillCatalogMap[skill.id]
  return catItem ? catItem.description[lang.value] : (skill.description ?? '')
}

onMounted(() => {
  if (conn.isConnected) {
    store.fetchStatus()
  } else {
    store.loadCatalogFallback()
  }
})
</script>

<template>
  <div class="skills-view">
    <NAlert v-if="store.error" type="error" closable style="margin-bottom:12px;" @close="store.error = null">
      {{ store.error }}
    </NAlert>
    <NSpace justify="space-between" align="center" style="margin-bottom:16px;">
      <NSpace align="center" :size="12">
        <NText strong style="font-size:16px;">{{ t('skills.title') }}</NText>
        <NTag size="small" round>{{ store.enabledCount }} {{ t('skills.enabled') }}</NTag>
        <NTag v-if="store.incompatibleCount" size="small" round type="warning">
          {{ store.incompatibleCount }} {{ t('skills.incompatible') }}
        </NTag>
      </NSpace>
      <NButton size="small" secondary :loading="store.loading" @click="store.fetchStatus()">
        {{ t('common.refresh') }}
      </NButton>
    </NSpace>

    <!-- Category tabs -->
    <div class="category-tabs">
      <NButton
        v-for="tab in categoryTabs"
        :key="tab.id ?? '__all__'"
        :type="activeCategoryId === tab.id ? 'primary' : 'default'"
        :secondary="activeCategoryId === tab.id"
        :quaternary="activeCategoryId !== tab.id"
        size="small"
        @click="activeCategoryId = tab.id"
      >
        {{ tab.icon }} {{ tab.label }}
      </NButton>
    </div>

    <!-- Search and Filter -->
    <NSpace style="margin-bottom:12px;" :size="8" align="center">
      <NInput
        v-model:value="store.searchQuery"
        :placeholder="t('common.search')"
        clearable
        size="small"
        style="width:220px;"
      />
      <NSelect
        v-model:value="statusFilter"
        :options="statusFilterOptions"
        size="small"
        style="width:150px;"
        :placeholder="t('common.status')"
        clearable
      />
    </NSpace>

    <NSpin :show="store.loading">
      <NEmpty v-if="!hasAnySkills && !store.loading" :description="t('skills.noSkills')" />

      <NSpace v-else vertical :size="20">
        <template v-for="group in filteredCategoryGroups" :key="group.category.id">
          <div v-if="group.skills.length">
            <NText strong depth="2" style="display:block;margin-bottom:8px;font-size:13px;">
              {{ group.category.icon }} {{ group.category.label[lang] }} ({{ group.skills.length }})
            </NText>

            <NGrid :cols="3" :x-gap="12" :y-gap="12">
              <NGi v-for="skill in group.skills" :key="skill.id">
                <NCard size="small" :class="{ 'skill-incompatible': skill.incompatible }">
                  <NSpace vertical :size="8">
                    <!-- Header: name + toggle -->
                    <NSpace justify="space-between" align="center">
                      <NText strong>{{ getSkillDisplayName(skill) }}</NText>
                      <NSwitch
                        :value="skill.enabled ?? false"
                        size="small"
                        :disabled="skill.incompatible || false"
                        @update:value="handleToggle(skill.id, $event)"
                      />
                    </NSpace>

                    <!-- Description -->
                    <NText v-if="getSkillDescription(skill)" depth="2" style="font-size:12px;">
                      {{ getSkillDescription(skill) }}
                    </NText>

                    <!-- Source badge + status -->
                    <NSpace align="center" :size="6" wrap>
                      <NTag size="tiny" :type="sourceBadgeType[skill.source ?? 'built-in'] ?? 'default'">
                        {{ sourceLabels[skill.source ?? 'built-in'] ?? skill.source }}
                      </NTag>
                      <NTag size="tiny" :type="skill.installed ? 'success' : 'default'">
                        {{ skill.installed ? t('common.enabled') : t('common.disabled') }}
                      </NTag>
                      <NText v-if="skill.version" depth="3" style="font-size:11px;">
                        v{{ skill.version }}
                      </NText>
                    </NSpace>

                    <!-- Missing deps warning -->
                    <NSpace v-if="skill.missingDeps && skill.missingDeps.length" align="center" :size="4">
                      <NTag size="tiny" type="warning">{{ t('skills.needsDeps') }}</NTag>
                      <NText depth="3" style="font-size:11px;">
                        {{ skill.missingDeps.join(', ') }}
                      </NText>
                    </NSpace>

                    <!-- Incompatible OS warning -->
                    <NTag v-if="skill.incompatible" size="tiny" type="error">
                      {{ t('skills.incompatible') }}{{ skill.os ? ` (${skill.os.join('/')})` : '' }}
                    </NTag>

                    <!-- Dependency requirements -->
                    <NText v-if="skill.deps && skill.deps.length" depth="3" style="font-size:11px;">
                      {{ t('skills.deps') }}: {{ skill.deps.join(', ') }}
                    </NText>

                    <!-- API Key section -->
                    <template v-if="skill.apiKeyRequired">
                      <NSpace align="center" :size="4" style="margin-top:4px;">
                        <NTag size="tiny" :type="skill.apiKeySet ? 'success' : 'warning'">
                          {{ skill.apiKeySet ? t('skills.keySet') : t('skills.keyNeeded') }}
                        </NTag>
                      </NSpace>
                      <NSpace v-if="!skill.apiKeySet" :size="4" align="center">
                        <NInput
                          :value="apiKeyInputs[skill.id] ?? ''"
                          @update:value="(v: string) => { apiKeyInputs[skill.id] = v }"
                          size="tiny"
                          type="password"
                          show-password-on="click"
                          :placeholder="t('skills.apiKey')"
                          style="width:180px;"
                        />
                        <NButton
                          size="tiny"
                          type="primary"
                          :disabled="!apiKeyInputs[skill.id]"
                          @click="handleSaveApiKey(skill.id)"
                        >
                          {{ t('common.save') }}
                        </NButton>
                      </NSpace>
                      <NButton
                        v-if="skill.apiKeySet"
                        size="tiny"
                        type="warning"
                        ghost
                        @click="handleClearApiKey(skill.id)"
                      >
                        {{ t('skills.clearKey') }}
                      </NButton>
                    </template>

                    <!-- Actions -->
                    <NSpace size="small" style="margin-top:4px;">
                      <NTooltip v-if="!skill.installed && skill.id.startsWith('clawhub:')">
                        <template #trigger>
                          <NButton
                            size="tiny"
                            type="primary"
                            :loading="store.installing === skill.id"
                            @click="handleInstall(skill.id)"
                          >
                            {{ t('skills.install') }}
                          </NButton>
                        </template>
                        clawhub install {{ skill.id.replace(/^clawhub:/, '') }}
                      </NTooltip>
                      <NButton
                        v-else-if="!skill.installed"
                        size="tiny"
                        type="primary"
                        :loading="store.installing === skill.id"
                        @click="handleInstall(skill.id)"
                      >
                        {{ t('skills.install') }}
                      </NButton>
                      <NTooltip v-if="skill.missingDeps && skill.missingDeps.length">
                        <template #trigger>
                          <NButton
                            size="tiny"
                            secondary
                            :loading="store.installing === skill.id"
                            @click="handleInstall(skill.id)"
                          >
                            {{ t('skills.installDeps') }}
                          </NButton>
                        </template>
                        {{ t('skills.installDeps') }}: {{ skill.missingDeps.join(', ') }}
                      </NTooltip>
                    </NSpace>
                  </NSpace>
                </NCard>
              </NGi>
            </NGrid>
          </div>
        </template>
      </NSpace>
    </NSpin>
  </div>
</template>

<style scoped>
.skills-view { padding: 16px; }
.skill-incompatible { opacity: 0.6; }
.category-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 12px;
}
</style>
