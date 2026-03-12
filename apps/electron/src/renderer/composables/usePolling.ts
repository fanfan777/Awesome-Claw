import { ref, onUnmounted, watch } from "vue";
import { useConnectionStore } from "@renderer/gateway/connection";
import { ConnectionStatus } from "@renderer/gateway/types";

export interface PollingOptions {
  /** Call callback immediately on start before the first interval fires. */
  immediate?: boolean;
}

/**
 * Composable for periodic data refresh.
 * Auto-stops on component unmount and pauses when the gateway is disconnected.
 */
export function usePolling(
  callback: () => void | Promise<void>,
  intervalMs: number,
  options: PollingOptions = {},
) {
  const isActive = ref(false);
  let timer: ReturnType<typeof setInterval> | null = null;

  function tick() {
    const conn = useConnectionStore();
    // Pause polling when not connected
    if (conn.status !== ConnectionStatus.Connected) {return;}
    void Promise.resolve(callback()).catch((err: unknown) => {
      console.warn("[usePolling] callback error:", err);
    });
  }

  function start() {
    if (isActive.value) {return;}
    isActive.value = true;
    if (options.immediate) {tick();}
    timer = setInterval(tick, intervalMs);
  }

  function stop() {
    if (!isActive.value) {return;}
    isActive.value = false;
    if (timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  }

  // Pause/resume polling based on connection state
  const conn = useConnectionStore();
  watch(
    () => conn.status,
    (status) => {
      if (status === ConnectionStatus.Connected && isActive.value) {
        // Restart timer cleanly when reconnected
        if (timer !== null) {clearInterval(timer);}
        if (options.immediate) {tick();}
        timer = setInterval(tick, intervalMs);
      } else if (status !== ConnectionStatus.Connected && timer !== null) {
        clearInterval(timer);
        timer = null;
      }
    },
  );

  onUnmounted(stop);

  return { start, stop, isActive };
}
