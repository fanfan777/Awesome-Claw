/**
 * Static skills catalog for the wizard skills-setup phase.
 * Maps 25 categories (16 job roles + 9 general) to ~127 skills.
 */

export interface SkillCatalogItem {
  id: string
  name: { zh: string; en: string }
  description: { zh: string; en: string }
  source: "builtin" | "clawhub"
  categories: string[]
}

export interface SkillCategoryDef {
  id: string
  icon: string
  label: { zh: string; en: string }
  type: "role" | "general"
}

// ── Categories ──

export const SKILL_CATEGORIES: SkillCategoryDef[] = [
  // Job roles (16)
  { id: "backend", icon: "💻", label: { zh: "后端研发", en: "Backend Dev" }, type: "role" },
  { id: "frontend", icon: "🌐", label: { zh: "前端开发", en: "Frontend Dev" }, type: "role" },
  { id: "mobile", icon: "📱", label: { zh: "移动开发", en: "Mobile Dev" }, type: "role" },
  { id: "creative", icon: "🎨", label: { zh: "内容创作与设计", en: "Content & Design" }, type: "role" },
  { id: "data", icon: "📊", label: { zh: "数据分析", en: "Data Analysis" }, type: "role" },
  { id: "product", icon: "📦", label: { zh: "产品经理", en: "Product Manager" }, type: "role" },
  { id: "operations", icon: "📝", label: { zh: "运营", en: "Operations" }, type: "role" },
  { id: "marketing", icon: "📢", label: { zh: "营销", en: "Marketing" }, type: "role" },
  { id: "gamedev", icon: "🎮", label: { zh: "游戏开发", en: "Game Dev" }, type: "role" },
  { id: "devops", icon: "🏗️", label: { zh: "DevOps/运维", en: "DevOps" }, type: "role" },
  { id: "research", icon: "🔬", label: { zh: "科研/学术", en: "Research" }, type: "role" },
  { id: "finance", icon: "💰", label: { zh: "金融", en: "Finance" }, type: "role" },
  { id: "security", icon: "🔒", label: { zh: "安全", en: "Security" }, type: "role" },
  { id: "pm", icon: "📋", label: { zh: "项目管理", en: "Project Management" }, type: "role" },
  { id: "health", icon: "🩺", label: { zh: "医疗健康", en: "Healthcare" }, type: "role" },

  // General (9)
  { id: "devtools", icon: "🔧", label: { zh: "开发工具", en: "Dev Tools" }, type: "general" },
  { id: "documents", icon: "📄", label: { zh: "文档处理", en: "Documents" }, type: "general" },
  { id: "ai", icon: "🤖", label: { zh: "AI/LLM", en: "AI/LLM" }, type: "general" },
  { id: "browser", icon: "🕸️", label: { zh: "浏览器/自动化", en: "Browser/Automation" }, type: "general" },
  { id: "communication", icon: "💬", label: { zh: "通信", en: "Communication" }, type: "general" },
  { id: "notes", icon: "📝", label: { zh: "笔记/知识管理", en: "Notes/PKM" }, type: "general" },
  { id: "news", icon: "📰", label: { zh: "资讯/新闻", en: "News/Feeds" }, type: "general" },
  { id: "smarthome", icon: "🏠", label: { zh: "智能家居", en: "Smart Home" }, type: "general" },
  { id: "media", icon: "🎵", label: { zh: "媒体", en: "Media" }, type: "general" },
  { id: "speech", icon: "🗣️", label: { zh: "语音/转录", en: "Speech" }, type: "general" },
]

// ── Skills Catalog ──

