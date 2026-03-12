import { computed } from "vue";
import { useI18n } from "vue-i18n";
import type { WizardStep } from "@renderer/stores/wizard";

/**
 * Client-side localization for server wizard steps.
 *
 * The server sends step content in English with developer-oriented language.
 * This composable matches steps by title/message and returns user-friendly
 * localized overrides including option labels.
 */

type OptionOverride = { value: unknown; label: string; hint?: string };

type StepOverride = {
  title?: string;
  message?: string;
  options?: OptionOverride[];
};

type StepMatcher = {
  match: (step: WizardStep) => boolean;
  override: (locale: string, step: WizardStep) => StepOverride;
};

/** Helper: merge server options with localized labels (match by value). */
function localizeOptions(
  serverOptions: WizardStep["options"],
  localized: Record<string, { label: string; hint?: string }>,
): OptionOverride[] | undefined {
  if (!serverOptions) {return undefined;}
  return serverOptions.map((opt) => {
    const key = String(opt.value);
    const loc = localized[key];
    return loc
      ? { value: opt.value, label: loc.label, hint: loc.hint ?? opt.hint }
      : { ...opt };
  });
}

const matchers: StepMatcher[] = [
  // ── Security warning note ──
  {
    match: (step) =>
      step.type === "note" &&
      step.title === "Security" &&
      (step.message?.includes("Security warning") ?? false),
    override: (locale) =>
      locale.startsWith("zh")
        ? {
            title: "安全须知",
            message: [
              "**请仔细阅读以下内容。**",
              "",
              "OpenClaw 是一个 AI 助手管理工具，目前仍处于测试阶段。",
              "",
              "**您需要了解的重要事项：**",
              "",
              "- OpenClaw 默认是**个人使用**模式 — 一个用户管理自己的 AI 助手",
              "- 如果开启了工具功能，AI 助手可以读取文件和执行操作",
              "- 恶意的提示词（prompt）可能诱导 AI 做出不安全的行为",
              "- 如果多人共用同一个 AI 助手，他们会共享该助手的操作权限",
              "",
              "**安全建议：**",
              "",
              "- 设置访问白名单，限制谁可以与 AI 助手对话",
              "- 多人使用时，为每个人创建独立的 AI 助手",
              "- 启用沙箱模式，限制 AI 助手的操作权限",
              "- 不要将密码等敏感信息保存在 AI 可以访问的文件中",
              "- 定期运行安全检查：`openclaw security audit --deep`",
              "",
              "详细文档：https://docs.openclaw.ai/gateway/security",
            ].join("\n"),
          }
        : {
            title: "Safety Notice",
            message: [
              "**Please read the following carefully.**",
              "",
              "OpenClaw is an AI assistant management tool, currently in beta.",
              "",
              "**Important things to know:**",
              "",
              "- OpenClaw is designed for **personal use** by default — one user managing their own AI assistant",
              "- If tools are enabled, the AI assistant can read files and perform actions on your computer",
              "- A malicious prompt could trick the AI into doing unsafe things",
              "- If multiple people share one AI assistant, they share its action permissions",
              "",
              "**Safety recommendations:**",
              "",
              "- Set up access controls to limit who can talk to your AI assistant",
              "- For multiple users, create separate AI assistants for each person",
              "- Enable sandbox mode to limit what the AI can do",
              "- Don't store passwords or secrets in files the AI can access",
              "- Run security checks regularly: `openclaw security audit --deep`",
              "",
              "Documentation: https://docs.openclaw.ai/gateway/security",
            ].join("\n"),
          },
  },

  // ── Security acknowledgement confirm ──
  {
    match: (step) =>
      step.type === "confirm" &&
      (step.message?.includes("personal-by-default") ?? false),
    override: (locale) =>
      locale.startsWith("zh")
        ? { message: "我已阅读并理解上述安全须知，确认继续？" }
        : { message: "I have read and understand the safety notice above. Continue?" },
  },

  // ── Onboarding intro ──
  {
    match: (step) =>
      step.type === "note" && step.title === "OpenClaw onboarding",
    override: (locale) =>
      locale.startsWith("zh")
        ? { title: "OpenClaw 初始设置", message: "欢迎使用 OpenClaw！接下来将引导您完成基本配置。" }
        : { title: "OpenClaw Setup", message: "Welcome to OpenClaw! We'll guide you through the basic setup." },
  },

  // ── Onboarding mode select ──
  {
    match: (step) =>
      step.type === "select" && step.message === "Onboarding mode",
    override: (locale, step) =>
      locale.startsWith("zh")
        ? {
            message: "设置模式",
            options: localizeOptions(step.options, {
              quickstart: { label: "快速设置", hint: "稍后可通过 openclaw configure 调整详细配置" },
              advanced: { label: "手动配置", hint: "配置端口、网络、Tailscale 和认证选项" },
            }),
          }
        : {},
  },

  // ── Config handling select ──
  {
    match: (step) =>
      step.type === "select" && step.message === "Config handling",
    override: (locale, step) =>
      locale.startsWith("zh")
        ? {
            message: "配置处理方式",
            options: localizeOptions(step.options, {
              keep: { label: "使用现有配置" },
              modify: { label: "更新配置" },
              reset: { label: "重置" },
            }),
          }
        : {},
  },

  // ── Reset scope select ──
  {
    match: (step) =>
      step.type === "select" && step.message === "Reset scope",
    override: (locale, step) =>
      locale.startsWith("zh")
        ? {
            message: "重置范围",
            options: localizeOptions(step.options, {
              config: { label: "仅重置配置" },
              "config+creds+sessions": { label: "配置 + 凭证 + 会话" },
              full: { label: "完全重置（配置 + 凭证 + 会话 + 工作空间）" },
            }),
          }
        : {},
  },

  // ── Existing config note ──
  {
    match: (step) =>
      step.type === "note" && step.title === "Existing config detected",
    override: (locale) =>
      locale.startsWith("zh") ? { title: "检测到已有配置" } : {},
  },

  // ── Invalid config note ──
  {
    match: (step) =>
      step.type === "note" && step.title === "Invalid config",
    override: (locale) =>
      locale.startsWith("zh") ? { title: "配置无效" } : {},
  },

  // ── What do you want to set up? ──
  {
    match: (step) =>
      step.type === "select" &&
      (step.message?.includes("What do you want to set up") ?? false),
    override: (locale, step) =>
      locale.startsWith("zh")
        ? {
            message: "您要设置什么？",
            options: localizeOptions(step.options, {
              local: { label: "本地网关（本机）" },
              remote: { label: "远程网关（仅配置信息）" },
            }),
          }
        : {},
  },

  // ── Enter API key / token (generic) ──
  {
    match: (step) =>
      step.type === "text" &&
      (step.message?.startsWith("Enter ") ?? false) &&
      (step.message?.includes("API key") || step.message?.includes("token")),
    override: (locale, step) => {
      if (!locale.startsWith("zh")) {return {};}
      // "Enter OpenAI API key" → "请输入 OpenAI API Key"
      const msg = step.message ?? "";
      const name = msg
        .replace(/^Enter\s+/, "")
        .replace(/\s*API key.*$/i, "")
        .replace(/\s*token.*$/i, "")
        .trim();
      if (msg.toLowerCase().includes("api key")) {
        return { message: `请输入 ${name} API Key` };
      }
      return { message: `请输入 ${name} 令牌` };
    },
  },

  // ── API Base URL text ──
  {
    match: (step) =>
      step.type === "text" && step.message === "API Base URL",
    override: (locale) =>
      locale.startsWith("zh")
        ? { message: "API 端点地址", title: "API 端点地址" }
        : {},
  },

  // ── API Key (leave blank) text ──
  {
    match: (step) =>
      step.type === "text" &&
      (step.message?.includes("API Key (leave blank") ?? false),
    override: (locale) =>
      locale.startsWith("zh")
        ? { message: "API Key（如不需要可留空）" }
        : {},
  },

  // ── Custom model ID text ──
  {
    match: (step) =>
      step.type === "text" &&
      (step.message?.includes("Model ID") || step.message?.includes("model")) &&
      step.type === "text",
    override: (locale) =>
      locale.startsWith("zh") ? { message: "模型 ID" } : {},
  },

  // ── Endpoint compatibility select ──
  {
    match: (step) =>
      step.type === "select" && step.message === "Endpoint compatibility",
    override: (locale, step) =>
      locale.startsWith("zh")
        ? {
            message: "端点兼容类型",
            options: localizeOptions(step.options, {
              openai: { label: "OpenAI 兼容", hint: "使用 /chat/completions" },
              anthropic: { label: "Anthropic 兼容", hint: "使用 /messages" },
              unknown: { label: "自动检测", hint: "依次尝试 OpenAI 和 Anthropic 端点" },
            }),
          }
        : {},
  },

  // ── Workspace directory text ──
  {
    match: (step) =>
      step.type === "text" && step.message === "Workspace directory",
    override: (locale) =>
      locale.startsWith("zh") ? { message: "工作空间目录" } : {},
  },

  // ── Gateway port text ──
  {
    match: (step) =>
      step.type === "text" && step.message === "Gateway port",
    override: (locale) =>
      locale.startsWith("zh") ? { message: "网关端口" } : {},
  },

  // ── Gateway bind select ──
  {
    match: (step) =>
      step.type === "select" && step.message === "Gateway bind",
    override: (locale, step) =>
      locale.startsWith("zh")
        ? {
            message: "网关绑定地址",
            options: localizeOptions(step.options, {
              loopback: { label: "本地回环 (127.0.0.1)", hint: "仅本机可访问" },
              lan: { label: "局域网 (0.0.0.0)", hint: "局域网内其他设备可访问" },
              tailnet: { label: "Tailnet (Tailscale IP)" },
              auto: { label: "自动" },
              custom: { label: "自定义 IP" },
            }),
          }
        : {},
  },

  // ── Custom IP text ──
  {
    match: (step) =>
      step.type === "text" && step.message === "Custom IP address",
    override: (locale) =>
      locale.startsWith("zh") ? { message: "自定义 IP 地址" } : {},
  },

  // ── Gateway auth select ──
  {
    match: (step) =>
      step.type === "select" && step.message === "Gateway auth",
    override: (locale, step) =>
      locale.startsWith("zh")
        ? {
            message: "网关认证方式",
            options: localizeOptions(step.options, {
              token: { label: "令牌认证（默认）" },
              password: { label: "密码认证" },
            }),
          }
        : {},
  },

  // ── Tailscale exposure select ──
  {
    match: (step) =>
      step.type === "select" && step.message === "Tailscale exposure",
    override: (locale, step) =>
      locale.startsWith("zh")
        ? {
            message: "Tailscale 暴露方式",
            options: localizeOptions(step.options, {
              off: { label: "关闭" },
              serve: { label: "Serve" },
              funnel: { label: "Funnel（公网可访问）" },
            }),
          }
        : {},
  },

  // ── Tailscale reset confirm ──
  {
    match: (step) =>
      step.type === "confirm" &&
      (step.message?.includes("Tailscale serve/funnel") ?? false),
    override: (locale) =>
      locale.startsWith("zh")
        ? { message: "退出时重置 Tailscale serve/funnel？" }
        : {},
  },

  // ── Auth choice (grouped provider select) ──
  {
    match: (step) =>
      step.type === "select" &&
      step.message === "Model/auth provider",
    override: (locale, step) =>
      locale.startsWith("zh")
        ? {
            message: "选择 AI 模型供应商",
            options: localizeOptions(step.options, {
              openai: { label: "OpenAI", hint: "官方 API Key（api.openai.com）" },
              anthropic: { label: "Anthropic (Claude)", hint: "Setup Token + API Key" },
              chutes: { label: "Chutes", hint: "OAuth 认证" },
              vllm: { label: "vLLM", hint: "本地/自托管 OpenAI 兼容服务" },
              minimax: { label: "MiniMax（稀宇科技）", hint: "M2.5（推荐）" },
              moonshot: { label: "Moonshot AI（月之暗面 / Kimi）", hint: "Kimi K2.5 + Kimi Coding" },
              google: { label: "Google (Gemini)", hint: "Gemini API Key + OAuth" },
              xai: { label: "xAI (Grok)", hint: "API Key" },
              mistral: { label: "Mistral AI", hint: "API Key" },
              volcengine: { label: "Volcano Engine（火山引擎）", hint: "API Key" },
              byteplus: { label: "BytePlus（字节跳动）", hint: "API Key" },
              openrouter: { label: "OpenRouter", hint: "API Key" },
              kilocode: { label: "Kilo Gateway", hint: "API Key（OpenRouter 兼容）" },
              qwen: { label: "Qwen（通义千问）", hint: "OAuth 认证" },
              zai: { label: "Z.AI（智谱 AI）", hint: "GLM Coding 方案" },
              qianfan: { label: "Qianfan（百度千帆）", hint: "API Key" },
              copilot: { label: "GitHub Copilot", hint: "GitHub 登录 + 本地代理" },
              "ai-gateway": { label: "Vercel AI Gateway", hint: "API Key" },
              "opencode-zen": { label: "OpenCode Zen", hint: "API Key" },
              xiaomi: { label: "Xiaomi（小米）", hint: "API Key" },
              synthetic: { label: "Synthetic", hint: "Anthropic 兼容（多模型）" },
              together: { label: "Together AI", hint: "API Key" },
              huggingface: { label: "Hugging Face", hint: "推理 API" },
              venice: { label: "Venice AI", hint: "隐私优先（开放模型）" },
              litellm: { label: "LiteLLM", hint: "统一网关（100+ 供应商）" },
              "cloudflare-ai-gateway": { label: "Cloudflare AI Gateway", hint: "API Key" },
              custom: { label: "自定义 / 第三方代理", hint: "可设置 Base URL，支持 OpenAI / Anthropic 兼容端点（如优刻得、Azure 代理等）" },
              skip: { label: "跳过（稍后配置）" },
            }),
          }
        : {},
  },

  // ── Auth method sub-select ──
  {
    match: (step) =>
      step.type === "select" &&
      (step.message?.endsWith("auth method") ?? false),
    override: (locale, step) =>
      locale.startsWith("zh")
        ? {
            message: step.message!.replace("auth method", "认证方式"),
            options: localizeOptions(step.options, {
              __back: { label: "返回" },
            }),
          }
        : {},
  },

  // ── Model/auth choice note ──
  {
    match: (step) =>
      step.type === "note" && step.title === "Model/auth choice",
    override: (locale) =>
      locale.startsWith("zh") ? { title: "模型/认证选择" } : {},
  },

  // ── Model configured note ──
  {
    match: (step) =>
      step.type === "note" &&
      (step.title === "Model configured" || (step.message?.includes("Default model set to") ?? false)),
    override: (locale, step) => {
      if (!locale.startsWith("zh")) {return {};}
      const msg = step.message ?? "";
      const modelMatch = msg.match(/Default model set to\s+(.+)/);
      const model = modelMatch?.[1] ?? "";
      return {
        title: "模型已配置",
        message: model ? `默认模型已设置为 ${model}` : "模型配置完成",
      };
    },
  },

  // ── Default model select ──
  {
    match: (step) =>
      step.type === "select" &&
      (step.message?.includes("Default model") || step.message?.includes("model")) &&
      step.options?.some((o) => String(o.value).includes("claude") || String(o.value).includes("gpt") || String(o.label).startsWith("Keep current")) === true,
    override: (locale, step) => {
      if (!locale.startsWith("zh")) {return {};}
      // Localize option labels
      const options = step.options
        ?.filter((opt) => !(String(opt.label).toLowerCase().includes("enter") && String(opt.label).toLowerCase().includes("manual")))
        .map((opt) => {
          const label = String(opt.label);
          if (label.startsWith("Keep current")) {
            const model = label.match(/\((.+)\)/)?.[1] ?? "";
            return { ...opt, label: model ? `保持当前模型 (${model})` : "保持当前模型" };
          }
          return opt;
        });
      return { message: "选择默认模型", options };
    },
  },

  // ── Install Gateway service confirm ──
  {
    match: (step) =>
      step.type === "confirm" &&
      (step.message?.includes("Install Gateway service") ?? false),
    override: (locale) =>
      locale.startsWith("zh")
        ? { message: "安装网关服务（推荐）" }
        : {},
  },

  // ── Gateway service runtime select ──
  {
    match: (step) =>
      step.type === "select" && step.message === "Gateway service runtime",
    override: (locale) =>
      locale.startsWith("zh") ? { message: "网关服务运行时" } : {},
  },

  // ── Gateway service already installed ──
  {
    match: (step) =>
      step.type === "select" &&
      step.message === "Gateway service already installed",
    override: (locale, step) =>
      locale.startsWith("zh")
        ? {
            message: "网关服务已安装",
            options: localizeOptions(step.options, {
              restart: { label: "重启" },
              reinstall: { label: "重新安装" },
              skip: { label: "跳过" },
            }),
          }
        : {},
  },

  // ── Optional apps note ──
  {
    match: (step) =>
      step.type === "note" && step.title === "Optional apps",
    override: (locale) =>
      locale.startsWith("zh")
        ? {
            title: "可选应用",
            message: [
              "安装以下应用可获得更多功能：",
              "- macOS 应用（系统集成 + 通知）",
              "- iOS 应用（相机/画布）",
              "- Android 应用（相机/画布）",
            ].join("\n"),
          }
        : {},
  },

  // ── Control UI note ──
  {
    match: (step) =>
      step.type === "note" && step.title === "Control UI",
    override: (locale) =>
      locale.startsWith("zh") ? { title: "控制面板" } : {},
  },

  // ── Token info note ──
  {
    match: (step) =>
      step.type === "note" && step.title === "Token",
    override: (locale) =>
      locale.startsWith("zh")
        ? {
            title: "访问令牌",
            message: [
              "网关令牌：用于网关和控制面板的共享认证。",
              "存储位置：~/.openclaw/openclaw.json (gateway.auth.token) 或环境变量 OPENCLAW_GATEWAY_TOKEN",
              "查看令牌：`openclaw config get gateway.auth.token`",
              "生成令牌：`openclaw doctor --generate-gateway-token`",
              "控制面板会在当前标签页内存中保存令牌，加载后自动从 URL 中移除。",
              "随时打开面板：`openclaw dashboard --no-open`",
            ].join("\n"),
          }
        : {},
  },

  // ── Start TUI note ──
  {
    match: (step) =>
      step.type === "note" &&
      (step.title?.includes("TUI") ?? false),
    override: (locale) =>
      locale.startsWith("zh")
        ? {
            title: "启动终端界面（推荐）",
            message: [
              "这是定义你的 AI 助手个性的关键步骤。",
              "请花点时间好好配置。",
              "你告诉它越多，体验就越好。",
              '我们会发送："Wake up, my friend!"',
            ].join("\n"),
          }
        : {},
  },

  // ── Hatch bot select ──
  {
    match: (step) =>
      step.type === "select" &&
      (step.message?.includes("hatch your bot") ?? false),
    override: (locale, step) =>
      locale.startsWith("zh")
        ? {
            message: "如何启动您的 AI 助手？",
            options: localizeOptions(step.options, {
              tui: { label: "在终端中启动（推荐）" },
              web: { label: "打开网页控制面板" },
              later: { label: "稍后再说" },
            }),
          }
        : {},
  },

  // ── Dashboard ready note ──
  {
    match: (step) =>
      step.type === "note" && step.title === "Dashboard ready",
    override: (locale) =>
      locale.startsWith("zh") ? { title: "面板已就绪" } : {},
  },

  // ── Workspace backup note ──
  {
    match: (step) =>
      step.type === "note" && step.title === "Workspace backup",
    override: (locale) =>
      locale.startsWith("zh")
        ? {
            title: "工作空间备份",
            message: [
              "建议定期备份您的工作空间。",
              "文档：https://docs.openclaw.ai/concepts/agent-workspace",
            ].join("\n"),
          }
        : {},
  },

  // ── Final security reminder ──
  {
    match: (step) =>
      step.type === "note" &&
      step.title === "Security" &&
      (step.message?.includes("harden your setup") ?? false),
    override: (locale) =>
      locale.startsWith("zh")
        ? {
            title: "安全提醒",
            message:
              "在您的电脑上运行 AI 助手存在一定风险，请加固您的安全设置：https://docs.openclaw.ai/security",
          }
        : {},
  },

  // ── What now note ──
  {
    match: (step) =>
      step.type === "note" && step.title === "What now",
    override: (locale) =>
      locale.startsWith("zh")
        ? {
            title: "接下来",
            message: "看看别人在用 OpenClaw 做什么：https://openclaw.ai/showcase",
          }
        : {},
  },

  // ── QuickStart note ──
  {
    match: (step) =>
      step.type === "note" && step.title === "QuickStart",
    override: (locale) =>
      locale.startsWith("zh") ? { title: "快速设置" } : {},
  },

  // ── Gateway service note ──
  {
    match: (step) =>
      step.type === "note" && step.title === "Gateway service",
    override: (locale) =>
      locale.startsWith("zh") ? { title: "网关服务" } : {},
  },

  // ── Gateway service runtime note ──
  {
    match: (step) =>
      step.type === "note" && step.title === "Gateway service runtime",
    override: (locale) =>
      locale.startsWith("zh") ? { title: "网关服务运行时" } : {},
  },

  // ── Gateway auth note ──
  {
    match: (step) =>
      step.type === "note" && step.title === "Gateway auth",
    override: (locale) =>
      locale.startsWith("zh") ? { title: "网关认证" } : {},
  },

  // ── Health check help note ──
  {
    match: (step) =>
      step.type === "note" && step.title === "Health check help",
    override: (locale) =>
      locale.startsWith("zh") ? { title: "健康检查帮助" } : {},
  },

  // ── Systemd note ──
  {
    match: (step) =>
      step.type === "note" && step.title === "Systemd",
    override: (locale) =>
      locale.startsWith("zh") ? { title: "系统服务" } : {},
  },

  // ── Web search note ──
  {
    match: (step) =>
      step.type === "note" && step.title === "Web search",
    override: (locale) =>
      locale.startsWith("zh") ? { title: "网络搜索" } : {},
  },

  // ── Later note ──
  {
    match: (step) =>
      step.type === "note" && step.title === "Later",
    override: (locale) =>
      locale.startsWith("zh") ? { title: "稍后" } : {},
  },

  // ── Channels note ──
  {
    match: (step) =>
      step.type === "note" && step.title === "Channels",
    override: (locale) =>
      locale.startsWith("zh") ? { title: "渠道" } : {},
  },

  // ── Channel status note (localize status phrases) ──
  {
    match: (step) =>
      step.type === "note" && step.title === "Channel status",
    override: (locale, step) => {
      if (!locale.startsWith("zh")) {return {};}
      const msg = (step.message ?? "")
        .replace(/needs token/g, "需要令牌")
        .replace(/needs tokens/g, "需要令牌")
        .replace(/needs setup/g, "需要设置")
        .replace(/not linked/g, "未连接")
        .replace(/not configured/g, "未配置")
        .replace(/install plugin to enable/g, "安装插件以启用")
        .replace(/missing \(([^)]+)\)/g, "缺少 ($1)")
        .replace(/\(default\)/g, "(默认)");
      return { title: "渠道状态", message: msg };
    },
  },

  // ── Configure chat channels confirm ──
  {
    match: (step) =>
      step.type === "confirm" &&
      (step.message?.includes("Configure chat channels") ?? false),
    override: (locale) =>
      locale.startsWith("zh")
        ? { message: "现在配置聊天渠道？" }
        : {},
  },

  // ── Select channel (QuickStart) ──
  {
    match: (step) =>
      step.type === "select" &&
      (step.message?.includes("Select channel") || step.message?.includes("Select a channel")),
    override: (locale, step) => {
      if (!locale.startsWith("zh")) {return {};}
      // Region classification for channels
      const DOMESTIC_CHANNELS = new Set([
        "feishu", "dingtalk", "wechat", "wecom",
        "zalo", "zalouser", "line",
      ]);
      // Chinese display names for ALL channels
      const CHANNEL_ZH_NAMES: Record<string, string> = {
        // 国内渠道
        feishu: "飞书",
        dingtalk: "钉钉",
        wechat: "微信",
        wecom: "企业微信",
        zalo: "Zalo（越南）",
        zalouser: "Zalo 个人（越南）",
        line: "LINE（日韩东南亚）",
        // 国际渠道
        telegram: "Telegram",
        whatsapp: "WhatsApp",
        discord: "Discord",
        slack: "Slack",
        signal: "Signal",
        imessage: "iMessage",
        irc: "IRC",
        googlechat: "Google Chat",
        msteams: "Microsoft Teams",
        matrix: "Matrix",
        mattermost: "Mattermost",
        twitch: "Twitch",
        bluebubbles: "BlueBubbles（iMessage 桥接）",
        nostr: "Nostr",
        "synology-chat": "Synology Chat（群晖）",
        "nextcloud-talk": "Nextcloud Talk",
        tlon: "Tlon",
      };
      const domesticOpts: typeof step.options = [];
      const intlOpts: typeof step.options = [];
      const controlOpts: typeof step.options = [];
      for (const opt of step.options ?? []) {
        const val = String(opt.value);
        if (val === "__skip__" || val === "__done__" || val === "skip") {
          controlOpts.push({
            ...opt,
            label: opt.label === "Skip for now" ? "跳过（稍后配置）" : opt.label === "Finished" ? "完成" : opt.label,
          });
        } else if (DOMESTIC_CHANNELS.has(val)) {
          domesticOpts.push({
            ...opt,
            label: CHANNEL_ZH_NAMES[val] ?? opt.label,
            hint: opt.hint ? String(opt.hint) : undefined,
          });
        } else {
          intlOpts.push({
            ...opt,
            label: CHANNEL_ZH_NAMES[val] ?? opt.label,
            hint: opt.hint ? String(opt.hint) : undefined,
          });
        }
      }
      // Combine: domestic first with separator hints, then international, then control
      const options = [
        ...domesticOpts.map((o, i) => i === 0 ? { ...o, hint: `国内 · ${o.hint ?? ""}`.replace(/ · $/, "") } : o),
        ...intlOpts.map((o, i) => i === 0 ? { ...o, hint: `国际 · ${o.hint ?? ""}`.replace(/ · $/, "") } : o),
        ...controlOpts,
      ];
      return { message: "选择要配置的渠道", options };
    },
  },

  // ── Channel already configured ──
  {
    match: (step) =>
      step.type === "select" &&
      (step.message?.includes("already configured") ?? false),
    override: (locale, step) => {
      if (!locale.startsWith("zh")) {return {};}
      const name = step.message?.replace(/ already configured.*/, "") ?? "";
      const options = localizeOptions(step.options, {
        update: { label: "修改设置" },
        disable: { label: "停用（保留配置）" },
        delete: { label: "删除配置" },
        skip: { label: "跳过" },
      });
      return { message: `${name} 已配置，您要？`, options };
    },
  },

  // ── Search note ──
  {
    match: (step) =>
      step.type === "note" && step.title === "Search",
    override: (locale) =>
      locale.startsWith("zh") ? { title: "搜索" } : {},
  },

  // ── Skills note ──
  {
    match: (step) =>
      step.type === "note" && step.title === "Skills",
    override: (locale) =>
      locale.startsWith("zh") ? { title: "技能" } : {},
  },

  // ── Skills status note ──
  {
    match: (step) =>
      step.type === "note" && step.title === "Skills status",
    override: (locale, step) => {
      if (!locale.startsWith("zh")) {return {};}
      const msg = (step.message ?? "")
        .replace(/Eligible:/g, "可用:")
        .replace(/Missing requirements:/g, "缺少依赖:")
        .replace(/Unsupported on this OS:/g, "当前系统不支持:")
        .replace(/Blocked by allowlist:/g, "被白名单限制:");
      return { title: "技能状态", message: msg };
    },
  },

  // ── Configure skills confirm ──
  {
    match: (step) =>
      step.type === "confirm" &&
      (step.message?.includes("Configure skills") ?? false),
    override: (locale) =>
      locale.startsWith("zh")
        ? { message: "现在配置技能？（推荐）" }
        : {},
  },

  // ── Install skill dependencies multiselect ──
  {
    match: (step) =>
      step.type === "multiselect" &&
      (step.message?.includes("skill dependencies") ?? false),
    override: (locale, step) => {
      if (!locale.startsWith("zh")) {return {};}
      const options = step.options?.map((opt) => {
        const label = String(opt.label);
        if (label === "Skip for now") {
          return { ...opt, label: "跳过（稍后安装）", hint: "跳过依赖安装，继续设置" };
        }
        // Replace npm/brew/package manager references in hints with user-friendly text
        const hint = opt.hint
          ? String(opt.hint)
              .replace(/\bnpm install\b/gi, "下载")
              .replace(/\bbrew install\b/gi, "下载")
              .replace(/\bpnpm install\b/gi, "下载")
              .replace(/\bbun install\b/gi, "下载")
              .replace(/\bpip install\b/gi, "下载")
              .replace(/\bvia (npm|brew|pnpm|bun|pip|Homebrew)\b/gi, "（自动下载）")
              .replace(/\b(npm|Homebrew)\s+package\b/gi, "软件包")
          : undefined;
        return { ...opt, ...(hint ? { hint } : {}) };
      });
      return { message: "下载缺少的技能依赖", options };
    },
  },

  // ── Set skill API key confirm ──
  {
    match: (step) =>
      step.type === "confirm" &&
      (step.message?.startsWith("Set ") ?? false) &&
      (step.message?.includes(" for ") ?? false),
    override: (locale, step) => {
      if (!locale.startsWith("zh")) {return {};}
      const msg = step.message ?? "";
      const envMatch = msg.match(/Set (\S+) for (.+)\?/);
      if (envMatch) {
        return { message: `设置 ${envMatch[1]}（用于 ${envMatch[2]}）？` };
      }
      return {};
    },
  },

  // ── Feishu credentials note ──
  {
    match: (step) =>
      step.type === "note" && step.title === "Feishu credentials",
    override: (locale) =>
      locale.startsWith("zh")
        ? {
            title: "飞书应用配置",
            message: [
              "**1) 登录飞书开放平台**",
              "使用手机号或邮箱登录 [open.feishu.cn](https://open.feishu.cn)，进入开发者后台",
              "",
              "**2) 创建企业自建应用**",
              "在「我的应用」中点击「创建应用」→ 选择「企业自建应用」",
              "",
              "**3) 开启机器人能力**",
              "进入应用 →「添加应用能力」→ 添加「机器人」（Bot），这是收发消息的必要前提",
              "",
              "**4) 复制凭证信息**",
              "进入「凭证与基础信息」页面 → 复制 **App ID** 和 **App Secret**",
              "",
              "**5) 开通权限**",
              "进入「权限管理」，搜索并开通以下权限：",
              "- **接收消息 (im:message)** — 接收和发送消息",
              "- **读取群信息 (im:chat)** — 获取群组列表和信息",
              "- **获取用户基本信息 (contact:user.base:readonly)** — 识别发送者身份",
              "",
              "如需更多功能（如文档、云盘、知识库），可稍后在权限管理中按需开通。",
              "",
              "**6) 创建版本并发布（⚠️ 必须）**",
              "上述能力和权限的变更，**必须创建新版本并发布后才会生效**。",
              "点击「版本管理与发布」→「创建版本」→ 填写更新说明 → 提交发布。",
              "如暂不发布，可先在「测试企业和人员」中添加测试用户进行调试。",
              "",
              "文档：https://docs.openclaw.ai/channels/feishu",
            ].join("\n"),
          }
        : {},
  },

  // ── Feishu connection test note ──
  {
    match: (step) =>
      step.type === "note" && step.title === "Feishu connection test",
    override: (locale, step) => {
      if (!locale.startsWith("zh")) {return {};}
      const msg = (step.message ?? "")
        .replace(/^Connected as/, "已连接为")
        .replace(/^Connection failed:/, "连接失败：")
        .replace(/^Connection test failed:/, "连接测试失败：");
      return { title: "飞书连接测试", message: msg };
    },
  },

  // ── Feishu App ID text ──
  {
    match: (step) =>
      step.type === "text" &&
      (step.message?.includes("Feishu App ID") ?? false),
    override: (locale) =>
      locale.startsWith("zh") ? { message: "请输入飞书 App ID" } : {},
  },

  // ── Feishu App Secret text (combined page: Secret + App ID) ──
  {
    match: (step) =>
      step.type === "text" &&
      (step.message?.includes("Feishu App Secret") ?? false),
    override: (locale) =>
      locale.startsWith("zh") ? { message: "请输入飞书应用凭证" } : {},
  },

  // ── Feishu connection mode select ──
  {
    match: (step) =>
      step.type === "select" && step.message === "Feishu connection mode",
    override: (locale, step) =>
      locale.startsWith("zh")
        ? {
            message: "飞书连接方式",
            options: localizeOptions(step.options, {
              websocket: { label: "WebSocket（默认）" },
              webhook: { label: "Webhook" },
            }),
          }
        : {},
  },

  // ── Feishu domain select ──
  {
    match: (step) =>
      step.type === "select" &&
      (step.message?.includes("Feishu domain") || step.message?.includes("Which Feishu")),
    override: (locale, step) =>
      locale.startsWith("zh")
        ? {
            message: "选择飞书版本",
            options: localizeOptions(step.options, {
              feishu: { label: "飞书 (feishu.cn) — 国内版" },
              lark: { label: "Lark (larksuite.com) — 国际版" },
            }),
          }
        : {},
  },

  // ── Group chat policy select ──
  {
    match: (step) =>
      step.type === "select" && step.message === "Group chat policy",
    override: (locale, step) =>
      locale.startsWith("zh")
        ? {
            message: "机器人要不要回复群聊消息？",
            options: localizeOptions(step.options, {
              allowlist: { label: "只回复指定的群", hint: "需要设置允许的群" },
              open: { label: "所有群都回复", hint: "群里 @机器人 时会回复" },
              disabled: { label: "不回复群消息", hint: "只处理私聊，推荐先选这个" },
            }),
          }
        : {},
  },

  // ── Group chat allowlist text ──
  {
    match: (step) =>
      step.type === "text" &&
      (step.message?.includes("Group chat allowlist") ?? false),
    override: (locale) =>
      locale.startsWith("zh") ? { message: "输入允许回复的群 ID（多个用逗号隔开）\n\n获取方式：打开飞书群 → 右上角「···」→「设置」→ 滑到底部「群 ID」即为 chat_id\n留空可跳过，稍后在设置中配置" } : {},
  },

  // ── Feishu verification token text ──
  {
    match: (step) =>
      step.type === "text" &&
      (step.message?.includes("Feishu verification token") ?? false),
    override: (locale) =>
      locale.startsWith("zh") ? { message: "请输入飞书 Verification Token" } : {},
  },

  // ── Feishu webhook path text ──
  {
    match: (step) =>
      step.type === "text" &&
      (step.message?.includes("Feishu webhook path") ?? false),
    override: (locale) =>
      locale.startsWith("zh") ? { message: "飞书 Webhook 路径" } : {},
  },

  // ── Feishu allowlist note ──
  {
    match: (step) =>
      step.type === "note" &&
      (step.title?.includes("Feishu allowlist") ?? false),
    override: (locale, step) => {
      if (!locale.startsWith("zh")) {return {};}
      const msg = (step.message ?? "")
        .replace(/Allowlist Feishu DMs by/g, "通过以下方式设置飞书私聊白名单：")
        .replace(/You can find user open_id/g, "你可以在飞书管理后台或通过 API 找到用户 open_id")
        .replace(/Examples:/g, "示例：")
        .replace(/Enter at least one user/g, "请输入至少一个用户");
      return { title: "飞书白名单", message: msg };
    },
  },

  // ── Feishu allowFrom text ──
  {
    match: (step) =>
      step.type === "text" &&
      (step.message?.includes("Feishu allowFrom") ?? false),
    override: (locale) =>
      locale.startsWith("zh") ? { message: "飞书白名单（用户 open_id）" } : {},
  },

  // ── Generic channel credential notes (Discord, Telegram, Slack, etc.) ──
  {
    match: (step) =>
      step.type === "note" &&
      Boolean(step.title) &&
      /credentials|setup guide/i.test(step.title ?? ""),
    override: (locale, step) => {
      if (!locale.startsWith("zh")) {return {};}
      const title = (step.title ?? "").replace(/credentials/i, "凭证").replace(/setup guide/i, "设置指南");
      const msg = (step.message ?? "")
        .replace(/Go to/g, "前往")
        .replace(/Create a/g, "创建一个")
        .replace(/Get /g, "获取 ")
        .replace(/ from /g, " 从 ")
        .replace(/Enable required permissions/g, "开启必要权限")
        .replace(/Publish the app/g, "发布应用")
        .replace(/add it to a test group/g, "将其添加到测试群组")
        .replace(/Tip: you can also set/g, "提示：也可以通过环境变量设置")
        .replace(/env vars/g, "环境变量")
        .replace(/Docs:/g, "文档：");
      return { title, message: msg };
    },
  },

  // ── Generic "Enter X" text steps for channel onboarding ──
  {
    match: (step) =>
      step.type === "text" &&
      (step.message?.startsWith("Enter ") ?? false) &&
      !(step.message?.includes("API key") ?? false) &&
      !(step.message?.includes("token") ?? false),
    override: (locale, step) => {
      if (!locale.startsWith("zh")) {return {};}
      const msg = step.message ?? "";
      return { message: msg.replace(/^Enter /, "请输入 ") };
    },
  },

  // ── Generic "X already configured. Keep it?" confirm ──
  {
    match: (step) =>
      step.type === "confirm" &&
      (step.message?.includes("already configured") ?? false) &&
      (step.message?.includes("Keep") ?? false),
    override: (locale, step) => {
      if (!locale.startsWith("zh")) {return {};}
      const msg = step.message ?? "";
      const name = msg.replace(/\s*already configured.*/, "");
      return { message: `${name} 已配置，保留当前设置？` };
    },
  },

  // ── Generic "X detected. Use env vars?" confirm ──
  {
    match: (step) =>
      step.type === "confirm" &&
      (step.message?.includes("detected") ?? false) &&
      (step.message?.includes("env") ?? false),
    override: (locale, step) => {
      if (!locale.startsWith("zh")) {return {};}
      const msg = (step.message ?? "")
        .replace(/detected\. Use env vars\?/, "已检测到环境变量，使用环境变量？")
        .replace(/detected\. Use env/, "已检测到，使用环境变量");
      return { message: msg };
    },
  },

  // ── Secret input mode select (in case auto-skip misses) ──
  {
    match: (step) =>
      step.type === "select" &&
      (step.message?.startsWith("How do you want to provide") ?? false),
    override: (locale, step) => {
      if (!locale.startsWith("zh")) {return {};}
      const msg = (step.message ?? "").replace("How do you want to provide this", "如何提供").replace("?", "？");
      const options = step.options?.map((opt) => {
        const label = String(opt.label);
        if (label.includes("Paste") || label.includes("Enter")) {
          return { ...opt, label: "直接输入", hint: "将凭证保存在 OpenClaw 配置中" };
        }
        if (label.includes("external") || label.includes("secret provider")) {
          return { ...opt, label: "使用外部密钥管理", hint: "通过环境变量或外部密钥管理器引用" };
        }
        return opt;
      });
      return { message: msg, options };
    },
  },

  // ── Shell completion confirm ──
  {
    match: (step) =>
      step.type === "confirm" &&
      (step.message?.includes("shell completion") ?? false),
    override: (locale) =>
      locale.startsWith("zh") ? { message: "启用命令行自动补全？" } : {},
  },

  // ── Shell completion note ──
  {
    match: (step) =>
      step.type === "note" && step.title === "Shell completion",
    override: (locale, step) => {
      if (!locale.startsWith("zh")) {return {};}
      const msg = (step.message ?? "")
        .replace(/Shell completion installed/g, "命令行补全已安装")
        .replace(/Shell completion/g, "命令行补全")
        .replace(/Completion cache generation failed/g, "补全缓存生成失败");
      return { title: "命令行补全", message: msg };
    },
  },

  // ── Outro (completion) ──
  {
    match: (step) =>
      step.type === "note" &&
      (step.message?.includes("Onboarding complete") ?? false),
    override: (locale) =>
      locale.startsWith("zh")
        ? {
            title: "设置完成",
            message: "初始设置已完成。使用上方的面板链接来管理 OpenClaw。",
          }
        : {},
  },
];

