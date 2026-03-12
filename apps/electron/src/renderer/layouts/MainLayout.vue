<template>
  <n-layout has-sider style="height: 100vh">
    <!-- Sidebar -->
    <n-layout-sider
      :collapsed="collapsed"
      :collapsed-width="56"
      :width="220"
      collapse-mode="width"
      show-trigger="arrow-circle"
      bordered
      @update:collapsed="collapsed = $event"
    >
      <!-- Logo area -->
      <div class="sidebar-logo" :class="{ collapsed }">
        <span v-if="!collapsed" class="logo-text">OpenClaw</span>
        <span v-else class="logo-icon">OC</span>
      </div>

      <!-- Navigation menu -->
      <n-menu
        :value="activeKey"
        :collapsed="collapsed"
        :collapsed-width="56"
        :collapsed-icon-size="22"
        :options="menuOptions"
        @update:value="handleMenuSelect"
      />
    </n-layout-sider>

    <!-- Main content + status bar -->
    <n-layout>
      <n-layout-content style="height: calc(100vh - 32px); overflow: auto">
        <router-view v-slot="{ Component }">
          <keep-alive :max="5">
            <component :is="Component" :key="$route.name" />
          </keep-alive>
        </router-view>
      </n-layout-content>

      <!-- Bottom status bar -->
      <div class="status-bar">
        <n-space align="center" :size="8">
          <!-- Connection status dot -->
          <span
            class="status-dot"
            :class="statusClass"
            :title="statusTitle"
          />
          <n-text :depth="3" style="font-size: 12px">
            {{ statusLabel }}
          </n-text>
          <n-text v-if="serverVersion" :depth="3" style="font-size: 12px">
            v{{ serverVersion }}
          </n-text>
          <n-text v-if="conn.isConnected && conn.helloData?.policy?.tickIntervalMs" :depth="3" style="font-size: 12px">
            tick {{ conn.helloData.policy.tickIntervalMs }}ms
          </n-text>
        </n-space>

        <!-- Right side: reset wizard + language + theme toggle -->
        <n-space align="center" :size="6">
          <n-button
            quaternary
            size="small"
            :title="locale === 'zh-CN' ? '重新运行设置向导' : 'Re-run setup wizard'"
            @click="restartWizard"
          >
            <template #icon>
              <n-icon :size="16" :component="RefreshOutline" />
            </template>
          </n-button>
          <n-button
            quaternary
            size="small"
            :title="locale === 'zh-CN' ? 'Switch to English' : '切换为中文'"
            @click="toggleLanguage"
          >
            <template #icon>
              <n-icon :size="16" :component="LanguageOutline" />
            </template>
            {{ locale === 'zh-CN' ? 'EN' : '中' }}
          </n-button>
          <n-button
            quaternary
            size="small"
            :title="mode === 'dark' ? t('theme.light') : mode === 'light' ? t('theme.dark') : t('theme.system')"
            @click="cycleTheme"
          >
            <template #icon>
              <n-icon :size="16" :component="themeIcon" />
            </template>
          </n-button>
        </n-space>
      </div>
    </n-layout>
  </n-layout>
</template>

<script setup lang="ts">
import { ref, computed, h, onMounted, onUnmounted, onErrorCaptured } from "vue";
import { useRouter, useRoute } from "vue-router";
import { useI18n } from "vue-i18n";
import {
  NLayout,
  NLayoutSider,
  NLayoutContent,
  NMenu,
  NSpace,
  NText,
  NButton,
  NIcon,
  type MenuOption,
} from "naive-ui";
import {
  HomeOutline,
  ChatboxEllipsesOutline,
  HardwareChipOutline,
  ExtensionPuzzleOutline,
  RadioOutline,
  FlashOutline,
  AppsOutline,
  TimerOutline,
  LayersOutline,
  DesktopOutline,
  PeopleOutline,
  SettingsOutline,
  BarChartOutline,
  DocumentTextOutline,
  BugOutline,
  SunnyOutline,
  MoonOutline,
  ContrastOutline,
  LanguageOutline,
  RefreshOutline,
} from "@vicons/ionicons5";
import { useConnectionStore } from "../gateway/connection";
import { resetWizardCompleted } from "../router";
import { ConnectionStatus } from "../gateway/types";
import { gatewayEventBus } from "../gateway/event-bus";
import { useDebugStore } from "../stores/debug";
import { useInstancesStore } from "../stores/instances";
import { useTheme } from "../composables/useTheme";
import type { ThemeMode } from "../composables/useTheme";
import type { GatewayEventFrame } from "../gateway/types";

