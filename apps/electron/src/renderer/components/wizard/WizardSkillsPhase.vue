<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NButton, NSpace, NText, NTag, NDivider, NEmpty,
  NModal, NCard, NBadge, NSpin
} from 'naive-ui'
import { useWizardStore } from '@renderer/stores/wizard'
import { SKILL_CATEGORIES, getSkillsByCategory, getRoleCategories, getGeneralCategories } from '@renderer/data/skills-catalog'
import MarkdownRenderer from '@renderer/components/common/MarkdownRenderer.vue'

const { t, locale } = useI18n()
const store = useWizardStore()

const roleCategories = getRoleCategories()
const generalCategories = getGeneralCategories()

const categorySkills = computed(() => {
  return getSkillsByCategory(store.skillsActiveCategory)
})

const activeCategoryLabel = computed(() => {
  const cat = SKILL_CATEGORIES.find(c => c.id === store.skillsActiveCategory)
  if (!cat) return ''
  return locale.value.startsWith('zh') ? cat.label.zh : cat.label.en
})

function isSelected(skillId: string): boolean {
  return store.skillsSelectedIds.has(skillId)
}

function localizedLabel(cat: { label: { zh: string; en: string } }): string {
  return locale.value.startsWith('zh') ? cat.label.zh : cat.label.en
}

function localizedName(skill: { name: { zh: string; en: string } }): string {
  return locale.value.startsWith('zh') ? skill.name.zh : skill.name.en
}

function localizedDesc(skill: { description: { zh: string; en: string } }): string {
  return locale.value.startsWith('zh') ? skill.description.zh : skill.description.en
}

function handleInstall() {
  store.installSelectedSkills()
}

function getCategorySkillCount(catId: string): number {
  return getSkillsByCategory(catId).length
}

const showPreview = computed({
  get: () => store.skillsPreviewContent !== null,
  set: (v: boolean) => { if (!v) { store.skillsPreviewId = null; store.skillsPreviewContent = null } },
})
</script>

