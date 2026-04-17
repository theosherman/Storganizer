import { env } from "cloudflare:test";
import { app } from "../src/index";
import { createTestUser } from "./helpers";
import { signJwt } from "../src/middleware/auth";

describe("Auth middleware", () => {
  it("returns 401 when no auth cookie or header", async () => {
    const res = await app.request("/api/locations", {}, env);
    expect(res.status).toBe(401);
  });

  it("returns 401 for invalid JWT", async () => {
    const res = await app.request("/api/locations", {
      headers: { Cookie: "auth=invalid.jwt.token" },
    }, env);
    expect(res.status).toBe(401);
  });

  it("allows access with valid JWT", async () => {
    const user = await createTestUser();
    const jwt = await signJwt({ sub: user.id }, env.JWT_SECRET);
    const res = await app.request("/api/locations", {
      headers: { Cookie: `auth=${jwt}` },
    }, env);
    expect(res.status).toBe(200);
  });

  it("skips auth for /api/auth routes", async () => {
    const res = await app.request("/api/auth/me", {}, env);
    expect(res.status).toBe(200);
  });

  it("skips auth for /api/health", async () => {
    const res = await app.request("/api/health", {}, env);
    expect(res.status).toBe(200);
  });
});
