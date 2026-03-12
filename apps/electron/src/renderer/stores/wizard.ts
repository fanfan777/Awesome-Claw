import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { useConnectionStore } from "@renderer/gateway/connection";
import { markWizardCompleted } from "@renderer/router";

export type WizardStepType =
  | "note"
  | "select"
  | "text"
  | "confirm"
  | "multiselect"
  | "progress"
  | "action";

export type WizardPhase =
  | "welcome"
  | "gateway-detect"
  | "gateway-connect"
  | "identity-setup"
  | "server-wizard"
  | "complete";

export interface WizardStep {
  id: string;
  type: WizardStepType;
  title?: string;
  message?: string;
  options?: Array<{ value: unknown; label: string; hint?: string }>;
  initialValue?: unknown;
  placeholder?: string;
  sensitive?: boolean;
  executor?: "gateway" | "client";
  progress?: number;
  total?: number;
}

// Matches WizardStartResultSchema: { sessionId, done, step?, status?, error? }
export interface WizardStartResult {
  sessionId: string;
  done: boolean;
  step?: WizardStep;
  status?: "running" | "done" | "cancelled" | "error";
  error?: string;
}

// Matches WizardNextResultSchema: { done, step?, status?, error? }
export interface WizardNextResult {
  done: boolean;
  step?: WizardStep;
  status?: "running" | "done" | "cancelled" | "error";
  error?: string;
}

// Matches WizardStatusResultSchema: { status, error? }
export interface WizardStatusResult {
  status: "running" | "done" | "cancelled" | "error";
  error?: string;
}

export interface StepHistoryEntry {
  step: WizardStep;
  answer: unknown;
  autoSubmitted?: boolean;
}