const { t, locale } = useI18n();
const router = useRouter();
const route = useRoute();
const conn = useConnectionStore();
const { mode, setMode } = useTheme();

const collapsed = ref(false);

const activeKey = computed(() => route.name as string | undefined);

function renderIcon(icon: object) {
  return () => h(NIcon, null, { default: () => h(icon) });
}

const menuOptions = computed<MenuOption[]>(() => [
  {
    label: t("nav.overview"),
    key: "overview",
    icon: renderIcon(HomeOutline),
  },
  {
    label: t("nav.chat"),
    key: "chat",
    icon: renderIcon(ChatboxEllipsesOutline),
  },
  {
    label: t("nav.agents"),
    key: "agents",
    icon: renderIcon(HardwareChipOutline),
  },
  {
    label: t("nav.models"),
    key: "models",
    icon: renderIcon(ExtensionPuzzleOutline),
  },
  {
    label: t("nav.channels"),
    key: "channels",
    icon: renderIcon(RadioOutline),
  },
  {
    label: t("nav.skills"),
    key: "skills",
    icon: renderIcon(FlashOutline),
  },
  {
    label: t("nav.plugins"),
    key: "plugins",
    icon: renderIcon(AppsOutline),
  },
  {
    label: t("nav.cron"),
    key: "cron",
    icon: renderIcon(TimerOutline),
  },
  {
    label: t("nav.sessions"),
    key: "sessions",
    icon: renderIcon(LayersOutline),
  },
  {
    label: t("nav.nodes"),
    key: "nodes",
    icon: renderIcon(DesktopOutline),
  },
  {
    label: t("nav.instances"),
    key: "instances",
    icon: renderIcon(PeopleOutline),
  },
  {
    label: t("nav.config"),
    key: "config",
    icon: renderIcon(SettingsOutline),
  },
  {
    label: t("nav.usage"),
    key: "usage",
    icon: renderIcon(BarChartOutline),
  },
  {
    label: t("nav.logs"),
    key: "logs",
    icon: renderIcon(DocumentTextOutline),
  },
  {
    label: t("nav.debug"),
    key: "debug",
    icon: renderIcon(BugOutline),
  },
]);

function handleMenuSelect(key: string) {
  void router.push({ name: key });
}

// Status bar
const statusClass = computed(() => ({
  "dot-connected": conn.status === ConnectionStatus.Connected,
  "dot-connecting":
    conn.status === ConnectionStatus.Connecting ||
    conn.status === ConnectionStatus.Reconnecting,
  "dot-error": conn.status === ConnectionStatus.Error,
  "dot-disconnected": conn.status === ConnectionStatus.Disconnected,
}));

const statusLabel = computed(() => {
  switch (conn.status) {
    case ConnectionStatus.Connected:
      return t("gateway.connected");
    case ConnectionStatus.Connecting:
      return t("gateway.connecting");
    case ConnectionStatus.Reconnecting:
      return t("gateway.reconnecting");
    case ConnectionStatus.Error:
      return t("gateway.error");
    default:
      return t("gateway.disconnected");
  }
});

const statusTitle = computed(() =>
  conn.errorMessage ? conn.errorMessage : statusLabel.value,
);

const serverVersion = computed(() => conn.serverVersion);