<template>
  <div class="skills-setup">
    <h3 class="step-title">{{ t('wizard.skillsTitle') }}</h3>
    <NText depth="2" style="display: block; margin-bottom: 16px;">{{ t('wizard.skillsDesc') }}</NText>

    <div class="skills-browser">
      <!-- Left panel: categories -->
      <div class="skills-categories">
        <NText depth="3" style="font-size: 11px; text-transform: uppercase; letter-spacing: 1px; display: block; margin-bottom: 8px;">
          {{ t('wizard.skillsRoles') }}
        </NText>
        <div
          v-for="cat in roleCategories"
          :key="cat.id"
          class="category-item"
          :class="{ 'category-item--active': store.skillsActiveCategory === cat.id }"
          @click="store.setActiveCategory(cat.id)"
        >
          <span class="category-icon">{{ cat.icon }}</span>
          <span class="category-label">{{ localizedLabel(cat) }}</span>
          <span class="category-count">{{ getCategorySkillCount(cat.id) }}</span>
        </div>

        <NDivider style="margin: 12px 0;" />

        <NText depth="3" style="font-size: 11px; text-transform: uppercase; letter-spacing: 1px; display: block; margin-bottom: 8px;">
          {{ t('wizard.skillsGeneral') }}
        </NText>
        <div
          v-for="cat in generalCategories"
          :key="cat.id"
          class="category-item"
          :class="{ 'category-item--active': store.skillsActiveCategory === cat.id }"
          @click="store.setActiveCategory(cat.id)"
        >
          <span class="category-icon">{{ cat.icon }}</span>
          <span class="category-label">{{ localizedLabel(cat) }}</span>
          <span class="category-count">{{ getCategorySkillCount(cat.id) }}</span>
        </div>
      </div>

      <!-- Right panel: skills in selected category -->
      <div class="skills-list">
        <div class="skills-list-header">
          <NText strong>{{ activeCategoryLabel }}</NText>
          <NText depth="3" style="font-size: 12px;">{{ categorySkills.length }} skills</NText>
        </div>

        <div class="skills-list-body">
          <div
            v-for="skill in categorySkills"
            :key="skill.id"
            class="skill-card"
            :class="{ 'skill-card--selected': isSelected(skill.id) }"
          >
            <div class="skill-info">
              <div class="skill-name-row">
                <NText strong style="font-size: 13px;">{{ localizedName(skill) }}</NText>
                <NTag size="tiny" :bordered="false" :type="skill.source === 'builtin' ? 'success' : 'info'">
                  {{ skill.source === 'builtin' ? t('wizard.skillsBuiltIn') : t('wizard.skillsClawHub') }}
                </NTag>
              </div>
              <NText depth="3" style="font-size: 12px; line-height: 1.4;">{{ localizedDesc(skill) }}</NText>
            </div>
            <div class="skill-actions">
              <NButton size="tiny" quaternary @click.stop="store.previewSkillReadme(skill.id)">
                {{ t('wizard.skillsPreview') }}
              </NButton>
              <NButton
                size="small"
                :type="isSelected(skill.id) ? 'default' : 'primary'"
                :ghost="!isSelected(skill.id)"
                @click.stop="store.toggleSkillSelection(skill.id)"
              >
                {{ isSelected(skill.id) ? t('wizard.skillsAdded') : t('wizard.skillsAdd') }}
              </NButton>
            </div>
          </div>

          <NEmpty v-if="categorySkills.length === 0" :description="t('wizard.skillsNone')" style="padding: 40px 0;" />
        </div>
      </div>
    </div>

    <!-- Bottom bar -->
    <div class="skills-bottom-bar">
      <NBadge :value="store.skillsSelectedIds.size" :max="99" :offset="[-4, 0]">
        <NText style="font-size: 14px;">{{ t('wizard.skillsSelected', { count: store.skillsSelectedIds.size }) }}</NText>
      </NBadge>
      <NButton
        type="primary"
        size="large"
        :loading="store.skillsInstalling"
        :disabled="store.skillsInstalling"
        @click="handleInstall"
      >
        {{ store.skillsInstalling
          ? t('wizard.skillsInstalling', { current: store.skillsInstallProgress.current, total: store.skillsInstallProgress.total })
          : store.skillsSelectedIds.size > 0
            ? t('wizard.skillsInstall') + ` (${store.skillsSelectedIds.size})`
            : t('wizard.skillsSkip')
        }}
      </NButton>
    </div>

    <!-- Footer: skip -->
    <div class="step-footer">
      <span />
      <NButton text size="small" depth="3" @click="store.skipSkillsSetup()">
        {{ t('wizard.skillsSkip') }}
      </NButton>
    </div>

    <!-- SKILL.md preview modal -->
    <NModal v-model:show="showPreview">
      <NCard style="max-width: 600px; max-height: 80vh; overflow-y: auto;" :bordered="false">
        <MarkdownRenderer :content="store.skillsPreviewContent ?? ''" />
      </NCard>
    </NModal>
  </div>
</template>

<style scoped>
.skills-setup {
  display: flex;
  flex-direction: column;
}

.skills-browser {
  display: flex;
  gap: 16px;
  min-height: 420px;
  max-height: 500px;
  border: 1px solid var(--border-color, rgba(255, 255, 255, 0.09));
  border-radius: 8px;
  overflow: hidden;
}

.skills-categories {
  width: 190px;
  flex-shrink: 0;
  overflow-y: auto;
  padding: 12px;
  border-right: 1px solid var(--border-color, rgba(255, 255, 255, 0.09));
  background: var(--card-color, rgba(255, 255, 255, 0.02));
}

.category-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  transition: background 0.15s, border-color 0.15s;
  border-left: 3px solid transparent;
  margin-bottom: 2px;
}

.category-item:hover {
  background: rgba(24, 160, 88, 0.08);
}

.category-item--active {
  background: rgba(24, 160, 88, 0.12);
  border-left-color: #18a058;
}

.category-icon {
  font-size: 14px;
  flex-shrink: 0;
}

.category-label {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.category-count {
  font-size: 11px;
  opacity: 0.5;
  flex-shrink: 0;
}

.skills-list {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.skills-list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 14px;
  border-bottom: 1px solid var(--border-color, rgba(255, 255, 255, 0.09));
  flex-shrink: 0;
}

.skills-list-body {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.skill-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 6px;
  margin-bottom: 4px;
  transition: background 0.15s;
}

.skill-card:hover {
  background: rgba(255, 255, 255, 0.04);
}

.skill-card--selected {
  background: rgba(24, 160, 88, 0.06);
}

.skill-info {
  flex: 1;
  min-width: 0;
}

.skill-name-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 2px;
}

.skill-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.skills-bottom-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 0 0;
  margin-top: 12px;
  border-top: 1px solid var(--border-color, rgba(255, 255, 255, 0.09));
}

.step-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 12px;
}
</style>
