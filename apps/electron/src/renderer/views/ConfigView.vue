<script setup lang="ts">
import { h, ref, computed, onMounted, watch, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NCard, NButton, NSpace, NSpin, NEmpty, NText, NInput, NTabs, NTabPane,
  NAlert, NDataTable, NTag, NMenu, NSwitch, NInputNumber, NSelect,
  NDynamicTags, NForm, NFormItem, NIcon, NCollapse, NCollapseItem,
  NBadge, NUpload, NTooltip, NScrollbar
} from 'naive-ui'
import type { DataTableColumns, MenuOption, UploadFileInfo } from 'naive-ui'
import {
  useConfigStore,
  type ConfigValue, type ConfigSchema, type ConfigEntry,
  isSensitiveKey, detectFieldType, CATEGORY_TAGS
} from '@renderer/stores/config'
import JsonEditor from '@renderer/components/common/JsonEditor.vue'
import { useConnectionStore } from '@renderer/gateway/connection'

const { t } = useI18n()
const conn = useConnectionStore()
const configStore = useConfigStore()

const activeTab = ref<'form' | 'table' | 'json'>('form')
const jsonText = ref('')
const jsonError = ref<string | null>(null)
const searchKey = ref('')
const saving = ref(false)
const activeSectionKey = ref<string | null>(null)
const activeTagFilter = ref<string | null>(null)
const importFileList = ref<UploadFileInfo[]>([])

// --- Form mode: section menu ---
const filteredSections = computed(() => {
  if (!activeTagFilter.value) return configStore.sections
  return configStore.sections.filter(s => s.tags.includes(activeTagFilter.value!))
})

function fieldLabel(field: { key: string; label: string }): string {
  const i18nKey = `config.fieldNames.${field.key}`
  const translated = t(i18nKey)
  return translated !== i18nKey ? translated : field.label
}

function sectionLabel(s: { key: string; title: string }): string {
  const i18nKey = `config.sectionNames.${s.key}`
  const translated = t(i18nKey)
  // If i18n returns the key itself, fall back to original title
  return translated !== i18nKey ? translated : s.title
}

const menuOptions = computed<MenuOption[]>(() =>
  filteredSections.value.map(s => ({
    label: sectionLabel(s),
    key: s.key,
  }))
)

// --- Form mode: fields for active section ---
interface FieldDef {
  path: string
  key: string
  label: string
  type: string
  schema?: ConfigSchema
  value: ConfigValue
  enumOptions?: Array<{ label: string; value: string }>
  sensitive: boolean
  description?: string
}

function getFieldsForSection(sectionKey: string): FieldDef[] {
  const sectionSchema = configStore.getSectionSchema(sectionKey)
  const sectionValue = configStore.config[sectionKey]
  const fields: FieldDef[] = []

  if (sectionSchema?.properties) {
    for (const [key, propSchema] of Object.entries(sectionSchema.properties)) {
      const path = `${sectionKey}.${key}`
      const value = configStore.getValueByPath(path)
      const fieldType = detectFieldType(propSchema, value)
      const sensitive = isSensitiveKey(path) || !!propSchema.uiHints?.sensitive
      let enumOptions: Array<{ label: string; value: string }> | undefined
      if (propSchema.enum) {
        enumOptions = propSchema.enum.map(e => ({
          label: String(e),
          value: String(e),
        }))
      }
      fields.push({
        path,
        key,
        label: propSchema.title ?? key,
        type: fieldType,
        schema: propSchema,
        value,
        enumOptions,
        sensitive,
        description: propSchema.description,
      })
    }
  } else if (sectionValue && typeof sectionValue === 'object' && !Array.isArray(sectionValue)) {
    // No schema -- infer from runtime values
    for (const [key, value] of Object.entries(sectionValue as Record<string, ConfigValue>)) {
      const path = `${sectionKey}.${key}`
      fields.push({
        path,
        key,
        label: key,
        type: detectFieldType(undefined, value),
        value,
        sensitive: isSensitiveKey(path),
      })
    }
  }
  return fields
}

const activeSectionFields = computed(() => {
  if (!activeSectionKey.value) return []
  return getFieldsForSection(activeSectionKey.value)
})

// --- Field editing ---
async function handleFieldChange(path: string, value: ConfigValue) {
  configStore.setValueByPath(path, value)
  configStore.markDirty(path)
}

async function handleFieldSave(path: string) {
  const value = configStore.getValueByPath(path)
  await configStore.patchConfig(path, value)
}

