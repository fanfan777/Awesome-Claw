import { ref } from "vue";
import { useConnectionStore } from "../gateway/connection";
import { GatewayRequestError } from "../gateway/types";

/**
 * Composable for making typed RPC calls to the gateway with loading/error state.
 *
 * Usage:
 *   const { execute, data, loading, error } = useGatewayRpc<AgentList>('agents.list')
 *   await execute({ limit: 20 })
 */
export function useGatewayRpc<T>(method: string) {
  const data = ref<T | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function execute(params?: unknown): Promise<T | null> {
    const conn = useConnectionStore();
    if (!conn.client || !conn.isConnected) {
      error.value = "Gateway not connected";
      return null;
    }

    loading.value = true;
    error.value = null;

    try {
      const result = await conn.client.request<T>(method, params);
      data.value = result;
      return result;
    } catch (err) {
      if (err instanceof GatewayRequestError) {
        error.value = `[${err.gatewayCode}] ${err.message}`;
      } else if (err instanceof Error) {
        error.value = err.message;
      } else {
        error.value = String(err);
      }
      return null;
    } finally {
      loading.value = false;
    }
  }

  function reset(): void {
    data.value = null;
    loading.value = false;
    error.value = null;
  }

  return { execute, data, loading, error, reset };
}
