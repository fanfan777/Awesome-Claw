<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NCard, NButton, NSpace, NInput, NText, NAlert, NSpin,
  NDivider, NSelect, NPopconfirm
} from 'naive-ui'
import type { SelectOption } from 'naive-ui'
import { useConnectionStore } from '@renderer/gateway/connection'

const { t, locale } = useI18n()
const conn = useConnectionStore()

const EMOJI_OPTIONS = ['🤖', '🧠', '🐱', '🐶', '🦊', '🐼', '🦉', '🐙', '🌟', '⚡', '🔮', '🎯', '💡', '🚀', '🎨', '🌈']

const langOptions: SelectOption[] = [
  { label: 'English', value: 'en' },
  { label: '中文', value: 'zh-CN' },
]

// Editable state
const agentName = ref('OpenClaw')
const agentEmoji = ref('🤖')
const userName = ref('')
const personality = ref('')
const replyLanguage = ref('zh-CN')
const toolProfile = ref('full')

const toolProfileOptions = computed(() => [
  { label: zh.value ? '🔓 完整权限 — 全部工具' : '🔓 Full — All tools', value: 'full' },
  { label: zh.value ? '💻 编程模式 — 代码与终端' : '💻 Coding — Code & terminal', value: 'coding' },
  { label: zh.value ? '💬 消息模式 — 仅聊天' : '💬 Messaging — Chat only', value: 'messaging' },
  { label: zh.value ? '🔒 最小权限 — 无工具' : '🔒 Minimal — No tools', value: 'minimal' },
])

// Raw MD content (advanced)
const rawIdentity = ref('')
const rawSoul = ref('')
const rawUser = ref('')

// UI state
const loading = ref(false)
const saving = ref(false)
const error = ref<string | null>(null)
const success = ref(false)
const dirty = ref(false)

const zh = computed(() => locale.value.startsWith('zh'))

function getClient() {
  const c = conn.client
  if (!c) throw new Error('Gateway not connected')
  return c
}