/**
 * Auto-submit rules for Electron desktop context.
 * Skips developer/CLI-oriented steps that don't apply to the desktop app.
 */
const electronAutoSubmitRules: Array<{
  match: (step: WizardStep) => boolean;
  value: unknown;
}> = [
  // Onboarding intro → already shown in welcome phase
  { match: (s) => s.type === "note" && s.title === "OpenClaw onboarding", value: undefined },
  // Security confirm → auto-accept (user already read the security note)
  { match: (s) => s.type === "confirm" && (s.message?.includes("personal-by-default") ?? false), value: true },
  // Existing config detected → skip (developer config details)
  { match: (s) => s.type === "note" && s.title === "Existing config detected", value: undefined },
  // Config handling → keep existing values
  { match: (s) => s.type === "select" && s.message === "Config handling", value: "keep" },
  // Config issues note → skip
  { match: (s) => s.type === "note" && s.title === "Config issues", value: undefined },
  // Onboarding mode → quickstart (skip advanced gateway config)
  { match: (s) => s.type === "select" && s.message === "Onboarding mode", value: "quickstart" },
  // QuickStart summary → skip (config details not useful for users)
  { match: (s) => s.type === "note" && s.title === "QuickStart", value: undefined },
  // Local vs remote → always local
  { match: (s) => s.type === "select" && (s.message?.includes("What do you want to set up") ?? false), value: "local" },
  // Secret input mode → always paste directly (skip "external secret provider")
  { match: (s) => s.type === "select" && (s.message?.startsWith("How do you want to provide") ?? false), value: "plaintext" },
  // Endpoint compatibility → default to OpenAI (most common)
  { match: (s) => s.type === "select" && s.message === "Endpoint compatibility", value: "openai" },
  // Endpoint detection note → skip
  { match: (s) => s.type === "note" && s.title === "Endpoint detection", value: undefined },
  // Model/auth choice note (no methods available) → skip
  { match: (s) => s.type === "note" && s.title === "Model/auth choice", value: undefined },
  // Model check warnings → skip (developer diagnostics)
  { match: (s) => s.type === "note" && s.title === "Model check", value: undefined },
  // Gateway auth secret resolution warnings → skip
  { match: (s) => s.type === "note" && s.title === "Gateway auth", value: undefined },
  // Gateway install error hints → skip
  { match: (s) => s.type === "note" && s.title === "Gateway", value: undefined },
  // Install Gateway service → no (Electron manages gateway process)
  { match: (s) => s.type === "confirm" && (s.message?.includes("Install Gateway service") ?? false), value: false },
  // Tailscale reset → auto-accept
  { match: (s) => s.type === "confirm" && (s.message?.includes("Tailscale serve/funnel") ?? false), value: true },
  // Systemd note → skip
  { match: (s) => s.type === "note" && s.title === "Systemd", value: undefined },
  // Gateway service notes → skip
  { match: (s) => s.type === "note" && s.title === "Gateway service", value: undefined },
  { match: (s) => s.type === "note" && s.title === "Gateway service runtime", value: undefined },
  // Health check help → skip
  { match: (s) => s.type === "note" && s.title === "Health check help", value: undefined },
  // Optional apps → skip (user is already in the app)
  { match: (s) => s.type === "note" && s.title === "Optional apps", value: undefined },
  // Token note → skip (contains gateway token info, not needed in Electron)
  { match: (s) => s.type === "note" && s.title === "Token", value: undefined },
  // Control UI → skip (user is already in the desktop app)
  { match: (s) => s.type === "note" && s.title === "Control UI", value: undefined },
  // TUI note → skip (not applicable in Electron)
  { match: (s) => s.type === "note" && (s.title?.includes("TUI") ?? false), value: undefined },
  // Hatch bot → skip (user is already in the app)
  { match: (s) => s.type === "select" && (s.message?.includes("hatch your bot") ?? false), value: "later" },
  // Dashboard ready → skip
  { match: (s) => s.type === "note" && s.title === "Dashboard ready", value: undefined },
  // Later note → skip
  { match: (s) => s.type === "note" && s.title === "Later", value: undefined },
  // Workspace backup → skip
  { match: (s) => s.type === "note" && s.title === "Workspace backup", value: undefined },
  // Final security reminder → skip (already shown in the security note)
  { match: (s) => s.type === "note" && s.title === "Security" && (s.message?.includes("harden your setup") ?? false), value: undefined },
  // What now → skip
  { match: (s) => s.type === "note" && s.title === "What now", value: undefined },
  // Model configured note → skip (redundant, model select step follows)
  { match: (s) => s.type === "note" && (s.title === "Model configured" || (s.message?.includes("Default model set to") ?? false)), value: undefined },
  // ── Plugin install prompt → auto-select local if available, else npm (auto-download) ──
  {
    match: (s) =>
      s.type === "select" &&
      (s.message?.includes("plugin?") ?? false) &&
      s.options?.some((o) => String(o.value) === "npm") === true,
    value: "__auto_plugin__",
  },
  // Plugin install error/result notes → skip
  { match: (s) => s.type === "note" && s.title === "Plugin install", value: undefined },

  // ── Channels: skip developer/CLI-only steps, show user-facing ones ──
  { match: (s) => s.type === "note" && s.title === "Channels", value: undefined },
  { match: (s) => s.type === "note" && s.title === "How channels work", value: undefined },
  { match: (s) => s.type === "note" && (s.message?.includes("DM security") ?? false), value: undefined },
  { match: (s) => s.type === "note" && (s.message?.includes("DM access") ?? false), value: undefined },
  { match: (s) => s.type === "confirm" && (s.message?.includes("Configure DM") ?? false), value: false },
  { match: (s) => s.type === "select" && (s.message?.includes("DM policy") ?? false), value: "pairing" },
  { match: (s) => s.type === "note" && (s.message?.includes("does not support deleting") ?? false), value: undefined },
  { match: (s) => s.type === "note" && s.title === "Remove channel", value: undefined },
  { match: (s) => s.type === "confirm" && (s.message?.includes("Delete") ?? false) && (s.message?.includes("account") ?? false), value: false },
  // Channel/plugin error notes → skip
  { match: (s) => s.type === "note" && (s.message?.includes("plugin not available") ?? false), value: undefined },
  { match: (s) => s.type === "note" && (s.message?.includes("does not support onboarding") ?? false), value: undefined },
  { match: (s) => s.type === "note" && s.title === "Channel setup", value: undefined },
  // Channel connection test notes → auto-skip (success silent, failure handled in WizardView)
  { match: (s) => s.type === "note" && (s.title?.includes("connection test") ?? false), value: undefined },
  // Feishu connection mode → default WebSocket
  { match: (s) => s.type === "select" && s.message === "Feishu connection mode", value: "websocket" },
  // Selected channels summary → auto-skip (user already knows what they selected)
  { match: (s) => s.type === "note" && s.title === "Selected channels", value: undefined },

  // ── Skills: skip Homebrew/node-manager, show user-facing ones ──
  { match: (s) => s.type === "note" && s.title === "Homebrew recommended", value: undefined },
  { match: (s) => s.type === "confirm" && (s.message?.includes("Homebrew") ?? false), value: false },
  { match: (s) => s.type === "note" && s.title === "Homebrew install", value: undefined },
  { match: (s) => s.type === "select" && (s.message?.includes("node manager") ?? false), value: "npm" },
  { match: (s) => s.type === "note" && s.title === "Hooks Configured", value: undefined },

  // ── Hooks (auto-skip — configure later in settings) ──
  { match: (s) => s.type === "note" && s.title === "Hooks", value: undefined },
  { match: (s) => s.type === "note" && s.title === "No Hooks Available", value: undefined },
  { match: (s) => s.type === "multiselect" && (s.message?.includes("Enable hooks") ?? false), value: [] },

  // ── Search (auto-skip — configure later in settings) ──
  { match: (s) => s.type === "note" && s.title === "Search", value: undefined },
  { match: (s) => s.type === "note" && s.title === "Web search", value: undefined },
  { match: (s) => s.type === "select" && s.message === "Search provider", value: "skip" },

  // ── Tailscale notes (auto-skip) ──
  { match: (s) => s.type === "note" && s.title === "Tailscale Warning", value: undefined },
  { match: (s) => s.type === "note" && s.title === "Tailscale", value: undefined },
  { match: (s) => s.type === "note" && s.title === "Note", value: undefined },

  // ── Secret ref steps (auto-skip — desktop uses plaintext) ──
  { match: (s) => s.type === "note" && s.title === "Reference validated", value: undefined },
  { match: (s) => s.type === "note" && s.title === "Reference check failed", value: undefined },
  { match: (s) => s.type === "note" && s.title === "No providers configured", value: undefined },
  { match: (s) => s.type === "select" && (s.message?.includes("secret provider") ?? false), value: undefined },
  { match: (s) => s.type === "select" && (s.message?.includes("Where is this") ?? false), value: "env" },

  // ── Model picker "Filter models" (auto-skip) ──
  { match: (s) => s.type === "select" && s.message === "Filter models by provider", value: "*" },
  { match: (s) => s.type === "confirm" && (s.message?.includes("Clear the model allowlist") ?? false), value: true },
  { match: (s) => s.type === "note" && s.title === "vLLM not available", value: undefined },

  // ── Custom provider steps: Endpoint ID / Model alias (auto-skip) ──
  { match: (s) => s.type === "text" && s.message === "Endpoint ID", value: "custom" },
  { match: (s) => s.type === "text" && (s.message?.includes("Model alias") ?? false), value: "" },
  { match: (s) => s.type === "note" && s.title === "Endpoint ID", value: undefined },
  { match: (s) => s.type === "select" && (s.message?.includes("What would you like to change") ?? false), value: "both" },

  // ── Outro (completion) ──
  { match: (s) => s.type === "note" && (s.message?.includes("Onboarding complete") ?? false), value: undefined },

  // ── Shell completion (auto-skip — CLI-specific) ──
  { match: (s) => s.type === "confirm" && (s.message?.includes("shell completion") ?? false), value: false },
  { match: (s) => s.type === "note" && s.title === "Shell completion", value: undefined },

  // ── Remote gateway (auto-skip — Electron manages local) ──
  { match: (s) => s.type === "note" && s.title === "Direct remote", value: undefined },
  { match: (s) => s.type === "note" && s.title === "SSH tunnel", value: undefined },
  { match: (s) => s.type === "note" && s.title === "Discovery", value: undefined },
];

