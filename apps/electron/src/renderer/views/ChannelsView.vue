<script setup lang="ts">
import { onMounted, ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NGrid, NGi, NCard, NButton, NSpace, NSpin, NEmpty, NText, NPopconfirm,
  NDrawer, NDrawerContent, NForm, NFormItem, NInput, NSelect, NTag,
  NModal, NDynamicTags, NTooltip, NAlert
} from 'naive-ui'
import type { SelectOption } from 'naive-ui'
import { useChannelsStore, type ChannelStatus, type ChannelConfig } from '@renderer/stores/channels'
import StatusBadge from '@renderer/components/common/StatusBadge.vue'
import { useConnectionStore } from '@renderer/gateway/connection'

const { t } = useI18n()
const store = useChannelsStore()
const conn = useConnectionStore()

/* ---------- State ---------- */
const detailDrawerOpen = ref(false)
const addModalOpen = ref(false)
const testSendModalOpen = ref(false)
const selectedChannel = ref<ChannelStatus | null>(null)

/* Channel config form */
const configForm = ref<ChannelConfig>({
  token: '',
  dmPolicy: 'pairing',
  allowFrom: [],
})

/* Add channel form */
const newChannelType = ref('')
const newChannelConfig = ref<ChannelConfig>({ token: '' })

/** Per-channel config field definitions */
interface ChannelField {
  key: string
  label: string
  labelZh: string
  placeholder?: string
  sensitive?: boolean
  required?: boolean
}

const channelFields: Record<string, ChannelField[]> = {
  feishu: [
    { key: 'appId', label: 'App ID', labelZh: 'App ID', placeholder: 'cli_xxxx', required: true },
    { key: 'appSecret', label: 'App Secret', labelZh: 'App Secret', placeholder: '', sensitive: true, required: true },
    { key: 'encryptKey', label: 'Encrypt Key', labelZh: '加密密钥', sensitive: true },
    { key: 'verificationToken', label: 'Verification Token', labelZh: '验证令牌', sensitive: true },
  ],
  telegram: [
    { key: 'token', label: 'Bot Token', labelZh: 'Bot Token', placeholder: '123456:ABC-DEF...', sensitive: true, required: true },
  ],
  discord: [
    { key: 'token', label: 'Bot Token', labelZh: 'Bot Token', placeholder: '', sensitive: true, required: true },
  ],
  slack: [
    { key: 'token', label: 'Bot Token', labelZh: 'Bot Token', placeholder: 'xoxb-...', sensitive: true, required: true },
    { key: 'appToken', label: 'App Token', labelZh: 'App Token', placeholder: 'xapp-...', sensitive: true },
    { key: 'signingSecret', label: 'Signing Secret', labelZh: '签名密钥', sensitive: true },
  ],
  dingtalk: [
    { key: 'appKey', label: 'App Key', labelZh: 'App Key', required: true },
    { key: 'appSecret', label: 'App Secret', labelZh: 'App Secret', sensitive: true, required: true },
  ],
  msteams: [
    { key: 'appId', label: 'App ID', labelZh: '应用 ID', required: true },
    { key: 'appPassword', label: 'App Password', labelZh: '应用密码', sensitive: true, required: true },
  ],
  line: [
    { key: 'channelAccessToken', label: 'Channel Access Token', labelZh: '渠道访问令牌', sensitive: true, required: true },
    { key: 'channelSecret', label: 'Channel Secret', labelZh: '渠道密钥', sensitive: true, required: true },
  ],
  matrix: [
    { key: 'homeserverUrl', label: 'Homeserver URL', labelZh: '服务器地址', placeholder: 'https://matrix.org', required: true },
    { key: 'accessToken', label: 'Access Token', labelZh: '访问令牌', sensitive: true, required: true },
  ],
}

/** Default: single token field for channels without specific definitions */
const defaultFields: ChannelField[] = [
  { key: 'token', label: 'Token', labelZh: 'Token', sensitive: true, required: true },
]

function getFieldsForChannel(channelType: string): ChannelField[] {
  return channelFields[channelType] ?? defaultFields
}

