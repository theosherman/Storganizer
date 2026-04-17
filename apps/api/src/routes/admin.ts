import { Hono } from "hono";
import type { Env } from "../env";

type AuthVariables = { userId: string };

const admin = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

admin.use("/*", async (c, next) => {
  const userId = c.get("userId");
  const user = await c.env.DB.prepare(
    "SELECT role FROM users WHERE id = ?"
  ).bind(userId).first<{ role: string }>();
  if (!user || user.role !== "admin") {
    return c.json({ error: "Forbidden" }, 403);
  }
  return next();
});

admin.post("/invite", async (c) => {
  const userId = c.get("userId");
  const body = await c.req.json<{ email: string }>();
  if (!body.email?.trim()) {
    return c.json({ error: "Email is required" }, 400);
  }

  await c.env.DB.prepare(
    "INSERT OR IGNORE INTO allowed_emails (email, invited_by) VALUES (?, ?)"
  ).bind(body.email.trim().toLowerCase(), userId).run();

  return c.json({ ok: true }, 201);
});

admin.get("/invites", async (c) => {
  const result = await c.env.DB.prepare(
    "SELECT email, invited_by, created_at FROM allowed_emails ORDER BY created_at DESC"
  ).all();
  return c.json({ invites: result.results });
});

admin.delete("/invite/:email", async (c) => {
  const email = c.req.param("email");
  await c.env.DB.prepare(
    "DELETE FROM allowed_emails WHERE email = ?"
  ).bind(email).run();
  return c.json({ ok: true });
});

export { admin };
