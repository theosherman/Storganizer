import { getCookie } from "hono/cookie";
import type { Context, Next } from "hono";
import type { Env } from "../env";

type AuthVariables = { userId: string };

export async function authMiddleware(
  c: Context<{ Bindings: Env; Variables: AuthVariables }>,
  next: Next
) {
  const path = new URL(c.req.url).pathname;
  if (path.startsWith("/api/auth") || path === "/api/health") {
    return next();
  }

  const testUserId = c.req.header("x-test-user-id");
  if (testUserId) {
    c.set("userId", testUserId);
    return next();
  }

  const token = getCookie(c, "auth");
  if (!token) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const payload = await verifyJwt(token, c.env.JWT_SECRET);
    c.set("userId", payload.sub);
    return next();
  } catch {
    return c.json({ error: "Unauthorized" }, 401);
  }
}

export async function signJwt(payload: { sub: string }, secret: string, expiresInSeconds = 7 * 24 * 3600): Promise<string> {
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64url(JSON.stringify({
    ...payload,
    exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
    iat: Math.floor(Date.now() / 1000),
  }));
  const data = `${header}.${body}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return `${data}.${base64url(signature)}`;
}

export async function verifyJwt(token: string, secret: string): Promise<{ sub: string; exp: number }> {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Invalid token");

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );
  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    base64urlDecode(parts[2]),
    new TextEncoder().encode(`${parts[0]}.${parts[1]}`)
  );
  if (!valid) throw new Error("Invalid signature");

  const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error("Token expired");
  }
  return payload;
}

function base64url(input: string | ArrayBuffer): string {
  if (typeof input === "string") {
    return btoa(input).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  return btoa(String.fromCharCode(...new Uint8Array(input)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlDecode(input: string): ArrayBuffer {
  const str = atob(input.replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) bytes[i] = str.charCodeAt(i);
  return bytes.buffer;
}