export const SKILL_CATALOG: SkillCatalogItem[] = [
  // ═══════════════════════════════════════
  // Built-in skills (52)
  // ═══════════════════════════════════════

  // --- Dev / Coding ---
  { id: "coding-agent", name: { zh: "编码 Agent", en: "Coding Agent" }, description: { zh: "委托编码任务给 Codex、Claude Code 或 Pi 后台执行", en: "Delegate coding tasks to Codex, Claude Code, or Pi agents" }, source: "builtin", categories: ["backend", "frontend", "devtools"] },
  { id: "github", name: { zh: "GitHub", en: "GitHub" }, description: { zh: "通过 gh CLI 操作 Issues、PR、CI、代码审查", en: "GitHub operations via gh CLI: issues, PRs, CI, code review" }, source: "builtin", categories: ["backend", "frontend", "devtools", "pm"] },
  { id: "gh-issues", name: { zh: "GitHub Issues 自动修复", en: "GitHub Issues Auto-fix" }, description: { zh: "获取 GitHub Issues，自动生成修复 PR", en: "Fetch GitHub issues, spawn agents to implement fixes and open PRs" }, source: "builtin", categories: ["backend", "devtools", "pm"] },
  { id: "session-logs", name: { zh: "会话日志", en: "Session Logs" }, description: { zh: "搜索和分析历史对话日志", en: "Search and analyze session logs from older conversations" }, source: "builtin", categories: ["devtools"] },
  { id: "skill-creator", name: { zh: "Skill 创建器", en: "Skill Creator" }, description: { zh: "创建、编辑、审计 AgentSkills", en: "Create, edit, improve, or audit AgentSkills" }, source: "builtin", categories: ["devtools"] },
  { id: "canvas", name: { zh: "Canvas", en: "Canvas" }, description: { zh: "Canvas 画布工具", en: "Canvas tool" }, source: "builtin", categories: ["devtools", "frontend"] },
  { id: "tmux", name: { zh: "Tmux", en: "Tmux" }, description: { zh: "通过发送按键和抓取输出来远程控制 tmux 会话", en: "Remote-control tmux sessions by sending keystrokes and scraping output" }, source: "builtin", categories: ["devops", "devtools"] },
  { id: "mcporter", name: { zh: "MCP 工具", en: "MCP Porter" }, description: { zh: "列出、配置、调用 MCP 服务器和工具", en: "List, configure, auth, and call MCP servers/tools" }, source: "builtin", categories: ["ai", "devtools"] },

  // --- Communication ---
  { id: "discord", name: { zh: "Discord", en: "Discord" }, description: { zh: "通过 message 工具操作 Discord", en: "Discord ops via the message tool" }, source: "builtin", categories: ["communication"] },
  { id: "slack", name: { zh: "Slack", en: "Slack" }, description: { zh: "通过 Slack 工具发送消息、回复和管理频道", en: "Control Slack including messaging, reactions, pinning in channels or DMs" }, source: "builtin", categories: ["communication"] },
  { id: "himalaya", name: { zh: "邮件 (IMAP)", en: "Email (IMAP)" }, description: { zh: "通过 IMAP/SMTP 管理邮件的 CLI 工具", en: "CLI to manage emails via IMAP/SMTP" }, source: "builtin", categories: ["communication"] },
  { id: "imsg", name: { zh: "iMessage", en: "iMessage" }, description: { zh: "iMessage/SMS CLI：聊天列表、历史、发送消息", en: "iMessage/SMS CLI for listing chats, history, and sending messages" }, source: "builtin", categories: ["communication"] },
  { id: "bluebubbles", name: { zh: "BlueBubbles", en: "BlueBubbles" }, description: { zh: "通过 BlueBubbles 发送和管理 iMessage", en: "Send and manage iMessages via BlueBubbles" }, source: "builtin", categories: ["communication"] },
  { id: "wacli", name: { zh: "WhatsApp", en: "WhatsApp" }, description: { zh: "发送 WhatsApp 消息或搜索/同步聊天记录", en: "Send WhatsApp messages or search/sync WhatsApp history" }, source: "builtin", categories: ["communication"] },
  { id: "voice-call", name: { zh: "语音通话", en: "Voice Call" }, description: { zh: "通过 OpenClaw 语音通话插件发起通话", en: "Start voice calls via the OpenClaw voice-call plugin" }, source: "builtin", categories: ["communication"] },
  { id: "gog", name: { zh: "Google Workspace", en: "Google Workspace" }, description: { zh: "Gmail、日历、Drive、通讯录、Sheets、Docs", en: "Google Workspace CLI for Gmail, Calendar, Drive, Contacts, Sheets, and Docs" }, source: "builtin", categories: ["communication", "pm", "documents"] },

  // --- Notes ---
  { id: "apple-notes", name: { zh: "Apple 备忘录", en: "Apple Notes" }, description: { zh: "通过 memo CLI 管理 macOS 备忘录", en: "Manage Apple Notes via memo CLI on macOS" }, source: "builtin", categories: ["notes"] },
  { id: "bear-notes", name: { zh: "Bear 笔记", en: "Bear Notes" }, description: { zh: "通过 grizzly CLI 创建、搜索、管理 Bear 笔记", en: "Create, search, and manage Bear notes via grizzly CLI" }, source: "builtin", categories: ["notes"] },
  { id: "notion", name: { zh: "Notion", en: "Notion" }, description: { zh: "通过 Notion API 创建和管理页面、数据库和块", en: "Notion API for creating and managing pages, databases, and blocks" }, source: "builtin", categories: ["notes", "pm"] },
  { id: "obsidian", name: { zh: "Obsidian", en: "Obsidian" }, description: { zh: "在 Obsidian vault 中操作 Markdown 笔记", en: "Work with Obsidian vaults (plain Markdown notes)" }, source: "builtin", categories: ["notes"] },

  // --- Project Management ---
  { id: "apple-reminders", name: { zh: "Apple 提醒事项", en: "Apple Reminders" }, description: { zh: "通过 remindctl CLI 管理 Apple 提醒事项", en: "Manage Apple Reminders via remindctl CLI" }, source: "builtin", categories: ["pm"] },
  { id: "things-mac", name: { zh: "Things 3", en: "Things 3" }, description: { zh: "通过 things CLI 管理 Things 3 任务和项目", en: "Manage Things 3 via things CLI on macOS" }, source: "builtin", categories: ["pm"] },
  { id: "trello", name: { zh: "Trello", en: "Trello" }, description: { zh: "通过 REST API 管理 Trello 看板、列表和卡片", en: "Manage Trello boards, lists, and cards via REST API" }, source: "builtin", categories: ["pm"] },

  // --- AI ---
  { id: "gemini", name: { zh: "Gemini", en: "Gemini" }, description: { zh: "Gemini CLI 一次性问答、摘要、生成", en: "Gemini CLI for one-shot Q&A, summaries, and generation" }, source: "builtin", categories: ["ai"] },
  { id: "oracle", name: { zh: "Oracle", en: "Oracle" }, description: { zh: "使用 oracle CLI 进行 prompt 和文件捆绑", en: "Best practices for using the oracle CLI" }, source: "builtin", categories: ["ai"] },
  { id: "model-usage", name: { zh: "模型用量", en: "Model Usage" }, description: { zh: "通过 CodexBar CLI 汇总每个模型的用量", en: "Summarize per-model usage for Codex or Claude" }, source: "builtin", categories: ["ai"] },
  { id: "clawhub", name: { zh: "ClawHub", en: "ClawHub" }, description: { zh: "搜索、安装、更新、发布 Skills", en: "Search, install, update, and publish agent skills from ClawHub" }, source: "builtin", categories: ["ai", "devtools"] },

  // --- Media ---
  { id: "spotify-player", name: { zh: "Spotify", en: "Spotify" }, description: { zh: "终端 Spotify 播放/搜索", en: "Terminal Spotify playback/search" }, source: "builtin", categories: ["media"] },
  { id: "sonoscli", name: { zh: "Sonos", en: "Sonos" }, description: { zh: "控制 Sonos 音箱（发现/播放/音量/分组）", en: "Control Sonos speakers (discover/play/volume/group)" }, source: "builtin", categories: ["media", "smarthome"] },
  { id: "songsee", name: { zh: "音频可视化", en: "Audio Visualizer" }, description: { zh: "从音频生成频谱图和特征可视化", en: "Generate spectrograms and visualizations from audio" }, source: "builtin", categories: ["media"] },
  { id: "blucli", name: { zh: "BluOS", en: "BluOS" }, description: { zh: "BluOS CLI 设备发现、播放、分组、音量", en: "BluOS CLI for discovery, playback, grouping, and volume" }, source: "builtin", categories: ["media", "smarthome"] },
  { id: "gifgrep", name: { zh: "GIF 搜索", en: "GIF Search" }, description: { zh: "搜索 GIF、下载、提取静帧", en: "Search GIF providers, download results, extract stills" }, source: "builtin", categories: ["media", "creative"] },
  { id: "video-frames", name: { zh: "视频帧提取", en: "Video Frames" }, description: { zh: "用 ffmpeg 从视频中提取帧或短片段", en: "Extract frames or short clips from videos using ffmpeg" }, source: "builtin", categories: ["media", "creative"] },

  // --- Image / Video / Multimodal Gen ---
  { id: "openai-image-gen", name: { zh: "OpenAI 图片生成", en: "OpenAI Image Gen" }, description: { zh: "批量生成图片并输出 HTML 画廊（DALL-E / GPT Image）", en: "Batch-generate images via OpenAI Images API (DALL-E / GPT Image)" }, source: "builtin", categories: ["creative"] },
  { id: "nano-banana-pro", name: { zh: "Gemini 图片生成", en: "Gemini Image Gen" }, description: { zh: "通过 Gemini 3 Pro 生成或编辑图片", en: "Generate or edit images via Gemini 3 Pro Image" }, source: "builtin", categories: ["creative"] },
  { id: "clawhub:mediaio-aigc-generate", name: { zh: "AI 媒体生成（MediaIO）", en: "MediaIO AI Generate" }, description: { zh: "文生图、图生图、图生视频、文生视频，全流程 AI 媒体生成", en: "Text-to-image, image-to-image, image-to-video, text-to-video via MediaIO API" }, source: "clawhub", categories: ["creative", "media"] },
  { id: "clawhub:ai-image-prompts", name: { zh: "AI 图片提示词库", en: "AI Image Prompts" }, description: { zh: "10000+ 真实图片生成提示词，适配所有 AI 图片模型", en: "10,000+ curated prompts for any AI image generation model" }, source: "clawhub", categories: ["creative"] },
  { id: "clawhub:grok-imagine-image-pro", name: { zh: "Grok/Flux 图片生成", en: "Grok Imagine Pro" }, description: { zh: "通过 xAI Grok/Flux API 生成高质量 PNG 图片", en: "Generate high-quality images via xAI Grok/Flux API" }, source: "clawhub", categories: ["creative"] },
  { id: "clawhub:linkfoxai", name: { zh: "LinkFox AI 图片处理", en: "LinkFox AI" }, description: { zh: "36 种图片 AI 能力：换模、抠图、扩展、场景变换、智能修图", en: "36 image AI capabilities: model swap, background removal, expansion, retouching" }, source: "clawhub", categories: ["creative"] },
  { id: "clawhub:replicate-ai", name: { zh: "Replicate 多模型平台", en: "Replicate AI" }, description: { zh: "通过 Replicate API 调用 Flux、SDXL、Stable Video 等数千个开源模型", en: "Run Flux, SDXL, Stable Video and thousands of open-source models via Replicate API" }, source: "clawhub", categories: ["creative", "ai"] },
  { id: "clawhub:comfyui", name: { zh: "ComfyUI 工作流", en: "ComfyUI Workflow" }, description: { zh: "连接本地 ComfyUI 节点式图片/视频生成工作流（Stable Diffusion）", en: "Connect to local ComfyUI node-based image/video generation workflows" }, source: "clawhub", categories: ["creative"] },
  { id: "clawhub:midjourney-api", name: { zh: "Midjourney", en: "Midjourney" }, description: { zh: "通过 Midjourney API 生成高质量艺术风格图片", en: "Generate artistic images via Midjourney API" }, source: "clawhub", categories: ["creative"] },
  { id: "clawhub:runway-ml", name: { zh: "Runway 视频生成", en: "Runway ML" }, description: { zh: "通过 Runway Gen-3/Gen-4 API 实现文生视频、图生视频", en: "Text-to-video, image-to-video via Runway Gen-3/Gen-4 API" }, source: "clawhub", categories: ["creative", "media"] },
  { id: "clawhub:kling-ai", name: { zh: "可灵 AI 视频", en: "Kling AI Video" }, description: { zh: "通过可灵 AI API 生成高质量视频（文生视频、图生视频）", en: "Generate high-quality videos via Kling AI API (text/image-to-video)" }, source: "clawhub", categories: ["creative", "media"] },
  { id: "clawhub:suno-music", name: { zh: "Suno AI 音乐", en: "Suno Music" }, description: { zh: "通过 Suno API 用文字描述生成完整歌曲（人声+伴奏）", en: "Generate full songs with vocals and instrumentals from text via Suno API" }, source: "clawhub", categories: ["creative", "media"] },
  { id: "clawhub:heygen-avatar", name: { zh: "HeyGen 数字人", en: "HeyGen Avatar" }, description: { zh: "通过 HeyGen API 生成数字人口播视频（文字转真人视频）", en: "Generate talking avatar videos from text via HeyGen API" }, source: "clawhub", categories: ["creative", "media"] },
  { id: "clawhub:luma-ai", name: { zh: "Luma 视频/3D", en: "Luma AI" }, description: { zh: "通过 Luma Dream Machine API 生成视频和 3D 场景", en: "Generate videos and 3D scenes via Luma Dream Machine API" }, source: "clawhub", categories: ["creative", "media"] },
  { id: "clawhub:ideogram", name: { zh: "Ideogram 文字图片", en: "Ideogram" }, description: { zh: "擅长在图片中精确渲染文字的 AI 图片生成", en: "AI image generation with accurate text rendering in images" }, source: "clawhub", categories: ["creative"] },
  { id: "clawhub:stable-diffusion", name: { zh: "Stable Diffusion 本地", en: "Stable Diffusion Local" }, description: { zh: "连接本地 Stable Diffusion WebUI (A1111/Forge) API 生成图片", en: "Connect to local Stable Diffusion WebUI (A1111/Forge) for image generation" }, source: "clawhub", categories: ["creative"] },
  { id: "clawhub:google-veo", name: { zh: "Google Veo 3 视频", en: "Google Veo 3" }, description: { zh: "通过 Google Veo 3 API 生成高质量视频（文生视频、图生视频、带音频）", en: "Generate high-quality videos with audio via Google Veo 3 API" }, source: "clawhub", categories: ["creative", "media"] },
  { id: "clawhub:openai-sora", name: { zh: "OpenAI Sora 视频", en: "OpenAI Sora" }, description: { zh: "通过 OpenAI Sora API 生成逼真视频（文生视频、图生视频、视频编辑）", en: "Generate realistic videos via OpenAI Sora API (text/image-to-video, editing)" }, source: "clawhub", categories: ["creative", "media"] },

  // --- Documents ---
  { id: "nano-pdf", name: { zh: "PDF 编辑", en: "PDF Editor" }, description: { zh: "用自然语言指令编辑 PDF", en: "Edit PDFs with natural-language instructions" }, source: "builtin", categories: ["documents"] },

  // --- Speech ---
  { id: "openai-whisper", name: { zh: "Whisper 本地", en: "Whisper Local" }, description: { zh: "本地语音转文字（无需 API Key）", en: "Local speech-to-text with the Whisper CLI (no API key)" }, source: "builtin", categories: ["speech"] },
  { id: "openai-whisper-api", name: { zh: "Whisper API", en: "Whisper API" }, description: { zh: "通过 OpenAI API 转录音频", en: "Transcribe audio via OpenAI Audio Transcriptions API" }, source: "builtin", categories: ["speech"] },
  { id: "sherpa-onnx-tts", name: { zh: "离线 TTS", en: "Offline TTS" }, description: { zh: "通过 sherpa-onnx 进行本地语音合成", en: "Local text-to-speech via sherpa-onnx (offline)" }, source: "builtin", categories: ["speech"] },
  { id: "sag", name: { zh: "ElevenLabs TTS", en: "ElevenLabs TTS" }, description: { zh: "ElevenLabs 文字转语音", en: "ElevenLabs text-to-speech with say UX" }, source: "builtin", categories: ["speech"] },

  // --- Smart Home ---
  { id: "openhue", name: { zh: "Philips Hue", en: "Philips Hue" }, description: { zh: "通过 OpenHue CLI 控制 Philips Hue 灯光和场景", en: "Control Philips Hue lights and scenes via OpenHue CLI" }, source: "builtin", categories: ["smarthome"] },
  { id: "eightctl", name: { zh: "Eight Sleep", en: "Eight Sleep" }, description: { zh: "控制 Eight Sleep 智能床垫（温度、闹钟、计划）", en: "Control Eight Sleep pods (status, temperature, alarms)" }, source: "builtin", categories: ["smarthome"] },
  { id: "camsnap", name: { zh: "摄像头", en: "Camera Capture" }, description: { zh: "从 RTSP/ONVIF 摄像头捕获帧或片段", en: "Capture frames or clips from RTSP/ONVIF cameras" }, source: "builtin", categories: ["smarthome"] },

  // --- DevOps ---
  { id: "healthcheck", name: { zh: "安全检查", en: "Security Healthcheck" }, description: { zh: "主机安全加固和风险配置审计", en: "Host security hardening and risk-tolerance configuration" }, source: "builtin", categories: ["devops", "security"] },
  { id: "peekaboo", name: { zh: "macOS UI 自动化", en: "macOS UI Automation" }, description: { zh: "通过 Peekaboo CLI 捕获和自动化 macOS UI", en: "Capture and automate macOS UI with the Peekaboo CLI" }, source: "builtin", categories: ["devops", "browser"] },

  // --- Other built-in ---
  { id: "summarize", name: { zh: "摘要", en: "Summarize" }, description: { zh: "从 URL、播客、本地文件提取摘要/文字稿", en: "Summarize or extract transcripts from URLs, podcasts, and files" }, source: "builtin", categories: ["research", "creative", "ai"] },
  { id: "weather", name: { zh: "天气", en: "Weather" }, description: { zh: "获取当前天气和天气预报", en: "Get current weather and forecasts" }, source: "builtin", categories: ["operations"] },
  { id: "blogwatcher", name: { zh: "博客监控", en: "Blog Watcher" }, description: { zh: "监控博客和 RSS/Atom 订阅更新", en: "Monitor blogs and RSS/Atom feeds for updates" }, source: "builtin", categories: ["news", "operations", "creative"] },
  { id: "xurl", name: { zh: "X/Twitter", en: "X/Twitter" }, description: { zh: "通过 X API 发推、回复、搜索、管理关注", en: "Post tweets, reply, search, manage followers via X API" }, source: "builtin", categories: ["marketing"] },
  { id: "goplaces", name: { zh: "Google 地点", en: "Google Places" }, description: { zh: "搜索 Google Places API 查询地点信息", en: "Query Google Places API for text search and details" }, source: "builtin", categories: ["operations"] },
  { id: "1password", name: { zh: "1Password", en: "1Password" }, description: { zh: "设置和使用 1Password CLI 管理密钥", en: "Set up and use 1Password CLI (op) for secrets" }, source: "builtin", categories: ["security"] },
  { id: "ordercli", name: { zh: "外卖订单", en: "Food Orders" }, description: { zh: "查看外卖历史订单和当前订单状态", en: "Check past food orders and active order status" }, source: "builtin", categories: ["operations"] },

  // ═══════════════════════════════════════
  // ClawHub skills (75)
  // ═══════════════════════════════════════

  // --- Backend / Coding ---
  { id: "clawhub:atris", name: { zh: "代码导航", en: "Codebase Navigator" }, description: { zh: "生成结构化代码导航图，减少重复扫描", en: "Generate structured navigation maps with file:line references" }, source: "clawhub", categories: ["backend", "devtools"] },
  { id: "clawhub:agentlens", name: { zh: "代码理解", en: "AgentLens" }, description: { zh: "通过层级视图导航和理解代码库", en: "Navigate and understand codebases using hierarchical views" }, source: "clawhub", categories: ["backend", "devtools"] },
  { id: "clawhub:auto-test-generator", name: { zh: "自动测试生成", en: "Auto Test Generator" }, description: { zh: "自动生成单元/集成测试", en: "Automatically generate unit/integration tests" }, source: "clawhub", categories: ["backend", "devtools"] },
  { id: "clawhub:anti-pattern-czar", name: { zh: "反模式检测", en: "Anti-Pattern Czar" }, description: { zh: "检测并修复 TypeScript 错误处理反模式", en: "Detect and fix TypeScript error handling anti-patterns" }, source: "clawhub", categories: ["backend"] },
  { id: "clawhub:supabase", name: { zh: "Supabase", en: "Supabase" }, description: { zh: "连接 Supabase 进行数据库操作、向量搜索和存储", en: "Connect to Supabase for database operations, vector search, and storage" }, source: "clawhub", categories: ["backend", "devops"] },
  { id: "clawhub:nocodb", name: { zh: "NocoDB", en: "NocoDB" }, description: { zh: "通过 REST API 访问和管理 NocoDB 数据库", en: "Access and manage NocoDB databases, tables, and records" }, source: "clawhub", categories: ["backend", "data"] },

  // --- Frontend ---
  { id: "clawhub:crawl4ai", name: { zh: "AI 爬虫", en: "Crawl4AI" }, description: { zh: "AI 驱动的网页抓取框架，提取结构化数据", en: "AI-powered web scraping for extracting structured data" }, source: "clawhub", categories: ["frontend", "browser"] },
  { id: "clawhub:awwwards-design", name: { zh: "获奖级设计", en: "Awwwards Design" }, description: { zh: "创建获奖级网站，高级动画和独特视觉设计", en: "Create award-winning websites with advanced animations" }, source: "clawhub", categories: ["frontend", "creative"] },
  { id: "clawhub:cloudflare-toolkit", name: { zh: "Cloudflare 工具包", en: "Cloudflare Toolkit" }, description: { zh: "管理域名、DNS、SSL、防火墙、隧道和分析", en: "Manage Cloudflare domains, DNS, SSL, firewall, tunnels" }, source: "clawhub", categories: ["frontend", "devops"] },
  { id: "clawhub:anti-slop-design", name: { zh: "反 AI 审美", en: "Anti-Slop Design" }, description: { zh: "创建独特的生产级前端界面，避免 AI 通用审美", en: "Create distinctive interfaces that avoid generic AI aesthetics" }, source: "clawhub", categories: ["frontend", "creative"] },
  { id: "clawhub:axe-devtools", name: { zh: "无障碍测试", en: "Accessibility Testing" }, description: { zh: "使用 axe MCP Server 进行无障碍测试和修复", en: "Accessibility testing and remediation using axe" }, source: "clawhub", categories: ["frontend"] },
  { id: "clawhub:netlify", name: { zh: "Netlify", en: "Netlify" }, description: { zh: "使用 Netlify CLI 创建/链接站点和 CI/CD", en: "Use Netlify CLI to create/link sites and set up CI/CD" }, source: "clawhub", categories: ["frontend", "devops"] },

  // --- Mobile ---
  { id: "clawhub:swift-concurrency-expert", name: { zh: "Swift 并发专家", en: "Swift Concurrency Expert" }, description: { zh: "Swift 并发审查和修复", en: "Swift Concurrency review and remediation" }, source: "clawhub", categories: ["mobile"] },
  { id: "clawhub:swiftui-performance-audit", name: { zh: "SwiftUI 性能审计", en: "SwiftUI Performance Audit" }, description: { zh: "审计和优化 SwiftUI 运行时性能", en: "Audit and improve SwiftUI runtime performance" }, source: "clawhub", categories: ["mobile"] },
  { id: "clawhub:instruments-profiling", name: { zh: "Instruments 分析", en: "Instruments Profiling" }, description: { zh: "使用 Instruments 分析原生 macOS/iOS 应用", en: "Profile native macOS or iOS apps with Instruments" }, source: "clawhub", categories: ["mobile"] },

  // --- Design ---
  { id: "clawhub:fal-ai", name: { zh: "fal.ai 多模态", en: "fal.ai" }, description: { zh: "通过 fal.ai API 生成图片、视频和音频", en: "Generate images, videos, and audio via fal.ai API" }, source: "clawhub", categories: ["creative", "creative", "media"] },
  { id: "clawhub:openai-image-cli", name: { zh: "OpenAI 图片 CLI", en: "OpenAI Image CLI" }, description: { zh: "通过 OpenAI GPT Image 和 DALL-E 生成/编辑图片", en: "Generate, edit, and manage images via OpenAI models" }, source: "clawhub", categories: ["creative", "creative"] },
  { id: "clawhub:chart-image", name: { zh: "图表生成", en: "Chart Image" }, description: { zh: "从数据生成出版级图表", en: "Generate publication-quality chart images from data" }, source: "clawhub", categories: ["creative", "data"] },

  // --- Data ---
  { id: "clawhub:data-analyst", name: { zh: "数据分析师", en: "Data Analyst" }, description: { zh: "数据可视化、报表生成、SQL 查询和电子表格", en: "Data visualization, reports, SQL queries, spreadsheet ops" }, source: "clawhub", categories: ["data"] },
  { id: "clawhub:csv-pipeline", name: { zh: "CSV 处理", en: "CSV Pipeline" }, description: { zh: "处理、转换、分析 CSV 和 JSON 数据并生成报表", en: "Process, transform, analyze CSV and JSON data" }, source: "clawhub", categories: ["data"] },
  { id: "clawhub:senior-data-scientist", name: { zh: "高级数据科学家", en: "Senior Data Scientist" }, description: { zh: "世界级数据科学技能套件", en: "World-class data science skill" }, source: "clawhub", categories: ["data", "research"] },
  { id: "clawhub:duckdb-cli-ai-skills", name: { zh: "DuckDB SQL 分析", en: "DuckDB SQL Analysis" }, description: { zh: "DuckDB CLI 专家，SQL 分析和数据处理", en: "DuckDB CLI specialist for SQL analysis and data processing" }, source: "clawhub", categories: ["data"] },

  // --- Product ---
  { id: "clawhub:clickup-mcp", name: { zh: "ClickUp", en: "ClickUp" }, description: { zh: "管理 ClickUp 任务、文档、时间追踪、评论", en: "Manage ClickUp tasks, docs, time tracking, comments" }, source: "clawhub", categories: ["product", "pm"] },
  { id: "clawhub:asana", name: { zh: "Asana", en: "Asana" }, description: { zh: "通过 REST API 集成 Asana 项目管理", en: "Integrate Asana via the Asana REST API" }, source: "clawhub", categories: ["product", "pm"] },
  { id: "clawhub:briefing", name: { zh: "每日简报", en: "Daily Briefing" }, description: { zh: "汇总日历、待办事项和天气的每日简报", en: "Daily briefing: calendar, active todos, and weather" }, source: "clawhub", categories: ["product", "pm", "operations"] },

  // --- 资讯/新闻 News & Feeds (real ClawHub skills) ---
  { id: "clawhub:openclaw-feeds", name: { zh: "RSS 资讯聚合", en: "RSS News Feeds" }, description: { zh: "聚合 Ars Technica、Wired、TechCrunch、NYT 等 40+ RSS 源，按新闻/游戏/金融分类", en: "Aggregate 40+ RSS sources (Ars Technica, Wired, TechCrunch, NYT, etc.) by news/games/finance" }, source: "clawhub", categories: ["news", "operations", "research"] },
  { id: "clawhub:news-summary", name: { zh: "新闻摘要", en: "News Summary" }, description: { zh: "从可信 RSS 源获取新闻摘要，支持语音播报、按话题/频率定制", en: "Fetch news summaries from trusted RSS feeds with voice output, customizable topics and frequency" }, source: "clawhub", categories: ["news", "operations", "research"] },
  { id: "clawhub:freshrss-reader", name: { zh: "FreshRSS 阅读器", en: "FreshRSS Reader" }, description: { zh: "从自建 FreshRSS 实例获取标题和文章，支持分类和时间过滤", en: "Query headlines/articles from self-hosted FreshRSS with category and time filtering" }, source: "clawhub", categories: ["news", "operations"] },
  { id: "clawhub:bbc-news", name: { zh: "BBC 新闻", en: "BBC News" }, description: { zh: "获取 BBC 各版块和地区的新闻报道", en: "Fetch and display BBC News stories from various sections and regions" }, source: "clawhub", categories: ["news", "research"] },
  { id: "clawhub:ai-news-oracle", name: { zh: "AI 资讯速报", en: "AI News Oracle" }, description: { zh: "从 Hacker News、TechCrunch、The Verge 获取实时 AI 资讯简报", en: "Real-time AI news briefings from Hacker News, TechCrunch, and The Verge" }, source: "clawhub", categories: ["news", "backend", "research"] },
  { id: "clawhub:rss-digest", name: { zh: "RSS 摘要", en: "RSS Digest" }, description: { zh: "智能 RSS 摘要生成器，自动聚合订阅源并生成每日/每周摘要", en: "Agentic RSS digest generator, auto-aggregate feeds into daily/weekly summaries" }, source: "clawhub", categories: ["news", "operations", "creative"] },

  { id: "clawhub:reprompter", name: { zh: "Prompt 优化器", en: "Reprompter" }, description: { zh: "将杂乱的 prompt 转化为结构化的高效 prompt", en: "Transform messy prompts into well-structured effective ones" }, source: "clawhub", categories: ["product", "ai"] },

  // --- Marketing ---
  { id: "clawhub:bird", name: { zh: "X/Twitter 高级", en: "X/Twitter Advanced" }, description: { zh: "X/Twitter CLI：阅读、搜索、发布", en: "X/Twitter CLI for reading, searching, and posting" }, source: "clawhub", categories: ["marketing"] },
  { id: "clawhub:bluesky", name: { zh: "Bluesky", en: "Bluesky" }, description: { zh: "完整 Bluesky CLI：发布、回复、点赞、转发、关注", en: "Complete Bluesky CLI: post, reply, like, repost, follow" }, source: "clawhub", categories: ["marketing"] },
  { id: "clawhub:content-creator", name: { zh: "内容创作者", en: "Content Creator" }, description: { zh: "创建 SEO 优化的营销内容，保持品牌一致性", en: "Create SEO-optimized marketing content with brand voice" }, source: "clawhub", categories: ["marketing", "creative"] },
  { id: "clawhub:ai-humanizer", name: { zh: "AI 文本人性化", en: "AI Humanizer" }, description: { zh: "检测并消除 AI 生成文本的典型模式", en: "Humanize AI-generated text by removing typical LLM patterns" }, source: "clawhub", categories: ["marketing", "creative"] },

  // --- DevOps ---
  { id: "clawhub:cicd-pipeline", name: { zh: "CI/CD 流水线", en: "CI/CD Pipeline" }, description: { zh: "创建、调试和管理 GitHub Actions CI/CD 流水线", en: "Create, debug, and manage CI/CD pipelines with GitHub Actions" }, source: "clawhub", categories: ["devops"] },
  { id: "clawhub:gh-action-gen", name: { zh: "GitHub Actions 生成器", en: "GitHub Actions Generator" }, description: { zh: "用自然语言生成 GitHub Actions 工作流", en: "Generate GitHub Actions workflows from plain English" }, source: "clawhub", categories: ["devops"] },
  { id: "clawhub:local-system-info", name: { zh: "系统信息", en: "System Info" }, description: { zh: "返回系统指标（CPU、内存、磁盘、进程）", en: "Return system metrics (CPU, RAM, disk, processes)" }, source: "clawhub", categories: ["devops"] },

  // --- Research ---
  { id: "clawhub:academic-deep-research", name: { zh: "深度学术研究", en: "Academic Deep Research" }, description: { zh: "透明严谨的研究，完整溯源", en: "Transparent, rigorous research with full provenance" }, source: "clawhub", categories: ["research"] },
  { id: "clawhub:academic-writing-refiner", name: { zh: "学术写作优化", en: "Academic Writing Refiner" }, description: { zh: "为顶会论文（NeurIPS/ICLR 等）优化学术写作", en: "Refine academic writing for CS research papers" }, source: "clawhub", categories: ["research"] },
  { id: "clawhub:wolfram-alpha", name: { zh: "Wolfram Alpha", en: "Wolfram Alpha" }, description: { zh: "复杂数学计算、物理模拟、数据分析和科学查询", en: "Complex math, physics simulations, data analysis, science queries" }, source: "clawhub", categories: ["research", "data", "finance"] },
  { id: "clawhub:geepers-data", name: { zh: "多源数据获取", en: "Multi-Source Data" }, description: { zh: "从 arXiv、Census、GitHub、NASA、Wikipedia、PubMed 等 17 个 API 获取数据", en: "Fetch structured data from 17 authoritative APIs" }, source: "clawhub", categories: ["research", "data"] },
  { id: "clawhub:deepwiki", name: { zh: "DeepWiki", en: "DeepWiki" }, description: { zh: "查询 GitHub 仓库的文档和 Wiki", en: "Query GitHub repository documentation and wiki" }, source: "clawhub", categories: ["research", "devtools"] },

  // --- Writing ---
  { id: "clawhub:ffmpeg-video-editor", name: { zh: "FFmpeg 视频编辑", en: "FFmpeg Video Editor" }, description: { zh: "用自然语言生成 FFmpeg 命令", en: "Generate FFmpeg commands from natural language" }, source: "clawhub", categories: ["creative", "media"] },

  // --- Finance ---
  { id: "clawhub:invoice-generator", name: { zh: "发票生成器", en: "Invoice Generator" }, description: { zh: "从 JSON 生成专业 PDF 发票", en: "Generate professional PDF invoices from JSON" }, source: "clawhub", categories: ["finance", "documents"] },

  // --- Security ---
  { id: "clawhub:bitwarden", name: { zh: "Bitwarden", en: "Bitwarden" }, description: { zh: "安全访问和管理 Bitwarden/Vaultwarden 密码", en: "Access and manage Bitwarden/Vaultwarden passwords securely" }, source: "clawhub", categories: ["security"] },
  { id: "clawhub:ggshield-scanner", name: { zh: "密钥泄露检测", en: "Secret Scanner" }, description: { zh: "检测 500+ 类型的硬编码密钥", en: "Detect 500+ types of hardcoded secrets" }, source: "clawhub", categories: ["security"] },
  { id: "clawhub:pr-risk-analyzer", name: { zh: "PR 风险分析", en: "PR Risk Analyzer" }, description: { zh: "分析 GitHub PR 的安全风险，判断是否安全合并", en: "Analyze GitHub PRs for security risks" }, source: "clawhub", categories: ["security", "devtools"] },

  // --- PM ---
  { id: "clawhub:excel-workflow", name: { zh: "Excel 工作流", en: "Excel Workflow" }, description: { zh: "Excel 处理、Google Drive 同步、公式保留", en: "Excel processing with Google Drive sync and formula preservation" }, source: "clawhub", categories: ["pm", "data"] },

  // --- Browser / Automation ---
  { id: "clawhub:actionbook", name: { zh: "网站交互", en: "ActionBook" }, description: { zh: "与任意网站交互：自动化、抓取、截图、表单", en: "Interact with any website: automation, scraping, screenshots" }, source: "clawhub", categories: ["browser"] },
  { id: "clawhub:apify-ultimate-scraper", name: { zh: "通用爬虫", en: "Ultimate Scraper" }, description: { zh: "AI 驱动的通用网页抓取器", en: "Universal AI-powered web scraper for any platform" }, source: "clawhub", categories: ["browser"] },
  { id: "clawhub:chrome-devtools", name: { zh: "Chrome DevTools", en: "Chrome DevTools" }, description: { zh: "通过 MCP 使用 Chrome DevTools 调试和自动化", en: "Chrome DevTools via MCP for debugging and automation" }, source: "clawhub", categories: ["browser", "frontend"] },
  { id: "clawhub:computer-use", name: { zh: "远程桌面控制", en: "Computer Use" }, description: { zh: "在无头 Linux 服务器和 VPS 上进行全桌面控制", en: "Full desktop computer use for headless Linux servers" }, source: "clawhub", categories: ["browser", "devops"] },

  // --- Git ---
  { id: "clawhub:super-github", name: { zh: "GitHub 超级工具", en: "Super GitHub" }, description: { zh: "终极 GitHub 自动化框架：Issues、PR、Releases", en: "The ultimate GitHub automation framework" }, source: "clawhub", categories: ["devtools"] },
  { id: "clawhub:conventional-commits", name: { zh: "约定式提交", en: "Conventional Commits" }, description: { zh: "按约定式提交规范格式化 commit 消息", en: "Format commit messages using Conventional Commits" }, source: "clawhub", categories: ["devtools"] },
  { id: "clawhub:git-changelog", name: { zh: "Git 变更日志", en: "Git Changelog" }, description: { zh: "从 git 历史自动生成变更日志", en: "Auto-generate changelogs from git history" }, source: "clawhub", categories: ["devtools"] },
  { id: "clawhub:dependency-audit", name: { zh: "依赖审计", en: "Dependency Audit" }, description: { zh: "安全审计、过期检测、未使用依赖和更新计划", en: "Security audit, outdated detection, unused deps, update plan" }, source: "clawhub", categories: ["devtools", "security"] },
  { id: "clawhub:create-cli", name: { zh: "CLI 设计器", en: "CLI Designer" }, description: { zh: "设计 CLI 参数、标志和子命令", en: "Design CLI arguments, flags, subcommands" }, source: "clawhub", categories: ["devtools"] },
  { id: "clawhub:fd-find", name: { zh: "快速文件查找", en: "fd-find" }, description: { zh: "快速友好的 find 替代品", en: "A fast and user-friendly alternative to find" }, source: "clawhub", categories: ["devtools"] },

  // --- Documents ---
  { id: "clawhub:markdown-converter", name: { zh: "Markdown 转换器", en: "Markdown Converter" }, description: { zh: "将文档和文件转换为 Markdown", en: "Convert documents and files to Markdown" }, source: "clawhub", categories: ["documents"] },
  { id: "clawhub:docx", name: { zh: "Word 文档", en: "DOCX" }, description: { zh: "全面的文档创建、编辑和分析（含修订追踪）", en: "Document creation, editing, and analysis with tracked changes" }, source: "clawhub", categories: ["documents"] },
  { id: "clawhub:stirling-pdf", name: { zh: "PDF 操作", en: "Stirling PDF" }, description: { zh: "通过 Stirling-PDF API 操作 PDF", en: "PDF manipulation via Stirling-PDF API" }, source: "clawhub", categories: ["documents"] },

  // --- AI ---
  { id: "clawhub:moa", name: { zh: "多模型辩论", en: "Mixture of Agents" }, description: { zh: "让 3 个前沿模型辩论，综合最佳见解", en: "Make 3 frontier models argue, synthesize best insights" }, source: "clawhub", categories: ["ai"] },
  { id: "clawhub:llmfit", name: { zh: "本地模型推荐", en: "LLM Fit" }, description: { zh: "检测本地硬件并推荐最佳本地 LLM 模型", en: "Detect local hardware and recommend best-fit local LLM" }, source: "clawhub", categories: ["ai"] },
  { id: "clawhub:cortex-memory", name: { zh: "长期记忆", en: "Cortex Memory" }, description: { zh: "知识图谱、实体追踪、时间推理、跨会话记忆", en: "Knowledge graph, entity tracking, temporal reasoning, cross-session recall" }, source: "clawhub", categories: ["ai", "notes"] },

  // --- Communication ---
  { id: "clawhub:microsoft365", name: { zh: "Microsoft 365", en: "Microsoft 365" }, description: { zh: "Outlook、日历、联系人、OneDrive（Graph API）", en: "Microsoft 365 integration via Microsoft Graph API" }, source: "clawhub", categories: ["communication", "pm"] },
  { id: "clawhub:clawemail", name: { zh: "Google 邮件/Drive", en: "Google Mail/Drive" }, description: { zh: "Gmail、Drive、Docs、Sheets、Slides", en: "Google Workspace via ClawEmail" }, source: "clawhub", categories: ["communication", "documents"] },
  { id: "clawhub:rocketchat", name: { zh: "Rocket.Chat", en: "Rocket.Chat" }, description: { zh: "Rocket.Chat 团队消息：频道、用户、集成", en: "Rocket.Chat team messaging via REST API" }, source: "clawhub", categories: ["communication"] },

  // --- Notes ---
  { id: "clawhub:better-notion", name: { zh: "Notion 增强", en: "Better Notion" }, description: { zh: "Notion 页面和数据库的完整 CRUD", en: "Full CRUD for Notion pages, databases" }, source: "clawhub", categories: ["notes"] },

  // --- Health ---
  { id: "clawhub:fitbit", name: { zh: "Fitbit", en: "Fitbit" }, description: { zh: "查询 Fitbit 健康数据：睡眠、心率、活动、血氧", en: "Query Fitbit health data: sleep, heart rate, activity, SpO2" }, source: "clawhub", categories: ["health"] },
  { id: "clawhub:garmin-health-analysis", name: { zh: "Garmin 健康", en: "Garmin Health" }, description: { zh: "用自然语言查询 Garmin 健康数据", en: "Talk to your Garmin data naturally" }, source: "clawhub", categories: ["health"] },
  { id: "clawhub:calorie-counter", name: { zh: "卡路里追踪", en: "Calorie Counter" }, description: { zh: "追踪每日热量和蛋白质摄入，设定目标", en: "Track daily calorie and protein intake, set goals" }, source: "clawhub", categories: ["health"] },

  // --- Smart Home ---
  { id: "clawhub:clawdbot-skill-homebridge", name: { zh: "Homebridge", en: "Homebridge" }, description: { zh: "通过 Homebridge 控制智能家居设备", en: "Control smart home devices via Homebridge" }, source: "clawhub", categories: ["smarthome"] },
  { id: "clawhub:homey", name: { zh: "Homey", en: "Homey" }, description: { zh: "通过本地或云 API 控制 Athom Homey 智能家居", en: "Control Athom Homey smart home devices" }, source: "clawhub", categories: ["smarthome"] },
  { id: "clawhub:nest-sdm", name: { zh: "Nest 智能家居", en: "Nest SDM" }, description: { zh: "控制 Nest 恒温器、门铃和摄像头", en: "Control Nest thermostat, doorbell, and cameras" }, source: "clawhub", categories: ["smarthome"] },

  // --- Speech ---
  { id: "clawhub:elevenlabs-tts", name: { zh: "ElevenLabs 高级 TTS", en: "ElevenLabs TTS Pro" }, description: { zh: "最佳 ElevenLabs 集成", en: "The best ElevenLabs integration for OpenClaw" }, source: "clawhub", categories: ["speech"] },
  { id: "clawhub:faster-whisper", name: { zh: "Faster Whisper", en: "Faster Whisper" }, description: { zh: "使用 faster-whisper 的本地语音转文字", en: "Local speech-to-text using faster-whisper" }, source: "clawhub", categories: ["speech"] },
  { id: "clawhub:assemblyai-transcribe", name: { zh: "AssemblyAI 转录", en: "AssemblyAI Transcribe" }, description: { zh: "使用 AssemblyAI 转录音视频", en: "Transcribe audio/video with AssemblyAI" }, source: "clawhub", categories: ["speech"] },

  // --- Game Dev ---
  { id: "clawhub:redis-store", name: { zh: "Redis 存储", en: "Redis Store" }, description: { zh: "Redis 数据存储和缓存操作", en: "Redis data storage and caching operations" }, source: "clawhub", categories: ["backend", "gamedev"] },

  // --- Feishu (Extension: openclaw-extra) ---
  { id: "feishu-doc", name: { zh: "飞书文档", en: "Feishu Docs" }, description: { zh: "飞书文档读写操作，适用于云文档和在线文档管理", en: "Feishu document read/write operations" }, source: "clawhub", categories: ["documents", "communication"] },
  { id: "feishu-drive", name: { zh: "飞书云盘", en: "Feishu Drive" }, description: { zh: "飞书云盘文件管理，支持云空间和文件夹操作", en: "Feishu cloud storage file management" }, source: "clawhub", categories: ["documents", "communication"] },
  { id: "feishu-perm", name: { zh: "飞书权限", en: "Feishu Permissions" }, description: { zh: "飞书文档和文件的权限管理，支持分享和协作设置", en: "Feishu permission management for documents and files" }, source: "clawhub", categories: ["documents", "communication"] },
  { id: "feishu-wiki", name: { zh: "飞书知识库", en: "Feishu Wiki" }, description: { zh: "飞书知识库导航和管理，支持 Wiki 浏览和编辑", en: "Feishu knowledge base navigation" }, source: "clawhub", categories: ["notes", "communication"] },
]

// ── Helpers ──

export function getSkillsByCategory(categoryId: string): SkillCatalogItem[] {
  return SKILL_CATALOG.filter(s => s.categories.includes(categoryId))
}

export function getRoleCategories(): SkillCategoryDef[] {
  return SKILL_CATEGORIES.filter(c => c.type === "role")
}

export function getGeneralCategories(): SkillCategoryDef[] {
  return SKILL_CATEGORIES.filter(c => c.type === "general")
}