function getFieldLabel(field: ChannelField): string {
  const isZh = t('common.save') === '保存'
  return isZh ? field.labelZh : field.label
}

/** Per-channel setup hints shown in add/configure modals */
const channelSetupHints: Record<string, { zh: string; en: string }> = {
  feishu: {
    zh: '配置步骤：\n1. 打开飞书开发者后台 (open.feishu.cn) → 创建企业自建应用\n2. 复制 App ID 和 App Secret\n3. 权限管理 → 添加以下权限并发布版本：\n   • im:message（接收和发送消息）\n   • im:message:send_as_bot（以机器人身份发消息）\n   • contact:user.employee_id:readonly（解析用户 ID，发消息必需）\n4. 应用发布 → 版本管理与发布 → 创建版本并发布\n5. 可用范围 → 设置可用范围为「全部员工」或指定用户/部门\n6. 事件与回调 → 订阅方式选择「使用长连接接收事件」\n7. 事件订阅 → 添加 im.message.receive_v1（接收消息事件）\n\n测试发送：收件人填飞书用户 open_id（ou_xxxx 格式）',
    en: 'Setup steps:\n1. Open Feishu Developer Console (open.feishu.cn) → Create custom app\n2. Copy App ID and App Secret\n3. Permissions → Add and publish:\n   • im:message (receive & send messages)\n   • im:message:send_as_bot (send as bot)\n   • contact:user.employee_id:readonly (resolve user ID, required for sending)\n4. App Release → Create version and publish\n5. Availability → Set to "All employees" or specific users/departments\n6. Events & Callbacks → Choose "Receive via persistent connection (WebSocket)"\n7. Event subscriptions → Add im.message.receive_v1\n\nTest send: use Feishu open_id (ou_xxxx format) as recipient',
  },
  telegram: {
    zh: '配置步骤：\n1. 在 Telegram 中找到 @BotFather\n2. 发送 /newbot 创建机器人\n3. 复制 Bot Token（格式：123456:ABC-DEF...）',
    en: 'Setup steps:\n1. Find @BotFather on Telegram\n2. Send /newbot to create a bot\n3. Copy the Bot Token (format: 123456:ABC-DEF...)',
  },
  discord: {
    zh: '配置步骤：\n1. 打开 Discord Developer Portal (discord.com/developers)\n2. 创建 Application → Bot → 复制 Token\n3. 开启 Privileged Gateway Intents（Message Content Intent）\n4. 用 OAuth2 URL 将 Bot 邀请到服务器',
    en: 'Setup steps:\n1. Open Discord Developer Portal (discord.com/developers)\n2. Create Application → Bot → Copy Token\n3. Enable Privileged Gateway Intents (Message Content Intent)\n4. Invite bot to server via OAuth2 URL',
  },
  slack: {
    zh: '配置步骤：\n1. 打开 api.slack.com/apps → 创建 App\n2. OAuth & Permissions → 添加 Bot Token Scopes\n3. 安装到工作区 → 复制 Bot Token (xoxb-...)\n4. Socket Mode → 启用并获取 App Token (xapp-...)',
    en: 'Setup steps:\n1. Open api.slack.com/apps → Create App\n2. OAuth & Permissions → Add Bot Token Scopes\n3. Install to workspace → Copy Bot Token (xoxb-...)\n4. Socket Mode → Enable and get App Token (xapp-...)',
  },
  dingtalk: {
    zh: '配置步骤：\n1. 打开钉钉开放平台 (open.dingtalk.com)\n2. 创建企业内部应用 → 复制 App Key 和 App Secret\n3. 消息推送 → 配置回调地址或 Stream 模式',
    en: 'Setup steps:\n1. Open DingTalk Developer Console (open.dingtalk.com)\n2. Create internal app → Copy App Key and App Secret\n3. Message push → Configure callback URL or Stream mode',
  },
}

function getSetupHint(channelType: string): string {
  const hint = channelSetupHints[channelType]
  if (!hint) return ''
  const isZh = t('common.save') === '保存'
  return isZh ? hint.zh : hint.en
}

