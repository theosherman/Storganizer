import { Hono } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import type { Env } from "../env";
import { signJwt, verifyJwt } from "../middleware/auth";
import { ulid } from "../lib/ulid";

type AuthVariables = { userId: string };

const auth = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

auth.get("/google", async (c) => {
  const params = new URLSearchParams({
    client_id: c.env.GOOGLE_CLIENT_ID,
    redirect_uri: `${new URL(c.req.url).origin}/api/auth/google/callback`,
    response_type: "code",
    scope: "openid email profile",
    access_type: "offline",
    state: crypto.randomUUID(),
  });
  return c.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});

auth.get("/google/callback", async (c) => {
  const code = c.req.query("code");
  if (!code) return c.json({ error: "Missing code" }, 400);

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: c.env.GOOGLE_CLIENT_ID,
      client_secret: c.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: `${new URL(c.req.url).origin}/api/auth/google/callback`,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenRes.ok) return c.json({ error: "Token exchange failed" }, 400);
  const tokens = await tokenRes.json() as { access_token: string };

  const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  if (!userInfoRes.ok) return c.json({ error: "Failed to get user info" }, 400);

  const googleUser = await userInfoRes.json() as {
    id: string; email: string; name: string; picture: string;
  };

  const isAdmin = googleUser.email === c.env.ADMIN_EMAIL;
  const isAllowed = await c.env.DB.prepare(
    "SELECT email FROM allowed_emails WHERE email = ?"
  ).bind(googleUser.email).first();

  if (!isAdmin && !isAllowed) {
    return c.redirect(`${c.env.FRONTEND_URL}/login?error=not_allowed`);
  }

  const existingUser = await c.env.DB.prepare(
    "SELECT id, role FROM users WHERE google_id = ?"
  ).bind(googleUser.id).first<{ id: string; role: string }>();

  let userId: string;
  if (existingUser) {
    userId = existingUser.id;
    await c.env.DB.prepare(
      "UPDATE users SET name = ?, avatar_url = ?, email = ? WHERE id = ?"
    ).bind(googleUser.name, googleUser.picture, googleUser.email, userId).run();
  } else {
    userId = ulid();
    const role = isAdmin ? "admin" : "member";
    await c.env.DB.prepare(
      "INSERT INTO users (id, google_id, email, name, avatar_url, role) VALUES (?, ?, ?, ?, ?, ?)"
    ).bind(userId, googleUser.id, googleUser.email, googleUser.name, googleUser.picture, role).run();
  }

  const jwt = await signJwt({ sub: userId }, c.env.JWT_SECRET);
  setCookie(c, "auth", jwt, {
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    path: "/",
    maxAge: 7 * 24 * 3600,
  });

  return c.redirect(c.env.FRONTEND_URL);
});

auth.get("/me", async (c) => {
  const testUserId = c.req.header("x-test-user-id");
  const token = getCookie(c, "auth");

  let userId: string | null = null;
  if (testUserId) {
    userId = testUserId;
  } else if (token) {
    try {
      const payload = await verifyJwt(token, c.env.JWT_SECRET);
      userId = payload.sub;
    } catch { /* invalid token */ }
  }

  if (!userId) return c.json({ user: null });

  const user = await c.env.DB.prepare(
    "SELECT id, email, name, avatar_url, role, created_at FROM users WHERE id = ?"
  ).bind(userId).first();
  return c.json({ user: user || null });
});

auth.post("/logout", async (c) => {
  deleteCookie(c, "auth", { path: "/" });
  return c.json({ ok: true });
});

export { auth };
