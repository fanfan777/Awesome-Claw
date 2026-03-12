/**
 * Ensures the openclaw gateway dist/ is built before starting the Electron dev server.
 * If dist/entry.mjs (or dist/entry.js) is missing, runs `pnpm build` in the monorepo root.
 */
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const monorepoRoot = resolve(__dirname, "..", "..", "..");

const entryMjs = resolve(monorepoRoot, "dist", "entry.mjs");
const entryJs = resolve(monorepoRoot, "dist", "entry.js");

if (existsSync(entryMjs) || existsSync(entryJs)) {
  console.log("[ensure-gateway] Gateway dist/ already built, skipping.");
  process.exit(0);
}

console.log("[ensure-gateway] Gateway dist/ not found, building...");
console.log(`[ensure-gateway] Running pnpm build in ${monorepoRoot}`);

try {
  execSync("pnpm build", {
    cwd: monorepoRoot,
    stdio: "inherit",
    timeout: 300_000, // 5 min max
  });
  console.log("[ensure-gateway] Gateway build complete.");
} catch (err) {
  console.error("[ensure-gateway] Gateway build failed:", err.message);
  process.exit(1);
}
