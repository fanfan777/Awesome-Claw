import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { useConnectionStore } from "@renderer/gateway/connection";

export interface AgentModel {
  primary?: string;
  fallbacks?: string[];
}

export interface AgentIdentity {
  name?: string;
  avatar?: string;
  emoji?: string;
}

export interface AgentTools {
  profile?: string;
  allow?: string[];
  deny?: string[];
}

export interface AgentGroupChat {
  mentionPatterns?: string[];
}

export interface AgentSandbox {
  mode?: string;
}

export interface Agent {
  id: string;
  name: string;
  description?: string;
  workspace?: string;
  default?: boolean;
  emoji?: string;
  model?: string | AgentModel;
  system?: string;
  identity?: AgentIdentity;
  tools?: AgentTools;
  skills?: string[];
  thinkingLevel?: string;
  subagents?: string[];
  groupChat?: AgentGroupChat;
  humanDelay?: number;
  sandbox?: AgentSandbox;
  createdAt?: string;
  updatedAt?: string;
}

export interface AgentCreateParams {
  name: string;
  description?: string;
  model?: string;
  system?: string;
  workspace?: string;
  emoji?: string;
  thinkingLevel?: string;
  default?: boolean;
  skills?: string[];
  subagents?: string[];
  humanDelay?: number;
}

export interface AgentUpdateParams {
  name?: string;
  description?: string;
  model?: string;
  system?: string;
  workspace?: string;
  emoji?: string;
  thinkingLevel?: string;
  default?: boolean;
  skills?: string[];
  subagents?: string[];
  humanDelay?: number;
  tools?: AgentTools;
  groupChat?: AgentGroupChat;
  sandbox?: AgentSandbox;
  identity?: AgentIdentity;
}

export interface AgentFile {
  name: string;
  content: string;
  size?: number;
}

export interface ToolInfo {
  name: string;
  description?: string;
  category?: string;
  enabled?: boolean;
}

export const AGENT_FILES = [
  "IDENTITY.md",
  "SOUL.md",
  "AGENTS.md",
  "USER.md",
  "TOOLS.md",
];

export const THINKING_LEVELS = [
  { label: "Off", value: "off" },
  { label: "Minimal", value: "minimal" },
  { label: "Low", value: "low" },
  { label: "Medium", value: "medium" },
  { label: "High", value: "high" },
  { label: "Extra High", value: "xhigh" },
];

export const TOOL_PROFILES = [
  { label: "Full", value: "full" },
  { label: "Coding", value: "coding" },
  { label: "Messaging", value: "messaging" },
  { label: "Minimal", value: "minimal" },
];

export const SANDBOX_MODES = [
  { label: "Off", value: "off" },
  { label: "Read-only", value: "ro" },
  { label: "Read-write", value: "rw" },
];

