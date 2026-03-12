import { defineStore } from "pinia";
import { ref } from "vue";
import { useConnectionStore } from "@renderer/gateway/connection";

export interface ToolCall {
  id: string;
  name: string;
  input?: unknown;
  output?: unknown;
  status: "running" | "complete" | "error";
  startedAt?: string;
  completedAt?: string;
}

export interface Attachment {
  type: "image" | "file";
  name: string;
  data: string;
  mimeType?: string;
}

export interface ChatMessage {
  id?: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  sessionKey?: string;
  timestamp?: string;
  streaming?: boolean;
  thinking?: string;
  thinkingVisible?: boolean;
  toolCalls?: ToolCall[];
  attachments?: Attachment[];
  fallback?: { from: string; to: string };
  aborted?: boolean;
  error?: string;
}

export interface SessionSummary {
  sessionKey: string;
  title?: string;
  updatedAt?: string;
  messageCount?: number;
  channel?: string;
  agentId?: string;
  tokenCount?: number;
}

export interface SendOptions {
  agent?: string;
  model?: string;
  thinking?: string;
  images?: Array<{ data: string; mimeType: string }>;
}

export interface ChatEventPayload {
  state: string;
  runId?: string;
  sessionKey?: string;
  seq?: number;
  message?: {
    role?: string;
    content?: Array<{ type: string; text: string }>;
    timestamp?: number;
  };
  stopReason?: string;
  errorMessage?: string;
  // Legacy/fallback fields
  delta?: string;
  content?: string;
  role?: string;
  id?: string;
  thinking?: string;
  error?: string;
  from?: string;
  to?: string;
  removedCount?: number;
  summary?: string;
}

export interface AgentEventPayload {
  type: string;
  sessionKey?: string;
  tool?: string;
  toolCallId?: string;
  input?: unknown;
  output?: unknown;
  error?: string;
}

