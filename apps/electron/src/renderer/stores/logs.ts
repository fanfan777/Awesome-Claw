import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { useConnectionStore } from "@renderer/gateway/connection";

export interface LogEntry {
  id?: string;
  timestamp: string;
  level: "debug" | "info" | "warn" | "error";
  message: string;
  source?: string;
  cursor?: string;
}

export type LogLevel = "debug" | "info" | "warn" | "error";

export const useLogsStore = defineStore("logs", () => {
  const entries = ref<LogEntry[]>([]);
  const cursor = ref<string | null>(null);
  const levelFilter = ref<LogLevel | null>(null);
  const searchText = ref("");
  const autoFollow = ref(true);
  const loading = ref(false);
  const error = ref<string | null>(null);

  function getClient() {
    const c = useConnectionStore().client;
    if (!c) {throw new Error('Gateway not connected');}
    return c;
  }

  const filteredLogs = computed(() => {
    let result = entries.value;
    if (levelFilter.value) {
      const levels: LogLevel[] = ["debug", "info", "warn", "error"];
      const minIdx = levels.indexOf(levelFilter.value);
      result = result.filter((e) => levels.indexOf(e.level) >= minIdx);
    }
    if (searchText.value) {
      const q = searchText.value.toLowerCase();
      result = result.filter(
        (e) =>
          e.message.toLowerCase().includes(q) ||
          (e.source ?? "").toLowerCase().includes(q),
      );
    }
    return result;
  });

  async function fetchLogs(fromCursor?: string) {
    loading.value = true;
    error.value = null;
    try {
      const result = await getClient().request<{ entries: LogEntry[]; cursor?: string }>("logs.tail", {
        cursor: fromCursor,
        limit: 100,
      });
      const newEntries = result.entries ?? [];
      if (fromCursor) {
        // Prepend older entries
        entries.value = [...newEntries, ...entries.value];
      } else {
        entries.value = newEntries;
      }
      if (result.cursor) {cursor.value = result.cursor;}
    } catch (err) {
      error.value = err instanceof Error ? err.message : "Failed to fetch logs";
    } finally {
      loading.value = false;
    }
  }

  async function loadMore() {
    if (cursor.value) {
      await fetchLogs(cursor.value);
    }
  }

  function setLevelFilter(level: LogLevel | null) {
    levelFilter.value = level;
  }

  function setSearch(text: string) {
    searchText.value = text;
  }

  function toggleAutoFollow() {
    autoFollow.value = !autoFollow.value;
  }

  function appendEntry(entry: LogEntry) {
    entries.value.push(entry);
    // Keep a reasonable cap to avoid memory growth
    if (entries.value.length > 2000) {
      entries.value = entries.value.slice(-1500);
    }
  }

  return {
    entries,
    cursor,
    levelFilter,
    searchText,
    autoFollow,
    loading,
    error,
    filteredLogs,
    fetchLogs,
    loadMore,
    setLevelFilter,
    setSearch,
    toggleAutoFollow,
    appendEntry,
  };
});
