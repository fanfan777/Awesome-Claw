<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NButton, NSpace, NDrawer, NDrawerContent, NForm, NFormItem,
  NInput, NSpin, NEmpty, NPopconfirm, NTabs, NTabPane, NText, NSwitch,
  NCard, NTag, NSelect, NSlider, NDynamicTags, NRadioGroup, NRadioButton,
  NInputNumber, NScrollbar, NList, NListItem, NBadge, NAlert, NModal
} from 'naive-ui'
import {
  useAgentsStore,
  type Agent, type AgentCreateParams, type AgentUpdateParams,
  AGENT_FILES, THINKING_LEVELS, TOOL_PROFILES, SANDBOX_MODES
} from '@renderer/stores/agents'
import MarkdownRenderer from '@renderer/components/common/MarkdownRenderer.vue'
import { useConnectionStore } from '@renderer/gateway/connection'

const { t } = useI18n()
const store = useAgentsStore()
const conn = useConnectionStore()

// --- Agent creation/edit modal ---
const modalOpen = ref(false)
const modalMode = ref<'create' | 'edit'>('create')
const modalForm = ref<AgentCreateParams>({
  name: '',
  description: '',
  model: '',
  system: '',
  workspace: '',
  emoji: '',
  thinkingLevel: '',
  default: false,
})
const modalSaving = ref(false)

// --- Active tab in right panel ---
const activeTab = ref('overview')

// --- File editor state ---
const activeFileTab = ref(AGENT_FILES[0])
const fileSaving = ref(false)
const filePreviewMode = ref(false)

// --- Tools panel ---
const toolSearch = ref('')
const filteredTools = computed(() => {
  const q = toolSearch.value.toLowerCase()
  if (!q) return store.toolsCatalog
  return store.toolsCatalog.filter(
    t => t.name.toLowerCase().includes(q) || (t.description?.toLowerCase().includes(q))
  )
})

// --- Config panel editing ---
const configSaving = ref(false)
const configForm = ref<AgentUpdateParams>({})

// --- Helpers ---
function getAgentDisplayName(agent: Agent): string {
  return agent.emoji ? `${agent.emoji} ${agent.name}` : agent.name
}

function getAgentModel(agent: Agent): string {
  if (!agent.model) return '--'
  if (typeof agent.model === 'string') return agent.model
  return agent.model.primary ?? '--'
}

function getAgentFallbacks(agent: Agent): string[] {
  if (!agent.model || typeof agent.model === 'string') return []
  return agent.model.fallbacks ?? []
}

// --- Agent selection ---
async function selectAgent(agent: Agent) {
  store.selectAgent(agent)
  activeTab.value = 'overview'
  await store.fetchFiles(agent.id)
}

// --- Create / Edit ---
function openCreate() {
  modalMode.value = 'create'
  modalForm.value = {
    name: '',
    description: '',
    model: '',
    system: '',
    workspace: '',
    emoji: '',
    thinkingLevel: '',
    default: false,
  }
  modalOpen.value = true
}

function openEdit(agent: Agent) {
  modalMode.value = 'edit'
  modalForm.value = {
    name: agent.name,
    description: agent.description ?? '',
    model: getAgentModel(agent),
    system: agent.system ?? '',
    workspace: agent.workspace ?? '',
    emoji: agent.emoji ?? '',
    thinkingLevel: agent.thinkingLevel ?? '',
    default: agent.default ?? false,
  }
  modalOpen.value = true
}

async function handleModalSave() {
  modalSaving.value = true
  if (modalMode.value === 'create') {
    const created = await store.createAgent(modalForm.value)
    if (created) {
      await selectAgent(created)
    }
  } else if (store.selectedAgent) {
    await store.updateAgent(store.selectedAgent.id, modalForm.value as AgentUpdateParams)
  }
  modalSaving.value = false
  modalOpen.value = false
}

// --- Delete ---
async function handleDelete(agent: Agent) {
  await store.deleteAgent(agent.id)
}

