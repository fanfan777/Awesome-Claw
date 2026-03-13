import { defineStore } from "pinia";
import { ref, computed, watch } from "vue";
import { useConnectionStore } from "@renderer/gateway/connection";

export interface ChannelStatus {
  channel: string;
  connected: boolean;
  accountId?: string;
  username?: string;
  error?: string;
  details?: Record<string, unknown>;
  lastRefresh?: string;
  dmPolicy?: string;
  allowFrom?: string[];
  qrCode?: string;
  running?: boolean;
  enabled?: boolean;
  label?: string;
}

/** Shape returned by channels.status RPC */
interface ChannelsStatusResult {
  ts: number;
  channelOrder: string[];
  channelLabels: Record<string, string>;
  channels: Record<string, unknown>;
  channelAccounts: Record<string, ChannelAccountSnapshot[]>;
  channelDefaultAccountId: Record<string, string>;
}

interface ChannelAccountSnapshot {
  accountId?: string;
  name?: string;
  enabled?: boolean;
  configured?: boolean;
  linked?: boolean;
  running?: boolean;
  connected?: boolean;
  lastError?: string;
  dmPolicy?: string;
  allowFrom?: string[];
  mode?: string;
  [key: string]: unknown;
}

export interface ChannelConfig {
  token?: string;
  dmPolicy?: string;
  allowFrom?: string[];
  [key: string]: unknown;
}

