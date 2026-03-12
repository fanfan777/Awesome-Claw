# OpenClaw 端到端系统架构分析

---

## 一、整体架构概览

OpenClaw 是一个**多通道 AI 网关系统**，将各种消息平台（Telegram、Discord、Slack、WhatsApp 等）的用户消息路由到可配置的 AI Agent，并将 Agent 回复投递回用户。

```
┌─────────────────────────────────────────────────────────────────┐
│                        用户消息入口                              │
│  Telegram  Discord  Slack  WhatsApp  Signal  iMessage  Line ... │
└──────┬──────┬────────┬───────┬────────┬────────┬────────┬───────┘
       │      │        │       │        │        │        │
       ▼      ▼        ▼       ▼        ▼        ▼        ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Channel Plugin 层                           │
│   每个平台实现 ChannelPlugin 接口（入站处理、出站投递、目录查询）     │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Routing 路由层                               │
│   binding 匹配 → Agent 选择 → Session Key 生成                   │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Gateway 网关核心                               │
│   WebSocket Server + HTTP API + Control UI + Node Registry       │
│   ┌─────────┐  ┌──────────┐  ┌──────────┐  ┌───────────────┐   │
│   │ Channel  │  │  Agent   │  │  Config  │  │  Device Auth  │   │
│   │ Manager  │  │ Dispatch │  │  Reload  │  │  & Pairing    │   │
│   └─────────┘  └──────────┘  └──────────┘  └───────────────┘   │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Agent 执行引擎                                │
│   Context Engine → Model Resolution → LLM API → Tool Execution  │
│   ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐   │
│   │ Context  │  │  Media   │  │  Plugin  │  │   Memory     │   │
│   │ Engine   │  │ Underst. │  │  Hooks   │  │   (Vector)   │   │
│   └──────────┘  └──────────┘  └──────────┘  └──────────────┘   │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    LLM Provider 层                               │
│   Anthropic  OpenAI  Google  Ollama  Bedrock  Groq  20+提供商    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 二、核心组件详解

### 1. 入口与 CLI

**关键文件**：`src/entry.ts` → `src/cli/run-main.ts` → `src/cli/program.ts`

- 入口文件 `entry.ts` 处理进程初始化、Node 实验性警告抑制、CLI Profile 解析
- 最终委托到 `src/cli/run-main.ts` 的 `runCli()` 启动 Commander.js 程序
- 主要命令：
  - `gateway run` — 启动网关服务器
  - `agent [prompt]` — 运行 Agent（支持 model/provider 覆盖）
  - `channels status` — 查看通道状态
  - `config get/set/apply` — 管理配置
  - `devices list/approve/reject` — 管理设备配对
  - `nodes describe/run` — 查询/调用 Node
  - `plugins install/remove/list` — 管理扩展
  - `memory list/set/reset` — 管理 Agent 记忆
  - `cron list/add/remove` — 管理定时任务

---

### 2. Gateway 网关（系统核心枢纽）

**关键文件**：`src/gateway/server.impl.ts`、`src/gateway/server-http.ts`、`src/gateway/server-channels.ts`

#### 2.1 启动流程

```
startGatewayServer(port, opts)
  1. 加载并验证配置（OpenClaw Config）
  2. 引导认证（生成/加载 Token，验证 Tailscale）
  3. 激活 Secrets 快照（敏感配置值的运行时快照）
  4. 加载插件（核心 + 扩展 ChannelPlugin）
  5. 创建 HTTP/HTTPS Server + WebSocket Server
  6. 启动所有消息 Channel
  7. 启动 Sidecar 服务（Browser Control、Gmail Watcher、Hooks）
  8. 启动健康监控 + 定期维护（媒体清理、去重、健康快照刷新）
  9. 注册优雅关闭处理
