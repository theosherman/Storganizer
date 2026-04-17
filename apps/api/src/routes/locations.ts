import { Hono } from "hono";
import type { Env } from "../env";
import { ulid } from "../lib/ulid";

type AuthVariables = { userId: string };

const locations = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

locations.get("/", async (c) => {
  const userId = c.get("userId");
  const result = await c.env.DB.prepare(
    "SELECT id, name, description, created_at FROM locations WHERE user_id = ? ORDER BY created_at DESC"
  ).bind(userId).all();
  return c.json({ locations: result.results });
});

locations.post("/", async (c) => {
  const userId = c.get("userId");
  const body = await c.req.json<{ name?: string; description?: string }>();
  if (!body.name?.trim()) {
    return c.json({ error: "Name is required" }, 400);
  }
  const id = ulid();
  await c.env.DB.prepare(
    "INSERT INTO locations (id, user_id, name, description) VALUES (?, ?, ?, ?)"
  ).bind(id, userId, body.name.trim(), body.description?.trim() || null).run();

  const location = await c.env.DB.prepare(
    "SELECT id, name, description, created_at FROM locations WHERE id = ?"
  ).bind(id).first();
  return c.json({ location }, 201);
});

locations.get("/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const location = await c.env.DB.prepare(
    "SELECT id, name, description, created_at FROM locations WHERE id = ? AND user_id = ?"
  ).bind(id, userId).first();
  if (!location) return c.json({ error: "Not found" }, 404);

  const containers = await c.env.DB.prepare(
    "SELECT c.id, c.name, c.description, c.created_at, COUNT(i.id) as item_count FROM containers c LEFT JOIN items i ON i.container_id = c.id WHERE c.location_id = ? AND c.user_id = ? GROUP BY c.id ORDER BY c.created_at DESC"
  ).bind(id, userId).all();

  return c.json({ location: { ...location, containers: containers.results } });
});

locations.patch("/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const body = await c.req.json<{ name?: string; description?: string }>();

  const existing = await c.env.DB.prepare(
    "SELECT id FROM locations WHERE id = ? AND user_id = ?"
  ).bind(id, userId).first();
  if (!existing) return c.json({ error: "Not found" }, 404);

  const updates: string[] = [];
  const values: (string | null)[] = [];
  if (body.name !== undefined) { updates.push("name = ?"); values.push(body.name.trim()); }
  if (body.description !== undefined) { updates.push("description = ?"); values.push(body.description?.trim() || null); }

  if (updates.length > 0) {
    values.push(id, userId);
    await c.env.DB.prepare(
      `UPDATE locations SET ${updates.join(", ")} WHERE id = ? AND user_id = ?`
    ).bind(...values).run();
  }

  const location = await c.env.DB.prepare(
    "SELECT id, name, description, created_at FROM locations WHERE id = ?"
  ).bind(id).first();
  return c.json({ location });
});

locations.delete("/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");

  const existing = await c.env.DB.prepare(
    "SELECT id FROM locations WHERE id = ? AND user_id = ?"
  ).bind(id, userId).first();
  if (!existing) return c.json({ error: "Not found" }, 404);

  await c.env.DB.prepare(
    "UPDATE containers SET location_id = NULL WHERE location_id = ? AND user_id = ?"
  ).bind(id, userId).run();

  await c.env.DB.prepare(
    "DELETE FROM locations WHERE id = ? AND user_id = ?"
  ).bind(id, userId).run();

  return c.json({ ok: true });
});

export { locations };
