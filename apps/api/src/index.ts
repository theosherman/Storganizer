import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env } from "./env";
import { locations } from "./routes/locations";

type AuthVariables = { userId: string };

const app = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

app.use("/*", cors({
  origin: (origin) => origin,
  credentials: true,
}));

app.get("/api/health", (c) => c.json({ ok: true }));

app.use("/api/*", async (c, next) => {
  const path = new URL(c.req.url).pathname;
  if (path.startsWith("/api/auth") || path === "/api/health") return next();

  const testUserId = c.req.header("x-test-user-id");
  if (testUserId) {
    c.set("userId", testUserId);
    return next();
  }

  return c.json({ error: "Unauthorized" }, 401);
});

app.route("/api/locations", locations);

export default {
  fetch: app.fetch,
  async queue(batch: MessageBatch<{ item_id: string; photo_r2_key: string }>, env: Env) {
    // Queue consumer — implemented in Task 14
  },
};

export { app };
