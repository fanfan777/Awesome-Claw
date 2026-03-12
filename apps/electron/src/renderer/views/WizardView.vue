<script setup lang="ts">
import { onMounted, computed, watch, ref, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import {
  NButton, NSpace, NSpin, NText, NInput, NInputNumber, NSelect,
  NAlert, NCard, NCheckboxGroup, NCheckbox,
  NProgress, NResult, NSteps, NStep, NDivider, NIcon,
  useMessage
} from 'naive-ui'
import type { SelectOption } from 'naive-ui'
import {
  CheckmarkCircle as CheckmarkCircleIcon,
  AlertCircle as AlertCircleIcon,
  Refresh as RefreshIcon,
  ChevronForward as ChevronForwardIcon
} from '@vicons/ionicons5'
import { useWizardStore } from '@renderer/stores/wizard'
import { useConnectionStore } from '@renderer/gateway/connection'
import { useWizardStepLocale, maskSensitiveContent } from '@renderer/composables/useWizardStepLocale'
import MarkdownRenderer from '@renderer/components/common/MarkdownRenderer.vue'

const { t, locale } = useI18n()
const router = useRouter()
const store = useWizardStore()
const connStore = useConnectionStore()

const message = useMessage()
const { localizedStep, autoSubmit } = useWizardStepLocale(() => store.stepData)

const langOptions: SelectOption[] = [
  { label: 'English', value: 'en' },
  { label: '中文', value: 'zh-CN' },
]

const EMOJI_OPTIONS = ['🤖', '🧠', '🐱', '🐶', '🦊', '🐼', '🦉', '🐙', '🌟', '⚡', '🔮', '🎯', '💡', '🚀', '🎨', '🌈']

// Sync locale whenever language changes
watch(() => store.language, (lang) => {
  locale.value = lang
}, { immediate: true })

// ── Provider key auto-detection ──

const pendingApiKey = ref<string | null>(null)
const showAllProviders = ref(false)
const selectedProvider = ref<string | null>(null)
const customBaseUrl = ref('')

// ── Feishu combined: server sends Secret first, then App ID ──
const pendingFeishuAppId = ref<string | null>(null)
const feishuAppIdInput = ref('')

const KEY_PREFIX_MAP: Array<{ prefix: string; provider: string }> = [
  { prefix: 'sk-ant-', provider: 'anthropic' },
  { prefix: 'sk-or-', provider: 'openrouter' },
  { prefix: 'sk-', provider: 'openai' },
  { prefix: 'AIza', provider: 'google' },
  { prefix: 'xai-', provider: 'xai' },
]

const POPULAR_PROVIDER_IDS = new Set([
  'anthropic', 'openai', 'google', 'moonshot', 'qwen',
  'minimax', 'volcengine', 'xai', 'mistral', 'custom',
])

function detectProviderFromKey(key: string): string | null {
  const trimmed = key.trim()
  for (const { prefix, provider } of KEY_PREFIX_MAP) {
    if (trimmed.startsWith(prefix)) return provider
  }
  return null
}

// ── Computed ──

const phaseStepStatus = computed(() => {
  return (index: number): 'process' | 'finish' | 'wait' => {
    if (index < store.phaseIndex) return 'finish'
    if (index === store.phaseIndex) return 'process'
    return 'wait'
  }
})

// Auto-submit: skip developer/CLI-specific steps in Electron context
const isAuthMethodStep = computed(() =>
  store.stepData?.type === 'select' && (store.stepData?.message?.endsWith('auth method') ?? false),
)

const isAutoStep = computed(() => {
  if (!store.stepData || store.error) return false
  // Replaying previous answers after "back"
  if (store.replayQueue.length > 0) return true
  // Always auto-select API Key in auth method sub-select
  if (isAuthMethodStep.value) return true
  // Auto-fill key input when pending
  if (pendingApiKey.value && store.stepData.type === 'text' && store.stepData.sensitive) return true
  // Feishu App ID auto-submit (combined with App Secret page)
  if (pendingFeishuAppId.value && isFeishuAppIdStep.value) return true
  return autoSubmit.value?.shouldAuto === true
})

const lastAutoStepId = ref<string | null>(null)

function findApiKeyOption() {
  return store.stepData?.options?.find(o =>
    String(o.value).toLowerCase().includes('apikey') ||
    String(o.value).toLowerCase().includes('api-key') ||
    String(o.label).toLowerCase().includes('api key'),
  )
}

watch(() => store.loading, (newVal, oldVal) => {
  if (oldVal && !newVal && store.stepData && !store.error && store.stepData.id !== lastAutoStepId.value) {
    // Replay queue (highest priority — replaying after "back")
    const replay = store.consumeReplayAnswer(store.stepData)
    if (replay) {
      // Preserve provider selection during replay
      if (isProviderStep.value && replay.answer) {
        selectedProvider.value = String(replay.answer)
      }
      lastAutoStepId.value = store.stepData.id
      nextTick(() => { store.submitAnswer(replay.answer, { auto: true }) })
      return
    }

    // Connection test notes → show toast for failures, skip silently for success
    if (store.stepData.type === 'note' && store.stepData.title?.includes('connection test')) {
      const msg = store.stepData.message ?? ''
      if (msg.includes('Connected as') || msg.includes('已连接为')) {
        message.success(locale.value.startsWith('zh') ? '连接成功' : 'Connected', { duration: 2000 })
      } else {
        const reason = msg.replace(/^(Connection failed:|Connection test failed:|连接失败：|连接测试失败：)\s*/, '')
        message.error(locale.value.startsWith('zh') ? `连接失败：${reason}` : `Connection failed: ${reason}`, { duration: 5000 })
      }
    }

    // Show channel fork when first channel step appears after model setup
    if (hasPassedModelSetup.value && isChannelSelectStep(store.stepData) && !showChannelFork.value) {
      showChannelFork.value = true
      return
    }

    // Static auto-submit rules
    const auto = autoSubmit.value
    if (auto?.shouldAuto) {
      let submitValue = auto.value
      // Plugin install: prefer local path if available, else npm (auto-download)
      if (submitValue === '__auto_plugin__' && store.stepData.options) {
        const hasLocal = store.stepData.options.some(o => String(o.value) === 'local')
        submitValue = hasLocal ? 'local' : 'npm'
      }
      lastAutoStepId.value = store.stepData.id
      nextTick(() => { store.submitAnswer(submitValue, { auto: true }) })
      return
    }

    // Auth method sub-select → always auto-select API Key variant
    if (isAuthMethodStep.value) {
      const apiKeyOpt = findApiKeyOption()
      if (apiKeyOpt) {
        lastAutoStepId.value = store.stepData.id
        nextTick(() => { store.submitAnswer(apiKeyOpt.value, { auto: true }) })
        return
      }
    }

    // Pending Feishu App ID → auto-fill when App ID step appears
    if (pendingFeishuAppId.value && isFeishuAppIdStep.value) {
      store.currentAnswer = pendingFeishuAppId.value
      pendingFeishuAppId.value = null
      lastAutoStepId.value = store.stepData.id
      nextTick(() => { store.submitAnswer(undefined, { auto: true }) })
      return
    }

    // Pending API key → auto-fill sensitive text input
    if (pendingApiKey.value && store.stepData.type === 'text' && store.stepData.sensitive) {
      store.currentAnswer = pendingApiKey.value
      pendingApiKey.value = null
      lastAutoStepId.value = store.stepData.id
      nextTick(() => { store.submitAnswer(undefined, { auto: true }) })
      return
    }
  }
})

const stepTitle = computed(() => localizedStep.value?.title ?? '')
const stepMessage = computed(() => {
  const msg = localizedStep.value?.message ?? ''
  return maskSensitiveContent(msg)
})
const hasStepMessage = computed(() => stepMessage.value.length > 0)
const displayOptions = computed(() => localizedStep.value?.options ?? store.stepData?.options ?? [])

// Provider step: split into popular / other
const isProviderStep = computed(() =>
  store.stepData?.type === 'select' && store.stepData?.message === 'Model/auth provider',
)

const popularProviderOptions = computed(() =>
  displayOptions.value.filter(o => POPULAR_PROVIDER_IDS.has(String(o.value))),
)

const otherProviderOptions = computed(() =>
  displayOptions.value.filter(o => !POPULAR_PROVIDER_IDS.has(String(o.value)) && o.value !== 'skip'),
)

const skipProviderOption = computed(() =>
  displayOptions.value.find(o => o.value === 'skip'),
)

const isApiKeyStep = computed(() => {
  if (!store.stepData || store.stepData.type !== 'text') return false
  const msg = stepMessage.value || store.stepData.message || ''
  return msg.includes('API Key') || msg.includes('API key') || msg.includes('api key') || msg.includes('令牌') || msg.includes('token') || (store.stepData.sensitive === true)
})

const isNumericText = computed(() => {
  if (!store.stepData || store.stepData.type !== 'text') return false
  const initial = store.stepData.initialValue
  return typeof initial === 'number' || /^\d+$/.test(store.stepData.placeholder ?? '')
})

const isFeishuAppSecretStep = computed(() => {
  if (!store.stepData || store.stepData.type !== 'text') return false
  const msg = store.stepData.message ?? ''
  return msg.includes('Feishu App Secret') || msg.includes('飞书 App Secret')
})

const isFeishuAppIdStep = computed(() => {
  if (!store.stepData || store.stepData.type !== 'text') return false
  const msg = store.stepData.message ?? ''
  return msg.includes('Feishu App ID') || msg.includes('飞书 App ID')
})

// Detect channel selection step (fork intercept point after model key)
function isChannelSelectStep(step: { type: string; message?: string } | null): boolean {
  if (!step || step.type !== 'select') return false
  const msg = step.message ?? ''
  return msg.includes('Select channel') || msg.includes('Select a channel')
}

// Track if we've passed model setup (to intercept channel step with fork)
const hasPassedModelSetup = computed(() => {
  return store.stepHistory.some(e =>
    e.step.type === 'select' && e.step.message === 'Model/auth provider',
  )
})

// Channel fork: offer "直接进入" vs "连接渠道" after model setup
const showChannelFork = ref(false)

// Channel display enhancement — show Chinese-friendly names and descriptions
const CHANNEL_INFO: Record<string, { icon: string; zh: string; desc: string }> = {
  telegram: { icon: '✈️', zh: 'Telegram 电报', desc: '全球流行的即时通讯' },
  discord: { icon: '🎮', zh: 'Discord', desc: '游戏与社区聊天' },
  feishu: { icon: '🐦', zh: '飞书 Feishu', desc: '字节跳动企业协作' },
  slack: { icon: '💬', zh: 'Slack', desc: '企业团队协作' },
  whatsapp: { icon: '📱', zh: 'WhatsApp', desc: '全球即时通讯' },
  signal: { icon: '🔒', zh: 'Signal', desc: '加密安全通讯' },
  msteams: { icon: '🏢', zh: 'Microsoft Teams', desc: '微软企业协作' },
  matrix: { icon: '🌐', zh: 'Matrix', desc: '去中心化通讯' },
  line: { icon: '🟢', zh: 'LINE', desc: '亚洲流行通讯' },
  irc: { icon: '💻', zh: 'IRC', desc: '经典互联网聊天' },
  googlechat: { icon: '📧', zh: 'Google Chat', desc: 'Google 工作区' },
  mattermost: { icon: '📢', zh: 'Mattermost', desc: '开源企业通讯' },
  nostr: { icon: '🔗', zh: 'Nostr', desc: '去中心化社交' },
  bluebubbles: { icon: '🫧', zh: 'BlueBubbles', desc: 'iMessage 桥接' },
  twitch: { icon: '🎬', zh: 'Twitch', desc: '直播平台聊天' },
  zalo: { icon: '💙', zh: 'Zalo', desc: '越南流行通讯' },
  synologychat: { icon: '🗂️', zh: 'Synology Chat', desc: '群晖 NAS 聊天' },
  nextcloudtalk: { icon: '☁️', zh: 'Nextcloud Talk', desc: '开源云端通讯' },
  skip: { icon: '⏭️', zh: '跳过', desc: '稍后在渠道管理中配置' },
  __skip__: { icon: '⏭️', zh: '跳过', desc: '稍后在渠道管理中配置' },
}

const isChannelStep = computed(() => {
  return store.stepData ? isChannelSelectStep(store.stepData) : false
})

const channelEnhancedOptions = computed(() => {
  if (!isChannelStep.value) return displayOptions.value
  return displayOptions.value.map(opt => {
    const key = String(opt.value).toLowerCase()
    const info = CHANNEL_INFO[key]
    if (info && locale.value.startsWith('zh')) {
      return { ...opt, label: `${info.icon} ${info.zh}`, hint: info.desc }
    }
    return opt
  })
})

// ── Phase: Welcome ──

function handleStartSetup() {
  store.advancePhase()
}

// ── Phase: Gateway (merged detect + connect) ──

const gatewayStatus = ref<'detecting' | 'starting' | 'connecting' | 'done' | 'manual'>('detecting')
const manualGatewayUrl = ref('ws://127.0.0.1:18789')
const manualConnecting = ref(false)
const gatewayStatusText = computed(() => {
  const zh = locale.value.startsWith('zh')
  switch (gatewayStatus.value) {
    case 'detecting': return zh ? '正在检测本地网关...' : 'Detecting local gateway...'
    case 'starting': return zh ? '正在启动网关服务...' : 'Starting gateway service...'
    case 'connecting': return zh ? '正在连接网关...' : 'Connecting to gateway...'
    case 'done': return zh ? '网关已就绪' : 'Gateway ready'
    case 'manual': return ''
  }
})

async function runGatewaySetup() {
  store.error = null
  gatewayStatus.value = 'detecting'

  // Step 1: Detect existing gateway
  await store.detectGateway()

  // Step 2: If not found, try auto-start
  if (!store.gatewayFound) {
    gatewayStatus.value = 'starting'
    await store.startGateway()
    if (!store.gatewayFound) {
      // Auto-start failed — show manual connection form instead of dead-end error
      gatewayStatus.value = 'manual'
      return
    }
  }

  // Step 3: Connect
  gatewayStatus.value = 'connecting'
  await store.connectToGateway()

  if (connStore.isConnected) {
    gatewayStatus.value = 'done'
  } else {
    // Connection failed — show manual form
    gatewayStatus.value = 'manual'
  }
}

async function manualConnect() {
  const url = manualGatewayUrl.value.trim()
  if (!url) return
  manualConnecting.value = true
  store.error = null
  try {
    store.gatewayUrl = url
    store.gatewayFound = true
    await store.connectToGateway()
    if (connStore.isConnected) {
      gatewayStatus.value = 'done'
    } else {
      store.error = locale.value.startsWith('zh')
        ? '连接失败，请检查地址是否正确'
        : 'Connection failed, check the URL'
    }
  } finally {
    manualConnecting.value = false
  }
}

onMounted(() => {
  if (store.phase === 'gateway-detect') {
    runGatewaySetup()
  }
})

watch(() => store.phase, async (newPhase) => {
  if (newPhase === 'gateway-detect') {
    await runGatewaySetup()
  }
  if (newPhase === 'server-wizard' && !store.sessionId) {
    // Only start a new wizard when entering for the first time.
    await store.startWizard()
  }
  // identity-setup is purely client-side, no async init needed
})

// ── Phase: Server Wizard — auto-advance interactions ──

// Key paste → auto-detect provider
function handleKeyPaste(value: string) {
  if (!value || value.length < 10 || store.loading) return
  const provider = detectProviderFromKey(value)
  if (provider) {
    pendingApiKey.value = value
    handleSelectOption(provider)
  }
}

// Select: click option → auto-submit
function handleSelectOption(value: unknown) {
  // Track provider selection for optional base URL
  if (isProviderStep.value) {
    selectedProvider.value = String(value)
    customBaseUrl.value = ''
  }
  store.currentAnswer = value
  nextTick(() => {
    store.submitAnswer(value)
  })
}

// Confirm: click → auto-submit
function handleConfirmAnswer(value: boolean) {
  store.submitAnswer(value)
}

// Text: enter or click confirm
function handleTextSubmit() {
  // Feishu combined: save App ID for auto-submit on next step
  if (isFeishuAppSecretStep.value && feishuAppIdInput.value.trim()) {
    pendingFeishuAppId.value = feishuAppIdInput.value.trim()
  }
  store.submitAnswer()
}

// Note: continue
function handleNoteContinue() {
  store.submitAnswer()
}

// Multiselect: needs explicit confirm (user picks multiple)
function handleMultiselectSubmit() {
  store.submitAnswer()
}

function handleSelectAll() {
  if (!store.stepData?.options) return
  store.currentAnswer = store.stepData.options.map((o) => o.value)
}

function handleDeselectAll() {
  store.currentAnswer = []
}

// ── Channel fork handlers ──

function handleSkipChannels() {
  showChannelFork.value = false
  // Skip channel selection and go to complete
  store.submitAnswer('__skip__', { auto: true })
}

function handleSetupChannels() {
  showChannelFork.value = false
  // Channel step is already in store.stepData, just let it render
}

// ── Phase: Complete ──

async function handleEnterApp() {
  // Apply custom base URL if user entered one during provider setup
  if (customBaseUrl.value.trim() && selectedProvider.value) {
    try {
      const client = connStore.client
      if (client) {
        await client.request('config.patch', {
          patch: {
            models: {
              providers: {
                [selectedProvider.value]: {
                  baseUrl: customBaseUrl.value.trim(),
                },
              },
            },
          },
        })
      }
    } catch {
      // best effort — user can configure later in settings
    }
  }
  store.finishWizard()
  router.push('/overview')
}

// ── Skip wizard ──

async function handleSkipWizard() {
  await store.cancelWizard()
  store.finishWizard()
  router.push('/overview')
}
</script>

<template>
  <div class="wizard-view">
    <div class="wizard-inner">
      <!-- Phase progress -->
      <div class="wizard-phases">
        <NSteps :current="store.phaseIndex + 1" size="small">
          <NStep :title="t('wizard.phases.welcome')" :status="phaseStepStatus(0)" />
          <NStep :title="t('wizard.phases.detect')" :status="phaseStepStatus(1)" />
          <NStep :title="t('wizard.phases.identity')" :status="phaseStepStatus(3)" />
          <NStep :title="t('wizard.phases.configure')" :status="phaseStepStatus(4)" />
          <NStep :title="t('wizard.phases.complete')" :status="phaseStepStatus(5)" />
        </NSteps>
      </div>

      <transition name="step-fade" mode="out-in">
        <!-- ==================== WELCOME ==================== -->
        <NCard v-if="store.phase === 'welcome'" key="welcome" class="wizard-card" :bordered="false">
          <div class="welcome-content">
            <div class="welcome-logo">OpenClaw</div>
            <h2 class="welcome-title">{{ t('wizard.welcome') }}</h2>
            <NText depth="2" class="welcome-desc">{{ t('wizard.welcomeDesc') }}</NText>

            <NDivider />

            <div class="field-row" style="justify-content: center; margin-bottom: 24px;">
              <NText class="field-label">{{ t('wizard.selectLanguage') }}</NText>
              <NSelect
                :value="store.language"
                :options="langOptions"
                style="width: 180px;"
                @update:value="store.setLanguage($event)"
              />
            </div>

            <NButton type="primary" size="large" block @click="handleStartSetup">
              {{ t('wizard.startSetup') }}
            </NButton>
          </div>
        </NCard>

        <!-- ==================== GATEWAY SETUP (merged detect+connect) ==================== -->
        <NCard
          v-else-if="store.phase === 'gateway-detect' || store.phase === 'gateway-connect'"
          key="gateway"
          class="wizard-card"
          :bordered="false"
        >
          <div class="gateway-setup">
            <!-- Progress state -->
            <div v-if="gatewayStatus !== 'manual' && gatewayStatus !== 'done'" class="gateway-progress">
              <NSpin size="large" />
              <NText depth="2" style="margin-top: 16px; font-size: 15px;">{{ gatewayStatusText }}</NText>
            </div>

            <!-- Done state (brief flash before auto-advance) -->
            <div v-else-if="gatewayStatus === 'done'" class="gateway-progress">
              <NIcon :size="48" color="#18a058">
                <CheckmarkCircleIcon />
              </NIcon>
              <NText strong style="margin-top: 12px; font-size: 15px;">{{ gatewayStatusText }}</NText>
            </div>

            <!-- Manual connection (auto-start failed) -->
            <div v-else class="gateway-manual">
              <NIcon :size="36" color="#f0a020">
                <AlertCircleIcon />
              </NIcon>
              <NText depth="2" style="margin-top: 12px; font-size: 14px;">
                {{ locale.startsWith('zh')
                  ? '未检测到本地网关，请输入远程网关地址或重试'
                  : 'Local gateway not detected. Enter a remote gateway URL or retry.' }}
              </NText>

              <NAlert v-if="store.error" type="error" closable style="margin-top: 12px; width: 100%;" @close="store.error = null">
                {{ store.error }}
              </NAlert>

              <div style="margin-top: 16px; width: 100%; max-width: 400px;">
                <NInput
                  v-model:value="manualGatewayUrl"
                  placeholder="ws://127.0.0.1:18789"
                  :disabled="manualConnecting"
                  @keyup.enter="manualConnect"
                />
              </div>

              <NSpace style="margin-top: 16px;" :size="12">
                <NButton type="primary" :loading="manualConnecting" @click="manualConnect">
                  {{ locale.startsWith('zh') ? '连接' : 'Connect' }}
                </NButton>
                <NButton secondary @click="runGatewaySetup()">
                  <template #icon><NIcon><RefreshIcon /></NIcon></template>
                  {{ locale.startsWith('zh') ? '重新检测' : 'Retry detection' }}
                </NButton>
                <NButton quaternary @click="handleSkipWizard">
                  {{ locale.startsWith('zh') ? '跳过' : 'Skip' }}
                </NButton>
              </NSpace>
            </div>
          </div>
        </NCard>

        <!-- ==================== IDENTITY SETUP ==================== -->
        <NCard v-else-if="store.phase === 'identity-setup'" key="identity" class="wizard-card" :bordered="false">
          <div class="identity-setup">
            <h3 class="step-title">{{ t('wizard.identityTitle') }}</h3>
            <NText depth="2" style="display: block; margin-bottom: 20px;">{{ t('wizard.identityDesc') }}</NText>

            <NAlert v-if="store.error" type="error" closable @close="store.error = null" style="margin-bottom: 16px;">
              {{ store.error }}
            </NAlert>

            <NSpace vertical :size="16">
              <!-- Agent emoji + name row -->
              <div class="identity-row">
                <div class="identity-emoji-section">
                  <NText depth="3" style="font-size: 12px; display: block; margin-bottom: 4px;">
                    {{ t('wizard.agentEmoji') }}
                  </NText>
                  <div class="emoji-grid">
                    <span
                      v-for="e in EMOJI_OPTIONS"
                      :key="e"
                      class="emoji-option"
                      :class="{ 'emoji-option--active': store.identityEmoji === e }"
                      @click="store.identityEmoji = e"
                    >{{ e }}</span>
                  </div>
                </div>
                <div style="flex: 1;">
                  <NText depth="3" style="font-size: 12px; display: block; margin-bottom: 4px;">
                    {{ t('wizard.agentName') }}
                  </NText>
                  <NInput
                    v-model:value="store.identityName"
                    :placeholder="t('wizard.agentNamePlaceholder')"
                  />
                </div>
              </div>

              <!-- User name -->
              <div>
                <NText depth="3" style="font-size: 12px; display: block; margin-bottom: 4px;">
                  {{ t('wizard.yourName') }}
                </NText>
                <NInput
                  v-model:value="store.userName"
                  :placeholder="t('wizard.yourNamePlaceholder')"
                />
              </div>

              <!-- Personality -->
              <div>
                <NText depth="3" style="font-size: 12px; display: block; margin-bottom: 8px;">
                  {{ t('wizard.personality') }}
                </NText>
                <NInput
                  v-model:value="store.soulText"
                  type="textarea"
                  :rows="3"
                  :placeholder="locale.startsWith('zh')
                    ? '如: 专业严谨的技术助手，回答简洁准确；或 友好活泼、善于用比喻解释复杂概念'
                    : 'e.g. A professional and precise tech assistant; or friendly and creative with analogies'"
                />
              </div>

              <NButton
                type="primary"
                block
                size="large"
                :loading="store.identitySaving"
                @click="store.saveIdentity()"
              >
                {{ t('wizard.saveAndContinue') }}
              </NButton>
            </NSpace>

            <div class="step-footer">
              <span />
              <NButton text size="small" depth="3" @click="store.phase = 'server-wizard'">
                {{ locale.startsWith('zh') ? '跳过，使用默认设置' : 'Skip, use defaults' }}
              </NButton>
            </div>
          </div>
        </NCard>

        <!-- ==================== SERVER WIZARD ==================== -->
        <NCard
          v-else-if="store.phase === 'server-wizard'"
          key="server"
          class="wizard-card"
          :bordered="false"
        >
          <!-- Channel fork: "直接进入" vs "连接渠道" -->
          <div v-if="showChannelFork" class="step-content">
            <h3 class="step-title">{{ t('wizard.forkTitle') }}</h3>
            <NText depth="2" style="display: block; margin-bottom: 20px; line-height: 1.6;">
              {{ t('wizard.forkDesc') }}
            </NText>

            <div class="option-cards">
              <div class="option-card fork-card" @click="handleSetupChannels">
                <div class="option-card-body">
                  <span class="option-label" style="font-size: 15px;">📡 {{ t('wizard.forkChannels') }}</span>
                  <span class="option-hint">{{ t('wizard.forkChannelsHint') }}</span>
                </div>
                <span class="option-arrow">&#8250;</span>
              </div>
              <div class="option-card fork-card" @click="handleSkipChannels">
                <div class="option-card-body">
                  <span class="option-label" style="font-size: 15px;">🚀 {{ t('wizard.forkSkip') }}</span>
                  <span class="option-hint">{{ t('wizard.forkSkipHint') }}</span>
                </div>
                <span class="option-arrow">&#8250;</span>
              </div>
            </div>
          </div>

          <!-- Loading / auto-configuring state -->
          <div v-else-if="(!store.stepData && !store.error) || isAutoStep" class="gateway-progress">
            <NSpin size="large" />
            <NText depth="3" style="margin-top: 12px;">
              {{ locale.startsWith('zh') ? '正在配置...' : 'Configuring...' }}
            </NText>
          </div>

          <!-- Error state (no step) -->
          <NSpace v-else-if="!store.stepData && store.error" vertical align="center" :size="16">
            <NAlert type="error" closable @close="store.error = null" style="width: 100%;">
              {{ store.error }}
            </NAlert>
            <NButton @click="store.startWizard()">{{ t('common.refresh') }}</NButton>
          </NSpace>

          <!-- Step content -->
          <div v-else-if="store.stepData" class="step-content">
            <!-- Step header -->
            <div v-if="stepTitle" class="step-header">
              <h3 class="step-title">{{ stepTitle }}</h3>
            </div>

            <!-- Step message -->
            <div v-if="hasStepMessage" class="step-message">
              <MarkdownRenderer :content="stepMessage" />
            </div>

            <!-- Error banner -->
            <NAlert v-if="store.error" type="error" closable @close="store.error = null" style="margin-bottom: 16px;">
              {{ store.error }}
            </NAlert>

            <!-- ── NOTE: single continue button ── -->
            <template v-if="store.stepData.type === 'note'">
              <NButton
                type="primary"
                block
                size="large"
                :loading="store.loading"
                style="margin-top: 8px;"
                @click="handleNoteContinue"
              >
                {{ locale.startsWith('zh') ? '继续' : 'Continue' }}
              </NButton>
            </template>

            <!-- ── SELECT: clickable option cards ── -->
            <template v-if="store.stepData.type === 'select'">

              <!-- Provider step: key paste + popular/other split -->
              <template v-if="isProviderStep">
                <NInput
                  :placeholder="locale.startsWith('zh') ? '粘贴 API Key 自动识别供应商...' : 'Paste API key to auto-detect...'"
                  style="margin-bottom: 12px;"
                  @update:value="handleKeyPaste"
                />

                <NText depth="3" style="font-size: 12px; display: block; margin-bottom: 8px;">
                  {{ locale.startsWith('zh') ? '常用供应商' : 'Popular' }}
                </NText>
                <div class="option-cards">
                  <div
                    v-for="opt in popularProviderOptions"
                    :key="String(opt.value)"
                    class="option-card"
                    :class="{ 'option-card--active': store.currentAnswer === opt.value, 'option-card--loading': store.loading }"
                    @click="!store.loading && handleSelectOption(opt.value)"
                  >
                    <div class="option-card-body">
                      <span class="option-label">{{ opt.label }}</span>
                      <span v-if="opt.hint" class="option-hint">{{ opt.hint }}</span>
                    </div>
                    <span class="option-arrow">&#8250;</span>
                  </div>
                </div>

                <div v-if="otherProviderOptions.length" style="margin-top: 12px;">
                  <NButton text size="small" depth="3" @click="showAllProviders = !showAllProviders">
                    {{ showAllProviders
                      ? (locale.startsWith('zh') ? '收起' : 'Collapse')
                      : (locale.startsWith('zh') ? `更多供应商 (${otherProviderOptions.length})` : `More providers (${otherProviderOptions.length})`)
                    }}
                  </NButton>
                  <div v-if="showAllProviders" class="option-cards" style="margin-top: 8px;">
                    <div
                      v-for="opt in otherProviderOptions"
                      :key="String(opt.value)"
                      class="option-card"
                      :class="{ 'option-card--active': store.currentAnswer === opt.value, 'option-card--loading': store.loading }"
                      @click="!store.loading && handleSelectOption(opt.value)"
                    >
                      <div class="option-card-body">
                        <span class="option-label">{{ opt.label }}</span>
                        <span v-if="opt.hint" class="option-hint">{{ opt.hint }}</span>
                      </div>
                      <span class="option-arrow">&#8250;</span>
                    </div>
                  </div>
                </div>

                <!-- Skip option always at bottom -->
                <div
                  v-if="skipProviderOption"
                  class="option-card"
                  :class="{ 'option-card--loading': store.loading }"
                  style="margin-top: 12px; opacity: 0.7;"
                  @click="!store.loading && handleSelectOption(skipProviderOption.value)"
                >
                  <div class="option-card-body">
                    <span class="option-label">{{ skipProviderOption.label }}</span>
                  </div>
                  <span class="option-arrow">&#8250;</span>
                </div>
              </template>

              <!-- Channel select step: enhanced with Chinese-friendly names -->
              <template v-else-if="isChannelStep">
                <NText depth="2" style="display: block; margin-bottom: 12px; font-size: 13px;">
                  {{ locale.startsWith('zh') ? '选择要连接的聊天平台：' : 'Select a messaging platform to connect:' }}
                </NText>
                <div class="option-cards">
                  <div
                    v-for="opt in channelEnhancedOptions"
                    :key="String(opt.value)"
                    class="option-card"
                    :class="{ 'option-card--active': store.currentAnswer === opt.value, 'option-card--loading': store.loading }"
                    @click="!store.loading && handleSelectOption(opt.value)"
                  >
                    <div class="option-card-body">
                      <span class="option-label">{{ opt.label }}</span>
                      <span v-if="opt.hint" class="option-hint">{{ opt.hint }}</span>
                    </div>
                    <span class="option-arrow">&#8250;</span>
                  </div>
                </div>
              </template>

              <!-- Regular select step -->
              <template v-else>
                <div class="option-cards">
                  <div
                    v-for="opt in displayOptions"
                    :key="String(opt.value)"
                    class="option-card"
                    :class="{ 'option-card--active': store.currentAnswer === opt.value, 'option-card--loading': store.loading }"
                    @click="!store.loading && handleSelectOption(opt.value)"
                  >
                    <div class="option-card-body">
                      <span class="option-label">{{ opt.label }}</span>
                      <span v-if="opt.hint" class="option-hint">{{ opt.hint }}</span>
                    </div>
                    <span class="option-arrow">&#8250;</span>
                  </div>
                </div>
              </template>

              <NSpin v-if="store.loading" size="small" style="display: block; margin: 12px auto 0;" />
            </template>

            <!-- ── TEXT: input + inline confirm ── -->
            <template v-if="store.stepData.type === 'text'">
              <NSpace vertical :size="12">
                <NInputNumber
                  v-if="isNumericText"
                  :value="(store.currentAnswer as number) ?? undefined"
                  :placeholder="store.stepData.placeholder ?? ''"
                  style="width: 100%;"
                  @update:value="store.currentAnswer = $event"
                  @keydown.enter="handleTextSubmit"
                />
                <NInput
                  v-else
                  :value="(store.currentAnswer as string) ?? ''"
                  :type="(store.stepData.sensitive || isApiKeyStep) ? 'password' : 'text'"
                  :show-password-on="(store.stepData.sensitive || isApiKeyStep) ? 'click' : undefined"
                  :placeholder="store.stepData.placeholder ?? ''"
                  @update:value="store.currentAnswer = $event"
                  @keydown.enter="handleTextSubmit"
                />

                <!-- Feishu combined: App ID on same page as App Secret -->
                <template v-if="isFeishuAppSecretStep">
                  <span style="font-size: 13px; color: var(--text-secondary, #666); margin-top: 4px;">
                    {{ locale.startsWith('zh') ? '飞书 App ID' : 'Feishu App ID' }}
                  </span>
                  <NInput
                    v-model:value="feishuAppIdInput"
                    :placeholder="locale.startsWith('zh') ? '请输入 App ID' : 'Enter App ID'"
                    @keydown.enter="handleTextSubmit"
                  />
                </template>

                <!-- Optional Base URL for API key steps -->
                <template v-if="isApiKeyStep && !isFeishuAppSecretStep">
                  <NText depth="3" style="font-size: 12px;">
                    {{ locale.startsWith('zh') ? 'API 端点（留空使用官方地址）' : 'API endpoint (blank = official)' }}
                  </NText>
                  <NInput
                    v-model:value="customBaseUrl"
                    :placeholder="locale.startsWith('zh') ? '如 https://api.example.com/v1' : 'e.g. https://api.example.com/v1'"
                  />
                </template>

                <NButton
                  type="primary"
                  block
                  :loading="store.loading"
                  @click="handleTextSubmit"
                >
                  {{ locale.startsWith('zh') ? '确认' : 'Confirm' }}
                </NButton>
              </NSpace>
            </template>

            <!-- ── CONFIRM: clickable option cards (same style as select) ── -->
            <template v-if="store.stepData.type === 'confirm'">
              <div class="option-cards">
                <div
                  class="option-card"
                  :class="{ 'option-card--loading': store.loading }"
                  @click="!store.loading && handleConfirmAnswer(true)"
                >
                  <div class="option-card-body">
                    <span class="option-label">{{ locale.startsWith('zh') ? '是' : 'Yes' }}</span>
                  </div>
                  <span class="option-arrow">&#8250;</span>
                </div>
                <div
                  class="option-card"
                  :class="{ 'option-card--loading': store.loading }"
                  @click="!store.loading && handleConfirmAnswer(false)"
                >
                  <div class="option-card-body">
                    <span class="option-label">{{ locale.startsWith('zh') ? '否' : 'No' }}</span>
                  </div>
                  <span class="option-arrow">&#8250;</span>
                </div>
              </div>
              <NSpin v-if="store.loading" size="small" style="display: block; margin: 12px auto 0;" />
            </template>

            <!-- ── MULTISELECT: checkboxes + confirm ── -->
            <template v-if="store.stepData.type === 'multiselect'">
              <NSpace :size="8" style="margin-bottom: 8px;">
                <NButton size="small" quaternary @click="handleSelectAll">{{ t('wizard.selectAll') }}</NButton>
                <NButton size="small" quaternary @click="handleDeselectAll">{{ t('wizard.deselectAll') }}</NButton>
              </NSpace>
              <NCheckboxGroup
                :value="(store.currentAnswer as Array<string | number>) ?? []"
                @update:value="store.currentAnswer = $event"
              >
                <NSpace vertical :size="8">
                  <NCheckbox
                    v-for="opt in displayOptions"
                    :key="String(opt.value)"
                    :value="opt.value as string | number"
                  >
                    <NText>{{ opt.label }}</NText>
                    <NText v-if="opt.hint" depth="3" style="font-size: 12px; margin-left: 4px;">{{ opt.hint }}</NText>
                  </NCheckbox>
                </NSpace>
              </NCheckboxGroup>
              <NButton
                type="primary"
                block
                :loading="store.loading"
                style="margin-top: 12px;"
                @click="handleMultiselectSubmit"
              >
                {{ locale.startsWith('zh') ? '确认' : 'Confirm' }}
              </NButton>
            </template>

            <!-- ── PROGRESS ── -->
            <template v-if="store.stepData.type === 'progress'">
              <NProgress
                type="line"
                :percentage="store.stepData.progress ?? 0"
                :show-indicator="true"
                :processing="(store.stepData.progress ?? 0) < 100"
              />
            </template>

            <!-- ── ACTION: auto-executing ── -->
            <template v-if="store.stepData.type === 'action'">
              <div class="gateway-progress" style="padding: 24px 0;">
                <NSpin size="medium" />
                <NText depth="2" style="margin-top: 12px;">{{ locale.startsWith('zh') ? '正在执行...' : 'Executing...' }}</NText>
              </div>
            </template>

            <!-- Step footer: back + skip -->
            <div class="step-footer">
              <NButton
                v-if="store.canGoBack"
                size="small"
                :disabled="store.loading"
                @click="store.goBack()"
              >
                {{ locale.startsWith('zh') ? '上一步' : 'Back' }}
              </NButton>
              <span v-else />
              <NButton text size="small" depth="3" @click="handleSkipWizard">
                {{ locale.startsWith('zh') ? '跳过设置，稍后配置' : 'Skip setup, configure later' }}
              </NButton>
            </div>
          </div>
        </NCard>

        <!-- ==================== COMPLETE ==================== -->
        <NCard v-else-if="store.phase === 'complete'" key="complete" class="wizard-card" :bordered="false">
          <NResult status="success" :title="t('wizard.complete')" :description="t('wizard.completeDesc')">
            <template #footer>
              <!-- Advanced settings reminder -->
              <div class="advanced-reminder">
                <NText depth="3" style="font-size: 13px; display: block; margin-bottom: 12px;">
                  {{ t('wizard.advancedReminderDesc') }}
                </NText>
                <div class="advanced-items">
                  <div class="advanced-item">📡 {{ t('wizard.advancedItems.channels') }}</div>
                  <div class="advanced-item">🔧 {{ t('wizard.advancedItems.skills') }}</div>
                  <div class="advanced-item">🧩 {{ t('wizard.advancedItems.plugins') }}</div>
                  <div class="advanced-item">⏰ {{ t('wizard.advancedItems.cron') }}</div>
                  <div class="advanced-item">🔌 {{ t('wizard.advancedItems.mcp') }}</div>
                  <div class="advanced-item">🤖 {{ t('wizard.advancedItems.multiAgent') }}</div>
                </div>
              </div>
              <NButton type="primary" size="large" block style="margin-top: 20px;" @click="handleEnterApp">
                {{ t('wizard.enterApp') }}
              </NButton>
            </template>
          </NResult>
        </NCard>
      </transition>
    </div>
  </div>
</template>

<style scoped>
.wizard-view {
  padding: 32px 16px;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  min-height: 100%;
}

.wizard-inner {
  width: 100%;
  max-width: 580px;
}

.wizard-phases {
  margin-bottom: 28px;
}

.wizard-card {
  border-radius: 16px;
  box-shadow: 0 8px 40px rgba(0, 0, 0, 0.1);
  backdrop-filter: blur(8px);
}

.wizard-card--wide {
  max-width: 820px;
  width: 820px;
}

/* ── Welcome ── */

.welcome-content {
  text-align: center;
  padding: 20px 0 8px;
}

.welcome-logo {
  font-size: 40px;
  font-weight: 800;
  letter-spacing: -1px;
  margin-bottom: 12px;
  background: linear-gradient(135deg, #18a058, #2080f0);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.welcome-title {
  font-size: 18px;
  font-weight: 600;
  margin: 4px 0 8px;
}

.welcome-desc {
  display: block;
  margin-bottom: 4px;
}

.field-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.field-label {
  font-weight: 500;
  white-space: nowrap;
}

/* ── Gateway setup ── */

.gateway-setup {
  padding: 32px 0;
}

.gateway-progress {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 120px;
}

.gateway-manual {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 16px 0;
}

/* ── Server wizard steps ── */

.step-content {
  padding: 4px 0;
}

.step-header {
  margin-bottom: 12px;
}

.step-title {
  font-size: 18px;
  font-weight: 600;
  margin: 0;
}

.step-message {
  margin-bottom: 16px;
  line-height: 1.65;
}

/* ── Option cards (select) ── */

.option-cards {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.option-card {
  display: flex;
  align-items: center;
  padding: 14px 16px;
  border-radius: 10px;
  border: 1px solid #e0e0e6;
  cursor: pointer;
  transition: all 0.15s ease;
  background: #fff;
  color: #333;
}

.option-card:hover {
  border-color: #18a058;
  background: #f0faf5;
  color: #1a1a1a;
}

.option-card--active {
  border-color: #18a058;
  background: #f0faf5;
  color: #1a1a1a;
}

.option-card--loading {
  pointer-events: none;
  opacity: 0.6;
}

.option-card-body {
  flex: 1;
  min-width: 0;
}

.option-label {
  display: block;
  font-size: 14px;
  font-weight: 600;
  color: #1a1a1a;
}

.option-card:hover .option-label {
  color: #0d5c34;
}

.option-hint {
  display: block;
  font-size: 12px;
  margin-top: 2px;
  color: #666;
}

.option-card:hover .option-hint {
  color: #555;
}

.option-arrow {
  margin-left: 8px;
  flex-shrink: 0;
  font-size: 20px;
  line-height: 1;
  opacity: 0.4;
  color: #333;
}

.option-card:hover .option-arrow {
  opacity: 0.8;
  color: #18a058;
}

/* ── Dark mode option cards ── */
:root[data-theme="dark"] .option-card {
  background: #2a2a2c;
  border-color: #444;
  color: #e0e0e0;
}

:root[data-theme="dark"] .option-card:hover {
  background: #1e3a2a;
  border-color: #18a058;
  color: #f0f0f0;
}

:root[data-theme="dark"] .option-card--active {
  background: #1e3a2a;
  border-color: #18a058;
  color: #f0f0f0;
}

:root[data-theme="dark"] .option-label {
  color: #e8e8e8;
}

:root[data-theme="dark"] .option-card:hover .option-label {
  color: #7dcea0;
}

:root[data-theme="dark"] .option-hint {
  color: #999;
}

:root[data-theme="dark"] .option-card:hover .option-hint {
  color: #aaa;
}

:root[data-theme="dark"] .option-arrow {
  color: #999;
}

/* ── Skip link ── */

.step-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid var(--n-border-color, #e0e0e6);
}

/* ── Dark mode: step footer ── */
:root[data-theme="dark"] .step-footer {
  border-top-color: #444;
}

/* ── Transitions ── */

.step-fade-enter-active,
.step-fade-leave-active {
  transition: all 0.2s ease;
}

.step-fade-enter-from {
  opacity: 0;
  transform: translateY(8px);
}

.step-fade-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

/* ── Identity setup ── */

.identity-setup {
  padding: 4px 0;
}

.identity-row {
  display: flex;
  gap: 16px;
  align-items: flex-start;
}

.identity-emoji-section {
  flex-shrink: 0;
}

.emoji-grid {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 4px;
}

.emoji-option {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  font-size: 18px;
  border-radius: 6px;
  cursor: pointer;
  border: 2px solid transparent;
  transition: all 0.15s;
}

.emoji-option:hover {
  background: rgba(24, 160, 88, 0.08);
  border-color: rgba(24, 160, 88, 0.3);
}

.emoji-option--active {
  border-color: #18a058;
  background: rgba(24, 160, 88, 0.12);
}

:root[data-theme="dark"] .emoji-option:hover {
  background: rgba(24, 160, 88, 0.15);
}

:root[data-theme="dark"] .emoji-option--active {
  background: rgba(24, 160, 88, 0.2);
}

/* ── Fork cards ── */

.fork-card {
  padding: 18px 16px;
}

.fork-card--start:hover {
  border-color: #18a058;
  background: #f0faf5;
}

.fork-card--continue:hover {
  border-color: #2080f0;
  background: #f0f7ff;
}

:root[data-theme="dark"] .fork-card--start:hover {
  background: #1e3a2a;
  border-color: #18a058;
}

:root[data-theme="dark"] .fork-card--continue:hover {
  background: #1a2a3e;
  border-color: #2080f0;
}

/* ── Advanced settings reminder ── */

.advanced-reminder {
  text-align: left;
  margin-top: 16px;
  padding: 16px;
  border-radius: 10px;
  background: rgba(128, 128, 128, 0.06);
  border: 1px solid var(--n-border-color, #e0e0e6);
}

:root[data-theme="dark"] .advanced-reminder {
  background: rgba(255, 255, 255, 0.04);
}

.advanced-items {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.advanced-item {
  font-size: 13px;
  line-height: 1.6;
  color: var(--n-text-color-2, #606266);
}

:root[data-theme="dark"] .advanced-item {
  color: #aaa;
}
</style>