export const useChatStore = defineStore("chat", () => {
  const messages = ref<ChatMessage[]>([]);
  const sessions = ref<SessionSummary[]>([]);
  const currentSessionKey = ref<string | null>(null);
  const streaming = ref(false);
  const streamingContent = ref("");
  const error = ref<string | null>(null);
  const lastFallback = ref<{ from: string; to: string } | null>(null);

  function getClient() {
    const c = useConnectionStore().client;
    if (!c) {throw new Error("Gateway not connected");}
    return c;
  }

  async function fetchSessions() {
    try {
      const result = await getClient().request<{ sessions: Array<Record<string, unknown>> }>(
        "sessions.list",
      );
      // Gateway returns "key" (not "sessionKey"), "totalTokens" (not "tokenCount"),
      // "displayName"/"derivedTitle"/"label" (not "title"), "updatedAt" as ms number
      sessions.value = (result.sessions ?? []).map((s) => ({
        sessionKey: (s.key as string) ?? (s.sessionKey as string) ?? "",
        title: (s.derivedTitle as string) ?? (s.displayName as string) ?? (s.label as string),
        channel: s.channel as string | undefined,
        agentId: s.agentId as string | undefined,
        messageCount: s.messageCount as number | undefined,
        tokenCount: (s.totalTokens as number) ?? (s.tokenCount as number),
        updatedAt: typeof s.updatedAt === "number" ? new Date(s.updatedAt).toISOString() : (s.updatedAt as string | undefined),
      })) as SessionSummary[];
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to fetch sessions";
    }
  }

  async function fetchHistory(sessionKey: string) {
    error.value = null;
    try {
      const result = await getClient().request<{ messages: ChatMessage[] }>(
        "chat.history",
        { sessionKey },
      );
      messages.value = result.messages ?? [];
      currentSessionKey.value = sessionKey;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to fetch history";
    }
  }

  async function sendMessage(
    content: string,
    sessionKey?: string,
    options?: SendOptions,
  ): Promise<string | null> {
    error.value = null;
    streaming.value = true;
    streamingContent.value = "";
    const key = sessionKey ?? currentSessionKey.value ?? undefined;

    const userMessage: ChatMessage = {
      role: "user",
      content,
      sessionKey: key,
      timestamp: new Date().toISOString(),
    };

    if (options?.images && options.images.length > 0) {
      userMessage.attachments = options.images.map((img, i) => ({
        type: "image" as const,
        name: `image-${i + 1}`,
        data: img.data,
        mimeType: img.mimeType,
      }));
    }

    messages.value.push(userMessage);

    try {
      // Generate a session key if none exists (new conversation)
      const resolvedKey = key || `electron:${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const idempotencyKey = `${resolvedKey}:${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      const params: Record<string, unknown> = {
        sessionKey: resolvedKey,
        message: content,
        idempotencyKey,
      };
      if (options?.thinking) {params.thinking = options.thinking;}
      if (options?.images) {
        params.attachments = options.images.map((img) => ({
          type: "image",
          data: img.data,
          mimeType: img.mimeType,
        }));
      }

      console.log("[chat-store] sending chat.send:", params);
      const result = await getClient().request<{ sessionKey: string }>(
        "chat.send",
        params,
      );
      console.log("[chat-store] chat.send response:", result);
      const resultKey = result.sessionKey || resolvedKey;
      if (!currentSessionKey.value) {
        currentSessionKey.value = resultKey;
      }
      return resultKey;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to send message";
      streaming.value = false;
      // Remove the streaming assistant placeholder on send failure
      const last = messages.value[messages.value.length - 1];
      if (last?.role === "assistant" && last.streaming) {
        last.streaming = false;
        last.error = error.value ?? "Send failed";
      }
      return null;
    }
    // Do NOT set streaming=false here — the WebSocket "end"/"error"/"aborted"
    // event handler in handleChatEvent will reset it when the response finishes.
  }

  async function abort(sessionKey: string): Promise<void> {
    try {
      await getClient().request("chat.abort", { sessionKey });
    } catch {
      // ignore abort errors
    } finally {
      streaming.value = false;
      const last = messages.value[messages.value.length - 1];
      if (last?.role === "assistant" && last.streaming) {
        last.streaming = false;
        last.aborted = true;
      }
    }
  }

  async function createSession(): Promise<string | null> {
    try {
      const result = await getClient().request<{ sessionKey: string }>(
        "sessions.create",
        {},
      );
      const key = result.sessionKey;
      currentSessionKey.value = key;
      messages.value = [];
      await fetchSessions();
      return key;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to create session";
      return null;
    }
  }

  function clearCurrentSession() {
    currentSessionKey.value = null;
    messages.value = [];
    streaming.value = false;
    streamingContent.value = "";
    error.value = null;
  }

  /** Find (or create) the current streaming assistant message. */
  function _getOrCreateStreamingMsg(
    sessionKey?: string,
  ): ChatMessage {
    const last = messages.value[messages.value.length - 1];
    if (last?.role === "assistant" && last.streaming) {
      return last;
    }
    const msg: ChatMessage = {
      role: "assistant",
      content: "",
      sessionKey: sessionKey ?? undefined,
      streaming: true,
      timestamp: new Date().toISOString(),
      toolCalls: [],
    };
    messages.value.push(msg);
    return msg;
  }

  /** Extract text from gateway message content array */
  function _extractText(msg?: ChatEventPayload["message"]): string {
    if (!msg?.content) {return "";}
    return msg.content
      .filter((c) => c.type === "text" && c.text)
      .map((c) => c.text)
      .join("");
  }

  function handleChatEvent(payload: ChatEventPayload) {
    if (!payload) {return;}
    // Gateway uses "state" field, not "type"
    const state = payload.state;
    console.log("[chat-store] handleChatEvent:", state, payload);

    switch (state) {
      case "delta": {
        const text = _extractText(payload.message);
        if (!text) {break;}
        streaming.value = true;
        streamingContent.value += text;
        const msg = _getOrCreateStreamingMsg(payload.sessionKey);
        msg.content += text;
        break;
      }
      case "final": {
        streaming.value = false;
        streamingContent.value = "";
        const last = messages.value[messages.value.length - 1];
        if (last?.streaming) {
          last.streaming = false;
          const finalText = _extractText(payload.message);
          if (finalText) {last.content = finalText;}
        }
        break;
      }
      case "aborted": {
        streaming.value = false;
        streamingContent.value = "";
        const last = messages.value[messages.value.length - 1];
        if (last?.role === "assistant") {
          last.streaming = false;
          last.aborted = true;
          // Preserve any partial text from the abort payload
          const partialText = _extractText(payload.message);
          if (partialText && !last.content) {last.content = partialText;}
        }
        break;
      }
      case "error": {
        streaming.value = false;
        streamingContent.value = "";
        const errMsg = payload.errorMessage ?? payload.error ?? "Unknown error";
        error.value = errMsg;
        const last = messages.value[messages.value.length - 1];
        if (last?.role === "assistant" && last.streaming) {
          last.streaming = false;
          last.error = errMsg;
        } else {
          messages.value.push({
            role: "system",
            content: errMsg,
            error: errMsg,
            timestamp: new Date().toISOString(),
          });
        }
        break;
      }
      case "thinking": {
        if (!payload.thinking) {break;}
        const msg = _getOrCreateStreamingMsg(payload.sessionKey);
        msg.thinking = (msg.thinking ?? "") + payload.thinking;
        break;
      }
      case "compaction": {
        messages.value.push({
          role: "system",
          content: `Context compacted: ${payload.removedCount ?? 0} messages removed. ${payload.summary ?? ""}`.trim(),
          timestamp: new Date().toISOString(),
        });
        break;
      }
      case "fallback": {
        if (payload.from && payload.to) {
          lastFallback.value = { from: payload.from, to: payload.to };
          const msg = _getOrCreateStreamingMsg(payload.sessionKey);
          msg.fallback = { from: payload.from, to: payload.to };
          setTimeout(() => {
            lastFallback.value = null;
          }, 5000);
        }
        break;
      }
      case "message": {
        const text = _extractText(payload.message) || payload.content;
        if (text) {
          messages.value.push({
            role: (payload.message?.role as ChatMessage["role"]) ?? (payload.role as ChatMessage["role"]) ?? "assistant",
            content: text,
            id: payload.id,
            sessionKey: payload.sessionKey ?? undefined,
            timestamp: new Date().toISOString(),
          });
        }
        break;
      }
    }
  }

  function handleAgentEvent(payload: AgentEventPayload) {
    if (!payload) {return;}

    const msg = _getOrCreateStreamingMsg(payload.sessionKey);
    if (!msg.toolCalls) {msg.toolCalls = [];}

    switch (payload.type) {
      case "tool_start": {
        if (!payload.tool) {break;}
        const tc: ToolCall = {
          id: payload.toolCallId ?? `tc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          name: payload.tool,
          input: payload.input,
          status: "running",
          startedAt: new Date().toISOString(),
        };
        msg.toolCalls.push(tc);
        break;
      }
      case "tool_end": {
        if (!payload.tool) {break;}
        const existing = [...msg.toolCalls].toReversed().find(
          (tc) => tc.name === payload.tool && tc.status === "running",
        );
        if (existing) {
          existing.status = "complete";
          existing.output = payload.output;
          existing.completedAt = new Date().toISOString();
        }
        break;
      }
      case "tool_error": {
        if (!payload.tool) {break;}
        const running = [...msg.toolCalls].toReversed().find(
          (tc) => tc.name === payload.tool && tc.status === "running",
        );
        if (running) {
          running.status = "error";
          running.output = payload.error ?? "Tool execution failed";
          running.completedAt = new Date().toISOString();
        }
        break;
      }
    }
  }

  function dismissFallback() {
    lastFallback.value = null;
  }

  return {
    messages,
    sessions,
    currentSessionKey,
    streaming,
    streamingContent,
    error,
    lastFallback,
    fetchSessions,
    fetchHistory,
    sendMessage,
    abort,
    createSession,
    clearCurrentSession,
    handleChatEvent,
    handleAgentEvent,
    dismissFallback,
  };
});