// Parse structured fields from raw MD content
function parseIdentity(content: string) {
  const nameMatch = content.match(/^#\s+(.+)/m)
  if (nameMatch) agentName.value = nameMatch[1].trim()
  const emojiMatch = content.match(/Avatar:\s*(\S+)/)
  if (emojiMatch) agentEmoji.value = emojiMatch[1]
}

function parseSoul(content: string) {
  // Extract personality (everything under # Personality, before ## Language)
  const langSection = content.indexOf('## Language')
  let personalityText = content
  if (langSection >= 0) {
    personalityText = content.slice(0, langSection)
  }
  // Remove the "# Personality" header
  personalityText = personalityText.replace(/^#\s+Personality\s*/m, '').trim()
  personality.value = personalityText

  // Extract language preference
  if (content.includes('中文')) {
    replyLanguage.value = 'zh-CN'
  } else if (content.includes('English')) {
    replyLanguage.value = 'en'
  }
}

function parseUser(content: string) {
  const nameMatch = content.match(/Name:\s*(.+)/m)
  if (nameMatch) userName.value = nameMatch[1].trim()
}

async function loadFiles() {
  if (!conn.isConnected) return
  loading.value = true
  error.value = null
  try {
    const client = getClient()

    // Load IDENTITY.md
    try {
      const res = await client.request<{ content: string }>('agents.files.get', {
        agentId: 'main', name: 'IDENTITY.md'
      })
      rawIdentity.value = res.content ?? ''
      parseIdentity(rawIdentity.value)
    } catch { rawIdentity.value = '' }

    // Load SOUL.md
    try {
      const res = await client.request<{ content: string }>('agents.files.get', {
        agentId: 'main', name: 'SOUL.md'
      })
      rawSoul.value = res.content ?? ''
      parseSoul(rawSoul.value)
    } catch { rawSoul.value = '' }

    // Load USER.md
    try {
      const res = await client.request<{ content: string }>('agents.files.get', {
        agentId: 'main', name: 'USER.md'
      })
      rawUser.value = res.content ?? ''
      parseUser(rawUser.value)
    } catch { rawUser.value = '' }

    // Load tool profile from agent config
    try {
      const agentRes = await client.request<{ agents: Array<{ id: string; tools?: { profile?: string } }> }>('agents.list')
      const main = agentRes.agents?.find(a => a.id === 'main')
      if (main?.tools?.profile) toolProfile.value = main.tools.profile
    } catch { /* best-effort */ }

    dirty.value = false
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load files'
  } finally {
    loading.value = false
  }
}

function generateIdentityMd(): string {
  const name = agentName.value.trim() || 'OpenClaw'
  return `# ${name}\n\n- Avatar: ${agentEmoji.value}\n\nI am ${name}, your personal AI assistant.\n`
}

function generateSoulMd(): string {
  const parts: string[] = ['# Personality\n']
  if (personality.value.trim()) {
    parts.push(personality.value.trim() + '\n')
  }
  if (replyLanguage.value.startsWith('zh')) {
    parts.push('## Language\n\n请始终使用中文回复用户。\n')
  } else {
    parts.push('## Language\n\nAlways reply in English.\n')
  }
  return parts.join('\n')
}

function generateUserMd(): string {
  if (!userName.value.trim()) return ''
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
  return `# User\n\nName: ${userName.value.trim()}\nTimezone: ${tz}\n`
}

async function saveAll() {
  saving.value = true
  error.value = null
  success.value = false
  try {
    const client = getClient()

    await client.request('agents.files.set', {
      agentId: 'main', name: 'IDENTITY.md',
      content: generateIdentityMd(),
    })

    await client.request('agents.files.set', {
      agentId: 'main', name: 'SOUL.md',
      content: generateSoulMd(),
    })

    if (userName.value.trim()) {
      await client.request('agents.files.set', {
        agentId: 'main', name: 'USER.md',
        content: generateUserMd(),
      })
    }

    // Save tool profile
    try {
      await client.request('agents.update', {
        agentId: 'main',
        tools: { profile: toolProfile.value },
      })
    } catch { /* best-effort */ }

    // Update raw content to match
    rawIdentity.value = generateIdentityMd()
    rawSoul.value = generateSoulMd()
    rawUser.value = generateUserMd()

    success.value = true
    dirty.value = false
    setTimeout(() => { success.value = false }, 3000)
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to save'
  } finally {
    saving.value = false
  }
}

async function saveRaw() {
  saving.value = true
  error.value = null
  success.value = false
  try {
    const client = getClient()
    if (rawIdentity.value.trim()) {
      await client.request('agents.files.set', {
        agentId: 'main', name: 'IDENTITY.md', content: rawIdentity.value,
      })
    }
    if (rawSoul.value.trim()) {
      await client.request('agents.files.set', {
        agentId: 'main', name: 'SOUL.md', content: rawSoul.value,
      })
    }
    if (rawUser.value.trim()) {
      await client.request('agents.files.set', {
        agentId: 'main', name: 'USER.md', content: rawUser.value,
      })
    }
    // Re-parse structured fields from raw
    parseIdentity(rawIdentity.value)
    parseSoul(rawSoul.value)
    parseUser(rawUser.value)
    success.value = true
    dirty.value = false
    setTimeout(() => { success.value = false }, 3000)
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to save'
  } finally {
    saving.value = false
  }
}

async function resetToDefaults() {
  agentName.value = 'OpenClaw'
  agentEmoji.value = '🤖'
  userName.value = ''
  personality.value = ''
  replyLanguage.value = locale.value.startsWith('zh') ? 'zh-CN' : 'en'
  toolProfile.value = 'full'
  dirty.value = true
  await saveAll()
}

function markDirty() {
  dirty.value = true
}

onMounted(() => {
  loadFiles()
})
</script>

<template>
  <div class="personality-view">
    <div class="personality-header">
      <h2>{{ t('personality.title') }}</h2>
      <NText depth="2">{{ t('personality.desc') }}</NText>
    </div>

    <NAlert v-if="!conn.isConnected" type="warning" style="margin-bottom: 16px;">
      {{ t('personality.gatewayNotConnected') }}
    </NAlert>

    <NAlert v-if="error" type="error" closable style="margin-bottom: 16px;" @close="error = null">
      {{ error }}
    </NAlert>

    <NAlert v-if="success" type="success" style="margin-bottom: 16px;">
      {{ t('personality.savedSuccess') }}
    </NAlert>

    <NSpin :show="loading">
      <!-- Structured editor -->
      <NCard :title="t('personality.agentSettings')" size="small" style="margin-bottom: 16px;">
        <NSpace vertical :size="16">
          <!-- Agent name + emoji -->
          <div class="field-row">
            <div class="emoji-section">
              <NText depth="3" class="field-label">{{ t('personality.emoji') }}</NText>
              <div class="emoji-grid">
                <span
                  v-for="e in EMOJI_OPTIONS"
                  :key="e"
                  class="emoji-option"
                  :class="{ 'emoji-option--active': agentEmoji === e }"
                  @click="agentEmoji = e; markDirty()"
                >{{ e }}</span>
              </div>
            </div>
            <div style="flex: 1;">
              <NText depth="3" class="field-label">{{ t('personality.agentName') }}</NText>
              <NInput
                v-model:value="agentName"
                :placeholder="zh ? '如 OpenClaw、小助手' : 'e.g. OpenClaw'"
                @update:value="markDirty"
              />
            </div>
          </div>

          <!-- User name -->
          <div>
            <NText depth="3" class="field-label">{{ t('personality.yourName') }}</NText>
            <NInput
              v-model:value="userName"
              :placeholder="zh ? '怎么称呼你' : 'Your name'"
              @update:value="markDirty"
            />
          </div>

          <!-- Personality -->
          <div>
            <NText depth="3" class="field-label">{{ t('personality.personalityLabel') }}</NText>
            <NInput
              v-model:value="personality"
              type="textarea"
              :rows="3"
              :placeholder="zh
                ? '如: 专业严谨的技术助手，回答简洁准确'
                : 'e.g. A professional and precise tech assistant'"
              @update:value="markDirty"
            />
          </div>

          <!-- Reply language -->
          <div>
            <NText depth="3" class="field-label">{{ t('personality.replyLanguage') }}</NText>
            <NSelect
              v-model:value="replyLanguage"
              :options="langOptions"
              style="width: 200px;"
              @update:value="markDirty"
            />
          </div>

          <!-- Tool profile -->
          <div>
            <NText depth="3" class="field-label">{{ t('personality.toolProfile') }}</NText>
            <NText depth="3" style="font-size: 11px; display: block; margin-bottom: 4px; opacity: 0.7;">
              {{ t('personality.toolProfileHint') }}
            </NText>
            <NSelect
              v-model:value="toolProfile"
              :options="toolProfileOptions"
              style="width: 320px;"
              @update:value="markDirty"
            />
          </div>
        </NSpace>

        <NDivider />

        <NSpace :size="12">
          <NButton type="primary" :loading="saving" :disabled="!dirty || !conn.isConnected" @click="saveAll">
            {{ t('common.save') }}
          </NButton>
          <NPopconfirm
            :positive-text="zh ? '确认重置' : 'Reset'"
            :negative-text="t('common.cancel')"
            @positive-click="resetToDefaults"
          >
            <template #trigger>
              <NButton :disabled="!conn.isConnected">
                {{ t('personality.resetDefaults') }}
              </NButton>
            </template>
            {{ t('personality.resetConfirm') }}
          </NPopconfirm>
          <NButton quaternary :disabled="!conn.isConnected" @click="loadFiles">
            {{ t('common.refresh') }}
          </NButton>
        </NSpace>
      </NCard>

    </NSpin>
  </div>
</template>

<style scoped>
.personality-view {
  padding: 24px;
  max-width: 700px;
}

.personality-header {
  margin-bottom: 20px;
}

.personality-header h2 {
  margin: 0 0 4px;
  font-size: 20px;
  font-weight: 600;
}

.field-row {
  display: flex;
  gap: 16px;
  align-items: flex-start;
}

.field-label {
  font-size: 12px;
  display: block;
  margin-bottom: 4px;
}

.emoji-section {
  flex-shrink: 0;
}

.emoji-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  max-width: 140px;
}

.emoji-option {
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  cursor: pointer;
  font-size: 18px;
  transition: background 0.15s, transform 0.15s;
}

.emoji-option:hover {
  background: rgba(24, 160, 88, 0.12);
  transform: scale(1.15);
}

.emoji-option--active {
  background: rgba(24, 160, 88, 0.2);
  box-shadow: 0 0 0 2px #18a058;
  transform: scale(1.15);
}
</style>