/**
 * Check if a step should be auto-submitted in Electron context.
 */
export function getElectronAutoSubmit(
  step: WizardStep,
): { shouldAuto: true; value: unknown } | { shouldAuto: false } {
  for (const rule of electronAutoSubmitRules) {
    if (rule.match(step)) {
      return { shouldAuto: true, value: rule.value };
    }
  }
  return { shouldAuto: false };
}

/** Mask sensitive content (tokens, keys) in displayed messages. */
export function maskSensitiveContent(text: string): string {
  return (
    text
      // Mask tokens in URLs: #token=abc123... → #token=••••
      .replace(/(#token=)[^\s&"')\\]+/gi, "$1••••••••")
      // Mask long random strings after "token" labels
      .replace(/(token[:\s]+)([a-zA-Z0-9_-]{20,})/gi, "$1••••••••")
  );
}

/**
 * Returns a localized version of the wizard step.
 * Falls back to the original step content if no match found.
 */
export function localizeWizardStep(
  step: WizardStep,
  locale: string,
): WizardStep {
  for (const matcher of matchers) {
    if (matcher.match(step)) {
      const overrides = matcher.override(locale, step);
      return {
        ...step,
        ...(overrides.title !== undefined ? { title: overrides.title } : {}),
        ...(overrides.message !== undefined
          ? { message: overrides.message }
          : {}),
        ...(overrides.options !== undefined
          ? { options: overrides.options }
          : {}),
      };
    }
  }
  return step;
}

/**
 * Composable that returns a computed localized step + auto-submit info.
 */
export function useWizardStepLocale(
  getStep: () => WizardStep | null,
) {
  const { locale } = useI18n();

  const localizedStep = computed(() => {
    const step = getStep();
    if (!step) {return null;}
    return localizeWizardStep(step, locale.value);
  });

  const autoSubmit = computed(() => {
    const step = getStep();
    if (!step) {return null;}
    return getElectronAutoSubmit(step);
  });

  return { localizedStep, autoSubmit };
}
