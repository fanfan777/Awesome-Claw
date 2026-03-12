<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NLayout, NLayoutSider, NLayoutContent, NList, NListItem, NScrollbar,
  NEmpty, NText, NSpace, NButton, NInput, NSelect, NTag, NTooltip, NSwitch,
  NAlert,
} from 'naive-ui'
import {
  AddOutline,
  RefreshOutline,
  ContractOutline,
  ExpandOutline,
  ChevronDownOutline,
  ChatbubblesOutline,
  TimeOutline,
} from '@vicons/ionicons5'
import { useChatStore, type SessionSummary, type SendOptions } from '@renderer/stores/chat'
import { useConnectionStore } from '@renderer/gateway/connection'
import { useAgentsStore } from '@renderer/stores/agents'
import { useModelsStore } from '@renderer/stores/models'
import { gatewayEventBus } from '@renderer/gateway/event-bus'
import ChatMessage from '@renderer/components/chat/ChatMessage.vue'
import ChatInput from '@renderer/components/chat/ChatInput.vue'

const { t } = useI18n()
const chatStore = useChatStore()
const conn = useConnectionStore()
const agentsStore = useAgentsStore()
const modelsStore = useModelsStore()

// UI state
const sessionSearch = ref('')
const scrollbarRef = ref<InstanceType<typeof NScrollbar> | null>(null)
const messagesEndRef = ref<HTMLElement | null>(null)
const messagesContainerRef = ref<HTMLElement | null>(null)
const focusMode = ref(false)
const hideCronSessions = ref(true)
const showNewMessagesIndicator = ref(false)
const isScrolledToBottom = ref(true)

// Send options
const selectedAgent = ref<string | null>(null)
const selectedModel = ref<string | null>(null)
const thinkingLevel = ref<string>('off')

const thinkingOptions = computed(() => [
  { label: t('chat.thinkingOff'), value: 'off' },
  { label: t('chat.thinkingLow'), value: 'low' },
  { label: t('chat.thinkingMedium'), value: 'medium' },
  { label: t('chat.thinkingHigh'), value: 'high' },
])

const agentOptions = computed(() => {
  return agentsStore.agents.map((a) => ({
    label: a.name,
    value: a.id,
  }))
})

const modelOptions = computed(() => {
  return modelsStore.models.map((m) => ({
    label: m.name ?? m.id,
    value: m.id,
  }))
})

const filteredSessions = computed<SessionSummary[]>(() => {
  let list = chatStore.sessions
  if (hideCronSessions.value) {
    list = list.filter((s) => !(s.sessionKey ?? '').startsWith('cron:'))
  }
  const q = sessionSearch.value.toLowerCase()
  if (!q) return list
  return list.filter(
    (s) =>
      s.sessionKey.toLowerCase().includes(q) ||
      (s.title ?? '').toLowerCase().includes(q) ||
      (s.agentId ?? '').toLowerCase().includes(q),
  )
})

