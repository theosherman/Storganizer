import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env } from "./env";
import { authMiddleware } from "./middleware/auth";
import { auth } from "./routes/auth";
import { locations } from "./routes/locations";
import { containers } from "./routes/containers";
import { items } from "./routes/items";
import { admin } from "./routes/admin";
import { handleImageQueue } from "./queue/consumer";

type AuthVariables = { userId: string };

const app = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

app.use("/*", cors({
  origin: (origin) => origin,
  credentials: true,
}));

app.get("/api/health", (c) => c.json({ ok: true }));

app.get("/api/photos/*", async (c) => {
  const key = c.req.path.replace("/api/photos/", "");
  const object = await c.env.STORAGE.get(key);
  if (!object) return c.notFound();
  const headers = new Headers();
  headers.set("Content-Type", object.httpMetadata?.contentType || "image/jpeg");
  headers.set("Cache-Control", "public, max-age=31536000, immutable");
  return new Response(object.body, { headers });
});

app.use("/api/*", authMiddleware);

app.route("/api/auth", auth);
app.route("/api/locations", locations);
app.route("/api/containers", containers);
app.route("/api/items", items);
app.route("/api/admin", admin);

export default {
  fetch: app.fetch,
  async queue(batch: MessageBatch<{ item_id: string; photo_r2_key: string }>, env: Env) {
    await handleImageQueue(batch, env);
  },
};

export { app };
