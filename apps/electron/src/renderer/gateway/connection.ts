import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { GatewayElectronClient } from "./client";
import { gatewayEventBus } from "./event-bus";
import {
  ConnectionStatus,
  type GatewayHelloOk,
  type GatewayErrorInfo,
} from "./types";

const STORAGE_KEY = "openclaw:connection";

type PersistedSettings = {
  url: string;
  token?: string;
};

function loadSettings(): PersistedSettings | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as PersistedSettings) : null;
  } catch {
    return null;
  }
}

function saveSettings(settings: PersistedSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // ignore storage errors
  }
}

export const useConnectionStore = defineStore("connection", () => {
  const persisted = loadSettings();

  const url = ref(persisted?.url ?? "ws://127.0.0.1:18789");
  const token = ref(persisted?.token ?? "");
  const password = ref("");
  const status = ref<ConnectionStatus>(ConnectionStatus.Disconnected);
  const helloData = ref<GatewayHelloOk | null>(null);
  const errorMessage = ref<string | null>(null);
  const client = ref<GatewayElectronClient | null>(null);

  // Computed getters
  const isConnected = computed(() => status.value === ConnectionStatus.Connected);

  const serverVersion = computed(
    () => helloData.value?.server?.version ?? null,
  );

  const availableMethods = computed(
    () => helloData.value?.features?.methods ?? [],
  );

  const availableEvents = computed(
    () => helloData.value?.features?.events ?? [],
  );

  function _createClient(
    wsUrl: string,
    wsToken?: string,
    wsPassword?: string,
  ): GatewayElectronClient {
    return new GatewayElectronClient({
      url: wsUrl,
      token: wsToken || undefined,
      password: wsPassword || undefined,
      onHello(hello) {
        helloData.value = hello;
        status.value = ConnectionStatus.Connected;
        errorMessage.value = null;
      },
      onClose(info: { code: number; reason: string; error?: GatewayErrorInfo }) {
        helloData.value = null;
        if (info.error) {
          status.value = ConnectionStatus.Error;
          errorMessage.value = info.error.message;
        } else {
          status.value = ConnectionStatus.Reconnecting;
          errorMessage.value = null;
        }
      },
    });
  }

  function connect(
    wsUrl?: string,
    wsToken?: string,
    wsPassword?: string,
  ): void {
    // Disconnect existing client first
    if (client.value) {
      client.value.stop();
      client.value = null;
      gatewayEventBus.clear();
    }

    const resolvedUrl = wsUrl ?? url.value;
    const resolvedToken = wsToken ?? token.value;
    const resolvedPassword = wsPassword ?? password.value;

    url.value = resolvedUrl;
    if (wsToken !== undefined) {token.value = wsToken;}

    saveSettings({ url: resolvedUrl, token: resolvedToken });

    status.value = ConnectionStatus.Connecting;
    errorMessage.value = null;
    helloData.value = null;

    const c = _createClient(resolvedUrl, resolvedToken, resolvedPassword);
    client.value = c;
    c.start();
  }

  function disconnect(): void {
    if (client.value) {
      client.value.stop();
      client.value = null;
      gatewayEventBus.clear();
    }
    status.value = ConnectionStatus.Disconnected;
    helloData.value = null;
    errorMessage.value = null;
  }

  function reconnect(): void {
    connect(url.value, token.value, password.value);
  }

  return {
    url,
    token,
    password,
    status,
    helloData,
    errorMessage,
    client,
    isConnected,
    serverVersion,
    availableMethods,
    availableEvents,
    connect,
    disconnect,
    reconnect,
  };
});