// --- File operations ---
async function saveFile(filename: string) {
  if (!store.selectedAgent) return
  fileSaving.value = true
  const content = store.fileDrafts[filename] ?? ''
  await store.setFile(store.selectedAgent.id, filename, content)
  fileSaving.value = false
}

function resetFile(filename: string) {
  const file = store.files[filename]
  if (file) {
    store.setDraft(filename, file.content)
  }
}

// --- Config panel ---
function initConfigForm(agent: Agent) {
  configForm.value = {
    model: getAgentModel(agent),
    thinkingLevel: agent.thinkingLevel ?? '',
    humanDelay: agent.humanDelay ?? 0,
    subagents: agent.subagents ?? [],
    tools: {
      profile: agent.tools?.profile ?? 'full',
      allow: agent.tools?.allow ?? [],
      deny: agent.tools?.deny ?? [],
    },
    groupChat: {
      mentionPatterns: agent.groupChat?.mentionPatterns ?? [],
    },
    sandbox: {
      mode: agent.sandbox?.mode ?? 'off',
    },
  }
}

async function saveConfig() {
  if (!store.selectedAgent) return
  configSaving.value = true
  await store.updateAgent(store.selectedAgent.id, configForm.value)
  configSaving.value = false
}

// Watch selected agent to sync config form
watch(() => store.selectedAgent, (agent) => {
  if (agent) initConfigForm(agent)
}, { immediate: true })

// --- Skills panel ---
const skillInput = ref('')

function addSkill() {
  if (!skillInput.value.trim() || !store.selectedAgent) return
  const current = store.selectedAgent.skills ?? []
  if (!current.includes(skillInput.value.trim())) {
    store.updateAgent(store.selectedAgent.id, {
      skills: [...current, skillInput.value.trim()],
    })
  }
  skillInput.value = ''
}

function removeSkill(skill: string) {
  if (!store.selectedAgent) return
  const current = store.selectedAgent.skills ?? []
  store.updateAgent(store.selectedAgent.id, {
    skills: current.filter(s => s !== skill),
  })
}

async function clearAgentSkills() {
  if (!store.selectedAgent) return
  await store.updateAgent(store.selectedAgent.id, { skills: [] })
}

// --- Init ---
onMounted(async () => {
  if (!conn.isConnected) return
  await store.fetchAgents()
  await store.fetchToolsCatalog()
  if (store.agents.length > 0 && !store.selectedAgent) {
    await selectAgent(store.agents[0])
  }
})
</script>

