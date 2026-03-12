import {
  type GatewayEventFrame,
  type GatewayErrorInfo,
  type GatewayHelloOk,
  GatewayRequestError,
} from "./types";
import { gatewayEventBus } from "./event-bus";

export type GatewayClientOptions = {
  url: string;
  token?: string;
  password?: string;
  clientVersion?: string;
  onHello?: (hello: GatewayHelloOk) => void;
  onClose?: (info: { code: number; reason: string; error?: GatewayErrorInfo }) => void;
  onGap?: (info: { expected: number; received: number }) => void;
};

type Pending = {
  resolve: (value: unknown) => void;
  reject: (err: unknown) => void;
};

// Auth errors that won't resolve without user action — skip auto-reconnect.
const NON_RECOVERABLE_CODES = new Set([
  "AUTH_TOKEN_MISSING",
  "AUTH_PASSWORD_MISSING",
  "AUTH_PASSWORD_MISMATCH",
  "AUTH_RATE_LIMITED",
]);

function readDetailCode(details: unknown): string | null {
  if (details && typeof details === "object") {
    const d = details as Record<string, unknown>;
    if (typeof d["code"] === "string") {return d["code"];}
  }
  return null;
}

function isNonRecoverable(error: GatewayErrorInfo | undefined): boolean {
  if (!error) {return false;}
  const code = readDetailCode(error.details) ?? error.code;
  return NON_RECOVERABLE_CODES.has(code);
}