// --- Table mode ---
const filteredEntries = computed(() => {
  const q = searchKey.value.toLowerCase()
  if (!q) return configStore.flatEntries
  return configStore.flatEntries.filter(
    (e: ConfigEntry) => e.path.toLowerCase().includes(q) || e.value.toLowerCase().includes(q)
  )
})

const editingCell = ref<string | null>(null)
const editingValue = ref('')

function startCellEdit(path: string, currentValue: string) {
  editingCell.value = path
  editingValue.value = currentValue
}

async function saveCellEdit(path: string) {
  let parsed: ConfigValue = editingValue.value
  // Try to parse as number or boolean
  if (editingValue.value === 'true') parsed = true
  else if (editingValue.value === 'false') parsed = false
  else if (editingValue.value === 'null') parsed = null
  else if (!isNaN(Number(editingValue.value)) && editingValue.value.trim() !== '') {
    parsed = Number(editingValue.value)
  }
  await configStore.patchConfig(path, parsed)
  editingCell.value = null
}

function cancelCellEdit() {
  editingCell.value = null
}

const tableColumns = computed<DataTableColumns<ConfigEntry>>(() => [
  { title: t('config.key'), key: 'path', ellipsis: true, width: 280, sorter: 'default' },
  {
    title: t('config.value'),
    key: 'value',
    ellipsis: true,
    render(row) {
      if (editingCell.value === row.path) {
        return h(NSpace, { size: 4, align: 'center', wrap: false }, () => [
          h(NInput, {
            value: editingValue.value,
            size: 'tiny',
            style: 'width: 200px',
            onUpdateValue: (v: string) => { editingValue.value = v },
            onKeyup: (e: KeyboardEvent) => {
              if (e.key === 'Enter') saveCellEdit(row.path)
              if (e.key === 'Escape') cancelCellEdit()
            },
          }),
          h(NButton, { size: 'tiny', type: 'primary', onClick: () => saveCellEdit(row.path) }, () => 'OK'),
          h(NButton, { size: 'tiny', onClick: cancelCellEdit }, () => 'X'),
        ])
      }
      const display = isSensitiveKey(row.path)
        ? '********'
        : row.value.length > 80
          ? row.value.slice(0, 80) + '...'
          : row.value
      return h(NText, {
        style: 'cursor: pointer',
        onClick: () => startCellEdit(row.path, row.value),
      }, () => display)
    },
  },
  {
    title: t('common.type'),
    key: 'type',
    width: 80,
    render(r) { return h(NTag, { size: 'tiny' }, () => r.type) },
  },
])

// --- JSON mode ---
function syncJsonFromConfig() {
  jsonText.value = JSON.stringify(configStore.config, null, 2)
  jsonError.value = null
}

const jsonDirty = computed(() => {
  try {
    return JSON.stringify(JSON.parse(jsonText.value)) !== JSON.stringify(configStore.originalConfig)
  } catch {
    return true
  }
})

async function handleJsonSave() {
  jsonError.value = null
  let parsed: Record<string, ConfigValue>
  try {
    parsed = JSON.parse(jsonText.value) as Record<string, ConfigValue>
  } catch (e) {
    jsonError.value = e instanceof Error ? e.message : 'Invalid JSON'
    return
  }
  saving.value = true
  await configStore.setConfig(parsed)
  saving.value = false
}

// --- Actions ---
async function handleSaveAll() {
  saving.value = true
  await configStore.setConfig(configStore.config as Record<string, ConfigValue>)
  saving.value = false
}

async function handleApply() {
  saving.value = true
  await configStore.applyConfig()
  saving.value = false
}

async function handleReload() {
  await configStore.fetchConfig()
  syncJsonFromConfig()
}

function handleExport() {
  configStore.exportConfig()
}

async function handleImport(options: { file: UploadFileInfo; fileList: UploadFileInfo[] }) {
  const raw = options.file.file
  if (!raw) return
  await configStore.importConfig(raw)
  syncJsonFromConfig()
  importFileList.value = []
}

// --- Scroll to section ---
function scrollToSection(key: string) {
  activeSectionKey.value = key
  nextTick(() => {
    const el = document.getElementById(`config-section-${key}`)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  })
}

// --- Init ---
onMounted(async () => {
  if (!conn.isConnected) return
  await Promise.all([configStore.fetchConfig(), configStore.fetchSchema()])
  syncJsonFromConfig()
  if (configStore.sections.length > 0) {
    activeSectionKey.value = configStore.sections[0].key
  }
})

watch(activeTab, (tab) => {
  if (tab === 'json') syncJsonFromConfig()
})
</script>

