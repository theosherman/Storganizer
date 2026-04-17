import { env } from "cloudflare:test";
import { app } from "../src/index";
import { createTestUser } from "./helpers";

describe("GET /api/auth/google", () => {
  it("redirects to Google OAuth", async () => {
    const res = await app.request("/api/auth/google", { redirect: "manual" }, env);
    expect(res.status).toBe(302);
    const location = res.headers.get("Location")!;
    expect(location).toContain("accounts.google.com");
    expect(location).toContain("client_id=");
  });
});

describe("GET /api/auth/me", () => {
  it("returns null user when not authenticated", async () => {
    const res = await app.request("/api/auth/me", {}, env);
    expect(res.status).toBe(200);
    const data = await res.json() as any;
    expect(data.user).toBeNull();
  });

  it("returns user when authenticated", async () => {
    const user = await createTestUser({ name: "Alice", email: "alice@test.com" });
    const res = await app.request("/api/auth/me", {
      headers: { "x-test-user-id": user.id },
    }, env);
    expect(res.status).toBe(200);
    const data = await res.json() as any;
    expect(data.user.name).toBe("Alice");
    expect(data.user.email).toBe("alice@test.com");
  });
});

describe("POST /api/auth/logout", () => {
  it("clears auth cookie", async () => {
    const res = await app.request("/api/auth/logout", { method: "POST" }, env);
    expect(res.status).toBe(200);
    const cookie = res.headers.get("Set-Cookie")!;
    expect(cookie).toContain("auth=");
    expect(cookie).toContain("Max-Age=0");
  });
});
