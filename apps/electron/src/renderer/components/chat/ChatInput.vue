<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { NButton, NSpace, NText, NTooltip, NTag } from 'naive-ui'
import {
  SendOutline,
  StopCircleOutline,
  AttachOutline,
  CloseCircleOutline,
  MicOutline,
  DocumentOutline,
} from '@vicons/ionicons5'
import type { Attachment } from '@renderer/stores/chat'

const props = defineProps<{
  streaming?: boolean
  disabled?: boolean
  disabledReason?: string
}>()

const emit = defineEmits<{
  send: [
    message: string,
    images: Array<{ data: string; mimeType: string }>,
    files: Array<{ data: string; name: string; mimeType: string }>,
  ]
  abort: []
}>()

const { t } = useI18n()

const text = ref('')
const attachments = ref<Attachment[]>([])
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)

// ASR state
const isRecording = ref(false)
const recordingSeconds = ref(0)
let recognition: SpeechRecognition | null = null
let recordingTimer: ReturnType<typeof setInterval> | null = null

const charCount = computed(() => text.value.length)
const hasContent = computed(() => text.value.trim().length > 0 || attachments.value.length > 0)

const imageAttachments = computed(() => attachments.value.filter(a => a.type === 'image'))
const fileAttachments = computed(() => attachments.value.filter(a => a.type === 'file'))

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    submit()
  }
}

function submit() {
  const msg = text.value.trim()
  if ((!msg && attachments.value.length === 0) || props.disabled) return

  const images = imageAttachments.value
    .map((a) => ({ data: a.data, mimeType: a.mimeType ?? 'image/png' }))

  const files = fileAttachments.value
    .map((a) => ({ data: a.data, name: a.name, mimeType: a.mimeType ?? 'application/octet-stream' }))

  emit('send', msg, images, files)
  text.value = ''
  attachments.value = []
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
      if (file) addFile(file)
      return
    }
  }
}

function handleFileSelect(e: Event) {
  const target = e.target as HTMLInputElement
  const files = target.files
  if (!files) return

  for (const file of files) {
    addFile(file)
  }
  target.value = ''
}

function addFile(file: File) {
  const isImage = file.type.startsWith('image/')
  const reader = new FileReader()
  reader.onload = () => {
    const dataUrl = reader.result as string
    attachments.value.push({
      type: isImage ? 'image' : 'file',
      name: file.name,
      data: dataUrl,
      mimeType: file.type || 'application/octet-stream',
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

// --- ASR (Speech-to-Text) ---
const SpeechRecognitionAPI = (window as Record<string, unknown>).SpeechRecognition
  ?? (window as Record<string, unknown>).webkitSpeechRecognition

const asrSupported = !!SpeechRecognitionAPI

function toggleRecording() {
  if (isRecording.value) {
    stopRecording()
  } else {
    startRecording()
  }
}

function startRecording() {
  if (!SpeechRecognitionAPI) return

  recognition = new (SpeechRecognitionAPI as new () => SpeechRecognition)()
  recognition.continuous = true
  recognition.interimResults = true
  recognition.lang = document.documentElement.lang || 'zh-CN'

  let finalTranscript = ''

  recognition.onresult = (event: SpeechRecognitionEvent) => {
    let interim = ''
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i]
      if (result.isFinal) {
        finalTranscript += result[0].transcript
      } else {
        interim += result[0].transcript
      }
    }
    // Append recognized text to current input
    const before = text.value.replace(/\s*\[.*?\]\s*$/, '') // remove interim marker
    text.value = (finalTranscript ? before + finalTranscript : before)
      + (interim ? ` [${interim}]` : '')
  }

  recognition.onend = () => {
    // Clean up interim markers
    text.value = text.value.replace(/\s*\[.*?\]\s*$/, '')
    if (finalTranscript) {
      text.value = text.value.endsWith(finalTranscript)
        ? text.value
        : text.value + finalTranscript
    }
    isRecording.value = false
    recordingSeconds.value = 0
    if (recordingTimer) {
      clearInterval(recordingTimer)
      recordingTimer = null
    }
  }

  recognition.onerror = () => {
    isRecording.value = false
    recordingSeconds.value = 0
    if (recordingTimer) {
      clearInterval(recordingTimer)
      recordingTimer = null
    }
  }

  finalTranscript = ''
  recognition.start()
  isRecording.value = true
  recordingSeconds.value = 0
  recordingTimer = setInterval(() => {
    recordingSeconds.value++
  }, 1000)
}

function stopRecording() {
  recognition?.stop()
  recognition = null
  isRecording.value = false
  if (recordingTimer) {
    clearInterval(recordingTimer)
    recordingTimer = null
  }
}

function formatRecordingTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

onUnmounted(() => {
  stopRecording()
})
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
        <NTag v-else size="small" round>
          <template #icon><DocumentOutline style="width:12px;height:12px;" /></template>
          {{ att.name }}
        </NTag>
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
      <NSpace align="center" :size="6">
        <!-- File attach -->
        <NTooltip trigger="hover" placement="top">
          <template #trigger>
            <NButton
              quaternary
              circle
              size="small"
              :disabled="disabled || streaming"
              @click="openFilePicker"
            >
              <template #icon><AttachOutline /></template>
            </NButton>
          </template>
          {{ t('chat.attachFile') }}
        </NTooltip>
        <input
          ref="fileInputRef"
          type="file"
          accept="image/*,.pdf,.doc,.docx,.txt,.md,.json,.csv,.xlsx,.xls,.pptx,.zip"
          multiple
          style="display: none;"
          @change="handleFileSelect"
        />

        <!-- ASR microphone -->
        <NTooltip v-if="asrSupported" trigger="hover" placement="top">
          <template #trigger>
            <NButton
              :type="isRecording ? 'error' : undefined"
              :quaternary="!isRecording"
              circle
              size="small"
              :disabled="disabled || streaming"
              @click="toggleRecording"
            >
              <template #icon><MicOutline /></template>
            </NButton>
          </template>
          {{ isRecording ? t('chat.stopRecording') : t('chat.voiceInput') }}
        </NTooltip>

        <!-- Recording indicator -->
        <NText v-if="isRecording" type="error" style="font-size: 12px;">
          <span class="recording-dot" /> {{ formatRecordingTime(recordingSeconds) }}
        </NText>

        <NText v-else depth="3" style="font-size: 11px;">{{ charCount }}</NText>
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
  padding: 12px 14px;
  border-top: 2px solid var(--n-border-color);
  background: var(--n-color);
  flex-shrink: 0;
}
.chat-input__row {
  display: flex;
  width: 100%;
}
.chat-input__textarea {
  width: 100%;
  resize: none;
  border: 2px solid var(--n-border-color);
  border-radius: 8px;
  padding: 10px 12px;
  font-family: inherit;
  font-size: 14px;
  line-height: 1.5;
  background: transparent;
  color: var(--n-text-color);
  outline: none;
  min-height: 44px;
  max-height: 200px;
  overflow-y: auto;
  transition: border-color 0.2s, box-shadow 0.2s;
}
.chat-input__textarea:focus {
  border-color: #18a058;
  box-shadow: 0 0 0 2px rgba(24, 160, 88, 0.15);
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
  display: inline-flex;
  align-items: center;
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

/* Recording dot animation */
.recording-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  background: #d03050;
  border-radius: 50%;
  margin-right: 4px;
  vertical-align: middle;
  animation: pulse-dot 1s ease-in-out infinite;
}
@keyframes pulse-dot {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}
</style>