function formatSessionTime(updatedAt?: string): string {
  if (!updatedAt) return ''
  try {
    const now = Date.now()
    const then = new Date(updatedAt).getTime()
    const diffMs = now - then
    const mins = Math.floor(diffMs / 60_000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h`
    const days = Math.floor(hours / 24)
    return `${days}d`
  } catch {
    return ''
  }
}

async function selectSession(key: string) {
  await chatStore.fetchHistory(key)
  scrollToBottom()
}

async function handleNewSession() {
  chatStore.clearCurrentSession()
}

async function handleSend(
  message: string,
  images: Array<{ data: string; mimeType: string }>,
) {
  const opts: SendOptions = {}
  if (selectedAgent.value) opts.agent = selectedAgent.value
  if (selectedModel.value) opts.model = selectedModel.value
  if (thinkingLevel.value !== 'off') opts.thinking = thinkingLevel.value
  if (images.length > 0) opts.images = images

  await chatStore.sendMessage(
    message,
    chatStore.currentSessionKey ?? undefined,
    opts,
  )
  scrollToBottom()
}

async function handleAbort() {
  if (chatStore.currentSessionKey) {
    await chatStore.abort(chatStore.currentSessionKey)
  }
}

function scrollToBottom() {
  nextTick(() => {
    messagesEndRef.value?.scrollIntoView({ behavior: 'smooth' })
    isScrolledToBottom.value = true
    showNewMessagesIndicator.value = false
  })
}

function handleMessagesScroll(e: Event) {
  const target = e.target as HTMLElement
  if (!target) return
  const threshold = 80
  const atBottom =
    target.scrollHeight - target.scrollTop - target.clientHeight < threshold
  isScrolledToBottom.value = atBottom
  if (atBottom) {
    showNewMessagesIndicator.value = false
  }
}

function onChatEvent(payload: unknown) {
  chatStore.handleChatEvent(
    payload as Parameters<typeof chatStore.handleChatEvent>[0],
  )
  if (isScrolledToBottom.value) {
    scrollToBottom()
  } else {
    showNewMessagesIndicator.value = true
  }
}

function onAgentEvent(payload: unknown) {
  chatStore.handleAgentEvent(
    payload as Parameters<typeof chatStore.handleAgentEvent>[0],
  )
  if (isScrolledToBottom.value) {
    scrollToBottom()
  }
}

function toggleFocusMode() {
  focusMode.value = !focusMode.value
}

onMounted(async () => {
  if (conn.isConnected) {
    await Promise.all([
      chatStore.fetchSessions(),
      agentsStore.fetchAgents(),
      modelsStore.fetchModels(),
    ])
  }
  gatewayEventBus.on('chat', onChatEvent)
  gatewayEventBus.on('agent', onAgentEvent)
})

// When connection becomes available (e.g. after auto-connect), fetch data
watch(() => conn.isConnected, async (connected) => {
  if (connected) {
    await Promise.all([
      chatStore.fetchSessions(),
      agentsStore.fetchAgents(),
      modelsStore.fetchModels(),
    ])
  }
})

onUnmounted(() => {
  gatewayEventBus.off('chat', onChatEvent)
  gatewayEventBus.off('agent', onAgentEvent)
})

watch(() => chatStore.messages.length, () => {
  if (isScrolledToBottom.value) scrollToBottom()
  else showNewMessagesIndicator.value = true
})
</script>

<template>
  <NLayout has-sider style="height: 100%;">
    <!-- Session sidebar -->
    <NLayoutSider
      v-if="!focusMode"
      :width="260"
      bordered
      content-style="display:flex;flex-direction:column;height:100%;"
    >
      <!-- New session button -->
      <div style="padding: 8px;">
        <NButton
          size="small"
          block
          type="primary"
          secondary
          @click="handleNewSession"
        >
          <template #icon><AddOutline /></template>
          {{ t('chat.newConversation') }}
        </NButton>
      </div>

      <!-- Search + cron filter -->
      <div style="padding: 0 8px 8px 8px;">
        <NInput
          v-model:value="sessionSearch"
          :placeholder="t('chat.searchSessions')"
          size="small"
          clearable
        />
        <NSpace align="center" style="margin-top: 6px; padding: 0 2px;" :size="6">
          <NSwitch v-model:value="hideCronSessions" size="small" />
          <NText depth="3" style="font-size: 11px;">{{ t('chat.hideCron') }}</NText>
        </NSpace>
      </div>

      <!-- Session list -->
      <NScrollbar style="flex: 1;">
        <NEmpty
          v-if="!filteredSessions.length"
          :description="t('chat.noSessions')"
          style="padding: 24px;"
        />
        <NList v-else hoverable clickable>
          <NListItem
            v-for="s in filteredSessions"
            :key="s.sessionKey"
            :class="{ 'session-active': s.sessionKey === chatStore.currentSessionKey }"
            @click="selectSession(s.sessionKey)"
          >
            <div class="session-item">
              <div class="session-item__top">
                <NText
                  style="font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1;"
                  :strong="s.sessionKey === chatStore.currentSessionKey"
                >
                  {{ s.title ?? s.sessionKey }}
                </NText>
                <NText v-if="s.updatedAt" depth="3" style="font-size: 10px; white-space: nowrap;">
                  {{ formatSessionTime(s.updatedAt) }}
                </NText>
              </div>
              <NSpace :size="6" style="margin-top: 2px;" align="center">
                <NTag v-if="s.channel" size="tiny" round>
                  <template #icon><ChatbubblesOutline style="width:12px;height:12px;" /></template>
                  {{ s.channel }}
                </NTag>
                <NText v-if="s.agentId" depth="3" style="font-size: 11px;">
                  {{ s.agentId }}
                </NText>
                <NText depth="3" style="font-size: 11px;">
                  {{ s.messageCount ?? 0 }} {{ t('chat.msgs') }}
                </NText>
                <NText v-if="s.tokenCount" depth="3" style="font-size: 10px;">
                  {{ s.tokenCount }} {{ t('chat.tok') }}
                </NText>
              </NSpace>
            </div>
          </NListItem>
        </NList>
      </NScrollbar>

      <!-- Refresh button -->
      <div style="padding: 8px; border-top: 1px solid var(--n-border-color);">
        <NButton size="small" block secondary @click="chatStore.fetchSessions()">
          <template #icon><RefreshOutline /></template>
          {{ t('common.refresh') }}
        </NButton>
      </div>
    </NLayoutSider>

    <!-- Main chat area -->
    <NLayoutContent style="display: flex; flex-direction: column; height: 100%;">
      <!-- Top bar -->
      <div v-if="chatStore.currentSessionKey || focusMode" class="chat-topbar">
        <NSpace align="center" :size="8">
          <NTag size="small" round>
            {{ chatStore.currentSessionKey ?? t('chat.newConversation') }}
          </NTag>
        </NSpace>
        <NSpace align="center" :size="8">
          <!-- Agent selector -->
          <NSelect
            v-model:value="selectedAgent"
            :options="agentOptions"
            :placeholder="t('chat.agent')"
            size="small"
            clearable
            style="width: 140px;"
          />
          <!-- Model selector -->
          <NSelect
            v-model:value="selectedModel"
            :options="modelOptions"
            :placeholder="t('chat.model')"
            size="small"
            clearable
            style="width: 160px;"
          />
          <!-- Thinking level -->
          <NSelect
            v-model:value="thinkingLevel"
            :options="thinkingOptions"
            size="small"
            style="width: 100px;"
          />
          <!-- Focus mode toggle -->
          <NTooltip trigger="hover" placement="bottom">
            <template #trigger>
              <NButton quaternary circle size="small" @click="toggleFocusMode">
                <template #icon>
                  <ContractOutline v-if="!focusMode" />
                  <ExpandOutline v-else />
                </template>
              </NButton>
            </template>
            {{ focusMode ? t('chat.showSidebar') : t('chat.focusMode') }}
          </NTooltip>
        </NSpace>
      </div>

      <!-- Fallback alert -->
      <NAlert
        v-if="chatStore.lastFallback"
        type="warning"
        closable
        style="margin: 4px 12px 0 12px;"
        @close="chatStore.dismissFallback()"
      >
        Provider fallback: {{ chatStore.lastFallback.from }} &rarr; {{ chatStore.lastFallback.to }}
      </NAlert>

      <!-- Error alert -->
      <NAlert
        v-if="chatStore.error"
        type="error"
        closable
        style="margin: 4px 12px 0 12px;"
        @close="chatStore.error = null"
      >
        {{ chatStore.error }}
      </NAlert>

      <!-- Chat messages area -->
      <div style="flex: 1; position: relative; overflow: hidden;">
        <NScrollbar
          ref="scrollbarRef"
          style="height: 100%; padding: 12px;"
          @scroll="handleMessagesScroll"
        >
          <NEmpty
            v-if="!chatStore.messages.length"
            :description="chatStore.currentSessionKey ? t('chat.noMessagesYet') : t('chat.startNew')"
            style="margin-top: 60px;"
          />
          <ChatMessage
            v-for="(msg, i) in chatStore.messages"
            :key="msg.id ?? i"
            :message="msg"
          />
          <div ref="messagesEndRef" style="height: 1px;" />
        </NScrollbar>

        <!-- New messages indicator -->
        <div
          v-if="showNewMessagesIndicator"
          class="new-messages-indicator"
          @click="scrollToBottom"
        >
          <NButton size="small" type="info" round>
            <template #icon><ChevronDownOutline /></template>
            {{ t('chat.newMessages') }}
          </NButton>
        </div>
      </div>

      <!-- Chat input (always visible) -->
      <ChatInput
        :streaming="chatStore.streaming"
        :disabled="!conn.isConnected"
        :disabled-reason="!conn.isConnected ? 'Connect to the gateway first' : undefined"
        @send="handleSend"
        @abort="handleAbort"
      />
    </NLayoutContent>
  </NLayout>
</template>

<style scoped>
.session-active {
  background: rgba(24, 160, 88, 0.08);
}
.session-item {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.session-item__top {
  display: flex;
  align-items: center;
  gap: 6px;
}
.chat-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 12px;
  border-bottom: 1px solid var(--n-border-color);
  flex-shrink: 0;
  min-height: 40px;
  gap: 8px;
  flex-wrap: wrap;
}
.new-messages-indicator {
  position: absolute;
  bottom: 8px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10;
  cursor: pointer;
}
</style>
