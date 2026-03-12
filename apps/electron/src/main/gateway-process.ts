import { ChildProcess, spawn } from "node:child_process";
import { EventEmitter } from "node:events";
import type { ResolvedCli } from "./cli-resolver.js";

export type GatewayState =
  | "stopped"
  | "starting"
  | "running"
  | "failed"
  | "attachedExisting";

export interface GatewayStatus {
  state: GatewayState;
  pid?: number;
  port?: number;
}

interface GatewayEvents {
  stateChange: [status: GatewayStatus];
}

const DEFAULT_PORT = 18789;
const SIGTERM_TIMEOUT_MS = 5000;

class GatewayProcess extends EventEmitter<GatewayEvents> {
  private child: ChildProcess | null = null;
  private state: GatewayState = "stopped";
  private port: number = DEFAULT_PORT;
  private lastCli: ResolvedCli | null = null;
  private respawnCount = 0;
  private static MAX_RESPAWNS = 5;
  private static RESPAWN_WINDOW_MS = 30_000;
  private respawnWindowStart = 0;

  getStatus(): GatewayStatus {
    return {
      state: this.state,
      pid: this.child?.pid,
      port: this.state !== "stopped" && this.state !== "failed" ? this.port : undefined,
    };
  }

  private setState(state: GatewayState): void {
    this.state = state;
    this.emit("stateChange", this.getStatus());
  }

  async spawnGateway(cli: ResolvedCli, port: number = DEFAULT_PORT): Promise<void> {
    if (this.state === "running" || this.state === "starting") {
      return;
    }

    this.port = port;
    this.lastCli = cli;
    this.setState("starting");

    const gatewayArgs = ["gateway", "run", "--bind", "loopback", "--port", String(port), "--force", "--allow-unconfigured"];
    const args = [...cli.args, ...gatewayArgs];
    console.log(`[gateway] spawning: ${cli.command} ${args.join(" ")} (cwd: ${cli.cwd ?? "inherit"})`);
    const child = spawn(cli.command, args, {
      stdio: ["ignore", "pipe", "pipe"],
      detached: false,
      cwd: cli.cwd,
    });

    this.child = child;

    child.stdout?.on("data", (chunk: Buffer) => {
      const line = chunk.toString().trim();
      if (line) {console.log(`[gateway] ${line}`);}
    });

    child.stderr?.on("data", (chunk: Buffer) => {
      const line = chunk.toString().trim();
      if (line) {console.error(`[gateway:err] ${line}`);}
    });

    child.on("error", (err: Error) => {
      console.error("[gateway] spawn error:", err.message);
      this.child = null;
      this.setState("failed");
    });

    child.on("exit", (code, signal) => {
      console.log(`[gateway] exited code=${code} signal=${signal}`);
      this.child = null;

      // Supervisor restart: gateway exited cleanly (code=0) while running → respawn
      if (code === 0 && this.state === "running" && this.lastCli) {
        const now = Date.now();
        if (now - this.respawnWindowStart > GatewayProcess.RESPAWN_WINDOW_MS) {
          this.respawnCount = 0;
          this.respawnWindowStart = now;
        }
        this.respawnCount++;
        if (this.respawnCount <= GatewayProcess.MAX_RESPAWNS) {
          console.log(`[gateway] supervisor restart (${this.respawnCount}/${GatewayProcess.MAX_RESPAWNS}), respawning in 1s...`);
          this.state = "stopped"; // reset without emitting
          setTimeout(() => {
            if (this.state === "stopped" && this.lastCli) {
              void this.spawnGateway(this.lastCli, this.port);
            }
          }, 1000);
          return;
        }
        console.warn("[gateway] too many respawns in window, marking failed");
      }

      // Only mark failed if we were running/starting (not a deliberate stop)
      if (this.state === "running" || this.state === "starting") {
        this.setState("failed");
      } else {
        this.setState("stopped");
      }
    });

    // Poll /health endpoint — first run may need to build UI assets (~60s)
    await this.waitForReady(port, 60_000);
  }

  private async waitForReady(port: number, timeoutMs: number): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (this.state === "failed" || this.state === "stopped") {break;}
      if (this.state === "running") {break;}
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 2000);
        const res = await fetch(`http://127.0.0.1:${port}/health`, {
          signal: controller.signal,
        });
        clearTimeout(timer);
        if (res.ok && this.state === "starting") {
          console.log("[gateway] health check passed, marking running");
          this.setState("running");
          break;
        }
      } catch {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
  }

  async stopGateway(): Promise<void> {
    const child = this.child;
    if (!child || this.state === "stopped") {return;}

    this.setState("stopped");
    child.kill("SIGTERM");

    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        if (!child.killed) {child.kill("SIGKILL");}
        resolve();
      }, SIGTERM_TIMEOUT_MS);

      child.on("exit", () => {
        clearTimeout(timer);
        resolve();
      });
    });

    this.child = null;
  }

  attachExisting(port: number = DEFAULT_PORT): void {
    this.port = port;
    this.setState("attachedExisting");
  }

  cleanup(): void {
    if (this.child && !this.child.killed) {
      this.child.kill("SIGKILL");
      this.child = null;
    }
  }
}

export const gatewayProcess = new GatewayProcess();