export const useChannelsStore = defineStore("channels", () => {
  const channels = ref<ChannelStatus[]>([]);
  const loading = ref(false);
  const configuring = ref(false);
  const error = ref<string | null>(null);
  const selectedChannel = ref<string | null>(null);

  const onlineChannels = computed(() =>
    channels.value.filter((ch) => ch.connected),
  );

  const offlineChannels = computed(() =>
    channels.value.filter((ch) => !ch.connected),
  );

  const sortedChannels = computed(() => [
    ...onlineChannels.value,
    ...offlineChannels.value,
  ]);

  const channelNames = computed(() =>
    channels.value.map((ch) => ch.channel),
  );

  function getClient() {
    const c = useConnectionStore().client;
    if (!c) {throw new Error("Gateway not connected");}
    return c;
  }

  /** Wait for gateway connection to be (re-)established, with timeout */
  function waitForConnection(timeoutMs = 15000): Promise<boolean> {
    const conn = useConnectionStore();
    if (conn.isConnected) {return Promise.resolve(true);}
    return new Promise((resolve) => {
      const timer = setTimeout(() => { unwatch(); resolve(false); }, timeoutMs);
      const unwatch = watch(() => conn.isConnected, (connected) => {
        if (connected) {
          clearTimeout(timer);
          unwatch();
          resolve(true);
        }
      });
    });
  }

  /** Fetch config hash required for config.patch */
  async function getConfigHash(): Promise<string | undefined> {
    const result = await getClient().request<{ hash?: string }>("config.get");
    return result.hash ?? undefined;
  }

  async function fetchStatus() {
    console.log("[channels-store] fetchStatus called");
    loading.value = true;
    error.value = null;
    try {
      const client = getClient();
      const now = new Date().toISOString();
      const liveChannels: ChannelStatus[] = [];
      const seenChannels = new Set<string>();

      // 1) Try channels.status (10s timeout)
      try {
        console.log("[channels-store] calling channels.status...");
        const result = await Promise.race([
          client.request<ChannelsStatusResult>("channels.status"),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 10000)),
        ]);
        console.log("[channels-store] channels.status OK, channelOrder:", JSON.stringify(result.channelOrder));
        console.log("[channels-store] channelAccounts:", JSON.stringify(result.channelAccounts));

        const accounts = result.channelAccounts ?? {};
        const labels = result.channelLabels ?? {};

        for (const channelName of result.channelOrder ?? Object.keys(accounts)) {
          seenChannels.add(channelName);
          const snapshots = accounts[channelName] ?? [];
          if (snapshots.length === 0) {
            liveChannels.push({
              channel: channelName,
              connected: false,
              running: false,
              label: labels[channelName],
              lastRefresh: now,
            });
            continue;
          }
          for (const snap of snapshots) {
            const isConnected = snap.connected ?? snap.running ?? false;
            console.log("[channels-store] channel", channelName, "account", snap.accountId, "connected:", snap.connected, "running:", snap.running, "→ online:", isConnected);
            liveChannels.push({
              channel: channelName,
              connected: isConnected,
              running: snap.running ?? false,
              enabled: snap.enabled ?? true,
              accountId: snap.accountId,
              username: snap.name,
              error: snap.lastError,
              dmPolicy: snap.dmPolicy,
              allowFrom: snap.allowFrom,
              label: labels[channelName],
              lastRefresh: now,
            });
          }
        }
      } catch (e) {
        console.warn("[channels-store] channels.status failed/timeout:", e);
      }

      // 2) Always merge config.get to catch configured-but-missing channels
      try {
        const configResult = await client.request<{ config: Record<string, unknown> }>("config.get");
        const configChannels = (configResult.config?.channels ?? {}) as Record<string, unknown>;
        console.log("[channels-store] config.get channels:", Object.keys(configChannels));
        for (const [name, cfg] of Object.entries(configChannels)) {
          if (seenChannels.has(name) || !cfg || typeof cfg !== "object") {continue;}
          const cfgObj = cfg as Record<string, unknown>;
          if (cfgObj.enabled === false) {continue;}
          console.log("[channels-store] adding from config:", name);
          liveChannels.push({
            channel: name,
            connected: false,
            lastRefresh: now,
            error: "已配置，等待连接",
            dmPolicy: cfgObj.dmPolicy as string | undefined,
            allowFrom: cfgObj.allowFrom as string[] | undefined,
          });
        }
      } catch (e) {
        console.warn("[channels-store] config.get merge failed:", e);
      }

      console.log("[channels-store] final channels:", liveChannels.map(c => `${c.channel}(${c.connected ? "online" : "offline"})`));
      channels.value = liveChannels;
    } catch (err) {
      error.value =
        err instanceof Error
          ? err.message
          : "Failed to fetch channel status";
    } finally {
      loading.value = false;
    }
  }

  async function logout(
    channel: string,
    accountId?: string,
  ): Promise<boolean> {
    error.value = null;
    try {
      await getClient().request("channels.logout", { channel, accountId });
      await fetchStatus();
      return true;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to logout channel";
      return false;
    }
  }

  async function configureChannel(
    channel: string,
    config: ChannelConfig,
  ): Promise<boolean> {
    configuring.value = true;
    error.value = null;
    try {
      // Schema: config.patch { raw, baseHash }
      const baseHash = await getConfigHash();
      const channelCfg = { enabled: true, ...config };
      await getClient().request("config.patch", {
        raw: JSON.stringify({ channels: { [channel]: channelCfg } }),
        baseHash,
      });
      // Gateway may restart after config change — wait for reconnection
      console.log("[channels-store] config.patch sent, waiting for reconnection...");
      await waitForConnection(15000);
      // Extra delay for channel startup
      await new Promise((r) => setTimeout(r, 2000));
      await fetchStatus();
      return true;
    } catch (err) {
      error.value =
        err instanceof Error
          ? err.message
          : "Failed to configure channel";
      return false;
    } finally {
      configuring.value = false;
    }
  }

  async function testSend(
    channel: string,
    to: string,
    message: string,
  ): Promise<boolean> {
    error.value = null;
    try {
      // Use "send" RPC to send a message via the specified channel
      await getClient().request("send", {
        to,
        message,
        channel,
        idempotencyKey: `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      });
      return true;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to send test message";
      return false;
    }
  }

  async function refreshChannel(_channel: string): Promise<boolean> {
    // No channels.refresh RPC — just re-fetch status
    error.value = null;
    try {
      await fetchStatus();
      return true;
    } catch (err) {
      error.value =
        err instanceof Error
          ? err.message
          : "Failed to refresh channel";
      return false;
    }
  }

  async function addChannel(
    channel: string,
    config: ChannelConfig,
  ): Promise<boolean> {
    configuring.value = true;
    error.value = null;
    try {
      // Ensure enabled:true is set so the gateway starts the channel
      const baseHash = await getConfigHash();
      const channelConfig = { enabled: true, ...config };
      const patch = { channels: { [channel]: channelConfig } };
      console.log("[channels-store] addChannel patch:", JSON.stringify(patch));
      const result = await getClient().request("config.patch", {
        raw: JSON.stringify(patch),
        baseHash,
      });
      console.log("[channels-store] config.patch result:", result);
      // Gateway may restart — wait for reconnection, then poll status
      console.log("[channels-store] waiting for reconnection...");
      await waitForConnection(15000);
      for (let i = 0; i < 3; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        await fetchStatus();
        if (channels.value.some((ch) => ch.channel === channel)) {
          console.log("[channels-store] channel appeared:", channel);
          return true;
        }
        console.log("[channels-store] channel not yet visible, retry", i + 1);
      }
      // Channel written but not connected — still show in list via config merge
      console.log("[channels-store] channel configured but may not be connected yet");
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to add channel";
      console.error("[channels-store] addChannel error:", msg, err);
      error.value = msg;
      return false;
    } finally {
      configuring.value = false;
    }
  }

  return {
    channels,
    loading,
    configuring,
    error,
    selectedChannel,
    onlineChannels,
    offlineChannels,
    sortedChannels,
    channelNames,
    fetchStatus,
    logout,
    configureChannel,
    testSend,
    refreshChannel,
    addChannel,
  };
});