export const useWizardStore = defineStore("wizard", () => {
  // -- Client-side phase state --
  const phase = ref<WizardPhase>("welcome");
  const language = ref("zh-CN");

  // -- Identity setup state (client-side) --
  const identityName = ref("OpenClaw");
  const identityEmoji = ref("🤖");
  const userName = ref("");
  const soulText = ref("");
  const toolProfile = ref("full");
  const identitySaving = ref(false);

  // -- Fork state (after model API key) --
  const showFork = ref(false);
  const pendingChannelStep = ref<WizardStep | null>(null);

  // -- Gateway detection state --
  const gatewayDetecting = ref(false);
  const gatewayFound = ref(false);
  const gatewayUrl = ref("");
  const gatewayVersion = ref<string | null>(null);
  const gatewayStarting = ref(false);

  // -- Server-side wizard state --
  const wizardActive = ref(false);
  const sessionId = ref<string | null>(null);
  const stepData = ref<WizardStep | null>(null);

  // Current answer value bound to form inputs
  const currentAnswer = ref<unknown>(null);

  // -- UI state --
  const loading = ref(false);
  const error = ref<string | null>(null);
  const stepHistory = ref<StepHistoryEntry[]>([]);
  const replayQueue = ref<StepHistoryEntry[]>([]);

  // Can go back if there's at least one user-visible step in history
  const canGoBack = computed(() => {
    return stepHistory.value.some(e => !e.autoSubmitted);
  });

  // Phase index for progress display (0-based)
  const phaseIndex = computed(() => {
    switch (phase.value) {
      case "welcome":
        return 0;
      case "gateway-detect":
        return 1;
      case "gateway-connect":
        return 2;
      case "identity-setup":
        return 3;
      case "server-wizard":
        return 4;
      case "complete":
        return 5;
      default:
        return 0;
    }
  });

  // -- Helpers --

  function getClient() {
    const c = useConnectionStore().client;
    if (!c) {throw new Error("Gateway not connected");}
    return c;
  }

  function applyStepResult(result: { done: boolean; step?: WizardStep; status?: string; error?: string }, newSessionId?: string) {
    if (newSessionId) {sessionId.value = newSessionId;}

    wizardActive.value = !result.done;
    stepData.value = result.step ?? null;

    // Initialize currentAnswer from step's initialValue
    if (result.step) {
      if (result.step.type === "multiselect") {
        currentAnswer.value =
          result.step.initialValue != null
            ? (result.step.initialValue as unknown[])
            : [];
      } else {
        currentAnswer.value = result.step.initialValue ?? null;
      }
    }

    // If server says done, move to complete phase
    if (result.done) {
      phase.value = "complete";
    }
  }

  // -- Client-side actions --

  function setLanguage(lang: string) {
    language.value = lang;
    localStorage.setItem("openclaw:locale", lang);
  }

  async function detectGateway(): Promise<void> {
    gatewayDetecting.value = true;
    gatewayFound.value = false;
    error.value = null;
    try {
      const api = window.electronAPI?.gateway;
      if (!api) {
        gatewayFound.value = false;
        return;
      }
      const result = await api.discover();
      if (result && result.found) {
        gatewayFound.value = true;
        // discover returns http url, convert to ws for gateway client
        gatewayUrl.value = result.url.replace(/^http/, "ws");
        gatewayVersion.value = result.version ?? null;
      } else {
        gatewayFound.value = false;
      }
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to detect gateway";
      gatewayFound.value = false;
    } finally {
      gatewayDetecting.value = false;
    }
  }

  async function startGateway(): Promise<void> {
    gatewayStarting.value = true;
    error.value = null;
    try {
      const api = window.electronAPI?.gateway;
      if (!api) {throw new Error("electronAPI not available");}
      const result = await api.spawn();
      if (!result.ok) {
        error.value = result.error ?? "Gateway failed to start";
        return;
      }
      // Spawn succeeded — poll status until running (up to 90s, first run builds UI)
      const deadline = Date.now() + 90_000;
      while (Date.now() < deadline) {
        const status = await api.status();
        if (status.state === "running" || status.state === "attachedExisting") {
          gatewayFound.value = true;
          gatewayUrl.value = `ws://127.0.0.1:${status.port ?? 18789}`;
          return;
        }
        if (status.state === "failed" || status.state === "stopped") {
          error.value = "Gateway process exited unexpectedly";
          return;
        }
        await new Promise((r) => setTimeout(r, 500));
      }
      // If we're here, still starting after timeout — try discover
      const disc = await api.discover();
      if (disc.found) {
        gatewayFound.value = true;
        gatewayUrl.value = disc.url.replace(/^http/, "ws");
        gatewayVersion.value = disc.version ?? null;
      } else {
        error.value = "Gateway start timeout";
      }
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to start gateway";
    } finally {
      gatewayStarting.value = false;
    }
  }

  async function connectToGateway(): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      const connStore = useConnectionStore();
      const targetUrl = gatewayUrl.value || connStore.url;

      // Always try to read gateway auth token from config file
      try {
        const token = await window.electronAPI?.gateway?.readToken();
        console.log("[wizard] readToken result:", token ? `${token.slice(0, 8)}...` : "null");
        if (token) {connStore.token = token;}
      } catch (e) {
        console.warn("[wizard] readToken failed:", e);
      }

      if (!connStore.token) {
        console.warn("[wizard] No auth token available, connection may fail");
      }

      console.log("[wizard] Connecting to", targetUrl, "with token:", connStore.token ? "yes" : "no");
      connStore.connect(targetUrl, connStore.token, connStore.password);

      // Wait for connection to establish (poll for up to 15 seconds)
      const deadline = Date.now() + 15_000;
      while (Date.now() < deadline) {
        if (connStore.isConnected) {
          console.log("[wizard] Connected to gateway");
          phase.value = "identity-setup";
          return;
        }
        if (connStore.errorMessage) {
          error.value = connStore.errorMessage;
          return;
        }
        await new Promise((r) => setTimeout(r, 300));
      }
      error.value = "Connection timeout — check if gateway is running on " + targetUrl;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to connect to gateway";
    } finally {
      loading.value = false;
    }
  }

  function advancePhase() {
    const order: WizardPhase[] = [
      "welcome",
      "gateway-detect",
      "gateway-connect",
      "identity-setup",
      "server-wizard",
      "complete",
    ];
    const idx = order.indexOf(phase.value);
    if (idx >= 0 && idx < order.length - 1) {
      phase.value = order[idx + 1]!;
    }
  }

  // -- Server-side actions --

  async function tryStartWizard(): Promise<WizardStartResult> {
    return getClient().request<WizardStartResult>("wizard.start", {});
  }

  async function startWizard(): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      const result = await tryStartWizard();
      applyStepResult(result, result.sessionId);
      localStorage.setItem("openclaw:wizard-session", result.sessionId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to start wizard";
      if (msg.includes("wizard already running")) {
        // Try to cancel the stale session (saved or not), then retry
        const staleId = localStorage.getItem("openclaw:wizard-session");
        if (staleId) {
          try {
            await getClient().request("wizard.cancel", { sessionId: staleId });
          } catch { /* ignore */ }
          localStorage.removeItem("openclaw:wizard-session");
        }

        // Restart gateway to clear any stale sessions we can't cancel
        try {
          const api = window.electronAPI?.gateway;
          if (api) {
            await api.stop();
            await new Promise((r) => setTimeout(r, 1500));
            await api.spawn();
            // Wait for gateway to come back up
            const deadline = Date.now() + 10_000;
            while (Date.now() < deadline) {
              const status = await api.status();
              if (status.state === "running" || status.state === "attachedExisting") {break;}
              await new Promise((r) => setTimeout(r, 500));
            }
            // Reconnect
            const connStore = useConnectionStore();
            connStore.disconnect();
            await new Promise((r) => setTimeout(r, 500));
            const token = await api.readToken();
            if (token) {connStore.token = token;}
            connStore.connect(
              gatewayUrl.value || connStore.url,
              connStore.token,
              connStore.password,
            );
            // Wait for connection
            const connDeadline = Date.now() + 10_000;
            while (Date.now() < connDeadline) {
              if (connStore.isConnected) {break;}
              await new Promise((r) => setTimeout(r, 300));
            }
            if (connStore.isConnected) {
              const result = await tryStartWizard();
              applyStepResult(result, result.sessionId);
              localStorage.setItem("openclaw:wizard-session", result.sessionId);
              return;
            }
          }
        } catch { /* fallthrough to error */ }
        error.value = language.value.startsWith("zh")
          ? "有其他向导正在运行，请重启应用后重试"
          : "Another wizard is already running. Please restart the app and try again.";
      } else {
        error.value = msg;
      }
    } finally {
      loading.value = false;
    }
  }

  async function submitAnswer(answer?: unknown, opts?: { auto?: boolean }): Promise<void> {
    loading.value = true;
    error.value = null;

    const answerValue = answer ?? currentAnswer.value;

    // Record history entry before advancing
    if (stepData.value) {
      stepHistory.value.push({
        step: { ...stepData.value },
        answer: answerValue,
        autoSubmitted: opts?.auto ?? false,
      });
    }

    try {
      const result = await getClient().request<WizardNextResult>("wizard.next", {
        sessionId: sessionId.value,
        answer: stepData.value
          ? { stepId: stepData.value.id, value: answerValue }
          : undefined,
      });
      applyStepResult(result);
    } catch (err) {
      // Remove the history entry we just pushed on failure
      stepHistory.value.pop();
      error.value =
        err instanceof Error ? err.message : "Failed to advance wizard";
    } finally {
      loading.value = false;
    }
  }

  async function cancelWizard(): Promise<void> {
    error.value = null;
    try {
      await getClient().request<WizardStatusResult>("wizard.cancel", {
        sessionId: sessionId.value,
      });
      wizardActive.value = false;
      stepData.value = null;
      sessionId.value = null;
      stepHistory.value = [];
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to cancel wizard";
    }
  }

  async function goBack(): Promise<void> {
    // Find last user-visible (non-auto) step index
    let lastVisibleIdx = -1;
    for (let i = stepHistory.value.length - 1; i >= 0; i--) {
      if (!stepHistory.value[i].autoSubmitted) {
        lastVisibleIdx = i;
        break;
      }
    }
    if (lastVisibleIdx < 0) {return;}

    // Everything before the last visible step becomes replay queue
    replayQueue.value = stepHistory.value.slice(0, lastVisibleIdx);
    stepHistory.value = [];
    error.value = null;
    loading.value = true;

    // Cancel current wizard
    try {
      await getClient().request("wizard.cancel", { sessionId: sessionId.value });
    } catch { /* ignore */ }
    wizardActive.value = true;
    stepData.value = null;
    sessionId.value = null;
    currentAnswer.value = null;

    // Restart wizard
    try {
      const result = await tryStartWizard();
      applyStepResult(result, result.sessionId);
      localStorage.setItem("openclaw:wizard-session", result.sessionId);
    } catch (err) {
      error.value = err instanceof Error ? err.message : "Failed to restart wizard";
    } finally {
      loading.value = false;
    }
  }

  function consumeReplayAnswer(step: WizardStep): { found: true; answer: unknown } | null {
    if (replayQueue.value.length === 0) {return null;}
    const entry = replayQueue.value[0];
    // Match by type + message (IDs change on restart)
    if (entry.step.type === step.type && entry.step.message === step.message) {
      replayQueue.value.shift();
      return { found: true, answer: entry.answer };
    }
    // Try to find a match further in the queue (step order may shift slightly)
    const idx = replayQueue.value.findIndex(
      e => e.step.type === step.type && e.step.message === step.message,
    );
    if (idx >= 0) {
      const found = replayQueue.value[idx];
      replayQueue.value.splice(0, idx + 1);
      return { found: true, answer: found.answer };
    }
    // No match — wizard flow changed, clear replay
    replayQueue.value = [];
    return null;
  }

  async function getStatus(): Promise<void> {
    if (!sessionId.value) {return;}
    try {
      const result = await getClient().request<WizardStatusResult>("wizard.status", {
        sessionId: sessionId.value,
      });
      // If wizard finished or errored out, update state
      if (result.status === "done") {
        phase.value = "complete";
        wizardActive.value = false;
      } else if (result.status === "cancelled" || result.status === "error") {
        wizardActive.value = false;
        if (result.error) {error.value = result.error;}
      }
    } catch {
      // non-critical
    }
  }

  // -- Identity setup (client-side → RPC calls) --

  async function saveIdentity(): Promise<void> {
    identitySaving.value = true;
    error.value = null;
    try {
      const client = getClient();
      const name = identityName.value.trim() || "OpenClaw";
      const emoji = identityEmoji.value;
      // Write IDENTITY.md (includes name + avatar; agents.update requires
      // agents.list to be configured which isn't the case on fresh installs)
      const identityContent = `# ${name}\n\n- Avatar: ${emoji}\n\nI am ${name}, your personal AI assistant.\n`;
      await client.request("agents.files.set", {
        agentId: "main",
        name: "IDENTITY.md",
        content: identityContent,
      });
      // Write USER.md if user provided a name
      if (userName.value.trim()) {
        const userContent = `# User\n\nName: ${userName.value.trim()}\nTimezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}\n`;
        await client.request("agents.files.set", {
          agentId: "main",
          name: "USER.md",
          content: userContent,
        });
      }
      // Write SOUL.md — personality + language preference
      {
        const parts: string[] = ["# Personality\n"];
        if (soulText.value.trim()) {
          parts.push(soulText.value.trim() + "\n");
        }
        // Auto-set reply language based on wizard language selection
        if (language.value.startsWith("zh")) {
          parts.push("## Language\n\n请始终使用中文回复用户。\n");
        } else {
          parts.push("## Language\n\nAlways reply in English.\n");
        }
        await client.request("agents.files.set", {
          agentId: "main",
          name: "SOUL.md",
          content: parts.join("\n"),
        });
      }
      // Set tool profile based on user selection
      try {
        await client.request("agents.update", {
          agentId: "main",
          tools: { profile: toolProfile.value },
        });
      } catch {
        // Non-critical: fresh installs may not have agents.update ready yet
        // Fall back to config.patch
        try {
          await client.request("config.patch", {
            patch: { agents: { main: { tools: { profile: toolProfile.value } } } },
          });
        } catch { /* best-effort */ }
      }
      // Advance to server wizard (model API key setup)
      phase.value = "server-wizard";
    } catch (err) {
      error.value = err instanceof Error ? err.message : "Failed to save identity";
    } finally {
      identitySaving.value = false;
    }
  }

  // -- Fork: intercept channel step after model key --

  function continueFork() {
    // Continue with server wizard (channels config)
    showFork.value = false;
    phase.value = "server-wizard";
  }

  async function skipToComplete() {
    // User chose "直接进入" → cancel wizard and go to complete
    showFork.value = false;
    pendingChannelStep.value = null;
    try {
      await getClient().request("wizard.cancel", { sessionId: sessionId.value });
    } catch { /* ignore */ }
    phase.value = "complete";
    wizardActive.value = false;
  }

  function finishWizard() {
    markWizardCompleted();
    phase.value = "complete";
    wizardActive.value = false;
    stepData.value = null;
    stepHistory.value = [];
  }

  function reset() {
    phase.value = "welcome";
    gatewayDetecting.value = false;
    gatewayFound.value = false;
    gatewayUrl.value = "";
    gatewayVersion.value = null;
    gatewayStarting.value = false;
    wizardActive.value = false;
    sessionId.value = null;
    stepData.value = null;
    currentAnswer.value = null;
    loading.value = false;
    error.value = null;
    stepHistory.value = [];
    replayQueue.value = [];
    identityName.value = "OpenClaw";
    identityEmoji.value = "🤖";
    userName.value = "";
    soulText.value = "";
    toolProfile.value = "full";
    identitySaving.value = false;
    showFork.value = false;
    pendingChannelStep.value = null;
  }

  return {
    // Client-side state
    phase,
    language,
    phaseIndex,

    // Gateway detection
    gatewayDetecting,
    gatewayFound,
    gatewayUrl,
    gatewayVersion,
    gatewayStarting,

    // Identity setup
    identityName,
    identityEmoji,
    userName,
    soulText,
    toolProfile,
    identitySaving,
    saveIdentity,

    // Fork state
    showFork,
    pendingChannelStep,
    continueFork,
    skipToComplete,

    // Server wizard state
    wizardActive,
    sessionId,
    stepData,
    currentAnswer,

    // UI state
    loading,
    error,
    stepHistory,

    // Client-side actions
    setLanguage,
    detectGateway,
    startGateway,
    connectToGateway,
    advancePhase,

    // Server-side actions
    startWizard,
    submitAnswer,
    cancelWizard,
    getStatus,

    // Back navigation
    replayQueue,
    canGoBack,
    goBack,
    consumeReplayAnswer,

    // Navigation
    finishWizard,
    reset,
  };
});
