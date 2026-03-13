/**
 * MCP (Model Context Protocol) server catalog.
 * Real, verified npm packages that can be installed as MCP servers.
 * Managed in ToolsView MCP section, separate from the Skills catalog.
 */

export interface McpServerEntry {
  id: string
  name: { zh: string; en: string }
  description: { zh: string; en: string }
  npmPackage: string
  category: string
  /** Official @modelcontextprotocol/* or well-known vendor */
  official?: boolean
}

export interface McpCategoryDef {
  id: string
  icon: string
  label: { zh: string; en: string }
}

export const MCP_CATEGORIES: McpCategoryDef[] = [
  { id: "devtools", icon: "🔧", label: { zh: "开发工具", en: "Dev Tools" } },
  { id: "data", icon: "📊", label: { zh: "数据库", en: "Databases" } },
  { id: "browser", icon: "🕸️", label: { zh: "浏览器", en: "Browser" } },
  { id: "ai", icon: "🤖", label: { zh: "AI 增强", en: "AI Enhanced" } },
  { id: "cloud", icon: "☁️", label: { zh: "云服务", en: "Cloud & SaaS" } },
  { id: "utility", icon: "⚙️", label: { zh: "实用工具", en: "Utilities" } },
]

export const MCP_CATALOG: McpServerEntry[] = [
  // ── Dev Tools ──
  {
    id: "mcp-filesystem",
    name: { zh: "文件系统", en: "Filesystem" },
    description: { zh: "安全访问本地文件系统（读写、目录、搜索）", en: "Secure local filesystem access (read, write, directory, search)" },
    npmPackage: "@modelcontextprotocol/server-filesystem",
    category: "devtools",
    official: true,
  },
  {
    id: "mcp-git",
    name: { zh: "Git", en: "Git" },
    description: { zh: "Git 操作（克隆、提交、分支、差异、日志）", en: "Git operations (clone, commit, branch, diff, log)" },
    npmPackage: "@modelcontextprotocol/server-git",
    category: "devtools",
    official: true,
  },
  {
    id: "mcp-github",
    name: { zh: "GitHub", en: "GitHub" },
    description: { zh: "GitHub API（仓库、Issues、PR、搜索、文件）", en: "GitHub API (repos, issues, PRs, search, files)" },
    npmPackage: "@modelcontextprotocol/server-github",
    category: "devtools",
    official: true,
  },
  {
    id: "mcp-gitlab",
    name: { zh: "GitLab", en: "GitLab" },
    description: { zh: "GitLab API（项目、合并请求、CI 流水线）", en: "GitLab API (projects, merge requests, CI pipelines)" },
    npmPackage: "@modelcontextprotocol/server-gitlab",
    category: "devtools",
    official: true,
  },
  {
    id: "mcp-sentry",
    name: { zh: "Sentry 错误追踪", en: "Sentry" },
    description: { zh: "查询 Sentry 错误事件、Issue 详情和堆栈信息", en: "Query Sentry issues, error events, and stack traces" },
    npmPackage: "@modelcontextprotocol/server-sentry",
    category: "devtools",
    official: true,
  },

  // ── Databases ──
  {
    id: "mcp-postgres",
    name: { zh: "PostgreSQL", en: "PostgreSQL" },
    description: { zh: "连接 PostgreSQL 数据库，执行只读 SQL 查询", en: "Connect to PostgreSQL and execute read-only SQL queries" },
    npmPackage: "@modelcontextprotocol/server-postgres",
    category: "data",
    official: true,
  },
  {
    id: "mcp-sqlite",
    name: { zh: "SQLite", en: "SQLite" },
    description: { zh: "操作 SQLite 数据库，支持查询、分析和报表", en: "SQLite database operations with query, analysis, and reporting" },
    npmPackage: "@modelcontextprotocol/server-sqlite",
    category: "data",
    official: true,
  },
  {
    id: "mcp-redis",
    name: { zh: "Redis", en: "Redis" },
    description: { zh: "Redis 键值操作和数据管理", en: "Redis key-value operations and data management" },
    npmPackage: "@modelcontextprotocol/server-redis",
    category: "data",
    official: true,
  },

  // ── Browser & Search ──
  {
    id: "mcp-puppeteer",
    name: { zh: "Puppeteer 浏览器", en: "Puppeteer" },
    description: { zh: "控制 Puppeteer 进行网页自动化、截图和表单交互", en: "Browser automation via Puppeteer (screenshots, navigation, forms)" },
    npmPackage: "@modelcontextprotocol/server-puppeteer",
    category: "browser",
    official: true,
  },
  {
    id: "mcp-playwright",
    name: { zh: "Playwright 浏览器", en: "Playwright" },
    description: { zh: "Microsoft 官方 Playwright 浏览器自动化和端到端测试", en: "Official Microsoft Playwright for browser automation and E2E testing" },
    npmPackage: "@playwright/mcp",
    category: "browser",
    official: true,
  },
  {
    id: "mcp-fetch",
    name: { zh: "网页抓取", en: "Web Fetch" },
    description: { zh: "获取网页内容并转换为 Markdown，适合 LLM 消费", en: "Fetch web content and convert to Markdown for LLM consumption" },
    npmPackage: "@modelcontextprotocol/server-fetch",
    category: "browser",
    official: true,
  },
  {
    id: "mcp-brave-search",
    name: { zh: "Brave 搜索", en: "Brave Search" },
    description: { zh: "调用 Brave Search API 进行网页和本地搜索", en: "Web and local search via Brave Search API" },
    npmPackage: "@modelcontextprotocol/server-brave-search",
    category: "browser",
    official: true,
  },

  // ── AI Enhanced ──
  {
    id: "mcp-memory",
    name: { zh: "知识图谱记忆", en: "Memory" },
    description: { zh: "基于知识图谱的持久记忆系统，实体关系存储和检索", en: "Knowledge graph-based persistent memory with entity-relation storage" },
    npmPackage: "@modelcontextprotocol/server-memory",
    category: "ai",
    official: true,
  },
  {
    id: "mcp-sequentialthinking",
    name: { zh: "链式思考", en: "Sequential Thinking" },
    description: { zh: "动态思维链推理，支持修正、分支和回溯", en: "Dynamic chain-of-thought reasoning with revision and branching" },
    npmPackage: "@modelcontextprotocol/server-sequentialthinking",
    category: "ai",
    official: true,
  },

  // ── Cloud & SaaS ──
  {
    id: "mcp-google-drive",
    name: { zh: "Google Drive", en: "Google Drive" },
    description: { zh: "搜索和读取 Google Drive 文件", en: "Search and read Google Drive files" },
    npmPackage: "@modelcontextprotocol/server-google-drive",
    category: "cloud",
    official: true,
  },
  {
    id: "mcp-google-maps",
    name: { zh: "Google Maps", en: "Google Maps" },
    description: { zh: "地理编码、路线规划、地点搜索", en: "Geocoding, directions, and place search" },
    npmPackage: "@modelcontextprotocol/server-google-maps",
    category: "cloud",
    official: true,
  },
  {
    id: "mcp-slack",
    name: { zh: "Slack", en: "Slack" },
    description: { zh: "通过 MCP 发送消息、管理频道和搜索 Slack 内容", en: "Send messages, manage channels, and search Slack content via MCP" },
    npmPackage: "@modelcontextprotocol/server-slack",
    category: "cloud",
    official: true,
  },

  // ── Utilities ──
  {
    id: "mcp-time",
    name: { zh: "时间时区", en: "Time & Timezone" },
    description: { zh: "获取当前时间和时区转换", en: "Get current time and timezone conversion" },
    npmPackage: "@modelcontextprotocol/server-time",
    category: "utility",
    official: true,
  },
  {
    id: "mcp-everart",
    name: { zh: "Everart 图片", en: "Everart" },
    description: { zh: "AI 图片生成", en: "AI image generation via Everart API" },
    npmPackage: "@modelcontextprotocol/server-everart",
    category: "utility",
    official: true,
  },
]
