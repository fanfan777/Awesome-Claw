<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NGrid, NGi, NCard, NButton, NSpace, NSpin, NEmpty, NText, NPopconfirm,
  NDrawer, NDrawerContent, NForm, NFormItem, NInput, NSelect, NTag,
  NModal, NDynamicTags, NTooltip
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
  if (configForm.value.token) config.token = configForm.value.token
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
  await store.addChannel(newChannelType.value, newChannelConfig.value)
  addModalOpen.value = false
  newChannelType.value = ''
  newChannelConfig.value = { token: '' }
}

function openAddModal() {
  newChannelType.value = ''
  newChannelConfig.value = { token: '' }
  addModalOpen.value = true
}

function formatTime(iso?: string): string {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString()
}

onMounted(() => { if (conn.isConnected) store.fetchStatus() })
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

          <NFormItem :label="t('channels.token')">
            <NInput
              v-model:value="configForm.token"
              type="password"
              show-password-on="click"
              :placeholder="t('channels.enterNewToken')"
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
        <NFormItem :label="t('channels.token')" v-if="newChannelType">
          <NInput
            v-model:value="newChannelConfig.token"
            type="password"
            show-password-on="click"
            :placeholder="t('channels.botToken')"
          />
        </NFormItem>
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
          <NInput v-model:value="testTo" :placeholder="t('channels.recipientPlaceholder')" />
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
