import { createMessageBatch, createExecutionContext, getQueueResult, env } from "cloudflare:test";
import worker from "../src/index";
import { createTestUser } from "./helpers";
import { ulid } from "../src/lib/ulid";

const PNG_BYTES = new Uint8Array([
  137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82,0,0,0,1,0,0,0,1,8,2,0,0,0,
  144,119,83,222,0,0,0,12,73,68,65,84,8,215,99,248,207,192,0,0,0,3,0,1,54,
  40,207,136,0,0,0,0,73,69,78,68,174,66,96,130
]);

describe("Queue consumer", () => {
  it("processes image and sets AI label", async () => {
    const user = await createTestUser();
    const itemId = ulid();
    const photoId = ulid();
    const r2Key = `${user.id}/${itemId}/${photoId}.png`;

    await env.DB.prepare(
      "INSERT INTO items (id, user_id, name, status) VALUES (?, ?, 'Processing...', 'processing')"
    ).bind(itemId, user.id).run();

    await env.STORAGE.put(r2Key, PNG_BYTES);

    await env.DB.prepare(
      "INSERT INTO item_photos (id, item_id, r2_key) VALUES (?, ?, ?)"
    ).bind(photoId, itemId, r2Key).run();

    const batch = createMessageBatch("storganizer-image-queue", [
      { id: "msg-1", timestamp: new Date(), attempts: 1, body: { item_id: itemId, photo_r2_key: r2Key } },
    ]);
    const ctx = createExecutionContext();
    await worker.queue!(batch, env, ctx);
    const result = await getQueueResult(batch, ctx);
    expect(result.ackAll).toBe(true);

    const item = await env.DB.prepare(
      "SELECT name, ai_label, status FROM items WHERE id = ?"
    ).bind(itemId).first<{ name: string; ai_label: string; status: string }>();
    expect(item!.status).toBe("ready");
    expect(item!.name).not.toBe("Processing...");
  });

  it("handles AI failure gracefully", async () => {
    const user = await createTestUser();
    const itemId = ulid();

    await env.DB.prepare(
      "INSERT INTO items (id, user_id, name, status) VALUES (?, ?, 'Processing...', 'processing')"
    ).bind(itemId, user.id).run();

    const batch = createMessageBatch("storganizer-image-queue", [
      { id: "msg-2", timestamp: new Date(), attempts: 1, body: { item_id: itemId, photo_r2_key: "nonexistent" } },
    ]);
    const ctx = createExecutionContext();
    await worker.queue!(batch, env, ctx);
    const result = await getQueueResult(batch, ctx);
    expect(result.ackAll).toBe(true);

    const item = await env.DB.prepare(
      "SELECT name, status FROM items WHERE id = ?"
    ).bind(itemId).first<{ name: string; status: string }>();
    expect(item!.status).toBe("ready");
    expect(item!.name).toBe("Unknown item");
  });
});
