<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { NSpace, NTag, NText, NButton, NTooltip } from 'naive-ui'
import {
  PersonCircleOutline,
  ChatbubbleEllipsesOutline,
  SettingsOutline,
  BuildOutline,
  CopyOutline,
  ImageOutline,
} from '@vicons/ionicons5'
import MarkdownRenderer from '@renderer/components/common/MarkdownRenderer.vue'
import ToolCallCard from '@renderer/components/chat/ToolCallCard.vue'
import ThinkingBlock from '@renderer/components/chat/ThinkingBlock.vue'
import type { ChatMessage as ChatMessageType } from '@renderer/stores/chat'

const { t } = useI18n()

const props = defineProps<{
  message: ChatMessageType
}>()

const isUser = computed(() => props.message.role === 'user')
const isAssistant = computed(() => props.message.role === 'assistant')
const isSystem = computed(() => props.message.role === 'system')
const isTool = computed(() => props.message.role === 'tool')

const hasThinking = computed(() => !!props.message.thinking)
const hasToolCalls = computed(
  () => props.message.toolCalls && props.message.toolCalls.length > 0,
)
const hasAttachments = computed(
  () => props.message.attachments && props.message.attachments.length > 0,
)
const hasError = computed(() => !!props.message.error)

const relativeTime = computed(() => {
  if (!props.message.timestamp) return ''
  try {
    const now = Date.now()
    const then = new Date(props.message.timestamp).getTime()
    const diffMs = now - then
    if (diffMs < 60_000) return t('chat.justNow')
    const mins = Math.floor(diffMs / 60_000)
    if (mins < 60) return `${mins}${t('chat.minutesAgo')}`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}${t('chat.hoursAgo')}`
    const days = Math.floor(hours / 24)
    return `${days}${t('chat.daysAgo')}`
  } catch {
    return ''
  }
})

const roleTagType = computed(() => {
  if (isUser.value) return 'info'
  if (isAssistant.value) return 'success'
  if (isSystem.value) return 'warning'
  if (isTool.value) return 'default'
  return 'default'
})

const roleLabel = computed(() => {
  const roleMap: Record<string, string> = {
    user: t('chat.roleUser'),
    assistant: t('chat.roleAssistant'),
    system: t('chat.roleSystem'),
    tool: t('chat.roleTool'),
  }
  return roleMap[props.message.role] ?? props.message.role
})

function copyContent() {
  navigator.clipboard.writeText(props.message.content).catch(() => {
    // ignore clipboard errors
  })
}

function toggleThinking() {
  // Use mutable prop pattern: message is a reactive object from the store
  const msg = props.message as ChatMessageType
  msg.thinkingVisible = !msg.thinkingVisible
}
</script>

<template>
  <div
    class="chat-message"
    :class="{
      'chat-message--user': isUser,
      'chat-message--assistant': isAssistant,
      'chat-message--system': isSystem,
      'chat-message--tool': isTool,
      'chat-message--error': hasError,
    }"
  >
    <!-- Header -->
    <div class="chat-message__header">
      <NSpace align="center" :size="6">
        <component
          :is="isUser ? PersonCircleOutline : isAssistant ? ChatbubbleEllipsesOutline : isTool ? BuildOutline : SettingsOutline"
          class="chat-message__avatar"
        />
        <NTag size="tiny" :type="roleTagType" round>
          {{ roleLabel }}
        </NTag>
        <NText v-if="relativeTime" depth="3" style="font-size: 11px;">
          {{ relativeTime }}
        </NText>
        <NTag v-if="message.streaming" size="tiny" type="warning" round>
          <span class="streaming-dots">
            <span>.</span><span>.</span><span>.</span>
          </span>
        </NTag>
        <NTag v-if="message.aborted" size="tiny" type="error" round>
          {{ t('chat.aborted') }}
        </NTag>
        <NTag v-if="message.fallback" size="tiny" type="warning" round>
          Fallback: {{ message.fallback.from }} &rarr; {{ message.fallback.to }}
        </NTag>
      </NSpace>
      <NTooltip trigger="hover" placement="top">
        <template #trigger>
          <NButton
            quaternary
            circle
            size="tiny"
            class="chat-message__copy"
            @click="copyContent"
          >
            <template #icon><CopyOutline /></template>
          </NButton>
        </template>
        {{ t('chat.copyMessage') }}
      </NTooltip>
    </div>

    <!-- Thinking block -->
    <ThinkingBlock
      v-if="hasThinking"
      :content="message.thinking!"
      :visible="message.thinkingVisible ?? false"
      @toggle="toggleThinking"
    />

    <!-- Attachments (images) -->
    <div v-if="hasAttachments" class="chat-message__attachments">
      <template v-for="(att, i) in message.attachments" :key="i">
        <img
          v-if="att.type === 'image'"
          :src="att.data.startsWith('data:') ? att.data : `data:${att.mimeType ?? 'image/png'};base64,${att.data}`"
          :alt="att.name"
          class="chat-message__image"
        />
        <NTag v-else size="small" round>
          <template #icon><ImageOutline /></template>
          {{ att.name }}
        </NTag>
      </template>
    </div>

    <!-- Message body -->
    <div class="chat-message__body">
      <template v-if="isSystem || isTool">
        <NText :depth="hasError ? undefined : 3" :type="hasError ? 'error' : undefined" style="font-size: 13px;">
          {{ message.content }}
        </NText>
      </template>
      <template v-else-if="isUser">
        <div class="chat-message__user-text">{{ message.content }}</div>
      </template>
      <template v-else>
        <MarkdownRenderer :content="message.content" />
        <span v-if="message.streaming" class="streaming-cursor" />
      </template>
    </div>

    <!-- Tool calls -->
    <div v-if="hasToolCalls" class="chat-message__tool-calls">
      <ToolCallCard
        v-for="tc in message.toolCalls"
        :key="tc.id"
        :tool-call="tc"
      />
    </div>
  </div>
</template>

<style scoped>
.chat-message {
  padding: 10px 14px;
  border-radius: 8px;
  margin-bottom: 8px;
  position: relative;
}
.chat-message--user {
  background: rgba(24, 160, 88, 0.08);
  max-width: 85%;
  margin-left: auto;
}
.chat-message--assistant {
  background: var(--n-color);
  max-width: 100%;
}
.chat-message--system,
.chat-message--tool {
  background: rgba(128, 128, 128, 0.08);
  font-size: 12px;
  max-width: 100%;
}
.chat-message--error {
  border-left: 3px solid #d03050;
  background: rgba(208, 48, 80, 0.06);
}
.chat-message__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  margin-bottom: 6px;
}
.chat-message__avatar {
  width: 18px;
  height: 18px;
  color: var(--n-text-color-3);
}
.chat-message__copy {
  opacity: 0;
  transition: opacity 0.15s;
}
.chat-message:hover .chat-message__copy {
  opacity: 1;
}
.chat-message__user-text {
  white-space: pre-wrap;
  word-break: break-word;
}
.chat-message__body {
  position: relative;
}
.chat-message__attachments {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 8px;
}
.chat-message__image {
  max-width: 200px;
  max-height: 150px;
  border-radius: 6px;
  border: 1px solid var(--n-border-color);
  object-fit: cover;
  cursor: pointer;
}
.chat-message__tool-calls {
  margin-top: 8px;
}

/* Streaming cursor animation */
.streaming-cursor {
  display: inline-block;
  width: 2px;
  height: 16px;
  background: var(--n-text-color);
  margin-left: 2px;
  vertical-align: text-bottom;
  animation: blink 1s step-end infinite;
}
@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}

/* Streaming dots animation */
.streaming-dots span {
  animation: dot-pulse 1.4s infinite;
  font-weight: bold;
}
.streaming-dots span:nth-child(2) { animation-delay: 0.2s; }
.streaming-dots span:nth-child(3) { animation-delay: 0.4s; }
@keyframes dot-pulse {
  0%, 80%, 100% { opacity: 0.2; }
  40% { opacity: 1; }
}
</style>