<template>
  <div class="config-view">
    <!-- Header -->
    <NSpace justify="space-between" align="center" style="margin-bottom: 12px;">
      <NSpace align="center" :size="12">
        <NText strong style="font-size: 16px;">{{ t('config.title') }}</NText>
        <NBadge v-if="configStore.dirty" dot type="warning" />
      </NSpace>
      <NSpace :size="8">
        <NInput
          v-model:value="searchKey"
          :placeholder="t('config.search')"
          size="small"
          clearable
          style="width: 200px;"
        />
        <NButton size="small" secondary :loading="configStore.loading" @click="handleReload">
          {{ t('common.refresh') }}
        </NButton>
        <NButton size="small" secondary @click="handleExport">
          {{ t('config.export') }}
        </NButton>
        <NUpload
          :file-list="importFileList"
          accept=".json"
          :show-file-list="false"
          @change="handleImport"
        >
          <NButton size="small" secondary>{{ t('config.import') }}</NButton>
        </NUpload>
        <NButton
          size="small"
          type="primary"
          :loading="saving"
          :disabled="!configStore.dirty"
          @click="handleSaveAll"
        >
          {{ t('config.save') }}
        </NButton>
        <NButton
          size="small"
          type="info"
          :loading="saving"
          @click="handleApply"
        >
          {{ t('config.apply') }}
        </NButton>
        <NButton
          size="small"
          :disabled="!configStore.dirty"
          @click="configStore.resetChanges()"
        >
          {{ t('config.reset') }}
        </NButton>
      </NSpace>
    </NSpace>

    <!-- Status alerts -->
    <NAlert v-if="configStore.error" type="error" closable style="margin-bottom: 8px;" @close="configStore.error = null">
      {{ configStore.error }}
    </NAlert>
    <NAlert v-if="configStore.lastSaved" type="success" closable style="margin-bottom: 8px;">
      {{ t('config.saved') }} ({{ new Date(configStore.lastSaved).toLocaleTimeString() }})
    </NAlert>

    <NSpin :show="configStore.loading">
      <NTabs v-model:value="activeTab" type="line" animated>

        <!-- Form Mode -->
        <NTabPane name="form" :tab="t('config.formMode')">
          <!-- Tag filter buttons -->
          <NSpace :size="6" style="margin-bottom: 12px;">
            <NButton
              v-for="tag in CATEGORY_TAGS"
              :key="tag.value"
              size="tiny"
              :type="activeTagFilter === tag.value ? 'primary' : 'default'"
              :secondary="activeTagFilter !== tag.value"
              @click="activeTagFilter = activeTagFilter === tag.value ? null : tag.value"
            >
              {{ tag.label }}
            </NButton>
          </NSpace>

          <div class="config-form-layout">
            <!-- Sidebar menu -->
            <div class="config-sidebar">
              <NScrollbar style="max-height: calc(100vh - 240px);">
                <NMenu
                  :options="menuOptions"
                  :value="activeSectionKey"
                  @update:value="scrollToSection"
                />
              </NScrollbar>
            </div>

            <!-- Right content: all sections rendered, scroll target -->
            <div class="config-content">
              <NScrollbar style="max-height: calc(100vh - 240px);">
                <div v-if="!filteredSections.length" style="padding: 24px;">
                  <NEmpty :description="t('config.noSections')" />
                </div>
                <div
                  v-for="section in filteredSections"
                  :key="section.key"
                  :id="`config-section-${section.key}`"
                  style="margin-bottom: 16px;"
                >
                  <NCard :title="sectionLabel(section)" size="small" :bordered="true">
                    <template #header-extra>
                      <NSpace :size="4">
                        <NTag v-for="tag in section.tags" :key="tag" size="tiny" :bordered="false">
                          {{ tag }}
                        </NTag>
                      </NSpace>
                    </template>

                    <NForm label-placement="left" label-width="200" size="small">
                      <template v-for="field in getFieldsForSection(section.key)" :key="field.path">
                        <NFormItem :label="fieldLabel(field)">
                          <template #label>
                            <NSpace :size="4" align="center" :wrap="false">
                              <NText>{{ fieldLabel(field) }}</NText>
                              <NBadge v-if="configStore.isFieldDirty(field.path)" dot type="warning" />
                            </NSpace>
                          </template>

                          <NSpace :size="8" align="center" style="width: 100%;" :wrap="false">
                            <!-- Boolean -->
                            <NSwitch
                              v-if="field.type === 'boolean'"
                              :value="!!field.value"
                              @update:value="(v: boolean) => handleFieldChange(field.path, v)"
                            />
                            <!-- Number -->
                            <NInputNumber
                              v-else-if="field.type === 'number' || field.type === 'integer'"
                              :value="typeof field.value === 'number' ? field.value : null"
                              size="small"
                              style="width: 200px;"
                              @update:value="(v: number | null) => handleFieldChange(field.path, v ?? 0)"
                            />
                            <!-- Enum -->
                            <NSelect
                              v-else-if="field.type === 'enum' && field.enumOptions"
                              :value="field.value != null ? String(field.value) : null"
                              :options="field.enumOptions"
                              size="small"
                              style="width: 240px;"
                              clearable
                              @update:value="(v: string | null) => handleFieldChange(field.path, v)"
                            />
                            <!-- Array -->
                            <NDynamicTags
                              v-else-if="field.type === 'array'"
                              :value="Array.isArray(field.value) ? (field.value as string[]).map(String) : []"
                              @update:value="(v: string[]) => handleFieldChange(field.path, v)"
                            />
                            <!-- Object -->
                            <NInput
                              v-else-if="field.type === 'object'"
                              :value="typeof field.value === 'object' ? JSON.stringify(field.value) : '{}'"
                              type="textarea"
                              :autosize="{ minRows: 2, maxRows: 6 }"
                              size="small"
                              style="width: 100%; font-family: monospace; font-size: 12px;"
                              @update:value="(v: string) => {
                                try { handleFieldChange(field.path, JSON.parse(v)) } catch {}
                              }"
                            />
                            <!-- Sensitive string -->
                            <NInput
                              v-else-if="field.sensitive"
                              :value="field.value != null ? String(field.value) : ''"
                              type="password"
                              show-password-on="click"
                              size="small"
                              style="width: 320px;"
                              @update:value="(v: string) => handleFieldChange(field.path, v)"
                            />
                            <!-- Default: string -->
                            <NInput
                              v-else
                              :value="field.value != null ? String(field.value) : ''"
                              size="small"
                              style="width: 320px;"
                              @update:value="(v: string) => handleFieldChange(field.path, v)"
                            />

                            <!-- Save button per field (when dirty) -->
                            <NButton
                              v-if="configStore.isFieldDirty(field.path)"
                              size="tiny"
                              type="primary"
                              @click="handleFieldSave(field.path)"
                            >
                              {{ t('common.save') }}
                            </NButton>
                          </NSpace>

                          <!-- Description tooltip -->
                          <template v-if="field.description" #feedback>
                            <NText depth="3" style="font-size: 12px;">{{ field.description }}</NText>
                          </template>
                        </NFormItem>
                      </template>

                      <NEmpty
                        v-if="getFieldsForSection(section.key).length === 0"
                        :description="t('config.noFields')"
                        style="padding: 12px 0;"
                      />
                    </NForm>
                  </NCard>
                </div>
              </NScrollbar>
            </div>
          </div>
        </NTabPane>

        <!-- Table Mode -->
        <NTabPane name="table" :tab="t('config.tableMode')">
          <NEmpty v-if="!filteredEntries.length" :description="t('common.noData')" />
          <NDataTable
            v-else
            :columns="tableColumns"
            :data="filteredEntries"
            :pagination="{ pageSize: 30 }"
            size="small"
          />
        </NTabPane>

        <!-- JSON Mode -->
        <NTabPane name="json" :tab="t('config.jsonMode')">
          <NSpace vertical :size="8">
            <NSpace align="center" :size="8">
              <NTag v-if="jsonDirty" type="warning" size="small">{{ t('config.unsavedChanges') }}</NTag>
              <NTag v-else type="success" size="small">{{ t('config.upToDate') }}</NTag>
            </NSpace>
            <JsonEditor v-model="jsonText" />
            <NAlert v-if="jsonError" type="error" style="margin-top: 4px;">
              {{ jsonError }}
            </NAlert>
            <NSpace justify="end">
              <NButton size="small" @click="syncJsonFromConfig">{{ t('config.reset') }}</NButton>
              <NButton size="small" type="primary" :loading="saving" @click="handleJsonSave">
                {{ t('common.save') }}
              </NButton>
            </NSpace>
          </NSpace>
        </NTabPane>
      </NTabs>
    </NSpin>
  </div>
</template>

<style scoped>
.config-view {
  padding: 16px;
}

.config-form-layout {
  display: flex;
  gap: 16px;
}

.config-sidebar {
  width: 200px;
  flex-shrink: 0;
}

.config-content {
  flex: 1;
  min-width: 0;
}
</style>
