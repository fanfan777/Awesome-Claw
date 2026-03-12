<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NGrid, NGi, NCard, NStatistic, NSpin, NEmpty, NDataTable, NText, NSpace, NTag, NButton,
  NAlert, NCollapse, NCollapseItem,
} from 'naive-ui'
import type { DataTableColumns } from 'naive-ui'
import { useConnectionStore } from '@renderer/gateway/connection'
import { useGatewayRpc } from '@renderer/composables/useGatewayRpc'
import { useInstancesStore } from '@renderer/stores/instances'

const { t } = useI18n()
const conn = useConnectionStore()
const instancesStore = useInstancesStore()

interface HealthResult { ok: boolean; uptime?: number; [key: string]: unknown }
interface ChannelStatus { configured?: boolean; connected?: boolean; [key: string]: unknown }
interface Session { sessionKey: string; title?: string; updatedAt?: string; messageCount?: number; agentId?: string }
interface CronStatus { running: boolean; jobCount: number }

const health = useGatewayRpc<HealthResult>('health')
const channelsRpc = useGatewayRpc<{ channels: Record<string, ChannelStatus>; channelOrder?: string[] }>('channels.status')
const sessionsRpc = useGatewayRpc<{ sessions: Array<Record<string, unknown>>; count?: number; total?: number }>('sessions.list')
const cronRpc = useGatewayRpc<CronStatus>('cron.status')

const onlineChannels = ref(0)
const activeSessions = ref(0)
const cronJobCount = ref(0)
const recentSessions = ref<Session[]>([])
const uptimeSeconds = ref<number | null>(null)
const healthData = ref<HealthResult | null>(null)

async function refresh() {
  const [h, ch, se, cr] = await Promise.all([
    health.execute(),
    channelsRpc.execute(),
    sessionsRpc.execute({ limit: 10 }),
    cronRpc.execute(),
    instancesStore.fetchInstances().catch(() => {}),
  ])
  if (h) {
    uptimeSeconds.value = h.uptime ?? null
    healthData.value = h
  }
  if (ch) {
    const channelValues = Object.values(ch.channels ?? {})
    onlineChannels.value = channelValues.filter(c => c.connected).length
  }
  if (se) {
    activeSessions.value = se.count ?? se.total ?? se.sessions.length
    // Map gateway "key" → "sessionKey", "updatedAt" ms → ISO string
    recentSessions.value = se.sessions.slice(0, 10).map((s) => ({
      sessionKey: (s.key as string) ?? (s.sessionKey as string) ?? '',
      title: (s.derivedTitle as string) ?? (s.displayName as string) ?? (s.label as string),
      updatedAt: typeof s.updatedAt === 'number' ? new Date(s.updatedAt).toISOString() : (s.updatedAt as string | undefined),
      messageCount: s.messageCount as number | undefined,
      agentId: s.agentId as string | undefined,
    })) as Session[]
  }
  if (cr) cronJobCount.value = cr.jobCount
}

const sessionColumns: DataTableColumns<Session> = [
  { title: 'Key', key: 'sessionKey', ellipsis: true },
  { title: 'Title', key: 'title', ellipsis: true },
  { title: 'Messages', key: 'messageCount', width: 90 },
  {
    title: 'Updated',
    key: 'updatedAt',
    width: 150,
    render(row) {
      if (!row.updatedAt) return '-'
      return new Date(row.updatedAt).toLocaleString()
    }
  },
]

function formatUptime(s: number | null) {
  if (s === null) return '-'
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return `${h}h ${m}m`
}

// Auth mode display
const authMode = computed(() => {
  const hello = conn.helloData
  if (!hello?.auth) return t('overview.authNone')
  if (hello.auth.role) return hello.auth.role
  return t('overview.authToken')
})

// Session key from auth
const sessionKey = computed(() => {
  return conn.helloData?.auth?.deviceToken ?? '-'
})

// Gateway access details
const wsUrl = computed(() => conn.url)
const protocolVersion = computed(() => conn.helloData?.protocol ?? '-')
const connectionId = computed(() => conn.helloData?.server?.connId ?? '-')

// Available methods/events count
const methodsCount = computed(() => conn.availableMethods.length)
const eventsCount = computed(() => conn.availableEvents.length)

// Auth error detection
const hasAuthError = computed(() => {
  return conn.errorMessage?.toLowerCase().includes('auth') ||
    conn.errorMessage?.toLowerCase().includes('unauthorized') ||
    conn.errorMessage?.toLowerCase().includes('forbidden')
})

let timer: ReturnType<typeof setInterval> | null = null

onMounted(async () => {
  if (conn.isConnected) await refresh()
  timer = setInterval(() => { if (conn.isConnected) refresh() }, 30_000)
})

onUnmounted(() => { if (timer) clearInterval(timer) })
</script>

<template>
  <div class="overview-view">
    <NSpace vertical :size="16">
      <!-- Auth error help -->
      <NAlert v-if="hasAuthError" type="error" :title="t('overview.authError')">
        <NText>{{ t('overview.authErrorHelp') }}</NText>
        <pre class="cli-help">openclaw config set gateway.token YOUR_TOKEN