<template>
  <div class="agents-view">
    <!-- Error -->
    <NAlert v-if="store.error" type="error" closable style="margin-bottom: 8px;" @close="store.error = null">
      {{ store.error }}
    </NAlert>

    <NSpin :show="store.loading && !store.agents.length">
      <div class="agents-layout">
        <!-- Left sidebar: agent list -->
        <div class="agents-sidebar">
          <NText strong style="font-size: 14px; margin-bottom: 8px; display: block;">
            {{ t('agents.title') }}
          </NText>

          <NScrollbar style="max-height: calc(100vh - 200px);">
            <NList bordered hoverable clickable>
              <NListItem
                v-for="agent in store.agents"
                :key="agent.id"
                :class="{ 'agent-item-active': store.selectedAgent?.id === agent.id }"
                @click="selectAgent(agent)"
              >
                <NSpace align="center" :size="8" :wrap="false">
                  <NText style="font-size: 18px; width: 24px; text-align: center;">
                    {{ agent.emoji || '🤖' }}
                  </NText>
                  <NSpace vertical :size="0" style="flex: 1; min-width: 0;">
                    <NSpace :size="6" align="center" :wrap="false">
                      <NText strong :style="{ fontSize: '13px' }">{{ agent.name }}</NText>
                      <NTag v-if="agent.default" size="tiny" type="success" :bordered="false">
                        {{ t('agents.default') }}
                      </NTag>
                    </NSpace>
                    <NText v-if="agent.workspace" depth="3" style="font-size: 11px;">
                      {{ agent.workspace }}
                    </NText>
                  </NSpace>
                </NSpace>
              </NListItem>
            </NList>
          </NScrollbar>

          <NButton
            type="primary"
            size="small"
            block
            style="margin-top: 8px;"
            @click="openCreate"
          >
            {{ t('agents.create') }}
          </NButton>
        </div>

        <!-- Right content: tabbed panels -->
        <div class="agents-content">
          <NEmpty
            v-if="!store.selectedAgent"
            :description="t('agents.noAgents')"
            style="padding: 48px;"
          />
          <template v-else>
            <NSpace justify="space-between" align="center" style="margin-bottom: 12px;">
              <NSpace align="center" :size="8">
                <NText style="font-size: 22px;">{{ store.selectedAgent.emoji || '🤖' }}</NText>
                <NText strong style="font-size: 16px;">{{ store.selectedAgent.name }}</NText>
                <NTag v-if="store.selectedAgent.default" size="small" type="success">
                  {{ t('agents.default') }}
                </NTag>
              </NSpace>
              <NSpace :size="6">
                <NButton size="small" secondary @click="openEdit(store.selectedAgent!)">
                  {{ t('common.edit') }}
                </NButton>
                <NPopconfirm @positive-click="handleDelete(store.selectedAgent!)">
                  <template #trigger>
                    <NButton size="small" type="error" ghost>{{ t('common.delete') }}</NButton>
                  </template>
                  {{ t('agents.confirmDelete', { name: store.selectedAgent?.name }) }}
                </NPopconfirm>
              </NSpace>
            </NSpace>

            <NTabs v-model:value="activeTab" type="line" animated>

              <!-- Overview Panel -->
              <NTabPane name="overview" :tab="t('agents.overview')">
                <NCard size="small">
                  <NSpace vertical :size="12">
                    <NSpace :size="16">
                      <NSpace vertical :size="2">
                        <NText depth="3" style="font-size: 12px;">{{ t('agents.name') }}</NText>
                        <NText>{{ store.selectedAgent.name }}</NText>
                      </NSpace>
                      <NSpace vertical :size="2">
                        <NText depth="3" style="font-size: 12px;">{{ t('agents.emoji') }}</NText>
                        <NText>{{ store.selectedAgent.emoji || '--' }}</NText>
                      </NSpace>
                      <NSpace vertical :size="2">
                        <NText depth="3" style="font-size: 12px;">{{ t('agents.workspace') }}</NText>
                        <NText>{{ store.selectedAgent.workspace || '--' }}</NText>
                      </NSpace>
                      <NSpace vertical :size="2">
                        <NText depth="3" style="font-size: 12px;">{{ t('agents.default') }}</NText>
                        <NTag size="small" :type="store.selectedAgent.default ? 'success' : 'default'">
                          {{ store.selectedAgent.default ? t('common.yes') : t('common.no') }}
                        </NTag>
                      </NSpace>
                    </NSpace>

                    <NSpace :size="16">
                      <NSpace vertical :size="2">
                        <NText depth="3" style="font-size: 12px;">{{ t('agents.primaryModel') }}</NText>
                        <NTag size="small">{{ getAgentModel(store.selectedAgent) }}</NTag>
                      </NSpace>
                      <NSpace vertical :size="2">
                        <NText depth="3" style="font-size: 12px;">{{ t('agents.fallbacks') }}</NText>
                        <NSpace :size="4">
                          <NTag
                            v-for="fb in getAgentFallbacks(store.selectedAgent)"
                            :key="fb"
                            size="tiny"
                          >
                            {{ fb }}
                          </NTag>
                          <NText v-if="!getAgentFallbacks(store.selectedAgent).length" depth="3">--</NText>
                        </NSpace>
                      </NSpace>
                    </NSpace>

                    <NSpace :size="16">
                      <NSpace vertical :size="2">
                        <NText depth="3" style="font-size: 12px;">{{ t('agents.thinkingLevel') }}</NText>
                        <NText>{{ store.selectedAgent.thinkingLevel || t('agents.default') }}</NText>
                      </NSpace>
                      <NSpace vertical :size="2">
                        <NText depth="3" style="font-size: 12px;">{{ t('agents.identity') }}</NText>
                        <NText>{{ store.selectedAgent.identity?.name || '--' }}</NText>
                      </NSpace>
                      <NSpace vertical :size="2">
                        <NText depth="3" style="font-size: 12px;">{{ t('agents.humanDelay') }}</NText>
                        <NText>{{ store.selectedAgent.humanDelay != null ? `${store.selectedAgent.humanDelay}ms` : '--' }}</NText>
                      </NSpace>
                    </NSpace>

                    <NSpace vertical :size="2" v-if="store.selectedAgent.description">
                      <NText depth="3" style="font-size: 12px;">{{ t('agents.description') }}</NText>
                      <NText style="font-size: 13px;">{{ store.selectedAgent.description }}</NText>
                    </NSpace>
                  </NSpace>
                </NCard>
              </NTabPane>

              <!-- Files Panel -->
              <NTabPane name="files" :tab="t('agents.files')">
                <NTabs v-model:value="activeFileTab" type="card" size="small">
                  <NTabPane v-for="fname in AGENT_FILES" :key="fname" :name="fname" :tab="fname">
                    <template #tab>
                      <NSpace :size="4" align="center" :wrap="false">
                        {{ fname }}
                        <NBadge v-if="store.isFileDirty(fname)" dot type="warning" />
                      </NSpace>
                    </template>

                    <NSpace vertical :size="8">
                      <NSpace :size="6" align="center">
                        <NSwitch
                          v-model:value="filePreviewMode"
                          size="small"
                        >
                          <template #checked>{{ t('agents.preview') }}</template>
                          <template #unchecked>{{ t('common.edit') }}</template>
                        </NSwitch>
                      </NSpace>

                      <MarkdownRenderer v-if="filePreviewMode" class="file-preview" :content="store.fileDrafts[fname] ?? ''" />
                      <NInput
                        v-else
                        :value="store.fileDrafts[fname] ?? ''"
                        type="textarea"
                        :autosize="{ minRows: 12, maxRows: 30 }"
                        style="font-family: monospace; font-size: 13px;"
                        @update:value="(v: string) => store.setDraft(fname, v)"
                      />

                      <NSpace justify="end" :size="6">
                        <NButton
                          size="small"
                          :disabled="!store.isFileDirty(fname)"
                          @click="resetFile(fname)"
                        >
                          {{ t('config.reset') }}
                        </NButton>
                        <NButton
                          size="small"
                          type="primary"
                          :loading="fileSaving"
                          :disabled="!store.isFileDirty(fname)"
                          @click="saveFile(fname)"
                        >
                          {{ t('common.save') }}
                        </NButton>
                      </NSpace>
                    </NSpace>
                  </NTabPane>
                </NTabs>
              </NTabPane>

              <!-- Tools Panel -->
              <NTabPane name="tools" :tab="t('agents.tools')">
                <NSpace vertical :size="16">
                  <NCard :title="t('agents.toolProfile')" size="small">
                    <NRadioGroup
                      :value="configForm.tools?.profile ?? 'full'"
                      @update:value="(v: string) => { if (configForm.tools) configForm.tools.profile = v }"
                    >
                      <NRadioButton
                        v-for="tp in TOOL_PROFILES"
                        :key="tp.value"
                        :value="tp.value"
                        :label="tp.label"
                      />
                    </NRadioGroup>
                  </NCard>

                  <NCard :title="t('agents.allowList')" size="small">
                    <NDynamicTags
                      :value="configForm.tools?.allow ?? []"
                      @update:value="(v: string[]) => { if (configForm.tools) configForm.tools.allow = v }"
                    />
                  </NCard>

                  <NCard :title="t('agents.denyList')" size="small">
                    <NDynamicTags
                      :value="configForm.tools?.deny ?? []"
                      @update:value="(v: string[]) => { if (configForm.tools) configForm.tools.deny = v }"
                    />
                  </NCard>

                  <NCard :title="t('agents.toolsCatalog')" size="small">
                    <NInput
                      v-model:value="toolSearch"
                      :placeholder="t('agents.searchToolsPlaceholder')"
                      size="small"
                      clearable
                      style="margin-bottom: 8px;"
                    />
                    <NScrollbar style="max-height: 300px;">
                      <NList size="small" bordered>
                        <NListItem v-for="tool in filteredTools" :key="tool.name">
                          <NSpace :size="8" align="center" :wrap="false">
                            <NText style="font-family: monospace; font-size: 12px;">{{ tool.name }}</NText>
                            <NTag v-if="tool.category" size="tiny" :bordered="false">{{ tool.category }}</NTag>
                          </NSpace>
                          <NText v-if="tool.description" depth="3" style="font-size: 11px; display: block;">
                            {{ tool.description }}
                          </NText>
                        </NListItem>
                        <NEmpty v-if="!filteredTools.length" :description="t('agents.noToolsFound')" />
                      </NList>
                    </NScrollbar>
                  </NCard>

                  <NSpace justify="end">
                    <NButton size="small" type="primary" :loading="configSaving" @click="saveConfig">
                      {{ t('common.save') }}
                    </NButton>
                  </NSpace>
                </NSpace>
              </NTabPane>

              <!-- Skills Panel -->
              <NTabPane name="skills" :tab="t('agents.skills')">
                <NSpace vertical :size="12">
                  <NCard :title="t('agents.agentSkills')" size="small">
                    <NSpace :size="6" style="margin-bottom: 8px;" wrap>
                      <NTag
                        v-for="skill in (store.selectedAgent?.skills ?? [])"
                        :key="skill"
                        closable
                        @close="removeSkill(skill)"
                      >
                        {{ skill }}
                      </NTag>
                      <NEmpty
                        v-if="!(store.selectedAgent?.skills ?? []).length"
                        :description="t('agents.noSkillsConfigured')"
                        size="small"
                      />
                    </NSpace>

                    <NSpace :size="6" align="center">
                      <NInput
                        v-model:value="skillInput"
                        :placeholder="t('agents.addSkillPlaceholder')"
                        size="small"
                        style="width: 200px;"
                        @keyup.enter="addSkill"
                      />
                      <NButton size="small" @click="addSkill" :disabled="!skillInput.trim()">
                        {{ t('common.add') }}
                      </NButton>
                    </NSpace>
                  </NCard>

                  <NButton
                    size="small"
                    type="warning"
                    ghost
                    :disabled="!(store.selectedAgent?.skills ?? []).length"
                    @click="clearAgentSkills"
                  >
                    {{ t('agents.clearSkills') }}
                  </NButton>
                </NSpace>
              </NTabPane>

              <!-- Config Panel -->
              <NTabPane name="config" :tab="t('agents.config')">
                <NSpace vertical :size="12">
                  <NCard :title="t('agents.modelSettings')" size="small">
                    <NForm label-placement="left" label-width="160" size="small">
                      <NFormItem :label="t('agents.primaryModel')">
                        <NInput
                          :value="configForm.model ?? ''"
                          :placeholder="t('agents.modelPlaceholder')"
                          @update:value="(v: string) => configForm.model = v"
                        />
                      </NFormItem>
                      <NFormItem :label="t('agents.thinkingLevel')">
                        <NSelect
                          :value="configForm.thinkingLevel ?? ''"
                          :options="THINKING_LEVELS"
                          clearable
                          :placeholder="t('agents.default')"
                        />
                      </NFormItem>
                    </NForm>
                  </NCard>

                  <NCard :title="t('agents.behavior')" size="small">
                    <NForm label-placement="left" label-width="160" size="small">
                      <NFormItem :label="t('agents.humanDelay')">
                        <NSlider
                          :value="configForm.humanDelay ?? 0"
                          :min="0"
                          :max="5000"
                          :step="100"
                          style="width: 300px;"
                          @update:value="(v: number) => configForm.humanDelay = v"
                        />
                        <NText style="margin-left: 12px; font-size: 12px;">
                          {{ configForm.humanDelay ?? 0 }}ms
                        </NText>
                      </NFormItem>

                      <NFormItem :label="t('agents.subagents')">
                        <NSelect
                          :value="configForm.subagents ?? []"
                          :options="store.agentOptions.filter(o => o.value !== store.selectedAgent?.id)"
                          multiple
                          clearable
                          :placeholder="t('agents.selectSubagents')"
                          @update:value="(v: string[]) => configForm.subagents = v"
                        />
                      </NFormItem>

                      <NFormItem :label="t('agents.mentionPatterns')">
                        <NDynamicTags
                          :value="configForm.groupChat?.mentionPatterns ?? []"
                          @update:value="(v: string[]) => { if (configForm.groupChat) configForm.groupChat.mentionPatterns = v }"
                        />
                      </NFormItem>

                      <NFormItem :label="t('agents.sandboxMode')">
                        <NSelect
                          :value="configForm.sandbox?.mode ?? 'off'"
                          :options="SANDBOX_MODES"
                          @update:value="(v: string) => { if (configForm.sandbox) configForm.sandbox.mode = v }"
                        />
                      </NFormItem>
                    </NForm>
                  </NCard>

                  <NSpace justify="end">
                    <NButton size="small" @click="store.selectedAgent && initConfigForm(store.selectedAgent)">
                      {{ t('config.reset') }}
                    </NButton>
                    <NButton size="small" type="primary" :loading="configSaving" @click="saveConfig">
                      {{ t('common.save') }}
                    </NButton>
                  </NSpace>
                </NSpace>
              </NTabPane>
            </NTabs>
          </template>
        </div>
      </div>
    </NSpin>

    <!-- Create/Edit Agent Modal -->
    <NModal
      v-model:show="modalOpen"
      preset="card"
      :title="modalMode === 'create' ? t('agents.create') : t('agents.editAgent', { name: store.selectedAgent?.name ?? '' })"
      style="width: 520px;"
      :mask-closable="false"
    >
      <NForm label-placement="top" :model="modalForm" size="small">
        <NFormItem :label="t('agents.name')" required>
          <NInput v-model:value="modalForm.name" :placeholder="t('agents.agentNamePlaceholder')" />
        </NFormItem>

        <NSpace :size="12" style="width: 100%;">
          <NFormItem :label="t('agents.emoji')" style="width: 100px;">
            <NInput v-model:value="modalForm.emoji" placeholder="🤖" maxlength="4" />
          </NFormItem>
          <NFormItem :label="t('agents.workspace')" style="flex: 1;">
            <NInput v-model:value="modalForm.workspace" :placeholder="t('agents.workspacePlaceholder')" />
          </NFormItem>
        </NSpace>

        <NFormItem :label="t('agents.model')">
          <NInput v-model:value="modalForm.model" :placeholder="t('agents.modelPlaceholder')" />
        </NFormItem>

        <NFormItem :label="t('agents.description')">
          <NInput
            v-model:value="modalForm.description"
            type="textarea"
            :autosize="{ minRows: 2 }"
            :placeholder="t('agents.descPlaceholder')"
          />
        </NFormItem>

        <NFormItem :label="t('agents.defaultAgent')">
          <NSwitch v-model:value="modalForm.default" />
        </NFormItem>
      </NForm>

      <template #footer>
        <NSpace justify="end">
          <NButton @click="modalOpen = false">{{ t('common.cancel') }}</NButton>
          <NButton
            type="primary"
            :loading="modalSaving"
            :disabled="!modalForm.name.trim()"
            @click="handleModalSave"
          >
            {{ modalMode === 'create' ? t('common.create') : t('common.save') }}
          </NButton>
        </NSpace>
      </template>
    </NModal>
  </div>
</template>

<style scoped>
.agents-view {
  padding: 16px;
}

.agents-layout {
  display: flex;
  gap: 16px;
  min-height: calc(100vh - 140px);
}

.agents-sidebar {
  width: 240px;
  flex-shrink: 0;
}

.agents-content {
  flex: 1;
  min-width: 0;
}

.agent-item-active {
  background-color: var(--n-item-color-active, rgba(24, 160, 88, 0.08));
}

.file-preview {
  padding: 12px;
  border: 1px solid var(--n-border-color, #e0e0e6);
  border-radius: 4px;
  min-height: 200px;
  font-size: 13px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
