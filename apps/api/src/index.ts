import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env } from "./env";
import { authMiddleware } from "./middleware/auth";
import { auth } from "./routes/auth";
import { locations } from "./routes/locations";
import { containers } from "./routes/containers";
import { items } from "./routes/items";

type AuthVariables = { userId: string };

const app = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

app.use("/*", cors({
  origin: (origin) => origin,
  credentials: true,
}));

app.get("/api/health", (c) => c.json({ ok: true }));

app.use("/api/*", authMiddleware);

app.route("/api/auth", auth);
app.route("/api/locations", locations);
app.route("/api/containers", containers);
app.route("/api/items", items);

export default {
  fetch: app.fetch,
  async queue(batch: MessageBatch<{ item_id: string; photo_r2_key: string }>, env: Env) {
    // Queue consumer — implemented in Task 14
  },
};

export { app };