// Theme cycling: light → dark → system → light
const THEME_CYCLE: ThemeMode[] = ["light", "dark", "system"];
const themeIcon = computed(() => {
  if (mode.value === "dark") return MoonOutline;
  if (mode.value === "light") return SunnyOutline;
  return ContrastOutline;
});

function cycleTheme() {
  const idx = THEME_CYCLE.indexOf(mode.value);
  setMode(THEME_CYCLE[(idx + 1) % THEME_CYCLE.length]);
}

function toggleLanguage() {
  const newLang = locale.value === "zh-CN" ? "en" : "zh-CN";
  locale.value = newLang;
  localStorage.setItem("openclaw:locale", newLang);
}

function restartWizard() {
  resetWizardCompleted();
  void router.push({ path: "/wizard" });
}

const debugStore = useDebugStore();
const instancesStore = useInstancesStore();

// Wildcard listener that pipes all gateway events to the debug store
function onWildcardEvent(frame: unknown) {
  const f = frame as GatewayEventFrame;
  if (f && f.event) {
    debugStore.recordEvent({ event: f.event, payload: f.payload });
    // Also forward presence events to instances store
    if (f.event === "presence") {
      instancesStore.handlePresenceEvent(f.payload);
    }
  }
}

// Prevent child component errors from killing the entire layout
onErrorCaptured((err) => {
  console.error("[MainLayout] caught child error:", err);
  return false; // prevent propagation
});

onMounted(async () => {
  // Auto-connect if not yet connected
  if (conn.status === ConnectionStatus.Disconnected && conn.url) {
    const api = window.electronAPI?.gateway;

    // Try to read fresh token from gateway config (wizard may have set it)
    try {
      const freshToken = await api?.readToken();
      if (freshToken) conn.token = freshToken;
    } catch { /* ignore */ }

    // Check if gateway is already running; if not, try to start it
    try {
      const disc = await api?.discover();
      if (!disc?.found) {
        // Gateway not running — try to spawn it
        const spawnResult = await api?.spawn();
        if (spawnResult?.ok) {
          // Wait for gateway to become ready (up to 30s)
          const deadline = Date.now() + 30_000;
          while (Date.now() < deadline) {
            const status = await api?.status();
            if (status?.state === "running" || status?.state === "attachedExisting") break;
            if (status?.state === "failed" || status?.state === "stopped") break;
            await new Promise((r) => setTimeout(r, 1000));
          }
          // Re-read token (gateway may have generated a new one)
          try {
            const newToken = await api?.readToken();
            if (newToken) conn.token = newToken;
          } catch { /* ignore */ }
        }
      }
    } catch { /* ignore — proceed with connect attempt anyway */ }

    conn.connect(conn.url, conn.token || undefined, conn.password || undefined);
  }
  // Listen to all gateway events
  gatewayEventBus.on("*", onWildcardEvent);
});

onUnmounted(() => {
  gatewayEventBus.off("*", onWildcardEvent);
});
</script>

<style scoped>
.sidebar-logo {
  height: 52px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 16px;
  font-weight: 700;
  font-size: 16px;
  letter-spacing: 0.5px;
  overflow: hidden;
  white-space: nowrap;
  border-bottom: 1px solid var(--n-border-color, #e0e0e0);
  transition: padding 0.2s;
}

.sidebar-logo.collapsed {
  padding: 0;
  font-size: 12px;
}

.logo-text {
  color: var(--n-text-color, inherit);
}

.logo-icon {
  color: var(--n-text-color, inherit);
  font-size: 11px;
  font-weight: 800;
}

.status-bar {
  height: 32px;
  padding: 0 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-top: 1px solid var(--n-border-color, #e0e0e0);
  flex-shrink: 0;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
  flex-shrink: 0;
}

.dot-connected {
  background: #18a058;
}

.dot-connecting {
  background: #f0a020;
  animation: blink 1s ease-in-out infinite;
}

.dot-error {
  background: #d03050;
}

.dot-disconnected {
  background: #909399;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}
</style>