```

#### 2.2 核心职责

| 职责                 | 说明                                                                 |
| -------------------- | -------------------------------------------------------------------- |
| **消息路由器**       | 将 10+ 消息平台的消息路由到 AI Agent                                 |
| **WebSocket 服务器** | 维持与移动 App、Web UI、远程 Node 的持久连接                         |
| **API 网关**         | 暴露 OpenAI 兼容 REST API（`/v1/chat/completions`、`/v1/responses`） |
| **控制平面**         | 管理 Channel 连接、认证、配置、定时任务、系统状态                    |
| **Node 编排器**      | 协调跨设备的技能执行（相机、屏幕、Canvas 等）                        |
| **实时事件总线**     | 广播 Agent 事件、健康状态、设备在线信息到所有已连接客户端            |
| **安全边界**         | 强制执行认证、RBAC、设备配对、速率限制                               |

#### 2.3 WebSocket 协议

**消息帧类型**（`src/gateway/protocol/index.ts`）：

```
RequestFrame:  { type: "request", method: string, params: unknown, id: string }
ResponseFrame: { type: "response", result?: unknown, error?: ErrorShape, id: string }
EventFrame:    { type: "event", event: string, payload: unknown, seq?: number }
```

**握手流程**：

1. 客户端发送 `ConnectParams`（auth token, device ID, scopes 等）
2. 服务端验证认证 → 返回 `HelloOk`（协议版本、能力列表）
3. 连接建立，双向通信开始

#### 2.4 HTTP 端点路由

请求经过有序阶段处理（`src/gateway/server-http.ts`）：

```
1.  /health, /healthz            → 健康探针（存活）
2.  /ready, /readyz              → 就绪探针
3.  POST /hooks/*                → Webhook 入口（wake/agent dispatch）
4.  POST /tools/invoke/*         → 工具 HTTP 调用
5.  Slack HTTP                   → Slack 斜杠命令和事件
6.  POST /v1/responses           → OpenResponses API（流式响应协议）
7.  POST /v1/chat/completions    → OpenAI 兼容聊天 API
8.  Canvas Auth & A2UI           → Canvas WebSocket 和 REST 端点
9.  Plugin Routes                → 插件注册的自定义路由
10. Control UI                   → 浏览器管理界面（SPA）
11. 404 Fallback
```

#### 2.5 Gateway RPC 方法（50+）

| 类别         | 方法                                                       |
| ------------ | ---------------------------------------------------------- |
| **连接**     | `connect.init`, `connect.resume`                           |
| **聊天**     | `chat.send`, `chat.history`, `chat.abort`, `chat.inject`   |
| **会话**     | `sessions.list`, `sessions.get`, `sessions.patch`          |
| **通道**     | `channels.status`, `channels.logout`                       |
| **配置**     | `config.get`, `config.set`, `config.patch`, `config.apply` |
| **节点**     | `nodes.list`, `nodes.invoke`, `nodes.subscribe`            |
| **模型**     | `models.list`, `models.info`                               |
| **技能**     | `skills.list`, `skills.status`                             |
| **执行审批** | `exec.approvals.list`, `exec.approvals.resolve`            |
| **其他**     | wizards, cron, tools, update, logs 等                      |

#### 2.6 授权流程

```
客户端请求
  ↓
1. 客户端角色验证（operator / node）
2. 方法级别角色检查（node 角色不能调用 config 方法）
3. 基于 Scope 的 RBAC（细粒度权限）
4. 控制平面写操作预算消费（速率限制）
```

---

### 3. Channel 消息通道层

**关键文件**：`src/channels/dock.ts`、`src/channels/plugins/types.ts`

#### 3.1 Channel 抽象

每个 Channel 实现 `ChannelPlugin` 接口：

```typescript
type ChannelPlugin = {
  id: string; // 通道标识（telegram, discord, ...）
  meta: ChannelMeta; // 元数据（标签、文档路径、排序）
  capabilities: ChannelCapabilities; // 能力（反应、媒体、线程、投票...）
  config: ChannelConfigAdapter; // 账户管理
  outbound: ChannelOutboundAdapter; // 发送消息
  gateway: ChannelGatewayAdapter; // 账户生命周期管理
  directory: ChannelDirectoryAdapter; // 搜索用户/群组
  pairing: ChannelPairingAdapter; // AllowList 管理
  setup: ChannelSetupAdapter; // 配置账户
  commands: ChannelCommandAdapter; // 原生平台命令
  messaging: ChannelMessagingAdapter; // 标准化目标
  groups: ChannelGroupAdapter; // 群组策略
  mentions: ChannelMentionAdapter; // 提及处理
  threading: ChannelThreadingAdapter; // 线程/回复模式
};
```

#### 3.2 Channel Dock 能力矩阵

| 特性     | Telegram | Discord    | Slack     | WhatsApp    | Signal | iMessage | Line |
| -------- | -------- | ---------- | --------- | ----------- | ------ | -------- | ---- |
| 线程     | Topics   | Threads    | Threads   | -           | -      | -        | -    |
| 反应     | Y        | Y          | Y         | Y           | Y      | Y        | Y    |
| 媒体     | Y        | Y          | Y         | Y           | Y      | Y        | Y    |
| 投票     | -        | Y          | -         | Y           | -      | -        | -    |
| 按钮     | Inline   | Components | Block Kit | Quick Reply | -      | Buttons  | -    |
| 群组     | Y        | Channels   | Channels  | Y           | Y      | Y        | Y    |
| 文本限制 | 4000     | 2000       | 4000      | 4000        | 4000   | 4000     | -    |

#### 3.3 核心 Channel 列表

**内置**：Telegram、Discord、Slack、WhatsApp(Web)、Signal、iMessage、Line、IRC、Google Chat

**扩展**（`extensions/`）：Matrix、MS Teams、Feishu（飞书）、Zalo、Nostr、Twitch、Mattermost、Nextcloud Talk、Synology Chat、Tlon 等 40+ 扩展

#### 3.4 Channel Manager

- 管理所有消息通道的生命周期
- 支持每通道多账户
- 崩溃自动重启（指数退避，最多 10 次）
- 手动停止追踪防止意外重启

---

### 4. Routing 路由系统

**关键文件**：`src/routing/resolve-route.ts`、`src/routing/session-key.ts`

#### 4.1 路由优先级（从高到低）

```
1. binding.peer          → 直接匹配特定用户/群组 ID
2. binding.peer.parent   → 继承父级线程/服务器
3. binding.guild+roles   → Discord 角色路由
4. binding.guild         → Discord 服务器级别
5. binding.team          → Slack 工作区级别
6. binding.account       → 账户级别
7. binding.channel       → 通道级别
8. default               → 回退到默认 Agent
```

#### 4.2 Session Key 构建

```typescript
buildAgentSessionKey({
  agentId: string,          // Agent ID
  channel: "telegram",      // 通道类型
  accountId?: string,       // 账户 ID
  peer?: { kind, id },      // 对话对端
  dmScope?: "main" | "per-peer" | "per-channel-peer"
})
→ "agent:agentId:channel:accountId:kind:peerId:..."
```

**Session Scope 类型**：

- `main` — 所有私聊合并为一个会话
- `per-peer` — 每个用户独立会话
- `per-channel-peer` — 每个 (通道, 用户) 对独立会话
- `per-account-channel-peer` — 最细粒度

---

### 5. 消息流转全链路

```
用户在 Telegram 发送消息
  ↓
Telegram Webhook/Polling 接收原始消息
  ↓
bot-handlers:
  - 媒体组缓冲 (100ms timeout，合并多图上传)
  - 文本片段缓冲 (1500ms timeout，合并拆分消息)
  ↓
resolveAgentRoute()
  → 匹配 Binding
  → 确定 agentId + sessionKey
  ↓
buildMessageContext()
  → 构造标准化消息上下文（发送者、通道、媒体、历史等）
  ↓
dispatchReplyWithBufferedBlockDispatcher()
  ↓
getReplyFromConfig()
  → 调用 Agent/LLM
  ↓
Agent 执行引擎:
  ├── [Plugin: before-agent-start]     修改 model/provider
  ├── Resolve Model & Auth             解析模型和认证
  ├── [Plugin: before-model-resolve]   覆盖模型选择
  ├── Context Engine 组装上下文        历史消息 + 系统提示 + Token 预算
  ├── Media Understanding              处理图片/音频/视频附件
  ├── [Plugin: before-prompt-build]    注入上下文
  ├── [Plugin: llm-input]             修改/记录 payload
  ├── 发送到 LLM API                  Anthropic/OpenAI/Google/...
  ├── [Streaming: llm-output hook]     流式输出处理
  ├── Tool Calls <-> Tool Execution    工具调用循环
  ├── [Plugin: before-tool-call / after-tool-call]
  ├── 累积响应
  ├── [Context Engine: ingest / afterTurn]
  └── [Plugin: before-message-write]
  ↓
normalizeReplyPayloadsForDelivery()
  → 标准化回复（文本分块、媒体、反应、状态消息）
  ↓
createChannelHandler("telegram")
  → 平台特定发送器
  ↓
sendMessageTelegram()
  → Telegram Bot API
  ↓
用户收到回复
```

---

### 6. Agent 执行引擎

**关键文件**：`src/agents/pi-embedded.ts`、`src/agents/pi-embedded-runner/run.ts`、`src/agents/models-config.ts`

#### 6.1 Agent 运行时

- 基于 `pi-coding-agent` 的嵌入式执行框架
- Session 持久化：`~/.openclaw/sessions/<key>.jsonl`（JSONL 格式）
- 支持重试逻辑、Failover 处理、Token 预算管理

#### 6.2 LLM Provider 集成

**支持 20+ Provider**：

| Provider            | API 类型                | 说明                           |
| ------------------- | ----------------------- | ------------------------------ |
| **Anthropic**       | Messages API            | 原生工具调用 + 扩展思考        |
| **OpenAI**          | Completions + Responses | WebSocket 流、函数调用         |
| **Google Gemini**   | Generative AI           | 多轮对话、专用工具结果处理     |
| **AWS Bedrock**     | AWS SDK                 | 多提供商、动态模型发现         |
| **Ollama**          | HTTP API                | 本地/远程、可配置 baseUrl      |
| **GitHub Copilot**  | OAuth                   | Token 刷新、专有 API           |
| **OpenRouter**      | 透传代理                | 支持 200+ 模型                 |
| **Together AI**     | HTTP API                | 开源模型托管                   |
| **Groq**            | HTTP API                | 快速推理                       |
| **Mistral**         | HTTP API                | 欧洲模型                       |
| **Moonshot/Kimi**   | HTTP API                | 中文模型                       |
| **BytePlus/Doubao** | HTTP API                | 字节跳动模型                   |
| **Minimax**         | HTTP API                | 视觉模型                       |
| **Qwen Portal**     | OAuth                   | 阿里 Qwen 模型                 |
| **更多**            | ...                     | NVIDIA、Voyage、HuggingFace 等 |

#### 6.3 Model 定义

```typescript
type ModelDefinitionConfig = {
  id: string;
  name: string;
  api?: ModelApi; // openai-completions, anthropic-messages, ...
  reasoning: boolean; // 是否支持推理
  input: Array<"text" | "image">; // 输入模态
  cost: { input; output; cacheRead; cacheWrite }; // 成本
  contextWindow: number; // 上下文窗口大小
  maxTokens: number; // 最大输出 token
  compat?: ModelCompatConfig; // 兼容性配置
};
```

#### 6.4 Context Engine

```typescript
interface ContextEngine {
  bootstrap?(): Promise<BootstrapResult>; // 会话初始化导入历史消息
  ingest(): Promise<IngestResult>; // 记录用户/助手消息
  assemble(messages, tokenBudget): Promise<AssembleResult>; // 组装上下文
  compact(tokenBudget): Promise<CompactResult>; // 压缩/摘要历史
  afterTurn?(): Promise<void>; // 持久化 + 触发后台压缩
  prepareSubagentSpawn?(): Promise<SubagentSpawnPreparation>;
  dispose?(): Promise<void>;
}
```

**压缩策略**：

- 自动阈值触发（上下文窗口使用达 80%）
- 强制压缩（显式请求）
- 向后兼容旧会话的压缩桥接

#### 6.5 Tool 系统

**内置工具**：

| 工具            | 说明                                         |
| --------------- | -------------------------------------------- |
| `read`          | 文件/目录读取（工作区边界守卫）              |
| `write`         | 文件创建/编辑（补丁应用）                    |
| `exec`          | 命令执行（审批流 + 超时处理）                |
| `process`       | 进程控制（发送按键、轮询、后台操作）         |
| `web_search`    | 搜索 + 引用追踪                              |
| `image_tool`    | 图像理解（via media-understanding pipeline） |
| `pdf_tool`      | PDF 提取（文本 + 表格）                      |
| `memory_search` | 向量搜索对话历史                             |
| `channel_tools` | 平台特定操作（反应、线程等）                 |

**工具策略控制**：

- Owner-only 限制
- Workspace-only 沙箱模式
- Per-agent allowlist/denylist
- 消息来源过滤器
- 模型提供商过滤器

#### 6.6 Failover 与韧性

- **Auth Profile 轮换**：一个提供商认证失败 → 自动尝试下一个
- **模型回退链**：主模型 → 备用模型 → 三级备用
- **速率限制退避**：指数退避
- **上下文溢出自动压缩**：Context Window 不足时自动 compact

---

### 7. Media Understanding 多模态理解

**关键文件**：`src/media-understanding/runner.ts`、`src/media-understanding/providers/`

#### 7.1 图像理解提供商

Anthropic Claude（原生视觉）、Google Gemini（内联图像）、OpenAI GPT-4V、Groq、Minimax、Mistral

#### 7.2 音频转录提供商

Deepgram（流式 + 说话人识别）、Google Speech-to-Text、OpenAI Whisper、Groq（快速 Whisper）、Moonshot（中文优化）

#### 7.3 视频处理

Google Video Intelligence（帧提取 + 多模态理解）、Moonshot（视频帧采样分析）

#### 7.4 处理流程

```
附件输入
  ↓
URL → base64 标准化（大小限制）
  ↓
Provider 选择（基于配置 + 可用性）
  ↓
并发控制（per-provider 限制）
  ↓
缓存管理（MD5 去重）
  ↓
失败回退（自动切换备选 Provider）
  ↓
输出提取（描述文本 / 转录文本）
```

---

### 8. Memory 记忆系统

**关键文件**：`src/memory/`

#### 8.1 向量数据库后端

- **SQLite-vec**：本地向量存储 + 混合搜索
- **LanceDB**：OLAP 向量数据库
- **Remote HTTP**：Webhook 自定义后端

#### 8.2 Embedding 提供商

OpenAI（text-embedding-3-small/large）、Gemini、Voyage AI、Mistral、Ollama（本地）、node-llama-cpp（离线 GGUF）

#### 8.3 检索策略

- 向量相似度搜索 + BM25 混合搜索
- MMR（最大边际相关性）多样性感知检索
- 时间衰减（近期条目权重更高）
- 批量处理 + 错误恢复

---

### 9. Plugin 与 Hook 系统

**关键文件**：`src/plugins/`、`src/hooks/`

#### 9.1 Plugin Hook 生命周期

```
Agent 执行前:
  ├── before-agent-start     → 修改 model/provider
  ├── before-model-resolve   → 覆盖模型选择
  ├── before-prompt-build    → 注入上下文、修改系统提示

LLM 调用:
  ├── llm-input              → 记录/修改发送给 LLM 的 payload
  ├── llm-output             → 处理流式响应

工具调用:
  ├── before-tool-call       → 验证/转换工具调用
  ├── after-tool-call        → 处理工具结果

消息处理:
  ├── message-received       → 拦截入站消息
  ├── message-sending        → 转换出站回复
  ├── before-message-write   → 写入前修改

会话:
  ├── before-reset           → 会话清理前
  └── subagent-spawning      → 控制子 Agent 创建
```

#### 9.2 Hook 执行规则

- **优先级排序**：数值越高越先执行
- **结果合并**：高优先级结果覆盖/前置
- **错误隔离**：`catchErrors` 标志控制
- **异步支持**：正确的顺序化处理

#### 9.3 扩展列表

```
extensions/
├── matrix/              # Matrix 开放协议
├── msteams/             # Microsoft Teams
├── feishu/              # 飞书
├── zalo/                # Zalo 消息
├── zalouser/            # Zalo 用户模式
├── telegram/            # Telegram 扩展
├── discord/             # Discord 扩展
├── slack/               # Slack 扩展
├── signal/              # Signal 扩展
├── whatsapp/            # WhatsApp 扩展
├── voice-call/          # 语音通话
├── talk-voice/          # 语音集成
├── irc/                 # IRC 协议
├── line/                # LINE 消息
├── nostr/               # Nostr 协议
├── twitch/              # Twitch 直播
├── mattermost/          # Mattermost
├── nextcloud-talk/      # Nextcloud Talk
├── synology-chat/       # Synology Chat
├── tlon/                # Tlon 消息
├── googlechat/          # Google Chat
├── imessage/            # iMessage 扩展
├── memory-core/         # 记忆核心
├── memory-lancedb/      # LanceDB 向量存储
├── lobster/             # UI 主题
├── copilot-proxy/       # Copilot 代理
├── diffs/               # Diff 工具
├── llm-task/            # LLM 任务
├── open-prose/          # 文本处理
├── phone-control/       # 手机控制
├── device-pair/         # 设备配对
├── diagnostics-otel/    # OpenTelemetry 诊断
├── thread-ownership/    # 线程所有权
└── ... (更多)
```

---

### 10. 原生客户端 App

#### 10.1 平台概览

| 平台        | 语言                   | 角色                                   | 状态        |
| ----------- | ---------------------- | -------------------------------------- | ----------- |
| **macOS**   | Swift/SwiftUI          | Gateway 宿主 + 操作员 UI（菜单栏应用） | 稳定        |
| **iOS**     | Swift/SwiftUI          | Node（伴侣设备，非网关）               | super-alpha |
| **Android** | Kotlin/Jetpack Compose | Node（伴侣设备，非网关）               | alpha       |

#### 10.2 macOS App（`apps/macos/`）

- 作为 Gateway 宿主运行（在端口 18789 启动网关进程）
- 菜单栏应用，提供操作员管理界面
- 子模块：
  - `OpenClawDiscovery` — mDNS/Bonjour 网关发现
  - `OpenClawIPC` — 进程间通信
  - `OpenClawMacCLI` — CLI 二进制包装
  - `OpenClawProtocol` — 网关协议处理
- 状态管理使用 `Observation` 框架（`@Observable`、`@Bindable`）

#### 10.3 iOS App（`apps/ios/`）

- Node 角色（伴侣设备，NOT 网关）
- 子系统：
  - `Gateway/` — 连接管理、发现、TLS 指纹信任
  - `Chat/` — 通过 `IOSGatewayChatTransport` 消息传输
  - `Voice/` — 语音唤醒 + 通话模式
  - `Camera/` — 照片/视频捕获
  - `Canvas/` — Web 渲染
  - `Location/` — 重大位置监控 + 地理围栏
  - `Device/` — 配对、Keychain 存储
  - `Services/` — APNs 注册、健康监控
  - `Onboarding/` — 设置码配对流程
- APNs 后台唤醒（开发/生产环境分离）

#### 10.4 Android App（`apps/android/`）

- Node 角色（伴侣设备，NOT 网关）
- 4 步引导 + QR 码扫描
- 设置码 + 手动连接模式
- 加密的网关状态持久化
- 流式聊天 UI
- 语音标签 + 屏幕标签（WebView Canvas）
- 前台服务 + 持久通知
- 生物识别锁 + 安全 Token 处理

#### 10.5 App 连接模型

```
App (iOS/Android)
  ↓
1. mDNS 发现: 扫描 _openclaw-gw._tcp 服务
   或 手动配置: 输入 IP + 端口 + TLS 指纹
  ↓
2. WebSocket 连接: ws://gateway:18789
   发送 ConnectParams { clientName, mode, role, deviceId, publicKey, scopes, caps }
  ↓
3. 设备配对（首次）:
   ├── Gateway 创建待审批请求（5 分钟 TTL）
   ├── 操作员审批: openclaw devices approve req-abc123
   ├── Gateway 生成 Auth Token → 发送给设备
   └── 设备存储到 Keychain/安全存储
  ↓
4. 后续连接:
   设备发送已存储 Token → Gateway 验证签名 + Scope
  ↓
5. HelloOk 响应:
   { nodeId, role, scopes, gateway version, method list, event list }
  ↓
6. 正常通信:
   ├── Node 广告能力: camera.snap, screen.record, canvas.eval, talk.say
   ├── Gateway 可远程调用 Node 能力
   ├── 事件广播: channel.message, agent.update
   └── 序列号追踪，断线重连触发 resync
```

---

### 11. ACP 桥接（IDE 集成）

**关键文件**：`src/acp/client.ts`、`src/acp/translator.ts`

#### 11.1 架构

```
IDE (VS Code / JetBrains / ...)
  ↓ stdio-based NDJSON
ACP Bridge
  ↓ WebSocket
Gateway Server
  ↓
Agent 执行引擎
```

#### 11.2 协议翻译

- ACP `PromptRequest` → Gateway `chat.send`
- Gateway `ChatEvent` → ACP `PromptResponse`
- 工具结果通过相同通道流转

#### 11.3 Session 映射

- 默认：`acp:<uuid>` 每个 ACP 客户端连接隔离
- 覆盖：直接 Session Key、标签解析、按需重置
- Session 创建速率限制（默认 120 req/10s）

---

### 12. 配置系统

**关键文件**：`src/config/config.ts`、`src/config/paths.ts`

#### 12.1 配置文件

- 主配置：`~/.openclaw/openclaw.json`
- 使用 Zod Schema 进行类型安全验证

#### 12.2 核心配置节

```typescript
{
  agents: Record<string, AgentConfig>,     // Agent 默认设置（模型、提供商、工具等）
  channels: Record<string, ChannelConfig>, // 通道认证（Telegram token、Discord bot 等）
  gateway: GatewayConfig,                  // 网关绑定、认证模式、TLS、插件
  hooks: HooksConfig,                      // 事件 Hook 处理器
  plugins: Record<string, PluginConfig>,   // 插件安装 + 配置
  sessions: SessionMaintenance,            // 会话保留 + 压缩
  routing: RoutingConfig,                  // 路由 Binding 规则
}
```

#### 12.3 环境变量解析优先级

```
Process env → .env → ~/.openclaw/.env → config env block
```

Secret 引用：`$ref("MYVAR")` 在运行时从环境变量解析。

#### 12.4 关键路径

| 路径                                       | 说明                                         |
| ------------------------------------------ | -------------------------------------------- |
| `~/.openclaw/`                             | 状态目录（可通过 `OPENCLAW_STATE_DIR` 配置） |
| `~/.openclaw/openclaw.json`                | 主配置文件                                   |
| `~/.openclaw/sessions/`                    | 会话存储                                     |
| `~/.openclaw/pairing/`                     | 设备配对数据                                 |
| `~/.openclaw/credentials/`                 | 凭证存储                                     |
| `~/.openclaw/agents/<id>/sessions/*.jsonl` | Agent 会话日志                               |

---

### 13. 部署架构

#### 13.1 部署模式

```
┌──────────────────┐   ┌──────────────────┐   ┌──────────────────┐
│   macOS 本地     │   │   Docker 部署     │   │   Fly.io 云      │
│   菜单栏应用     │   │   docker-compose  │   │   持久卷         │
│   端口 18789     │   │   端口 18789      │   │   端口 3000      │
└────────┬─────────┘   └────────┬─────────┘   └────────┬─────────┘
         │                      │                      │
         └──────────────────────┼──────────────────────┘
                                │
                    Gateway Server 实例
                                │
         ┌──────────┬───────────┼───────────┬──────────┐
         │          │           │           │          │
    消息平台    移动 App     Web UI      CLI      ACP/IDE
```

#### 13.2 Docker 部署

**Dockerfile**：

- 基础镜像：`node:22-bookworm`
- 多阶段构建，扩展依赖单独提取
- 构建参数：
  - `OPENCLAW_EXTENSIONS` — 包含的扩展列表
  - `OPENCLAW_INSTALL_BROWSER` — 安装 Chromium + Xvfb
  - `OPENCLAW_INSTALL_DOCKER_CLI` — 添加 Docker CLI（沙箱支持）
- 非 root `node` 用户运行

**Docker Compose**：

- `openclaw-gateway` 服务：端口 18789 + 18790
- 挂载 `~/.openclaw` 状态目录
- 健康检查：`GET /healthz`

#### 13.3 Fly.io 云部署

- 进程：`node dist/index.js gateway --allow-unconfigured --port 3000 --bind lan`
- VM：2x 共享 CPU，2GB RAM
- 持久卷：`/data`
- 强制 HTTPS，禁用自动停机（持久连接）

#### 13.4 进程管理

| 平台    | 方式           |
| ------- | -------------- |
| macOS   | launchd plist  |
| Linux   | systemd unit   |
| Windows | Task Scheduler |

---

### 14. 安全架构

#### 14.1 认证模式

| 模式            | 说明                                   |
| --------------- | -------------------------------------- |
| `none`          | 无认证（仅限受信任/本地环境）          |
| `token`         | Bearer Token（存储在配置或启动时生成） |
| `password`      | HTTP Basic Auth                        |
| `trusted-proxy` | 信任代理头进行身份转发                 |
| `tailscale`     | Tailscale 设备认证                     |

#### 14.2 设备认证

- TLS 证书指纹（SHA256）
- 设备 payload 私钥签名
- 设备 Token 存储用于会话恢复
- 设备配对流程（公钥交换 → 审批 → Token 颁发）

#### 14.3 RBAC

- 基于 Scope 的细粒度权限
- `operator` 和 `node` 角色分离
- 方法级别的角色检查
- 控制平面写操作预算（速率限制破坏性操作）

#### 14.4 其他安全措施

- 认证尝试速率限制（防暴力破解）
- 常数时间密钥比较
- CSP / X-Frame-Options 安全头
- WebSocket 帧大小限制
- Exec Approval Manager（命令执行白名单）

---

### 15. 网络与发现

#### 15.1 mDNS / Bonjour

- 服务类型：`_openclaw-gw._tcp`
- TXT 记录：Gateway 版本、认证要求、TLS
- 跨平台：`bonjour-ciao` 库

#### 15.2 Tailscale 集成

- 通过 Tailscale 网络暴露 Gateway
- 自动 NAT 穿透 + DERP 中继回退
- 广域发现域名支持
- Unicast DNS-SD 用于 tailnet 范围发现

#### 15.3 APNs 推送（仅 iOS）

- 发送推送通知唤醒后台 App
- 开发/生产环境自动切换
- 最小 JSON payload 触发后台任务

---

### 16. 项目源码结构

```
openclaw/
├── apps/
│   ├── macos/                     # macOS Swift 应用（Gateway 宿主）
│   ├── ios/                       # iOS Swift 应用（Node）
│   ├── android/                   # Android Kotlin 应用（Node）
│   └── shared/OpenClawKit/        # 共享 Swift Kit
│
├── src/
│   ├── entry.ts                   # CLI 入口
│   ├── index.ts                   # 库入口（导出公共 API）
│   ├── runtime.ts                 # 运行时 IO 抽象
│   │
│   ├── cli/                       # CLI 命令注册 + 工具函数
│   │   ├── program.ts             # Commander.js 程序构建
│   │   ├── run-main.ts            # runCli() 主入口
│   │   ├── deps.ts                # 依赖注入 createDefaultDeps
│   │   └── ...                    # 各子命令 CLI 定义
│   │
│   ├── commands/                  # 命令实现
│   │
│   ├── gateway/                   # 网关核心（230+ 文件）
│   │   ├── server.impl.ts         # 网关启动主函数
│   │   ├── server-http.ts         # HTTP 端点路由
│   │   ├── server-channels.ts     # Channel 管理器
│   │   ├── server-methods.ts      # 50+ RPC 方法注册
│   │   ├── server-chat.ts         # 聊天状态管理
│   │   ├── server-broadcast.ts    # 事件广播
│   │   ├── client.ts              # Node 客户端（连接 Gateway）
│   │   ├── auth.ts                # 认证验证
│   │   ├── control-ui.ts          # 浏览器管理界面
│   │   ├── node-registry.ts       # 远程 Node 追踪
│   │   ├── openai-http.ts         # OpenAI 兼容 API
│   │   ├── protocol/              # 消息协议定义
│   │   └── server-methods/        # 各方法处理器（40+ 文件）
│   │
│   ├── agents/                    # Agent 执行引擎
│   │   ├── pi-embedded.ts         # 嵌入式 Agent 运行器
│   │   ├── pi-embedded-runner/    # 运行循环 + 模型解析 + 尝试执行
│   │   ├── pi-tools.ts            # 内置工具系统
│   │   ├── models-config.ts       # 模型目录加载 + 合并
│   │   ├── models-config.providers.ts  # Provider 发现 + 配置
│   │   ├── model-auth.ts          # API 密钥 + 认证头解析
│   │   ├── model-compat.ts        # 跨 Provider 兼容层
│   │   ├── tool-policy.ts         # 工具策略系统
│   │   ├── auth-profiles/         # 认证凭证管理 + 冷却追踪
│   │   └── failover-error.ts      # 错误分类 + 回退触发
│   │
│   ├── channels/                  # Channel 抽象层
│   │   ├── dock.ts                # Channel 能力元数据
│   │   ├── plugins/types.ts       # ChannelPlugin 接口定义
│   │   ├── registry.ts            # Channel 注册 + 排序
│   │   └── thread-bindings-policy.ts  # 线程绑定策略
│   │
│   ├── routing/                   # 消息路由
│   │   ├── resolve-route.ts       # 路由解析（Binding 匹配）
│   │   ├── session-key.ts         # Session Key 构建
│   │   └── bindings.ts            # Binding 辅助函数
│   │
│   ├── telegram/                  # Telegram Channel 实现
│   ├── discord/                   # Discord Channel 实现
│   ├── slack/                     # Slack Channel 实现
│   ├── signal/                    # Signal Channel 实现
│   ├── imessage/                  # iMessage Channel 实现
│   ├── web/                       # WhatsApp Web 实现
│   ├── whatsapp/                  # WhatsApp 共享逻辑
│   ├── line/                      # LINE Channel 实现
│   │
│   ├── acp/                       # Agent Client Protocol 桥接
│   ├── auto-reply/                # 自动回复 + 心跳
│   ├── canvas-host/               # 嵌入式 A2UI Web 服务器
│   ├── config/                    # 配置 Schema + 路径
│   ├── context-engine/            # 可插拔上下文管理
│   ├── cron/                      # 定时任务
│   ├── daemon/                    # launchd/systemd 管理
│   ├── hooks/                     # 事件 Hook 系统
│   ├── infra/                     # 基础设施工具（250+ 文件）
│   ├── media/                     # 媒体处理管道
│   ├── media-understanding/       # 多模态理解（图像/音频/视频）
│   ├── memory/                    # 向量记忆系统
│   ├── node-host/                 # Node 配置管理
│   ├── pairing/                   # 设备配对
│   ├── plugins/                   # 插件系统
│   ├── plugin-sdk/                # 插件 SDK
│   ├── process/                   # 命令队列 + 执行
│   ├── providers/                 # Provider 特定逻辑
│   ├── secrets/                   # Secret 解析 + 存储
│   ├── sessions/                  # 会话持久化 + 元数据
│   ├── terminal/                  # CLI UI 组件
│   ├── tts/                       # 文本转语音
│   ├── utils/                     # 共享工具
│   └── wizard/                    # 引导向导
│
├── extensions/                    # 插件包（40+ 扩展）
├── packages/                      # 内部共享包
├── docs/                          # 用户文档（Mintlify）
├── scripts/                       # 构建/发布/工具脚本
├── ui/                            # Web UI 资源
├── vendor/                        # 第三方供应商代码
│
├── Dockerfile                     # Docker 构建
├── docker-compose.yml             # Docker Compose 服务栈
├── fly.toml                       # Fly.io 部署配置
├── package.json                   # 根 monorepo 包
├── pnpm-workspace.yaml            # PNPM 工作区配置
├── tsconfig.json                  # TypeScript 配置
├── tsdown.config.ts               # 打包配置
└── vitest.config.ts               # 测试配置
```

---

### 17. 总结

OpenClaw 的架构核心是 **Gateway 网关**，它作为中央枢纽连接三个维度：

1. **上游（用户侧）**：10+ 消息平台通过 Channel Plugin 接入用户消息，每个平台实现统一的 `ChannelPlugin` 接口，通过 Routing Binding 系统灵活映射到不同的 AI Agent
2. **下游（AI 侧）**：20+ LLM Provider 通过统一的 Model Catalog 提供 AI 能力，支持 Failover、Auth Profile 轮换、Context Window 自动管理
3. **横向（操作侧）**：原生 App（macOS/iOS/Android）、CLI、Web UI、IDE（ACP）作为操作界面和计算节点，通过 WebSocket 协议与 Gateway 实时通信

**关键设计原则**：

- **模块化插件架构**：Channel、Provider、Tool 均可插拔替换
- **中心化事件总线**：所有消息流经 Gateway，统一管理状态和广播
- **灵活部署**：单机（macOS 菜单栏）到云端（Docker/Fly.io）均支持
- **安全纵深**：认证、RBAC、设备配对、命令审批、速率限制层层防护
- **韧性优先**：模型回退、Auth 轮换、Channel 自动重启、上下文自动压缩

---

## 三、Agent 执行引擎详解

### 1. Agent 调用链全景

从用户发送消息到 Agent 产生回复的完整函数调用链：

```
用户消息 (Gateway WebSocket / CLI / ACP)
  ↓
agentCommandInternal()                    [src/commands/agent.ts]
  ↓
runAgentAttempt()                         [src/commands/agent.ts]
  ↓
runEmbeddedPiAgent()  ← 主重试循环        [src/agents/pi-embedded-runner/run.ts]
  ↓
  RETRY LOOP (最多 24 + 8*profileCount 次):
    ↓
    runEmbeddedAttempt()  ← 单次尝试      [src/agents/pi-embedded-runner/run/attempt.ts]
      ↓
      1. 工作区设置 + 沙箱上下文
      2. Bootstrap 上下文注入（工作区文件）
      3. Session Manager 创建（加载/修复会话）
      4. 系统提示构建（buildEmbeddedSystemPrompt）
      5. Context Engine 组装消息（assemble）
      6. 流式 API 调用（streamSimple）
      7. 工具调用循环（Tool Execution Loop）
      8. 压缩处理（如上下文溢出）
      9. 会话持久化 + Token 统计
```

### 2. Agent 配置解析流程

#### 2.1 模型解析（Model Resolution）

```
1. 加载模型目录: ensureOpenClawModelsJson()
   ├── 内置目录: Anthropic / OpenAI / Google / Bedrock 等
   └── 用户配置: ~/.openclaw/openclaw.json → models.providers.*
   ↓
2. 运行 Hook: before_model_resolve() → 允许插件覆盖 provider/model
   ↓
3. 解析模型对象: resolveModel()
   ├── 从目录中查找匹配的 ModelDefinition
   ├── 验证上下文窗口（硬性最小值 + 警告阈值）
   └── 应用兼容性配置（ModelCompatConfig）
   ↓
4. 创建/验证认证存储: ensureAuthProfileStore()
   ↓
5. 构建认证候选列表:
   ├── 按偏好排序
   ├── 过滤冷却中的 Profile
   └── 锁定用户选择（如果指定）
```

**配置优先级**（低 → 高）：

| 层级            | 来源                          | 示例                                        |
| --------------- | ----------------------------- | ------------------------------------------- |
| 1. 默认值       | `src/agents/defaults.ts`      | provider=anthropic, model=claude-3-5-sonnet |
| 2. 配置文件     | `~/.openclaw/openclaw.json`   | `agents.defaults.model`                     |
| 3. 会话覆盖     | `~/.openclaw/sessions/*.json` | `modelOverride`                             |
| 4. CLI/命令覆盖 | `--model`, `--provider`       | `--model gpt-4o`                            |
| 5. Plugin Hook  | `before_model_resolve`        | 动态覆盖                                    |

#### 2.2 认证解析（Auth Resolution）

```typescript
resolveApiKeyForModel() →
  1. 检查自定义 Provider 配置 (models.providers.*.apiKey)
  2. 检查环境变量 (OPENCLAW_PROVIDER_API_KEY 等)
  3. 查找 Auth Profile (~/.openclaw/auth-profiles.json)
  4. 验证认证模式 (api-key / aws-sdk / oauth / token)
  5. 设置运行时 API Key
```

**支持的认证模式**：

- **API Key**：直接 Bearer Token 或自定义 Header
- **AWS SDK**：环境变量凭证链（用于 Bedrock）
- **OAuth**：Token 刷新 + 过期追踪
- **Device Code**：浏览器授权流程
- **自定义**：Plugin 定义的认证（如 GitHub Copilot Token 交换）

### 3. 工具创建与策略

**工具注册**（`src/agents/pi-tools.ts`）：

```
createOpenClawCodingTools() 创建:
  ├── read / write / edit    → 文件操作（工作区边界守卫）
  ├── exec / bash            → 命令执行（安全策略）
  ├── apply_patch            → 补丁应用（OpenAI 专用，工作区限制）
  ├── process                → 进程管理（发送按键、轮询、后台）
  ├── Channel 工具           → Slack / Discord / Telegram 特定操作
  └── OpenClaw 工具          → message / web_search / memory_search 等
```

**策略层叠**（从上到下依次应用）：

```
1. 消息来源策略    → 如: 语音通道禁用 TTS
2. 模型提供商策略  → 如: xAI/Grok 使用原生 web_search
3. 工具所有权策略  → Owner-only 工具限制
4. Profile 策略    → 每用户 allowlist
5. Provider 策略   → provider.tools.allow
6. Agent 策略      → agent.tools.allow / deny
7. 群组/通道策略   → group.tools.allow
8. 沙箱策略        → 限制文件系统访问
9. 子 Agent 策略   → 深度限制的工具子集
```

最终处理：

- 按 Provider 特性标准化 Tool JSON Schema（Gemini vs Anthropic 差异）
- 包装 `beforeToolCall` Hook
- 包装 abort signal 支持

### 4. 主重试循环

**位置**：`src/agents/pi-embedded-runner/run.ts`

```
MAX_ITERATIONS = 24 + (8 × profileCount)  // 约 32-160 次

WHILE iterations < MAX_ITERATIONS:

  ┌─ Profile 轮换检查 ─────────────────────────────┐
  │  IF 当前 profile 因 auth/cooldown 失败:          │
  │    advanceAuthProfile() → 切换到下一候选         │
  │    标记当前 profile 进入冷却期                   │
  │    重新开始循环                                  │
  └────────────────────────────────────────────────┘

  ┌─ 思考级别递进 ──────────────────────────────────┐
  │  IF 模型支持 reasoning 且上次思考失败:            │
  │    尝试降级: xhigh → high → medium → low → off  │
  │    Profile 切换时重置已尝试的思考级别             │
  └────────────────────────────────────────────────┘

  ┌─ 执行尝试 ─────────────────────────────────────┐
  │  attempt = runEmbeddedAttempt(...)               │
  │                                                  │
  │  IF 成功:                                        │
  │    累积 Token 使用量 → 返回结果 → 退出循环       │
  │                                                  │
  │  IF 失败 → 分类错误:                             │
  │    ├─ auth        → Profile 轮换                 │
  │    ├─ rate_limit  → 等待 + 退避 + Profile 轮换   │
  │    ├─ overloaded  → 指数退避 + 轮换              │
  │    ├─ timeout     → 同 Profile 重试              │
  │    ├─ context_overflow → 尝试压缩（最多3次）     │
  │    ├─ model_not_found  → 直接报错（不重试）      │
  │    └─ other       → 同 Profile 重试              │
  └────────────────────────────────────────────────┘
```

### 5. 单次尝试执行

**位置**：`src/agents/pi-embedded-runner/run/attempt.ts`

```
runEmbeddedAttempt(params):

  1. 工作区设置
     ├── 确保工作区目录存在
     ├── 解析沙箱上下文（如启用）
     └── 切换 cwd 到工作区

  2. Bootstrap 上下文注入
     ├── resolveBootstrapContextForRun() → 获取工作区文件
     ├── analyzeBootstrapBudget() → 检查文件大小限制
     └── buildBootstrapPromptWarning() → 注入截断通知

  3. Session Manager 创建
     ├── createAgentSession() ← from pi-coding-agent
     ├── 加载已有会话文件
     ├── 修复（validateGeminiTurns 等）
     └── 获取会话写锁

  4. 系统提示构建 (buildEmbeddedSystemPrompt)
     ├── OpenClaw 前导说明
     ├── Channel 能力提示
     ├── TTS 提示（如适用）
     ├── 推理指令（如启用 reasoning）
     ├── Bootstrap 注入（工作区文件内容）
     ├── Skills 提示（运行时 Skills 快照）
     ├── 额外系统提示（用户覆盖）
     └── Context Engine 系统提示补充

  5. 消息组装
     ├── 运行 Hook: before_prompt_build → 插件可修改
     ├── Context Engine assemble() → 按 Token 预算组装历史消息
     └── 限制 DM 历史（getDmHistoryLimitFromSessionKey）

  6. 流式 API 调用
     ├── 选择流后端:
     │   ├── Ollama  → createOllamaStreamFn()
     │   ├── OpenAI WS → createOpenAIWebSocketStreamFn()
     │   └── 原生    → streamSimple() from pi-ai
     ├── 应用额外参数（cache control, thinking 等）
     └── 调用 streamSimple(model, messages, tools, callbacks)

  7. 流式事件处理
     ├── "text_delta"     → onPartialReply()    → 实时发送给用户
     ├── "thinking_delta" → onReasoningStream() → 推理 Token 流
     ├── "tool_calls"     → 写入会话
     ├── "tool_results"   → onToolResult()      → 工具结果通知
     └── "done"           → 完成

  8. 工具执行循环（在流式过程中）
     WHILE 流中有待执行的工具调用:
       a. 注册会话订阅（setupSessionSubscriber）
       b. 逐个执行工具:
          ├── 包装 beforeToolCall Hook
          ├── 调用工具函数
          ├── 清理结果（图像大小、格式化）
          └── 通过 onToolResult() 发送
       c. 将工具结果写回会话
       d. 继续流式输出（模型继续生成）

  9. 完成
     ├── 写入最终助手消息
     ├── 保存会话文件
     ├── 释放会话写锁
     ├── 累积 Token 使用量
     └── 返回 EmbeddedRunAttemptResult
```

### 6. 流式回调架构

```typescript
// Agent 运行时提供的流式回调
runEmbeddedPiAgent({
  onPartialReply:     (payload) → 文本增量，实时发送到 ACP/Web/App
  onToolResult:       (payload) → 工具执行结果
  onBlockReply:       (payload) → 块结构化回复（Discord 等）
  onReasoningStream:  (payload) → 推理 Token 流（o1 等模型）
  onAgentEvent:       (evt)     → 原始 Agent 事件
  onAssistantMessageStart: ()   → 助手消息开始
  onReasoningEnd:     ()        → 推理结束
})
```

这些回调在 Agent 流式输出过程中**实时调用**，不是完成后批量调用。

### 7. Gateway 到 Agent 的调度

```
Gateway WebSocket 收到消息
  ↓
server-chat.ts: processMessage()
  ↓
ChatRunRegistry: 注册活跃运行（per session）
  ↓
agent.ts: agentCommandInternal()
  ↓
resolveSession() → 加载/创建会话
  ↓
resolveAgentRunContext() → 构建执行上下文
  ↓
runAgentAttempt() → 带流式回调执行
  ↓
流式回调 → 发回 WebSocket 客户端:
  ├── onPartialReply  → text_delta 事件
  ├── onToolResult    → tool_output 事件
  ├── onBlockReply    → structured_reply 事件
  └── onReasoningStream → reasoning 事件
  ↓
ChatRunState: 缓冲文本组装 + delta 节流
  ↓
ToolEventRecipientRegistry: 追踪接收工具事件的 WS 客户端
```

### 8. Token 使用量追踪

```typescript
UsageAccumulator:
  - 跨一次运行的所有 API 调用累积
  - 追踪: input, output, cacheRead, cacheWrite, total

为什么分离 lastCallUsage?
  - 每次工具调用往返报告 cacheRead ≈ 当前上下文大小
  - 累加 N 次调用 = N × 上下文大小（虚高）
  - 解决方案: cache 字段使用最后一次调用的值，
              output 字段累加所有生成文本

上下文大小计算:
  lastInput + lastCacheRead + lastCacheWrite + 累积 output
  → 限制在 contextWindow 最大值内
```

### 9. 返回值结构

```typescript
EmbeddedPiRunResult {
  payloads?: Array<{
    text?: string           // 回复文本
    mediaUrl?: string       // 单个媒体 URL
    mediaUrls?: string[]    // 多个媒体 URL
    replyToId?: string      // 回复目标消息 ID
    isError?: boolean       // 是否错误消息
  }>
  meta: {
    durationMs: number      // 执行耗时
    agentMeta?: {
      sessionId, provider, model,
      usage?: { input, output, cacheRead, cacheWrite, total }
    }
    aborted?: boolean
    error?: {
      kind: "context_overflow" | "compaction_failure" | "retry_limit" | ...
      message: string
    }
    stopReason?: string     // "completed" | "tool_calls" | ...
    pendingToolCalls?: Array<{ id, name, arguments }>
  }
  didSendViaMessagingTool?: boolean     // 是否通过消息工具已发送
  messagingToolSentTexts?: string[]     // 已发送的文本
  successfulCronAdds?: number           // 成功添加的定时任务数
}
```

---

## 四、Skills 系统详解

### 1. Skills 概述

Skills 是定义在 **SKILL.md** 文件中的可复用能力单元，本质上是带有 YAML frontmatter 的 Markdown 文档，描述了 Agent 可以使用的特定能力。与 Tools（代码级别的函数调用）不同，Skills 是提示级别的能力注入。

### 2. Skill 数据结构

```typescript
type SkillEntry = {
  skill: Skill; // from @mariozechner/pi-coding-agent
  frontmatter: ParsedSkillFrontmatter; // YAML frontmatter
  metadata?: OpenClawSkillMetadata; // OpenClaw 特定元数据
  invocation?: SkillInvocationPolicy; // 调用策略
};

type OpenClawSkillMetadata = {
  always?: boolean; // 无条件可用
  skillKey?: string; // 唯一标识符
  primaryEnv?: string; // 主要环境变量（如 API Key）
  emoji?: string; // 视觉标识
  homepage?: string; // 主页 URL
  os?: string[]; // 支持的操作系统 (如 ["darwin"])
  requires?: {
    bins?: string[]; // 必需的二进制文件
    anyBins?: string[]; // 任一可用即可
    env?: string[]; // 必需的环境变量
    config?: string[]; // 必需的配置路径
  };
  install?: SkillInstallSpec[]; // 安装方式
};

type SkillInvocationPolicy = {
  userInvocable: boolean; // 用户可通过 /skillname 调用
  disableModelInvocation: boolean; // 禁止模型/AI 使用此 Skill
};
```

### 3. Skill 加载层级（优先级从高到低）

```
1. 额外 Skills     → config.skills.load.extraDirs（配置指定路径）
2. 内置 Skills     → openclaw-bundled（随安装包分发）
3. 托管 Skills     → ~/.openclaw/skills（手动安装的）
4. 个人 Agent Skills → ~/.agents/skills
5. 项目 Agent Skills → .agents/skills（项目级）
6. 工作区 Skills   → workspace/skills（工作区级）
7. Plugin Skills   → 从已启用插件动态加载
```

**加载限制**：

- 每个根目录最多扫描 300 个候选
- 每个来源最多加载 200 个 Skill
- 单个 SKILL.md 文件最大 256KB

### 4. Skill 资格评估

Skill 可用需满足全部条件：

- 未被显式禁用（`skills.entries[key].enabled != false`）
- 未被 allowlist 阻止
- 操作系统要求满足（如 `os: ["darwin"]`）
- 所有必需二进制可用（`requires.bins`）
- 所有必需环境变量存在（`requires.env`）
- 所有必需配置路径存在（`requires.config`）

### 5. Skill → 系统提示注入

```
加载合格的 SkillEntry 列表
  ↓
过滤: 排除 disable-model-invocation: true 的 Skill
  ↓
应用提示限制:
  ├── maxSkillsInPrompt: 150（数量限制）
  └── maxSkillsPromptChars: 30,000（字符限制）
  ↓
二分搜索: 找到最大前缀（适配字符预算）
  ↓
formatSkillsForPrompt() → 格式化为提示文本
  ↓
追加远程 Node 说明（如有）
  ↓
追加截断警告（如有被截断的 Skill）
  ↓
注入系统提示的 Skills 区块
```

路径压缩优化：将 Home 目录前缀替换为 `~` 以减少 Token 消耗。

### 6. Skill 命令系统

用户可以通过 `/skillname args` 或 `/skill skillname args` 调用 Skill：

```
用户输入: /github create issue "bug title"
  ↓
检测 /skillname 模式
  ↓
匹配 Skill 命令（按 name 或 skillName）
  ↓
传递参数（raw mode）
  ↓
如配置了 command-dispatch: tool → 路由到特定工具
否则 → 作为 Agent 提示注入
```

**命令生成规则**：

- 名称小写，无特殊字符，最长 32 字符
- 自动去重
- 描述截断到 100 字符

### 7. Skill 环境变量覆盖

每个 Skill 可配置独立的环境变量：

```typescript
// ~/.openclaw/openclaw.json
{
  "skills": {
    "entries": {
      "github": {
        "enabled": true,
        "apiKey": "$ref(GITHUB_TOKEN)",   // Secret 引用
        "env": {
          "GITHUB_ORG": "myorg"           // 自定义环境变量
        }
      }
    }
  }
}
```

应用流程：

1. 加载所有运行中 Skill 的配置
2. 引用计数获取环境变量 Key
3. 过滤危险 Key（PATH、HOME、OPENSSL_CONF 等）
4. 注入 `process.env`
5. 创建 reverter 函数用于清理

### 8. Skill 安装系统

**5 种安装方式**：

| 方式       | 说明                 | 示例                               |
| ---------- | -------------------- | ---------------------------------- |
| `brew`     | Homebrew 包          | `brew install gh`                  |
| `node`     | npm/pnpm/yarn/bun 包 | `npm install -g @octokit/cli`      |
| `go`       | Go 模块              | `go install github.com/...@latest` |
| `uv`       | Python uv 工具       | `uv tool install ruff`             |
| `download` | HTTP(S) 直接下载     | URL + 可选解压                     |

**安装前安全扫描**（`src/security/skill-scanner.ts`）：

关键规则（critical）：

- `dangerous-exec`: child_process exec/spawn
- `dynamic-code-execution`: eval, new Function
- `crypto-mining`: 挖矿相关引用
- `suspicious-network`: 非标准 WebSocket 端口

警告规则（warn）：

- `potential-exfiltration`: 文件读取 + 网络发送
- `obfuscated-code`: 十六进制字符串、base64 payload
- `env-harvesting`: process.env + 网络发送

### 9. 远程 Skill 执行

通过远程 Node 支持 macOS 专属 Skill：

```
远程 macOS Node 连接到 Gateway
  ↓
探测 Node 可用二进制（system.which / system.run）
  ↓
启用 os: ["darwin"] 的 Skill
  ↓
Agent 调用 Skill → Gateway 路由到远程 Node
  ↓
Node 执行 → 结果返回 Gateway → 返回 Agent
```

### 10. Skill 快照与版本管理

```typescript
type SkillSnapshot = {
  prompt: string; // 格式化后的 Skills 提示文本
  skills: Array<{
    name: string;
    primaryEnv?: string;
    requiredEnv?: string[];
  }>;
  skillFilter?: string[]; // 应用的 Agent 过滤器
  resolvedSkills?: Skill[]; // 实际 Skill 对象
  version?: number; // 快照缓存版本
};
```

**刷新触发条件**：

- Skill 过滤器变更
- 版本号变更
- 文件系统变更事件（SKILL.md 修改）
- 远程 Node 二进制更新

### 11. Skills vs Tools 对比

| 维度         | Skills                         | Tools                      |
| ------------ | ------------------------------ | -------------------------- |
| **定义方式** | SKILL.md（Markdown + YAML）    | TypeScript/JavaScript 函数 |
| **存储位置** | 多层级目录（工作区/用户/内置） | 编译到 Agent 或插件中      |
| **注入方式** | 系统提示中的文本描述           | API Schema（JSON Schema）  |
| **调用方式** | `/skillname` 命令 或 模型推理  | 模型 tool_call             |
| **配置**     | 每 Skill API Key + 环境变量    | 全局 Channel/Provider 配置 |
| **安装**     | brew/npm/go/uv/download        | 随代码编译                 |
| **安全**     | 安装前代码扫描                 | 策略层叠控制               |
| **作用域**   | Agent 范围，工作区特定         | Channel 范围               |

---

## 五、Plugin 系统详解

### 1. Plugin 架构概述

Plugin 是 OpenClaw 最核心的扩展机制，允许第三方代码扩展几乎所有系统能力：工具、Hook、Channel、Provider、CLI 命令、HTTP 路由、后台服务等。

### 2. Plugin 生命周期

```
发现 (Discovery)
  ↓
  搜索多个位置:
  ├── 内置插件（核心仓库中）
  ├── 全局插件（~/.openclaw/extensions/）
  ├── 工作区插件
  └── 额外加载路径（plugins.load.paths）
  ↓
  安全检查:
  ├── 路径逃逸验证（防止 symlink/hardlink 攻击）
  ├── 世界可写检查
  └── 所有权验证（非内置插件必须匹配用户 UID）
  ↓
加载 (Loading)
  ↓
  读取 openclaw.plugin.json 清单文件
  ↓
  启用状态解析:
  ├── 全局 plugins.enabled 标志
  ├── 每插件 plugins.entries[id].enabled
  ├── Allowlist (plugins.allow)
  ├── Denylist (plugins.deny)
  └── Memory Slot 排他性（同时只能一个 memory 插件）
  ↓
  模块加载（Jiti 动态加载 TypeScript/JavaScript）
  ↓
注册 (Registration)
  ↓
  插件调用 api.registerXxx() 方法注册所有扩展
  ↓
  记录到 PluginRegistry:
  ├── tools, hooks, channels, providers
  ├── gatewayHandlers, httpRoutes
  ├── cliRegistrars, services, commands
  └── diagnostics
  ↓
运行 (Runtime)
  ↓
  Gateway 启动: gateway_start Hook
  工具按需创建: ToolFactory 在 Agent 运行时调用
  服务启动: service.start() 在 Gateway 启动后调用
  ↓
清理 (Dispose)
  ↓
  Gateway 关闭: gateway_stop Hook
  服务停止: service.stop()
```

### 3. Plugin 清单文件

```json
// openclaw.plugin.json
{
  "id": "my-plugin",
  "name": "My Plugin",
  "version": "1.0.0",
  "description": "A custom plugin",
  "kind": "memory", // 可选: "memory" | "context-engine" | undefined
  "configSchema": {
    // JSON Schema 验证配置
    "type": "object",
    "properties": {
      "apiKey": { "type": "string" },
      "enabled": { "type": "boolean" }
    }
  },
  "channels": ["my-channel"], // 注册的 Channel ID
  "providers": ["my-provider"], // 注册的 Provider ID
  "skills": ["my-skill"], // 注册的 Skill 名称
  "uiHints": {
    // 配置字段的 UI 提示
    "apiKey": {
      "label": "API Key",
      "help": "Your API key",
      "sensitive": true
    }
  }
}
```

### 4. Plugin API 完整参考

```typescript
// 插件注册函数签名
export default function register(api: OpenClawPluginApi): void;

// api 对象提供的注册方法:

// === 工具注册 ===
api.registerTool(
  tool: AnyAgentTool | OpenClawPluginToolFactory,
  opts?: { name?: string; names?: string[]; optional?: boolean }
)
// ToolFactory 接收上下文:
type OpenClawPluginToolContext = {
  config: OpenClawConfig;
  workspaceDir: string;
  agentDir: string;
  agentId: string;
  sessionKey: string;
  sessionId: string;
  messageChannel: string;       // "telegram" | "discord" | ...
  agentAccountId?: string;
  requesterSenderId?: string;
  senderIsOwner: boolean;
  sandboxed: boolean;
};

// === Hook 注册 ===
api.registerHook(events, handler, opts?)
api.on(hookName, handler, { priority?: number })  // 现代 API

// === HTTP 路由 ===
api.registerHttpRoute({
  path: string,                 // URL 路径
  handler: (req, res) => boolean | void,
  auth: "gateway" | "plugin",  // 认证模式
  match?: "exact" | "prefix",
  replaceExisting?: boolean
})

// === Channel 注册 ===
api.registerChannel(channelPlugin: ChannelPlugin)

// === Gateway 方法 ===
api.registerGatewayMethod(method: string, handler: GatewayRequestHandler)

// === CLI 命令 ===
api.registerCli(
  registrar: (ctx: { program, config }) => void,
  opts?: { commands?: string[] }
)

// === 后台服务 ===
api.registerService({
  id: string,
  start: (ctx) => void | Promise<void>,
  stop?: (ctx) => void | Promise<void>
})

// === 命令（绕过 LLM）===
api.registerCommand({
  name: string,
  description: string,
  acceptsArgs?: boolean,
  requireAuth?: boolean,
  handler: (ctx) => PluginCommandResult
})

// === Provider（认证）===
api.registerProvider(provider: ProviderPlugin)

// === Context Engine ===
api.registerContextEngine(id: string, factory: ContextEngineFactory)
```

### 5. Plugin Hook 系统（23 个命名 Hook）

#### Agent 生命周期 Hook

| Hook                   | 执行模式   | 说明                       |
| ---------------------- | ---------- | -------------------------- |
| `before_model_resolve` | 顺序，首胜 | 覆盖 model/provider        |
| `before_prompt_build`  | 顺序，拼接 | 注入系统提示/上下文        |
| `before_agent_start`   | 顺序，合并 | 旧版综合 Hook              |
| `llm_input`            | 并行       | 观察发送给 LLM 的 payload  |
| `llm_output`           | 并行       | 观察 LLM 输出 + Token 使用 |
| `agent_end`            | 并行       | 运行后分析                 |

#### 消息 Hook

| Hook               | 执行模式   | 说明              |
| ------------------ | ---------- | ----------------- |
| `message_received` | 并行       | 入站消息观察      |
| `message_sending`  | 顺序，合并 | 修改/取消出站消息 |
| `message_sent`     | 并行       | 出站投递确认      |

#### 工具 Hook

| Hook                   | 执行模式     | 说明                 |
| ---------------------- | ------------ | -------------------- |
| `before_tool_call`     | 顺序 (async) | 修改/阻止工具调用    |
| `after_tool_call`      | 并行 (async) | 后调用分析           |
| `tool_result_persist`  | **同步**     | 修改持久化的工具结果 |
| `before_message_write` | **同步**     | 阻止/修改 JSONL 写入 |

#### 会话 Hook

| Hook                       | 执行模式 | 说明                  |
| -------------------------- | -------- | --------------------- |
| `session_start`            | 并行     | 新会话创建            |
| `session_end`              | 并行     | 会话结束              |
| `subagent_spawning`        | 顺序     | 子 Agent 生成前       |
| `subagent_spawned`         | 并行     | 子 Agent 已启动       |
| `subagent_ended`           | 并行     | 子 Agent 终止         |
| `subagent_delivery_target` | 顺序     | 确定子 Agent 输出路由 |

#### 压缩 Hook

| Hook                | 执行模式 | 说明                  |
| ------------------- | -------- | --------------------- |
| `before_compaction` | 并行     | 消息压缩前            |
| `after_compaction`  | 并行     | 消息压缩后            |
| `before_reset`      | 并行     | /new 或 /reset 清理前 |

#### Gateway Hook

| Hook            | 执行模式 | 说明               |
| --------------- | -------- | ------------------ |
| `gateway_start` | 并行     | Gateway 初始化完成 |
| `gateway_stop`  | 并行     | Gateway 关闭中     |

**Hook 执行规则**：

- 并行 Hook：`Promise.all`，所有错误被捕获
- 顺序 Hook：按优先级排序，结果合并/覆盖
- 同步 Hook：用于热路径，无 async 开销
- 提示注入保护：可通过 `plugins.entries[id].hooks.allowPromptInjection: false` 禁用

### 6. Plugin Runtime

插件通过 `api.runtime` 访问核心运行时能力：

```typescript
PluginRuntime {
  version: string,                    // OpenClaw 版本
  config: {
    resolveDir(),                     // 配置目录
    resolveConfigDir()                // 配置子目录
  },
  system: {
    isStandalone, isSandboxed,        // 运行模式
    platform, nodeVersion, arch       // 系统信息
  },
  media: {
    detectMime(),                     // MIME 类型检测
    transcodeAudio()                  // 音频转码
  },
  tts: { textToSpeechTelephony() },  // TTS
  stt: { transcribeAudioFile() },    // STT
  tools: {
    createMemorySearchTool(),         // 创建记忆搜索工具
    createMemoryGetTool(),            // 创建记忆获取工具
    registerMemoryCli()               // 注册 memory CLI
  },
  channel: {
    getAccountId(),                   // 获取通道账户 ID
    resolveOutboundTarget()           // 解析出站目标
  },
  events: {
    onChannelMessage(),               // 通道消息事件
    onChannelStatusChange()           // 通道状态变更
  },
  state: { resolveStateDir() },       // 插件状态目录
  subagent: {
    run(params): Promise<{ runId }>,  // 启动子 Agent
    waitForRun(params): Promise<result>,
    getSessionMessages(params),
    deleteSession(params)
  }
}
```

### 7. Plugin 配置

```typescript
// ~/.openclaw/openclaw.json 中的 plugins 配置节
{
  "plugins": {
    "enabled": true,                 // 全局开关（默认 true）
    "allow": ["plugin-a", "plugin-b"], // 白名单
    "deny": ["plugin-c"],           // 黑名单
    "load": {
      "paths": ["/custom/plugins"]  // 额外搜索路径
    },
    "slots": {
      "memory": "memory-core"       // Memory 插件槽（只能激活一个）
                                    // 设为 "none" 禁用所有 memory 插件
    },
    "entries": {
      "my-plugin": {
        "enabled": true,
        "hooks": {
          "allowPromptInjection": false  // 禁止提示注入
        },
        "config": {                 // 插件专属配置
          "apiKey": "sk-...",
          "verbose": true
        }
      }
    },
    "installs": {                   // 安装追踪
      "my-plugin": {
        "npmSpec": "@scope/my-plugin@1.0.0",
        "installPath": "/path/to/plugin",
        "integrity": "sha256:..."
      }
    }
  }
}
```

### 8. 真实 Plugin 示例

#### Memory-Core（内置记忆插件）

```typescript
// extensions/memory-core/src/index.ts
export default function register(api: OpenClawPluginApi) {
  // 注册工具
  api.registerTool(
    (ctx) => [
      createMemorySearchTool(), // memory_search 工具
      createMemoryGetTool(), // memory_get 工具
    ],
    { names: ["memory_search", "memory_get"] },
  );

  // 注册 CLI 命令
  api.registerCli(({ program }) => {
    api.runtime.tools.registerMemoryCli(program);
  });
}
```

#### Diffs（差异可视化插件）

```typescript
// extensions/diffs/src/index.ts
export default function register(api: OpenClawPluginApi) {
  const store = new DiffArtifactStore(...);

  // 注册工具
  api.registerTool(createDiffsTool({ api, store }));

  // 注册 HTTP 路由（Web UI 展示差异）
  api.registerHttpRoute({
    path: "/plugins/diffs",
    auth: "plugin",
    handler: createDiffsHttpHandler({ store })
  });

  // 注册 Hook（在系统提示中注入 Diffs 引导）
  api.on("before_prompt_build", async () => ({
    prependSystemContext: DIFFS_AGENT_GUIDANCE
  }));
}
```

#### Lobster（UI 主题插件，沙箱感知）

```typescript
// extensions/lobster/src/index.ts
export default function register(api: OpenClawPluginApi) {
  api.registerTool(
    (ctx) => {
      if (ctx.sandboxed) return null; // 沙箱中不可用
      return createLobsterTool(api);
    },
    { optional: true }, // 可选工具，需显式 allowlist
  );
}
```

### 9. Plugin 安全模型

| 层级     | 机制               | 说明                         |
| -------- | ------------------ | ---------------------------- |
| **发现** | 路径验证           | 防止 symlink/hardlink 攻击   |
| **发现** | 所有权验证         | 非内置插件必须匹配用户 UID   |
| **发现** | 世界可写检查       | 拒绝不安全目录               |
| **加载** | Allowlist/Denylist | 白名单/黑名单控制            |
| **注册** | 命令保留           | 内置命令不可覆盖             |
| **运行** | 提示注入门控       | 可禁止不信任插件修改系统提示 |
| **运行** | 沙箱感知           | 工具可检查 `ctx.sandboxed`   |
| **运行** | Optional 工具      | 需显式 allowlist 才可用      |
| **安装** | 来源追踪           | npm spec + integrity hash    |

### 10. Gateway 中的 Plugin 集成

```
Gateway 启动
  ↓
loadPlugins() → 发现、加载、注册所有插件
  ↓
注册 Plugin Gateway 方法 → 扩展 RPC 方法列表
  ↓
注册 Plugin HTTP 路由 → 挂载到 HTTP Server
  ↓
启动 Plugin 服务 → service.start() 逐个调用
  ↓
设置 Hook Runner → 全局单例，所有 Hook 统一管理
  ↓
触发 gateway_start Hook
  ↓
... 正常运行 ...
  ↓
Gateway 关闭
  ↓
触发 gateway_stop Hook
  ↓
停止 Plugin 服务 → service.stop() 逐个调用
```

### 11. Plugin CLI 命令

```bash
# 列出所有插件
openclaw plugins list [--json] [--enabled] [--verbose]

# 查看插件详情
openclaw plugins info <plugin-id> [--json]

# 安装插件
openclaw plugins install <npm-spec-or-path> [--global|--workspace]

# 卸载插件
openclaw plugins uninstall <plugin-id> [--keep-files] [--keep-config]

# 更新插件
openclaw plugins update [--all] [--dry-run]

# 启用/禁用
openclaw plugins enable <plugin-id>
openclaw plugins disable <plugin-id>
```

### 12. Agent、Skills、Plugins 三者关系

```
┌─────────────────────────────────────────────────────────────┐
│                      Agent 执行引擎                          │
│                                                              │
│   系统提示 = 基础提示                                        │
│           + Skills 提示（SKILL.md 内容注入）                  │
│           + Plugin Hook 注入（before_prompt_build）           │
│                                                              │
│   工具列表 = 内置工具（read/write/exec/...）                 │
│           + Plugin 注册工具（api.registerTool）               │
│           + Channel 工具                                     │
│           ← 策略层叠过滤                                     │
│                                                              │
│   执行流程中 Plugin Hook 在每个关键点触发:                    │
│   before_model_resolve → before_prompt_build →               │
│   llm_input → before_tool_call → after_tool_call →           │
│   llm_output → message_sending → agent_end                   │
│                                                              │
│   Skills 提供"做什么"的描述（提示注入）                      │
│   Tools 提供"怎么做"的能力（函数调用）                       │
│   Plugins 提供"扩展一切"的机制（Hook + 注册）                │
└─────────────────────────────────────────────────────────────┘
```

简要总结：

- **Skills** = 提示级能力描述，告诉模型"你可以做 X"
- **Tools** = 代码级函数接口，让模型实际调用 `tool_call`
- **Plugins** = 系统级扩展机制，可同时注册 Skills、Tools、Hooks、Channels、Services 等所有组件
