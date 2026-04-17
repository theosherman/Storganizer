import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env } from "./env";

const app = new Hono<{ Bindings: Env }>();

app.use("/*", cors({
  origin: (origin) => origin,
  credentials: true,
}));

app.get("/api/health", (c) => c.json({ ok: true }));

export default {
  fetch: app.fetch,
  async queue(batch: MessageBatch<{ item_id: string; photo_r2_key: string }>, env: Env) {
    // Queue consumer — implemented in Task 14
  },
};

export { app };