/** Per-channel recipient placeholder for test send */
const recipientPlaceholders: Record<string, { zh: string; en: string }> = {
  feishu: { zh: '飞书用户 open_id，如 ou_xxxx（非用户名）', en: 'Feishu open_id, e.g. ou_xxxx (not username)' },
  telegram: { zh: 'Telegram chat ID 或 @username', en: 'Telegram chat ID or @username' },
  discord: { zh: 'Discord 用户 ID 或频道 ID', en: 'Discord user ID or channel ID' },
  slack: { zh: 'Slack 用户 ID 或频道名称', en: 'Slack user ID or channel name' },
  dingtalk: { zh: '钉钉用户 ID', en: 'DingTalk user ID' },
}

function getRecipientPlaceholder(): string {
  const ch = selectedChannel.value?.channel ?? ''
  const hint = recipientPlaceholders[ch]
  if (!hint) return t('channels.recipientPlaceholder')
  const isZh = t('common.save') === '保存'
  return isZh ? hint.zh : hint.en
}

/* Test send form */
const testTo = ref('')
const testMessage = ref('Hello from OpenClaw!')

const channelTypeOptions: SelectOption[] = [
  { label: 'Telegram', value: 'telegram' },
  { label: 'Discord', value: 'discord' },
  { label: 'Feishu (飞书)', value: 'feishu' },
  { label: 'Slack', value: 'slack' },
  { label: 'WhatsApp', value: 'whatsapp' },
  { label: 'Signal', value: 'signal' },
  { label: 'iMessage', value: 'imessage' },
  { label: 'MS Teams', value: 'msteams' },
  { label: 'Matrix', value: 'matrix' },
  { label: 'LINE', value: 'line' },
  { label: 'IRC', value: 'irc' },
  { label: 'Google Chat', value: 'googlechat' },
  { label: 'Mattermost', value: 'mattermost' },
  { label: 'Nostr', value: 'nostr' },
  { label: 'Twitch', value: 'twitch' },
  { label: 'Synology Chat', value: 'synologychat' },
  { label: 'Nextcloud Talk', value: 'nextcloudtalk' },
  { label: 'Zalo', value: 'zalo' },
  { label: 'BlueBubbles', value: 'bluebubbles' },
  { label: 'DingTalk (钉钉)', value: 'dingtalk' },
]

const dmPolicyOptions = computed<SelectOption[]>(() => [
  { label: t('channels.pairing'), value: 'pairing' },
  { label: t('channels.allowlist'), value: 'allowlist' },
  { label: t('channels.open'), value: 'open' },
  { label: t('channels.disabledPolicy'), value: 'disabled' },
])

/* ---------- Computed ---------- */
const channelEmojis: Record<string, string> = {
  telegram: 'T',
  discord: 'D',
  feishu: '飞',
  slack: 'S',
  whatsapp: 'W',
  signal: 'Si',
  imessage: 'iM',
  msteams: 'MS',
  matrix: 'Mx',
  line: 'L',
  irc: 'IRC',
  googlechat: 'G',
  mattermost: 'MM',
  nostr: 'N',
  twitch: 'Tw',
  synologychat: 'Sy',
  nextcloudtalk: 'NC',
  zalo: 'Z',
  bluebubbles: 'BB',
  dingtalk: '钉',
  web: 'Web',
  voice: 'V',
}

function getChannelInitial(name: string): string {
  return channelEmojis[name.toLowerCase()] ?? name.charAt(0).toUpperCase()
}

const hasQrCode = computed(() =>
  selectedChannel.value?.channel?.toLowerCase() === 'whatsapp' &&
  selectedChannel.value?.qrCode,
)

/* ---------- Actions ---------- */
function openDetail(ch: ChannelStatus) {
  selectedChannel.value = ch
  configForm.value = {
    token: '',
    dmPolicy: ch.dmPolicy ?? 'pairing',
    allowFrom: ch.allowFrom ? [...ch.allowFrom] : [],
  }
  detailDrawerOpen.value = true
}

