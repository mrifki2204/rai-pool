import { Hono } from "hono";
import { db } from "../db/index";
import { settings } from "../db/schema";
import { eq } from "drizzle-orm";
import { config } from "../config";

const DASHBOARD_PASSWORD_KEY = "dashboard_password_hash";
const SESSION_TOKEN_KEY = "dashboard_session_token";

export const dashboardAuthRouter = new Hono();

/**
 * Hash a password using Bun's built-in bcrypt.
 */
async function hashPassword(password: string): Promise<string> {
  return await Bun.password.hash(password, { algorithm: "bcrypt", cost: 10 });
}

/**
 * Verify a password against a bcrypt hash.
 */
async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return await Bun.password.verify(password, hash);
}

/**
 * Get the stored password hash from DB, or hash the default from .env on first use.
 */
async function getStoredPasswordHash(): Promise<string> {
  const [row] = await db.select().from(settings).where(eq(settings.key, DASHBOARD_PASSWORD_KEY));
  if (row?.value) return row.value;

  // First time: hash the default password from config and store it
  const hash = await hashPassword(config.dashboardPassword);
  await db.insert(settings).values({ key: DASHBOARD_PASSWORD_KEY, value: hash });
  return hash;
}

/**
 * Generate a random session token.
 */
function generateSessionToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

/**
 * Get or create a session token (stored in DB settings).
 */
async function getSessionToken(): Promise<string> {
  const [row] = await db.select().from(settings).where(eq(settings.key, SESSION_TOKEN_KEY));
  if (row?.value) return row.value;

  const token = generateSessionToken();
  await db.insert(settings).values({ key: SESSION_TOKEN_KEY, value: token });
  return token;
}

/**
 * Rotate the session token (invalidates all existing sessions).
 */
async function rotateSessionToken(): Promise<string> {
  const token = generateSessionToken();
  const existing = await db.select().from(settings).where(eq(settings.key, SESSION_TOKEN_KEY));
  if (existing.length > 0) {
    await db.update(settings).set({ value: token, updatedAt: new Date() }).where(eq(settings.key, SESSION_TOKEN_KEY));
  } else {
    await db.insert(settings).values({ key: SESSION_TOKEN_KEY, value: token });
  }
  return token;
}

/**
 * Validate a session token.
 */
export async function isValidSessionToken(token: string): Promise<boolean> {
  if (!token) return false;
  const stored = await getSessionToken();
  return token === stored;
}

/**
 * POST /api/auth/dashboard-login
 * Body: { password: string }
 * Returns: { success: true, token: string } or { success: false, error: string }
 */
dashboardAuthRouter.post("/dashboard-login", async (c) => {
  const body = await c.req.json<{ password: string }>();
  const password = body.password?.trim();

  if (!password) {
    return c.json({ success: false, error: "Password is required" }, 400);
  }

  const hash = await getStoredPasswordHash();
  const valid = await verifyPassword(password, hash);

  if (!valid) {
    return c.json({ success: false, error: "Invalid password" }, 401);
  }

  const token = await getSessionToken();
  return c.json({ success: true, token });
});

/**
 * POST /api/auth/validate-session
 * Body: { token: string }
 * Returns: { valid: boolean }
 */
dashboardAuthRouter.post("/validate-session", async (c) => {
  const body = await c.req.json<{ token: string }>();
  const valid = await isValidSessionToken(body.token || "");
  return c.json({ valid });
});

/**
 * POST /api/auth/change-password
 * Body: { currentPassword: string, newPassword: string }
 * Requires valid session (Authorization: Bearer <session_token>)
 */
dashboardAuthRouter.post("/change-password", async (c) => {
  const body = await c.req.json<{ currentPassword: string; newPassword: string }>();
  const { currentPassword, newPassword } = body;

  if (!currentPassword || !newPassword) {
    return c.json({ success: false, error: "Both current and new password are required" }, 400);
  }

  if (newPassword.length < 4) {
    return c.json({ success: false, error: "New password must be at least 4 characters" }, 400);
  }

  // Verify current password
  const hash = await getStoredPasswordHash();
  const valid = await verifyPassword(currentPassword, hash);
  if (!valid) {
    return c.json({ success: false, error: "Current password is incorrect" }, 401);
  }

  // Hash and save new password
  const newHash = await hashPassword(newPassword);
  const existing = await db.select().from(settings).where(eq(settings.key, DASHBOARD_PASSWORD_KEY));
  if (existing.length > 0) {
    await db.update(settings).set({ value: newHash, updatedAt: new Date() }).where(eq(settings.key, DASHBOARD_PASSWORD_KEY));
  } else {
    await db.insert(settings).values({ key: DASHBOARD_PASSWORD_KEY, value: newHash });
  }

  // Rotate session token so user needs to re-login
  const newToken = await rotateSessionToken();

  return c.json({ success: true, token: newToken });
});