function generateUUID(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/**
 * Electron renderer gateway client.
 *
 * Simplified vs. GatewayBrowserClient: no device-identity/WebCrypto pairing.
 * Auth is token or password only. Uses standard WebSocket (available in
 * Electron renderer). Reconnects with exponential backoff.
 */
export class GatewayElectronClient {
  private ws: WebSocket | null = null;
  private pending = new Map<string, Pending>();
  private closed = false;
  private lastSeq: number | null = null;
  private connectNonce: string | null = null;
  private connectSent = false;
  private connectTimer: ReturnType<typeof setTimeout> | null = null;
  private backoffMs = 800;
  private pendingConnectError: GatewayErrorInfo | undefined;

  constructor(private opts: GatewayClientOptions) {}

  start(): void {
    this.closed = false;
    this.connect();
  }

  stop(): void {
    this.closed = true;
    if (this.connectTimer !== null) {
      clearTimeout(this.connectTimer);
      this.connectTimer = null;
    }
    this.ws?.close();
    this.ws = null;
    this.pendingConnectError = undefined;
    this.flushPending(new Error("gateway client stopped"));
  }

  get connected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  private connect(): void {
    if (this.closed) {return;}
    const wsUrl = this.opts.url;
    console.log("[gateway-client] connecting to", wsUrl);
    try {
      this.ws = new WebSocket(wsUrl);
    } catch (err) {
      console.error("[gateway-client] WebSocket construction failed:", err);
      this.scheduleReconnect();
      return;
    }
    this.ws.addEventListener("open", () => {
      console.log("[gateway-client] WebSocket opened");
      this.queueConnect();
    });
    this.ws.addEventListener("message", (ev) => {
      this.handleMessage(String(ev.data ?? ""));
    });
    this.ws.addEventListener("close", (ev) => {
      const reason = String(ev.reason ?? "");
      console.log("[gateway-client] WebSocket closed:", ev.code, reason);
      const connectError = this.pendingConnectError;
      this.pendingConnectError = undefined;
      this.ws = null;
      this.flushPending(new Error(`gateway closed (${ev.code}): ${reason}`));
      this.opts.onClose?.({ code: ev.code, reason, error: connectError });
      if (!isNonRecoverable(connectError)) {
        this.scheduleReconnect();
      }
    });
    this.ws.addEventListener("error", (err) => {
      console.error("[gateway-client] WebSocket error:", err);
    });
  }

  private scheduleReconnect(): void {
    if (this.closed) {return;}
    const delay = this.backoffMs;
    this.backoffMs = Math.min(this.backoffMs * 1.7, 15_000);
    this.connectTimer = setTimeout(() => this.connect(), delay);
  }

  private flushPending(err: Error): void {
    for (const [, p] of this.pending) {
      p.reject(err);
    }
    this.pending.clear();
  }

  private sendConnect(): void {
    if (this.connectSent) {return;}
    this.connectSent = true;
    if (this.connectTimer !== null) {
      clearTimeout(this.connectTimer);
      this.connectTimer = null;
    }

    const hasToken = !!this.opts.token;
    const hasPassword = !!this.opts.password;
    console.log(`[gateway-client] sendConnect: hasToken=${hasToken}, hasPassword=${hasPassword}, nonce=${!!this.connectNonce}`);

    const auth =
      this.opts.token || this.opts.password
        ? { token: this.opts.token, password: this.opts.password }
        : undefined;

    const params = {
      minProtocol: 3,
      maxProtocol: 3,
      client: {
        id: "gateway-client",
        version: this.opts.clientVersion ?? "desktop",
        platform: navigator?.platform ?? "unknown",
        mode: "ui",
      },
      role: "operator",
      scopes: ["operator.admin", "operator.approvals", "operator.pairing"],
      caps: ["tool-events"],
      auth,
    };

    void this.request<GatewayHelloOk>("connect", params)
      .then((hello) => {
        this.backoffMs = 800;
        this.opts.onHello?.(hello);
      })
      .catch((err: unknown) => {
        if (err instanceof GatewayRequestError) {
          this.pendingConnectError = {
            code: err.gatewayCode,
            message: err.message,
            details: err.details,
          };
        } else {
          this.pendingConnectError = undefined;
        }
        this.ws?.close(4008, "connect failed");
      });
  }

  private handleMessage(raw: string): void {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      console.warn("[gateway-client] non-JSON message:", raw.slice(0, 200));
      return;
    }

    const frame = parsed as { type?: unknown };

    if (frame.type === "event") {
      const evt = parsed as GatewayEventFrame;

      if (evt.event === "connect.challenge") {
        const payload = evt.payload as { nonce?: unknown } | undefined;
        const nonce =
          payload && typeof payload.nonce === "string" ? payload.nonce : null;
        console.log("[gateway-client] challenge received, nonce:", nonce ? "yes" : "no");
        if (nonce) {
          this.connectNonce = nonce;
          this.sendConnect();
        }
        return;
      }

      const seq = typeof evt.seq === "number" ? evt.seq : null;
      if (seq !== null) {
        if (this.lastSeq !== null && seq > this.lastSeq + 1) {
          this.opts.onGap?.({ expected: this.lastSeq + 1, received: seq });
        }
        this.lastSeq = seq;
      }

      try {
        gatewayEventBus.emit(evt);
      } catch (err) {
        console.error("[gateway] event dispatch error:", err);
      }
      return;
    }

    if (frame.type === "res") {
      const res = parsed as { type: "res"; id: string; ok: boolean; payload?: unknown; error?: { code: string; message: string; details?: unknown } };
      const pending = this.pending.get(res.id);
      if (!pending) {return;}
      this.pending.delete(res.id);
      if (res.ok) {
        pending.resolve(res.payload);
      } else {
        pending.reject(
          new GatewayRequestError({
            code: res.error?.code ?? "UNAVAILABLE",
            message: res.error?.message ?? "request failed",
            details: res.error?.details,
          }),
        );
      }
    }
  }

  request<T = unknown>(method: string, params?: unknown, timeoutMs = 30_000): Promise<T> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error("gateway not connected"));
    }
    const id = generateUUID();
    const frame = { type: "req", id, method, params };
    const p = new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: (v) => resolve(v as T), reject });
      // Prevent indefinite hang if gateway never responds
      if (timeoutMs > 0) {
        setTimeout(() => {
          if (this.pending.has(id)) {
            this.pending.delete(id);
            reject(new Error(`RPC timeout: ${method} (${timeoutMs}ms)`));
          }
        }, timeoutMs);
      }
    });
    this.ws.send(JSON.stringify(frame));
    return p;
  }

  private queueConnect(): void {
    this.connectNonce = null;
    this.connectSent = false;
    if (this.connectTimer !== null) {
      clearTimeout(this.connectTimer);
    }
    // Wait briefly for challenge; if none arrives, send connect directly.
    this.connectTimer = setTimeout(() => {
      this.sendConnect();
    }, 750);
  }
}