async function saveConfig() {
  if (!selectedChannel.value) return
  const config: ChannelConfig = {}
  // Collect all channel-specific fields that have values
  const fields = getFieldsForChannel(selectedChannel.value.channel)
  for (const field of fields) {
    const val = (configForm.value as Record<string, unknown>)[field.key]
    if (val) config[field.key] = val
  }
  if (configForm.value.dmPolicy) config.dmPolicy = configForm.value.dmPolicy
  if (configForm.value.allowFrom) config.allowFrom = configForm.value.allowFrom
  await store.configureChannel(selectedChannel.value.channel, config)
  detailDrawerOpen.value = false
}

function openTestSend(ch: ChannelStatus) {
  selectedChannel.value = ch
  testTo.value = ''
  testMessage.value = 'Hello from OpenClaw!'
  testSendModalOpen.value = true
}

async function handleTestSend() {
  if (!selectedChannel.value) return
  await store.testSend(selectedChannel.value.channel, testTo.value, testMessage.value)
  testSendModalOpen.value = false
}

async function handleAddChannel() {
  if (!newChannelType.value) return
  console.log('[channels-view] Adding channel:', newChannelType.value, newChannelConfig.value)
  const ok = await store.addChannel(newChannelType.value, newChannelConfig.value)
  if (ok) {
    addModalOpen.value = false
    newChannelType.value = ''
    newChannelConfig.value = {}
  }
  // If failed, keep modal open so user sees the error
}

function openAddModal() {
  newChannelType.value = ''
  newChannelConfig.value = {}
  addModalOpen.value = true
}

// Reset config form when channel type changes
watch(newChannelType, () => {
  newChannelConfig.value = {}
})

function formatTime(iso?: string): string {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString()
}

onMounted(() => { if (conn.isConnected) store.fetchStatus() })

watch(() => conn.isConnected, (connected) => {
  if (connected) store.fetchStatus()
})
</script>