openclaw gateway run --bind loopback --port 18789</pre>
      </NAlert>

      <NSpace justify="end">
        <NButton size="small" secondary :loading="health.loading.value" @click="refresh">
          {{ t('common.refresh') }}
        </NButton>
      </NSpace>

      <!-- Stat cards -->
      <NSpin :show="health.loading.value">
        <NGrid :cols="5" :x-gap="12" :y-gap="12">
          <NGi>
            <NCard size="small">
              <NStatistic :label="t('overview.health')">
                <template #default>
                  <NTag v-if="health.data.value?.ok" type="success" size="small">OK</NTag>
                  <NTag v-else-if="health.error.value" type="error" size="small">Error</NTag>
                  <NTag v-else type="default" size="small">--</NTag>
                </template>
              </NStatistic>
            </NCard>
          </NGi>
          <NGi>
            <NCard size="small">
              <NStatistic :label="t('overview.channelsOnline')" :value="onlineChannels" />
            </NCard>
          </NGi>
          <NGi>
            <NCard size="small">
              <NStatistic :label="t('overview.activeSessions')" :value="activeSessions" />
            </NCard>
          </NGi>
          <NGi>
            <NCard size="small">
              <NStatistic :label="t('overview.cronJobs')" :value="cronJobCount" />
            </NCard>
          </NGi>
          <NGi>
            <NCard size="small">
              <NStatistic :label="t('overview.connectedInstances')" :value="instancesStore.totalCount" />
            </NCard>
          </NGi>
        </NGrid>
      </NSpin>

      <NGrid :cols="2" :x-gap="12" :y-gap="12">
        <!-- System info -->
        <NGi>
          <NCard :title="t('overview.systemInfo')" size="small">
            <NSpace vertical :size="4">
              <NText depth="2">
                {{ t('overview.gatewayVersion') }}: <NText strong>{{ conn.serverVersion ?? '-' }}</NText>
              </NText>
              <NText depth="2">
                {{ t('overview.uptime') }}: <NText strong>{{ formatUptime(uptimeSeconds) }}</NText>
              </NText>
              <NText depth="2">
                {{ t('gateway.status') }}: <NText strong>{{ conn.status }}</NText>
              </NText>
              <NText depth="2">
                {{ t('overview.authMode') }}: <NText strong>{{ authMode }}</NText>
              </NText>
              <NText depth="2">
                {{ t('overview.methodsAvailable') }}: <NText strong>{{ methodsCount }}</NText>
              </NText>
              <NText depth="2">
                {{ t('overview.eventsAvailable') }}: <NText strong>{{ eventsCount }}</NText>
              </NText>
            </NSpace>
          </NCard>
        </NGi>

        <!-- Gateway access details -->
        <NGi>
          <NCard :title="t('overview.accessDetails')" size="small">
            <NSpace vertical :size="4">
              <NText depth="2">
                WS URL: <NText strong code>{{ wsUrl }}</NText>
              </NText>
              <NText depth="2">
                {{ t('overview.protocol') }}: <NText strong>{{ protocolVersion }}</NText>
              </NText>
              <NText depth="2">
                {{ t('overview.connectionId') }}: <NText strong code>{{ connectionId }}</NText>
              </NText>
              <NText depth="2">
                {{ t('overview.sessionKey') }}: <NText strong code style="font-size: 11px">{{ sessionKey }}</NText>
              </NText>
            </NSpace>
          </NCard>
        </NGi>
      </NGrid>

      <!-- Detailed health -->
      <NCard v-if="healthData" size="small">
        <NCollapse>
          <NCollapseItem :title="t('overview.detailedHealth')" name="health">
            <pre class="json-output">{{ JSON.stringify(healthData, null, 2) }}</pre>
          </NCollapseItem>
        </NCollapse>
      </NCard>

      <!-- Recent sessions -->
      <NCard :title="t('overview.recentSessions')" size="small">
        <NEmpty v-if="!recentSessions.length" :description="t('sessions.noSessions')" />
        <NDataTable
          v-else
          :columns="sessionColumns"
          :data="recentSessions"
          :pagination="false"
          size="small"
          :max-height="200"
        />
      </NCard>

      <!-- Notes -->
      <NCard :title="t('overview.notes')" size="small">
        <NSpace vertical :size="4">
          <NText depth="3">{{ t('overview.noteTailscale') }}</NText>
          <NText depth="3">{{ t('overview.noteSession') }}</NText>
          <NText depth="3">{{ t('overview.noteCron') }}</NText>
        </NSpace>
      </NCard>
    </NSpace>
  </div>
</template>

<style scoped>
.overview-view { padding: 16px; }

.json-output {
  margin: 0;
  padding: 8px;
  background: var(--n-color-embedded, #f5f5f5);
  border-radius: 4px;
  font-family: monospace;
  font-size: 12px;
  line-height: 1.5;
  overflow: auto;
  max-height: 300px;
  white-space: pre-wrap;
  word-break: break-all;
}

.cli-help {
  margin: 8px 0 0;
  padding: 8px;
  background: var(--n-color-embedded, #f5f5f5);
  border-radius: 4px;
  font-family: monospace;
  font-size: 12px;
}
</style>
