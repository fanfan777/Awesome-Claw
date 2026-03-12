# Awesome-Claw

OpenClaw Electron 跨平台桌面管理客户端，基于 Vue 3 + Naive UI + Pinia + electron-vite 构建。

## 技术栈

- **框架**: Electron + Vue 3 + TypeScript (Composition API)
- **UI 库**: Naive UI（原生中文支持、暗色主题、虚拟滚动表格）
- **状态管理**: Pinia（每实体域一个 store）
- **构建**: electron-vite (Vite 内核)
- **国际化**: vue-i18n（中/英双语）
- **通信**: WebSocket (Gateway RPC) + IPC (contextBridge)

## 功能模块（15 个视图）

| 模块 | 说明 |
|------|------|
| 概览 Overview | 系统健康、渠道在线数、活跃会话、定时任务统计 |
| 对话 Chat | 流式聊天、Markdown 渲染、工具调用展示、Agent/模型切换 |
| 智能体 Agents | Agent CRUD、文件编辑器（IDENTITY.md/SOUL.md）、工具/Skills 配置 |
| 模型 Models | AI 供应商管理、Key 自动识别、主模型选择、能力展示 |
| 渠道 Channels | 30+ 渠道状态管理（Telegram/Discord/飞书/WhatsApp 等） |
| Skills | 127+ Skills 目录、分类展示、一键安装、ClawHub 集成 |
| 插件 Plugins | 插件启用/禁用、配置管理 |
| 定时任务 Cron | 任务 CRUD、运行历史、delivery 配置 |
| 会话 Sessions | 虚拟滚动列表、预览、重置、压缩 |
| 节点 Nodes | 设备配对审批、Token 管理、执行审批 |
| 配置 Config | Schema 驱动表单 + JSON 编辑器双模式 |
| 用量 Usage | Token 用量图表、费用统计、CSV 导出 |
| 日志 Logs | 实时日志流、级别过滤、自动跟踪 |
| 连接 Connection | Gateway URL/Token 认证、进程控制 |
| 向导 Wizard | 首次引导（语言→Gateway→Auth→模型→渠道→Skills） |

## 自定义改动

### Gateway 进程管理
- **自动重启 (Supervisor Restart)**: Gateway 因 `config.patch` 触发 SIGUSR1 退出时，Electron 自动在 1s 后重启 Gateway 进程（最多 5 次/30s），解决 "gateway not connected" 问题
- **IPC 直写配置**: 主模型设置支持直接读写 `~/.openclaw/openclaw.json`，无需 Gateway 连接

### 模型管理 (ModelsView)
- **主模型下拉选择器**: 支持从模型列表选择或手动输入模型 ID
- **Provider/Model 格式修复**: 选择模型时自动拼接 `provider/model` 格式（如 `openai/gpt-4o-mini`）
- **离线支持**: Gateway 断连时通过 IPC 读写配置文件

### Skills 管理
- **离线 Catalog 兜底**: Gateway 断连时显示 127+ 静态 Skills 目录
- **ClawHub 一键安装**: 通过 IPC 调用 `clawhub install` CLI 安装 Skills
- **分类合并**: `UI/UX 设计` + `内容创作` → `内容创作与设计`
- **AI 媒体生成 Skills**: 新增 16 个图片/视频生成工具
  - 已有 ClawHub 包：MediaIO、AI Image Prompts、Grok/Flux、LinkFox AI
  - 多平台工具：Replicate、ComfyUI、Midjourney、Runway、可灵、Suno、HeyGen、Luma、Ideogram、Stable Diffusion、Google Veo 3、OpenAI Sora
- **真实新闻 Skills**: 6 个 RSS/资讯聚合 Skills（openclaw-feeds、news-summary、freshrss-reader、bbc-news、ai-news-oracle、rss-digest）

### IPC 通道
- `config:get-primary-model` / `config:set-primary-model`: 直接文件读写主模型
- `skills:add`: 调用 clawhub CLI 安装 Skills（支持 npx 回退）

### 国际化
- 中英文完整覆盖所有模块

## 项目结构

```
src/
├── main/                  # Electron 主进程
│   ├── gateway-process.ts # Gateway 进程管理（含自动重启）
│   ├── ipc-handlers.ts    # IPC 处理器
│   ├── cli-resolver.ts    # 查找 openclaw CLI
│   └── ...
├── preload/               # contextBridge API
└── renderer/              # Vue 3 渲染进程
    ├── views/             # 15 个页面视图
    ├── stores/            # 17 个 Pinia Store
    ├── components/        # 子组件
    ├── gateway/           # WebSocket 通信层
    ├── data/              # Skills 静态目录（127+ skills）
    ├── i18n/              # 中英文翻译
    └── composables/       # 可复用逻辑
```

## 开发

```bash
# 安装依赖
pnpm install

# 开发模式
pnpm dev

# 构建
pnpm build
```

## 同步上游更新

```bash
git fetch upstream
git merge upstream/main
# 或
git rebase upstream/main
```
