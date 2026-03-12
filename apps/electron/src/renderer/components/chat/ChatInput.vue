<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { NButton, NSpace, NText, NTooltip, NTag } from 'naive-ui'
import {
  SendOutline,
  StopCircleOutline,
  AttachOutline,
  CloseCircleOutline,
} from '@vicons/ionicons5'
import type { Attachment } from '@renderer/stores/chat'

const props = defineProps<{
  streaming?: boolean
  disabled?: boolean
  disabledReason?: string
}>()

const emit = defineEmits<{
  send: [message: string, images: Array<{ data: string; mimeType: string }>]
  abort: []
}>()

const { t } = useI18n()

const text = ref('')
const attachments = ref<Attachment[]>([])
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)

const charCount = computed(() => text.value.length)
const hasContent = computed(() => text.value.trim().length > 0 || attachments.value.length > 0)

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    submit()
  }
}

function submit() {
  const msg = text.value.trim()
  if ((!msg && attachments.value.length === 0) || props.disabled) return

  const images = attachments.value
    .filter((a) => a.type === 'image')
    .map((a) => ({ data: a.data, mimeType: a.mimeType ?? 'image/png' }))

  emit('send', msg, images)
  text.value = ''
  attachments.value = []
  // Reset textarea height
  if (textareaRef.value) {
    textareaRef.value.style.height = 'auto'
  }
}

function handlePaste(e: ClipboardEvent) {
  const items = e.clipboardData?.items
  if (!items) return

  for (const item of items) {
    if (item.type.startsWith('image/')) {
      e.preventDefault()
      const file = item.getAsFile()
      if (file) addImageFile(file)
      return
    }
  }
}

function handleFileSelect(e: Event) {
  const target = e.target as HTMLInputElement
  const files = target.files
  if (!files) return

  for (const file of files) {
    if (file.type.startsWith('image/')) {
      addImageFile(file)
    }
  }
  target.value = ''
}

function addImageFile(file: File) {
  const reader = new FileReader()
  reader.onload = () => {
    const dataUrl = reader.result as string
    attachments.value.push({
      type: 'image',
      name: file.name,
      data: dataUrl,
      mimeType: file.type,
    })
  }
  reader.readAsDataURL(file)
}

function removeAttachment(index: number) {
  attachments.value.splice(index, 1)
}

function handleTextareaInput(e: Event) {
  const el = e.target as HTMLTextAreaElement
  el.style.height = 'auto'
  el.style.height = Math.min(el.scrollHeight, 200) + 'px'
}

function openFilePicker() {
  fileInputRef.value?.click()
}
</script>

<template>
  <div class="chat-input">
    <!-- Attachment previews -->
    <div v-if="attachments.length > 0" class="chat-input__previews">
      <div
        v-for="(att, i) in attachments"
        :key="i"
        class="chat-input__preview"
      >
        <img
          v-if="att.type === 'image'"
          :src="att.data"
          :alt="att.name"
          class="chat-input__preview-img"
        />
        <NTag v-else size="small">{{ att.name }}</NTag>
        <NButton
          quaternary
          circle
          size="tiny"
          class="chat-input__preview-remove"
          @click="removeAttachment(i)"
        >
          <template #icon><CloseCircleOutline /></template>
        </NButton>
      </div>
    </div>

    <!-- Textarea row -->
    <div class="chat-input__row">
      <NTooltip v-if="disabled && disabledReason" trigger="hover" placement="top">
        <template #trigger>
          <textarea
            ref="textareaRef"
            v-model="text"
            class="chat-input__textarea"
            :class="{ 'chat-input__textarea--disabled': disabled }"
            :placeholder="streaming ? t('chat.generating') : disabled ? t('chat.notConnected') : t('chat.placeholder')"
            :disabled="disabled"
            rows="2"
            @keydown="handleKeydown"
            @paste="handlePaste"
            @input="handleTextareaInput"
          />
        </template>
        {{ disabledReason }}
      </NTooltip>
      <textarea
        v-else
        ref="textareaRef"
        v-model="text"
        class="chat-input__textarea"
        :class="{ 'chat-input__textarea--disabled': disabled }"
        :placeholder="streaming ? t('chat.generating') : disabled ? t('chat.notConnected') : t('chat.placeholder')"
        :disabled="disabled || streaming"
        rows="2"
        @keydown="handleKeydown"
        @paste="handlePaste"
        @input="handleTextareaInput"
      />
    </div>

    <!-- Actions row -->
    <div class="chat-input__actions">
      <NSpace align="center" :size="8">
        <NButton
          quaternary
          circle
          size="small"
          :disabled="disabled || streaming"
          @click="openFilePicker"
        >
          <template #icon><AttachOutline /></template>
        </NButton>
        <input
          ref="fileInputRef"
          type="file"
          accept="image/*"
          multiple
          style="display: none;"
          @change="handleFileSelect"
        />
        <NText depth="3" style="font-size: 11px;">{{ charCount }}</NText>
      </NSpace>
      <NSpace align="center" :size="8">
        <NButton
          v-if="streaming"
          type="error"
          size="small"
          @click="emit('abort')"
        >
          <template #icon><StopCircleOutline /></template>
          {{ t('chat.abort') }}
        </NButton>
        <NButton
          v-else
          type="primary"
          size="small"
          :disabled="!hasContent || disabled"
          :loading="streaming"
          @click="submit"
        >
          <template #icon><SendOutline /></template>
          {{ t('chat.send') }}
        </NButton>
      </NSpace>
    </div>
  </div>
</template>

<style scoped>
.chat-input {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px 12px;
  border-top: 1px solid var(--n-border-color);
  background: var(--n-color);
}
.chat-input__row {
  display: flex;
  width: 100%;
}
.chat-input__textarea {
  width: 100%;
  resize: none;
  border: 1px solid var(--n-border-color);
  border-radius: 6px;
  padding: 8px 10px;
  font-family: inherit;
  font-size: 14px;
  line-height: 1.5;
  background: transparent;
  color: var(--n-text-color);
  outline: none;
  min-height: 40px;
  max-height: 200px;
  overflow-y: auto;
  transition: border-color 0.2s;
}
.chat-input__textarea:focus {
  border-color: #18a058;
}
.chat-input__textarea--disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.chat-input__textarea::placeholder {
  color: var(--n-text-color-3);
}
.chat-input__actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.chat-input__previews {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding-bottom: 4px;
}
.chat-input__preview {
  position: relative;
  display: inline-block;
}
.chat-input__preview-img {
  width: 60px;
  height: 60px;
  border-radius: 6px;
  object-fit: cover;
  border: 1px solid var(--n-border-color);
}
.chat-input__preview-remove {
  position: absolute;
  top: -6px;
  right: -6px;
  background: var(--n-color);
  border-radius: 50%;
}
</style>
