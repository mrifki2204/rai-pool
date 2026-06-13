#!/usr/bin/env bun
/**
 * Watchdog — Auto-restart wrapper for RAI Pool server.
 *
 * Handles Bun runtime crashes (panic/assertion failures) by automatically
 * restarting the server process with exponential backoff.
 *
 * Usage:
 *   bun scripts/watchdog.ts
 *
 * Environment:
 *   MAX_RESTARTS=10       Max restarts before giving up (default: 10)
 *   RESTART_DELAY=2000    Initial restart delay in ms (default: 2000)
 *   RESTART_WINDOW=60000  Reset restart count after this many ms of uptime (default: 60s)
 */

import path from "path";
const root = path.resolve(import.meta.dir, "..");
const maxRestarts = Number(process.env.MAX_RESTARTS || 10);
const baseDelay = Number(process.env.RESTART_DELAY || 2000);
const stableWindow = Number(process.env.RESTART_WINDOW || 60_000);

let restartCount = 0;
let lastStartTime = 0;
let shuttingDown = false;

function log(msg: string) {
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`[${ts}] [watchdog] ${msg}`);
}

function getDelay(): number {
  // Exponential backoff: 2s, 4s, 8s, 16s, max 30s
  return Math.min(baseDelay * Math.pow(2, restartCount - 1), 30_000);
}

async function startServer(): Promise<number> {
  lastStartTime = Date.now();

  log(`Starting server (attempt ${restartCount + 1})...`);

  const bunPath = process.argv[0] || process.execPath;
  const proc = Bun.spawn([bunPath, "src/index.ts"], {
    cwd: root,
    stdout: "inherit",
    stderr: "inherit",
    env: {
      ...process.env,
      NODE_ENV: process.env.NODE_ENV || "production",
    },
  });

  // Write PID file
  await Bun.write(`${root}/.rai.pid`, String(proc.pid));

  const exitCode = await proc.exited;
  return exitCode;
}

async function run() {
  log("Watchdog started");
  log(`Config: maxRestarts=${maxRestarts}, baseDelay=${baseDelay}ms, stableWindow=${stableWindow}ms`);

  while (!shuttingDown) {
    const exitCode = await startServer();

    if (shuttingDown) break;

    const uptime = Date.now() - lastStartTime;
    const uptimeStr = uptime > 60_000
      ? `${(uptime / 60_000).toFixed(1)}m`
      : `${(uptime / 1000).toFixed(1)}s`;

    if (exitCode === 0) {
      log(`Server exited cleanly (code 0) after ${uptimeStr}. Stopping watchdog.`);
      break;
    }

    log(`Server crashed! Exit code: ${exitCode}, uptime: ${uptimeStr}`);

    // If server was stable for a while, reset the restart counter
    if (uptime > stableWindow) {
      log(`Server was stable for ${uptimeStr} — resetting restart counter`);
      restartCount = 0;
    }

    restartCount++;

    if (restartCount > maxRestarts) {
      log(`Max restarts (${maxRestarts}) exceeded. Giving up.`);
      log(`Check logs and fix the issue, then restart manually.`);
      process.exit(1);
    }

    const delay = getDelay();
    log(`Restarting in ${delay}ms... (${restartCount}/${maxRestarts})`);
    await Bun.sleep(delay);
  }

  log("Watchdog stopped");
}

// Handle graceful shutdown
process.on("SIGINT", () => {
  if (shuttingDown) return;
  shuttingDown = true;
  log("Received SIGINT, shutting down...");
});

process.on("SIGTERM", () => {
  if (shuttingDown) return;
  shuttingDown = true;
  log("Received SIGTERM, shutting down...");
});

run().catch((err) => {
  log(`Fatal error: ${err}`);
  process.exit(1);
});
