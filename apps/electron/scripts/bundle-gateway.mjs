/**
 * Bundles the gateway dist/ + openclaw.mjs into the Electron app's resources/ directory
 * for production packaging. This allows the packaged app to spawn the gateway
 * without requiring a separate openclaw CLI installation.
 */
import { existsSync, mkdirSync, cpSync, copyFileSync } from "node:fs";
import { resolve } from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const electronRoot = resolve(__dirname, "..");
const monorepoRoot = resolve(electronRoot, "..", "..");

const entryMjs = resolve(monorepoRoot, "dist", "entry.mjs");
const entryJs = resolve(monorepoRoot, "dist", "entry.js");

// Ensure gateway is built first
if (!existsSync(entryMjs) && !existsSync(entryJs)) {
  console.log("[bundle-gateway] Building gateway first...");
  execSync("pnpm build", {
    cwd: monorepoRoot,
    stdio: "inherit",
    timeout: 300_000,
  });
}

const targetDir = resolve(electronRoot, "resources", "gateway");

// Clean and recreate
if (existsSync(targetDir)) {
  cpSync(targetDir, targetDir + ".bak", { recursive: true, force: true });
  // Remove old
  execSync(`rm -rf "${targetDir}"`);
}
mkdirSync(targetDir, { recursive: true });

// Copy dist/
const srcDist = resolve(monorepoRoot, "dist");
const dstDist = resolve(targetDir, "dist");
cpSync(srcDist, dstDist, { recursive: true });
console.log(`[bundle-gateway] Copied dist/ → resources/gateway/dist/`);

// Copy openclaw.mjs entry
copyFileSync(
  resolve(monorepoRoot, "openclaw.mjs"),
  resolve(targetDir, "openclaw.mjs"),
);
console.log(`[bundle-gateway] Copied openclaw.mjs → resources/gateway/openclaw.mjs`);

// Copy package.json (needed for module resolution)
copyFileSync(
  resolve(monorepoRoot, "package.json"),
  resolve(targetDir, "package.json"),
);
console.log(`[bundle-gateway] Copied package.json → resources/gateway/package.json`);

// Clean up backup
const bakDir = targetDir + ".bak";
if (existsSync(bakDir)) {
  execSync(`rm -rf "${bakDir}"`);
}

console.log("[bundle-gateway] Gateway bundled successfully into resources/gateway/");
