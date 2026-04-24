import { Hono } from "hono";
import type { Env } from "../env";
import { ulid } from "../lib/ulid";

type AuthVariables = { userId: string };

const items = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

items.post("/upload", async (c) => {
  const userId = c.get("userId");

  const formData = await c.req.formData();
  const photo = formData.get("photo");
  if (!photo || !(photo instanceof File)) {
    return c.json({ error: "Photo is required" }, 400);
  }

  const containerIdRaw = formData.get("container_id");
  const containerId =
    typeof containerIdRaw === "string" && containerIdRaw.length > 0 ? containerIdRaw : null;

  if (containerId) {
    const container = await c.env.DB.prepare(
      "SELECT id FROM containers WHERE id = ? AND user_id = ?"
    ).bind(containerId, userId).first();
    if (!container) {
      return c.json({ error: "Container not found" }, 400);
    }
  }

  const itemId = ulid();
  const photoId = ulid();
  const ext = photo.name.split(".").pop() || "jpg";
  const r2Key = `${userId}/${itemId}/${photoId}.${ext}`;
  const contentType = photo.type;
  const arrayBuffer = await photo.arrayBuffer();

  await c.env.DB.prepare(
    "INSERT INTO items (id, user_id, name, status, container_id) VALUES (?, ?, 'Processing...', 'uploading', ?)"
  ).bind(itemId, userId, containerId).run();

  const item = await c.env.DB.prepare(
    `SELECT i.id, i.name, i.ai_label, i.status, i.container_id, i.created_at,
     c.name as container_name
     FROM items i LEFT JOIN containers c ON c.id = i.container_id
     WHERE i.id = ?`
  ).bind(itemId).first();

  c.executionCtx.waitUntil((async () => {
    try {
      await c.env.STORAGE.put(r2Key, arrayBuffer, {
        httpMetadata: { contentType },
      });
      await c.env.DB.prepare(
        "INSERT INTO item_photos (id, item_id, r2_key) VALUES (?, ?, ?)"
      ).bind(photoId, itemId, r2Key).run();
      await c.env.IMAGE_QUEUE.send({ item_id: itemId, photo_r2_key: r2Key });
      await c.env.DB.prepare(
        "UPDATE items SET status = 'processing' WHERE id = ? AND status = 'uploading'"
      ).bind(itemId).run();
    } catch (err) {
      console.error(`Upload background work failed for item ${itemId}:`, err);
      try {
        await c.env.DB.prepare(
          "UPDATE items SET status = 'upload_failed' WHERE id = ? AND status = 'uploading'"
        ).bind(itemId).run();
      } catch (updateErr) {
        console.error(`Also failed to mark item ${itemId} upload_failed:`, updateErr);
      }
    }
  })());

  return c.json({ item }, 201);
});

items.get("/", async (c) => {
  const userId = c.get("userId");
  const q = c.req.query("q");
  const status = c.req.query("status");
  const unorganized = c.req.query("unorganized");

  let sql = `SELECT i.id, i.name, i.ai_label, i.description, i.status, i.container_id, i.created_at,
    c.name as container_name, l.name as location_name,
    (SELECT r2_key FROM item_photos WHERE item_id = i.id LIMIT 1) as thumbnail_key
    FROM items i
    LEFT JOIN containers c ON c.id = i.container_id
    LEFT JOIN locations l ON l.id = c.location_id
    WHERE i.user_id = ?`;
  const params: (string | null)[] = [userId];

  if (unorganized === "true") {
    sql += " AND i.container_id IS NULL";
  }
  if (status) {
    sql += " AND i.status = ?";
    params.push(status);
  }
  if (q) {
    sql += " AND (i.name LIKE ? OR i.ai_label LIKE ? OR i.description LIKE ? OR c.name LIKE ? OR l.name LIKE ?)";
    const pattern = `%${q}%`;
    params.push(pattern, pattern, pattern, pattern, pattern);
  }

  sql += " ORDER BY i.created_at DESC";

  const result = await c.env.DB.prepare(sql).bind(...params).all();
  return c.json({ items: result.results });
});

items.get("/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");

  const item = await c.env.DB.prepare(
    `SELECT i.id, i.name, i.ai_label, i.description, i.status, i.container_id, i.created_at,
     c.name as container_name, c.location_id, l.name as location_name
     FROM items i
     LEFT JOIN containers c ON c.id = i.container_id
     LEFT JOIN locations l ON l.id = c.location_id
     WHERE i.id = ? AND i.user_id = ?`
  ).bind(id, userId).first();
  if (!item) return c.json({ error: "Not found" }, 404);

  const photos = await c.env.DB.prepare(
    "SELECT id, r2_key, thumbnail_url, created_at FROM item_photos WHERE item_id = ? ORDER BY created_at ASC"
  ).bind(id).all();

  return c.json({ item: { ...item, photos: photos.results } });
});

items.patch("/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const body = await c.req.json<{ name?: string; description?: string; container_id?: string | null }>();

  const existing = await c.env.DB.prepare(
    "SELECT id FROM items WHERE id = ? AND user_id = ?"
  ).bind(id, userId).first();
  if (!existing) return c.json({ error: "Not found" }, 404);

  const updates: string[] = [];
  const values: (string | null)[] = [];
  if (body.name !== undefined) { updates.push("name = ?"); values.push(body.name.trim()); }
  if (body.description !== undefined) { updates.push("description = ?"); values.push(body.description?.trim() || null); }
  if (body.container_id !== undefined) { updates.push("container_id = ?"); values.push(body.container_id); }

  if (updates.length > 0) {
    values.push(id, userId);
    await c.env.DB.prepare(
      `UPDATE items SET ${updates.join(", ")} WHERE id = ? AND user_id = ?`
    ).bind(...values).run();
  }

  const item = await c.env.DB.prepare(
    `SELECT i.id, i.name, i.ai_label, i.description, i.status, i.container_id, i.created_at,
     c.name as container_name
     FROM items i LEFT JOIN containers c ON c.id = i.container_id
     WHERE i.id = ?`
  ).bind(id).first();
  return c.json({ item });
});

items.delete("/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");

  const existing = await c.env.DB.prepare(
    "SELECT id FROM items WHERE id = ? AND user_id = ?"
  ).bind(id, userId).first();
  if (!existing) return c.json({ error: "Not found" }, 404);

  const photos = await c.env.DB.prepare(
    "SELECT r2_key FROM item_photos WHERE item_id = ?"
  ).bind(id).all();

  for (const photo of photos.results) {
    await c.env.STORAGE.delete(photo.r2_key as string);
  }

  await c.env.DB.prepare(
    "DELETE FROM items WHERE id = ? AND user_id = ?"
  ).bind(id, userId).run();

  return c.json({ ok: true });
});

export { items };
