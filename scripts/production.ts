#!/usr/bin/env bun
/**
 * Production start script.
 *
 * 1. Builds dashboard (if needed)
 * 2. Starts backend (API + Dashboard on single PORT)
 *
 * Usage:
 *   bun run production
 *   bun run scripts/production.ts
 *   bun run scripts/production.ts --skip-build
 */

const root = new URL("..", import.meta.url).pathname;
const dashboardDir = `${root}/dashboard`;
const dashboardDist = `${dashboardDir}/dist/index.html`;
const skipBuild = process.argv.includes("--skip-build");

const port = process.env.PORT || "2002";

async function buildDashboard() {
  const distExists = await Bun.file(dashboardDist).exists();

  if (skipBuild && distExists) {
    console.log("[production] Skipping dashboard build (--skip-build)");
    return;
  }

  if (!skipBuild || !distExists) {
    console.log("[production] Building dashboard...");
    const proc = Bun.spawn([process.execPath, "run", "build"], {
      cwd: dashboardDir,
      stdout: "inherit",
      stderr: "inherit",
      env: { ...process.env },
    });
    const code = await proc.exited;
    if (code !== 0) {
      console.error("[production] Dashboard build failed!");
      process.exit(1);
    }
    console.log("[production] Dashboard built successfully.\n");
  }
}

await buildDashboard();

console.log(`╔══════════════════════════════════════╗`);
console.log(`║   RAI Pool — Production Mode         ║`);
console.log(`╠══════════════════════════════════════╣`);
console.log(`║  Server: http://localhost:${port}       ║`);
console.log(`╚══════════════════════════════════════╝\n`);

// Start backend (serves API + Dashboard on single port)
const backend = Bun.spawn([process.execPath, "src/index.ts"], {
  cwd: root,
  stdout: "inherit",
  stderr: "inherit",
  env: {
    ...process.env,
    PORT: port,
    NODE_ENV: "production",
  },
});

let shuttingDown = false;

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  backend.kill();
  setTimeout(() => process.exit(code), 300).unref();
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

backend.exited.then((code) => {
  if (!shuttingDown) {
    console.error(`[production] Server exited with code ${code}`);
    shutdown(code || 1);
  }
});

await new Promise(() => {});