export const useAgentsStore = defineStore("agents", () => {
  const agents = ref<Agent[]>([]);
  const selectedAgent = ref<Agent | null>(null);
  const files = ref<Record<string, AgentFile>>({});
  const fileDrafts = ref<Record<string, string>>({});
  const toolsCatalog = ref<ToolInfo[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  // Main agent display identity (loaded from IDENTITY.md)
  const mainAgentDisplayName = ref("OpenClaw");
  const mainAgentEmoji = ref("🤖");

  const hasFileDrafts = computed(() => {
    return Object.keys(fileDrafts.value).some((key) => {
      const file = files.value[key];
      return file && fileDrafts.value[key] !== file.content;
    });
  });

  /** Check if a specific file has unsaved changes */
  function isFileDirty(filename: string): boolean {
    const file = files.value[filename];
    if (!file) {return !!fileDrafts.value[filename];}
    return fileDrafts.value[filename] !== file.content;
  }

  /** Get list of agent IDs for subagent selection */
  const agentOptions = computed(() =>
    agents.value.map((a) => ({ label: a.emoji ? `${a.emoji} ${a.name}` : a.name, value: a.id })),
  );

  function getClient() {
    const c = useConnectionStore().client;
    if (!c) {throw new Error("Gateway not connected");}
    return c;
  }

  async function fetchAgents() {
    loading.value = true;
    error.value = null;
    try {
      const result = await getClient().request<{ agents: Agent[] }>(
        "agents.list",
      );
      agents.value = result.agents ?? [];
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to fetch agents";
    } finally {
      loading.value = false;
    }
  }

  async function createAgent(
    params: AgentCreateParams,
  ): Promise<Agent | null> {
    error.value = null;
    try {
      // Schema: { name, workspace, emoji?, avatar? }
      const agent = await getClient().request<Agent>(
        "agents.create",
        {
          name: params.name,
          workspace: params.workspace ?? "default",
          ...(params.emoji ? { emoji: params.emoji } : {}),
        },
      );
      agents.value.push(agent);
      return agent;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to create agent";
      return null;
    }
  }

  async function updateAgent(
    id: string,
    params: AgentUpdateParams,
  ): Promise<Agent | null> {
    error.value = null;
    try {
      const agent = await getClient().request<Agent>("agents.update", {
        agentId: id,
        ...(params.name ? { name: params.name } : {}),
        ...(params.workspace ? { workspace: params.workspace } : {}),
        ...(params.model ? { model: params.model } : {}),
        ...(params.identity?.avatar !== undefined ? { avatar: params.identity.avatar } : {}),
        ...(params.tools ? { tools: params.tools } : {}),
        ...(params.groupChat ? { groupChat: params.groupChat } : {}),
        ...(params.sandbox ? { sandbox: params.sandbox } : {}),
        ...(params.thinkingLevel ? { thinkingLevel: params.thinkingLevel } : {}),
        ...(params.humanDelay !== undefined ? { humanDelay: params.humanDelay } : {}),
        ...(params.skills ? { skills: params.skills } : {}),
        ...(params.subagents ? { subagents: params.subagents } : {}),
      });
      const idx = agents.value.findIndex((a) => a.id === id);
      if (idx !== -1) {agents.value[idx] = agent;}
      if (selectedAgent.value?.id === id) {selectedAgent.value = agent;}
      return agent;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to update agent";
      return null;
    }
  }

  async function deleteAgent(id: string): Promise<boolean> {
    error.value = null;
    try {
      // Schema: { agentId, deleteFiles? }
      await getClient().request("agents.delete", { agentId: id });
      agents.value = agents.value.filter((a) => a.id !== id);
      if (selectedAgent.value?.id === id) {selectedAgent.value = null;}
      return true;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to delete agent";
      return false;
    }
  }

  // File operations
  async function fetchFiles(agentId: string) {
    try {
      const result = await getClient().request<{
        files: AgentFile[];
      }>("agents.files.list", { agentId });
      const fileMap: Record<string, AgentFile> = {};
      for (const f of result.files ?? []) {
        fileMap[f.name] = f;
      }
      files.value = fileMap;
      fileDrafts.value = {};
      for (const [name, file] of Object.entries(fileMap)) {
        fileDrafts.value[name] = file.content;
      }
    } catch {
      files.value = {};
      fileDrafts.value = {};
    }
  }

  async function getFile(
    agentId: string,
    filename: string,
  ): Promise<string | null> {
    try {
      const result = await getClient().request<{ content: string }>(
        "agents.files.get",
        { agentId, name: filename },
      );
      const content = result.content ?? "";
      files.value[filename] = {
        name: filename,
        content,
        size: content.length,
      };
      if (!(filename in fileDrafts.value)) {
        fileDrafts.value[filename] = content;
      }
      return content;
    } catch {
      return null;
    }
  }

  async function setFile(
    agentId: string,
    filename: string,
    content: string,
  ): Promise<boolean> {
    try {
      await getClient().request("agents.files.set", {
        agentId,
        name: filename,
        content,
      });
      files.value[filename] = { name: filename, content, size: content.length };
      fileDrafts.value[filename] = content;
      return true;
    } catch {
      return false;
    }
  }

  function setDraft(filename: string, content: string): void {
    fileDrafts.value[filename] = content;
  }

  function discardDrafts(): void {
    fileDrafts.value = {};
    for (const [name, file] of Object.entries(files.value)) {
      fileDrafts.value[name] = file.content;
    }
  }

  // Tools catalog
  async function fetchToolsCatalog() {
    try {
      const result = await getClient().request<{ tools: ToolInfo[] }>(
        "tools.catalog",
      );
      toolsCatalog.value = result.tools ?? [];
    } catch {
      // non-critical
    }
  }

  /** Load the main agent's display name and emoji from IDENTITY.md */
  async function fetchMainAgentIdentity() {
    try {
      const res = await getClient().request<{ content: string }>(
        "agents.files.get",
        { agentId: "main", name: "IDENTITY.md" },
      );
      const content = res.content ?? "";
      const nameMatch = content.match(/^#\s+(.+)/m);
      if (nameMatch) {mainAgentDisplayName.value = nameMatch[1].trim();}
      const emojiMatch = content.match(/Avatar:\s*(\S+)/);
      if (emojiMatch) {mainAgentEmoji.value = emojiMatch[1];}
    } catch {
      // best-effort — keep defaults
    }
  }

  function selectAgent(agent: Agent | null) {
    selectedAgent.value = agent;
    files.value = {};
    fileDrafts.value = {};
  }

  return {
    agents,
    selectedAgent,
    files,
    fileDrafts,
    toolsCatalog,
    loading,
    error,
    hasFileDrafts,
    agentOptions,
    mainAgentDisplayName,
    mainAgentEmoji,
    fetchAgents,
    fetchMainAgentIdentity,
    createAgent,
    updateAgent,
    deleteAgent,
    fetchFiles,
    getFile,
    setFile,
    setDraft,
    discardDrafts,
    fetchToolsCatalog,
    selectAgent,
    isFileDirty,
  };
});
