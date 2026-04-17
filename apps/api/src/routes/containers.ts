import { Hono } from "hono";
import type { Env } from "../env";
import { ulid } from "../lib/ulid";

type AuthVariables = { userId: string };

const containers = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

containers.get("/", async (c) => {
  const userId = c.get("userId");
  const locationId = c.req.query("location_id");
  const q = c.req.query("q");

  let sql = `SELECT c.id, c.name, c.description, c.location_id, c.created_at,
    l.name as location_name, COUNT(i.id) as item_count
    FROM containers c
    LEFT JOIN locations l ON l.id = c.location_id
    LEFT JOIN items i ON i.container_id = c.id
    WHERE c.user_id = ?`;
  const params: (string | null)[] = [userId];

  if (locationId) {
    sql += " AND c.location_id = ?";
    params.push(locationId);
  }
  if (q) {
    sql += " AND c.name LIKE ?";
    params.push(`%${q}%`);
  }

  sql += " GROUP BY c.id ORDER BY c.created_at DESC";

  const result = await c.env.DB.prepare(sql).bind(...params).all();
  return c.json({ containers: result.results });
});

containers.post("/", async (c) => {
  const userId = c.get("userId");
  const body = await c.req.json<{ name?: string; description?: string; location_id?: string }>();
  if (!body.name?.trim()) {
    return c.json({ error: "Name is required" }, 400);
  }
  const id = ulid();
  await c.env.DB.prepare(
    "INSERT INTO containers (id, user_id, name, description, location_id) VALUES (?, ?, ?, ?, ?)"
  ).bind(id, userId, body.name.trim(), body.description?.trim() || null, body.location_id || null).run();

  const container = await c.env.DB.prepare(
    "SELECT id, name, description, location_id, created_at FROM containers WHERE id = ?"
  ).bind(id).first();
  return c.json({ container }, 201);
});

containers.get("/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const container = await c.env.DB.prepare(
    `SELECT c.id, c.name, c.description, c.location_id, c.created_at,
     l.name as location_name
     FROM containers c
     LEFT JOIN locations l ON l.id = c.location_id
     WHERE c.id = ? AND c.user_id = ?`
  ).bind(id, userId).first();
  if (!container) return c.json({ error: "Not found" }, 404);

  const items = await c.env.DB.prepare(
    `SELECT i.id, i.name, i.ai_label, i.status, i.created_at,
     (SELECT r2_key FROM item_photos WHERE item_id = i.id LIMIT 1) as thumbnail_key
     FROM items i WHERE i.container_id = ? AND i.user_id = ?
     ORDER BY i.created_at DESC`
  ).bind(id, userId).all();

  return c.json({ container: { ...container, items: items.results } });
});

containers.patch("/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const body = await c.req.json<{ name?: string; description?: string; location_id?: string | null }>();

  const existing = await c.env.DB.prepare(
    "SELECT id FROM containers WHERE id = ? AND user_id = ?"
  ).bind(id, userId).first();
  if (!existing) return c.json({ error: "Not found" }, 404);

  const updates: string[] = [];
  const values: (string | null)[] = [];
  if (body.name !== undefined) { updates.push("name = ?"); values.push(body.name.trim()); }
  if (body.description !== undefined) { updates.push("description = ?"); values.push(body.description?.trim() || null); }
  if (body.location_id !== undefined) { updates.push("location_id = ?"); values.push(body.location_id); }

  if (updates.length > 0) {
    values.push(id, userId);
    await c.env.DB.prepare(
      `UPDATE containers SET ${updates.join(", ")} WHERE id = ? AND user_id = ?`
    ).bind(...values).run();
  }

  const container = await c.env.DB.prepare(
    "SELECT id, name, description, location_id, created_at FROM containers WHERE id = ?"
  ).bind(id).first();
  return c.json({ container });
});

containers.delete("/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");

  const existing = await c.env.DB.prepare(
    "SELECT id FROM containers WHERE id = ? AND user_id = ?"
  ).bind(id, userId).first();
  if (!existing) return c.json({ error: "Not found" }, 404);

  await c.env.DB.prepare(
    "UPDATE items SET container_id = NULL WHERE container_id = ? AND user_id = ?"
  ).bind(id, userId).run();

  await c.env.DB.prepare(
    "DELETE FROM containers WHERE id = ? AND user_id = ?"
  ).bind(id, userId).run();

  return c.json({ ok: true });
});

export { containers };
