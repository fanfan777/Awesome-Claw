import { defineStore } from "pinia";
import { ref, computed } from "vue";
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

  async function fetchStatus() {
    loading.value = true;
    error.value = null;
    try {
      const result = await getClient().request<{
        channels: ChannelStatus[];
      }>("channels.status");
      channels.value = (result.channels ?? []).map((ch) => ({
        ...ch,
        lastRefresh: new Date().toISOString(),
      }));
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
      // Schema: config.patch { raw: string }
      await getClient().request("config.patch", {
        raw: JSON.stringify({ channels: { [channel]: config } }),
      });
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
      await getClient().request("channels.testSend", {
        channel,
        to,
        message,
      });
      return true;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to send test message";
      return false;
    }
  }

  async function refreshChannel(channel: string): Promise<boolean> {
    error.value = null;
    try {
      await getClient().request("channels.refresh", { channel });
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
      // Schema: config.patch { raw: string }
      await getClient().request("config.patch", {
        raw: JSON.stringify({ channels: { [channel]: config } }),
      });
      await fetchStatus();
      return true;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to add channel";
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
