<script setup lang="ts">
import { onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NCard, NForm, NFormItem, NInput, NButton, NSpace, NAlert, NDivider, NText
} from 'naive-ui'
import { useConnectionStore } from '@renderer/gateway/connection'
import { ConnectionStatus } from '@renderer/gateway/types'
import { useGatewayLifecycleStore } from '@renderer/stores/gateway-lifecycle'
import ProcessControls from '@renderer/components/gateway/ProcessControls.vue'

const { t } = useI18n()
const conn = useConnectionStore()
const lifecycle = useGatewayLifecycleStore()

async function handleAutoDiscover() {
  const port = await lifecycle.discover()
  if (port) {
    conn.url = `ws://127.0.0.1:${port}`
  }
}

function handleConnect() {
  conn.connect(conn.url, conn.token || undefined, conn.password || undefined)
}

function handleDisconnect() {
  conn.disconnect()
}

onMounted(async () => {
  await lifecycle.getStatus()
  if (conn.status === ConnectionStatus.Disconnected) {
    await handleAutoDiscover()
  }
})
</script>

<template>
  <div class="connection-view">
    <NSpace vertical :size="16" style="max-width: 600px; margin: 0 auto;">
      <NCard title="Gateway Connection">
        <NAlert
          v-if="conn.status === ConnectionStatus.Connected"
          type="success"
          style="margin-bottom: 16px;"
        >
          Connected to {{ conn.url }}
          <template v-if="conn.serverVersion">
            — v{{ conn.serverVersion }}
          </template>
        </NAlert>
        <NAlert
          v-else-if="conn.status === ConnectionStatus.Error"
          type="error"
          style="margin-bottom: 16px;"
        >
          {{ conn.errorMessage ?? 'Connection error' }}
        </NAlert>
        <NAlert
          v-else-if="conn.status === ConnectionStatus.Connecting || conn.status === ConnectionStatus.Reconnecting"
          type="warning"
          style="margin-bottom: 16px;"
        >
          {{ conn.status === ConnectionStatus.Connecting ? 'Connecting…' : 'Reconnecting…' }}
        </NAlert>

        <NForm label-placement="left" label-width="120">
          <NFormItem label="Gateway URL">
            <NInput
              v-model:value="conn.url"
              placeholder="ws://127.0.0.1:18789"
              :disabled="conn.isConnected"
            />
          </NFormItem>
          <NFormItem label="Access Token">
            <NInput
              v-model:value="conn.token"
              type="password"
              show-password-on="click"
              placeholder="Optional token"
              :disabled="conn.isConnected"
            />
          </NFormItem>
          <NFormItem label="Password">
            <NInput
              v-model:value="conn.password"
              type="password"
              show-password-on="click"
              placeholder="Optional password"
              :disabled="conn.isConnected"
            />
          </NFormItem>
        </NForm>

        <NSpace>
          <NButton
            v-if="!conn.isConnected"
            type="primary"
            :loading="conn.status === ConnectionStatus.Connecting"
            @click="handleConnect"
          >
            Connect
          </NButton>
          <NButton v-else type="warning" @click="handleDisconnect">
            Disconnect
          </NButton>
          <NButton
            secondary
            :disabled="conn.isConnected"
            @click="handleAutoDiscover"
          >
            Auto-Discover
          </NButton>
        </NSpace>
      </NCard>

      <NCard title="Gateway Process">
        <NText depth="3" style="display:block; margin-bottom:12px; font-size:13px;">
          Control the local OpenClaw gateway process.
        </NText>
        <ProcessControls />
      </NCard>
    </NSpace>
  </div>
</template>

<style scoped>
.connection-view { padding: 24px; }
</style>
