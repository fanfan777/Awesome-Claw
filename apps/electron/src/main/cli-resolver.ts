import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { execSync } from "node:child_process";
import { homedir } from "node:os";
import { app } from "electron";

const CANDIDATE_PATHS: string[] = [
  "/usr/local/bin/openclaw",
  "/usr/bin/openclaw",
  join(homedir(), ".npm-global", "bin", "openclaw"),
  join(homedir(), ".local", "bin", "openclaw"),
];

const MACOS_CANDIDATES: string[] = [
  "/Applications/OpenClaw.app/Contents/MacOS/openclaw-cli",
];

export interface ResolvedCli {
  /** Executable path (binary or node) */
  command: string;
  /** Arguments to prepend (e.g. ["openclaw.mjs"] when using node) */
  args: string[];
  /** Working directory (set for monorepo dev mode) */
  cwd?: string;
}

const MIN_NODE_MAJOR = 22;

/** Check if a node binary meets the minimum version requirement. */
function checkNodeVersion(nodePath: string): boolean {
  try {
    const version = execSync(`"${nodePath}" -e "process.stdout.write(process.versions.node)"`, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 3000,
    }).trim();
    const major = parseInt(version.split(".")[0], 10);
    return major >= MIN_NODE_MAJOR;
  } catch {
    return false;
  }
}

/** Scan nvm versions directory for a node binary that meets the minimum version. */
function findNvmNode(): string | null {
  const nvmDir = process.env["NVM_DIR"] || join(homedir(), ".nvm");
  const versionsDir = join(nvmDir, "versions", "node");
  if (!existsSync(versionsDir)) {return null;}

  try {
    const { readdirSync } = require("node:fs") as typeof import("node:fs");
    const versions = readdirSync(versionsDir)
      .filter((d: string) => d.startsWith("v"))
      .toSorted((a: string, b: string) => {
        // Sort descending by major version to find highest first
        const aMajor = parseInt(a.slice(1).split(".")[0], 10);
        const bMajor = parseInt(b.slice(1).split(".")[0], 10);
        return bMajor - aMajor;
      });

    for (const v of versions) {
      const major = parseInt(v.slice(1).split(".")[0], 10);
      if (major < MIN_NODE_MAJOR) {continue;}
      const nodeBin = join(versionsDir, v, "bin", "node");
      if (existsSync(nodeBin)) {return nodeBin;}
    }
  } catch {
    // ignore
  }
  return null;
}

/** Find system-installed node binary (not Electron's bundled one). Prefers Node 22+. */
function resolveSystemNode(): string {
  // 1. Try `which node` — if it meets minimum version, use it
  try {
    const found = execSync(
      process.platform === "win32" ? "where node" : "which node",
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }
    ).trim().split("\n")[0].trim();
    if (found && existsSync(found) && checkNodeVersion(found)) {return found;}
  } catch {
    // ignore
  }

  // 2. nvm: check NVM_BIN (current nvm session)
  const nvmBin = process.env["NVM_BIN"];
  if (nvmBin) {
    const p = join(nvmBin, "node");
    if (existsSync(p) && checkNodeVersion(p)) {return p;}
  }

  // 3. nvm: scan installed versions for one that meets minimum
  const nvmNode = findNvmNode();
  if (nvmNode) {return nvmNode;}

  // 4. Well-known paths (check version)
  const nodePaths = ["/usr/local/bin/node", "/usr/bin/node"];
  for (const p of nodePaths) {
    if (existsSync(p) && checkNodeVersion(p)) {return p;}
  }

  // 5. Fallback: return whatever `which node` found even if too old (let openclaw.mjs print the error)
  try {
    const found = execSync(
      process.platform === "win32" ? "where node" : "which node",
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }
    ).trim().split("\n")[0].trim();
    if (found && existsSync(found)) {return found;}
  } catch {
    // ignore
  }

  // Last resort
  return process.execPath;
}

/** Resolve the `openclaw` CLI binary path, or return null if not found. */
export function resolveCliPath(): ResolvedCli | null {
  // 0a. Packaged app: look for bundled gateway in resources/gateway/
  if (app.isPackaged) {
    const resourcesPath = join(process.resourcesPath, "gateway", "openclaw.mjs");
    if (existsSync(resourcesPath)) {
      const nodePath = resolveSystemNode();
      return {
        command: nodePath,
        args: [resourcesPath],
        cwd: join(process.resourcesPath, "gateway"),
      };
    }
  }

  // 0b. Dev mode: look for openclaw.mjs in monorepo root
  if (!app.isPackaged) {
    const electronRoot = resolve(__dirname, "..", "..");
    const candidates = [
      resolve(electronRoot, "..", "..", "openclaw.mjs"), // apps/electron -> root
      resolve(electronRoot, "openclaw.mjs"), // if cwd is root
    ];
    for (const mjs of candidates) {
      if (existsSync(mjs)) {
        const nodePath = resolveSystemNode();
        return {
          command: nodePath,
          args: [mjs],
          cwd: resolve(mjs, ".."),
        };
      }
    }
  }

  // 1. Try `which`/`where` from PATH
  try {
    const found = execSync(
      process.platform === "win32" ? "where openclaw" : "which openclaw",
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }
    ).trim().split("\n")[0].trim();
    if (found && existsSync(found)) {return { command: found, args: [] };}
  } catch {
    // not in PATH
  }

  // 2. Try npm global bin directory
  try {
    const npmGlobal = execSync("npm root -g", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    const npmBin = join(npmGlobal, "..", "..", "bin", "openclaw");
    if (existsSync(npmBin)) {return { command: npmBin, args: [] };}
  } catch {
    // ignore
  }

  // 3. Well-known paths
  const allCandidates = [
    ...CANDIDATE_PATHS,
    ...(process.platform === "darwin" ? MACOS_CANDIDATES : []),
  ];

  for (const p of allCandidates) {
    if (existsSync(p)) {return { command: p, args: [] };}
  }

  return null;
}