<template>
  <div class="channels-view">
    <NSpace justify="space-between" align="center" style="margin-bottom:16px;">
      <NText strong style="font-size:16px;">{{ t('channels.title') }}</NText>
      <NSpace :size="8">
        <NButton size="small" type="primary" @click="openAddModal">
          + {{ t('channels.addChannel') }}
        </NButton>
        <NButton size="small" secondary :loading="store.loading" @click="store.fetchStatus()">
          {{ t('common.refresh') }}
        </NButton>
      </NSpace>
    </NSpace>

    <NSpin :show="store.loading">
      <NEmpty v-if="!store.channels.length && !store.loading" :description="t('channels.noChannels')" />
      <template v-else>
        <!-- Online channels first -->
        <NText v-if="store.onlineChannels.length" depth="2" style="display:block;margin-bottom:8px;font-size:13px;">
          {{ t('channels.online') }} ({{ store.onlineChannels.length }})
        </NText>
        <NGrid :cols="3" :x-gap="12" :y-gap="12" style="margin-bottom:16px;" v-if="store.onlineChannels.length">
          <NGi v-for="ch in store.onlineChannels" :key="ch.channel + (ch.accountId ?? '')">
            <NCard size="small" hoverable @click="openDetail(ch)" style="cursor:pointer;">
              <NSpace vertical :size="8">
                <NSpace justify="space-between" align="center">
                  <NSpace align="center" :size="8">
                    <NTag size="small" round :bordered="false">{{ getChannelInitial(ch.channel) }}</NTag>
                    <NText strong style="text-transform:capitalize;">{{ ch.channel }}</NText>
                  </NSpace>
                  <StatusBadge status="online" />
                </NSpace>

                <NText v-if="ch.username" depth="2" style="font-size:13px;">
                  @{{ ch.username }}
                </NText>
                <NText v-if="ch.accountId" depth="3" style="font-size:11px;">
                  {{ ch.accountId }}
                </NText>
                <NText v-if="ch.error" type="error" style="font-size:12px;">
                  {{ ch.error }}
                </NText>
                <NText v-if="ch.lastRefresh" depth="3" style="font-size:10px;">
                  {{ t('channels.refreshed') }} {{ formatTime(ch.lastRefresh) }}
                </NText>

                <NSpace size="small" style="margin-top:4px;" @click.stop>
                  <NButton size="tiny" secondary @click.stop="openDetail(ch)">
                    {{ t('channels.configure') }}
                  </NButton>
                  <NButton size="tiny" secondary @click.stop="store.refreshChannel(ch.channel)">
                    {{ t('common.refresh') }}
                  </NButton>
                  <NButton size="tiny" secondary @click.stop="openTestSend(ch)">
                    {{ t('channels.testSend') }}
                  </NButton>
                  <NPopconfirm @positive-click="store.logout(ch.channel, ch.accountId)">
                    <template #trigger>
                      <NButton size="tiny" type="warning" ghost>
                        {{ t('channels.logout') }}
                      </NButton>
                    </template>
                    {{ t('channels.logoutConfirm', { channel: ch.channel }) }}
                  </NPopconfirm>
                </NSpace>
              </NSpace>
            </NCard>
          </NGi>
        </NGrid>

        <!-- Offline channels -->
        <NText v-if="store.offlineChannels.length" depth="2" style="display:block;margin-bottom:8px;font-size:13px;">
          {{ t('channels.offline') }} ({{ store.offlineChannels.length }})
        </NText>
        <NGrid :cols="3" :x-gap="12" :y-gap="12" v-if="store.offlineChannels.length">
          <NGi v-for="ch in store.offlineChannels" :key="ch.channel + (ch.accountId ?? '')">
            <NCard size="small" hoverable @click="openDetail(ch)" style="cursor:pointer;">
              <NSpace vertical :size="8">
                <NSpace justify="space-between" align="center">
                  <NSpace align="center" :size="8">
                    <NTag size="small" round :bordered="false" type="default">{{ getChannelInitial(ch.channel) }}</NTag>
                    <NText strong style="text-transform:capitalize;">{{ ch.channel }}</NText>
                  </NSpace>
                  <StatusBadge status="offline" />
                </NSpace>

                <NText v-if="ch.username" depth="2" style="font-size:13px;">
                  @{{ ch.username }}
                </NText>
                <NText v-if="ch.error" type="error" style="font-size:12px;">
                  {{ ch.error }}
                </NText>

                <NSpace size="small" style="margin-top:4px;" @click.stop>
                  <NButton size="tiny" secondary @click.stop="openDetail(ch)">
                    {{ t('channels.configure') }}
                  </NButton>
                </NSpace>
              </NSpace>
            </NCard>
          </NGi>
        </NGrid>
      </template>
    </NSpin>

    <!-- Channel Detail Drawer -->
    <NDrawer v-model:show="detailDrawerOpen" :width="440" placement="right">
      <NDrawerContent
        :title="selectedChannel ? t('channels.configuration', { channel: selectedChannel.channel }) : t('channels.title')"
        closable
      >
        <NForm v-if="selectedChannel" label-placement="top" :model="configForm">
          <NFormItem :label="t('channels.status')">
            <StatusBadge :status="selectedChannel.connected ? 'online' : 'offline'" />
          </NFormItem>

          <NFormItem v-if="selectedChannel.username" :label="t('channels.account')">
            <NText>@{{ selectedChannel.username }}</NText>
          </NFormItem>

          <NAlert v-if="getSetupHint(selectedChannel.channel)" type="info" style="margin-bottom:16px;white-space:pre-line;">
            {{ getSetupHint(selectedChannel.channel) }}
          </NAlert>

          <NFormItem
            v-for="field in getFieldsForChannel(selectedChannel.channel)"
            :key="field.key"
            :label="getFieldLabel(field)"
          >
            <NInput
              :value="(configForm as Record<string, unknown>)[field.key] as string ?? ''"
              :type="field.sensitive ? 'password' : 'text'"
              :show-password-on="field.sensitive ? 'click' : undefined"
              :placeholder="t('channels.enterNewToken')"
              @update:value="(v: string) => { (configForm as Record<string, unknown>)[field.key] = v }"
            />
          </NFormItem>

          <NFormItem :label="t('channels.dmPolicy')">
            <NSelect v-model:value="configForm.dmPolicy" :options="dmPolicyOptions" />
          </NFormItem>

          <NFormItem :label="t('channels.allowFrom')" v-if="configForm.dmPolicy === 'allowlist'">
            <NDynamicTags v-model:value="configForm.allowFrom" />
          </NFormItem>

          <!-- WhatsApp QR Code -->
          <NFormItem v-if="hasQrCode" :label="t('channels.qrCodeLogin')">
            <NCard size="small" style="text-align:center;">
              <NText depth="2" style="font-size:12px;">
                {{ t('channels.scanQr') }}
              </NText>
              <div style="margin-top:8px;padding:16px;background:#fff;display:inline-block;">
                <NText code style="font-size:10px;word-break:break-all;">
                  {{ selectedChannel?.qrCode }}
                </NText>
              </div>
            </NCard>
          </NFormItem>

          <NFormItem :label="t('channels.setupGuide')">
            <NButton
              text
              tag="a"
              :href="`https://docs.openclaw.ai/channels/${selectedChannel.channel}`"
              target="_blank"
              type="primary"
              size="small"
            >
              {{ t('channels.viewGuide') }}
            </NButton>
          </NFormItem>
        </NForm>

        <template #footer>
          <NSpace justify="end">
            <NButton @click="detailDrawerOpen = false">{{ t('common.cancel') }}</NButton>
            <NButton type="primary" :loading="store.configuring" @click="saveConfig">
              {{ t('common.save') }}
            </NButton>
          </NSpace>
        </template>
      </NDrawerContent>
    </NDrawer>

    <!-- Add Channel Modal -->
    <NModal v-model:show="addModalOpen" preset="card" :title="t('channels.addChannel')" style="width:480px;">
      <NForm label-placement="top">
        <NFormItem :label="t('channels.channelType')">
          <NSelect
            v-model:value="newChannelType"
            :options="channelTypeOptions"
            :placeholder="t('channels.selectType')"
          />
        </NFormItem>
        <template v-if="newChannelType">
          <NAlert v-if="getSetupHint(newChannelType)" type="info" style="margin-bottom:16px;white-space:pre-line;">
            {{ getSetupHint(newChannelType) }}
          </NAlert>
          <NFormItem
            v-for="field in getFieldsForChannel(newChannelType)"
            :key="field.key"
            :label="getFieldLabel(field) + (field.required ? ' *' : '')"
          >
            <NInput
              :value="(newChannelConfig as Record<string, unknown>)[field.key] as string ?? ''"
              :type="field.sensitive ? 'password' : 'text'"
              :show-password-on="field.sensitive ? 'click' : undefined"
              :placeholder="field.placeholder ?? ''"
              @update:value="(v: string) => { (newChannelConfig as Record<string, unknown>)[field.key] = v }"
            />
          </NFormItem>
        </template>
      </NForm>
      <template #footer>
        <NSpace justify="end">
          <NButton @click="addModalOpen = false">{{ t('common.cancel') }}</NButton>
          <NButton
            type="primary"
            :disabled="!newChannelType"
            :loading="store.configuring"
            @click="handleAddChannel"
          >
            {{ t('channels.addChannel') }}
          </NButton>
        </NSpace>
      </template>
    </NModal>

    <!-- Test Send Modal -->
    <NModal v-model:show="testSendModalOpen" preset="card" :title="t('channels.testSendTitle')" style="width:480px;">
      <NForm label-placement="top">
        <NFormItem :label="t('channels.toRecipient')">
          <NInput v-model:value="testTo" :placeholder="getRecipientPlaceholder()" />
        </NFormItem>
        <NFormItem :label="t('channels.message')">
          <NInput v-model:value="testMessage" type="textarea" :autosize="{ minRows: 2 }" />
        </NFormItem>
      </NForm>
      <template #footer>
        <NSpace justify="end">
          <NButton @click="testSendModalOpen = false">{{ t('common.cancel') }}</NButton>
          <NButton type="primary" :loading="store.loading" @click="handleTestSend">
            {{ t('channels.testSend') }}
          </NButton>
        </NSpace>
      </template>
    </NModal>
  </div>
</template>

<style scoped>
.channels-view { padding: 16px; }
</style>
