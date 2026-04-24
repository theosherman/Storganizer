import { env, createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { createTestUser, authRequest } from "./helpers";
import { app } from "../src/index";

const PNG_BYTES = new Uint8Array([
  137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82,0,0,0,1,0,0,0,1,8,2,0,0,0,
  144,119,83,222,0,0,0,12,73,68,65,84,8,215,99,248,207,192,0,0,0,3,0,1,54,
  40,207,136,0,0,0,0,73,69,78,68,174,66,96,130
]);

describe("POST /api/items/upload", () => {
  it("responds 201 with status='uploading' before R2/queue work completes", async () => {
    const user = await createTestUser();

    const formData = new FormData();
    formData.append("photo", new Blob([PNG_BYTES], { type: "image/png" }), "test.png");

    const res = await authRequest("/api/items/upload", {
      method: "POST",
      body: formData,
    }, user.id);

    expect(res.status).toBe(201);
    const data = await res.json() as any;
    expect(data.item.status).toBe("uploading");
    expect(data.item.name).toBe("Processing...");
    expect(data.item.id).toBeDefined();

    // The row exists in D1 at response time.
    const row = await env.DB.prepare(
      "SELECT id, status FROM items WHERE id = ?"
    ).bind(data.item.id).first<{ id: string; status: string }>();
    expect(row).not.toBeNull();
    expect(row!.status).toBe("uploading");
  });

  it("after waitUntil settles, status='processing', R2 object exists, and queue got a message", async () => {
    const user = await createTestUser();

    const formData = new FormData();
    formData.append("photo", new Blob([PNG_BYTES], { type: "image/png" }), "test.png");

    const headers = new Headers();
    headers.set("x-test-user-id", user.id);
    const ctx = createExecutionContext();
    const res = await app.request("/api/items/upload",
      { method: "POST", headers, body: formData },
      env, ctx
    );

    expect(res.status).toBe(201);
    const data = await res.json() as any;

    await waitOnExecutionContext(ctx);

    const row = await env.DB.prepare(
      "SELECT status FROM items WHERE id = ?"
    ).bind(data.item.id).first<{ status: string }>();
    expect(row!.status).toBe("processing");

    const photo = await env.DB.prepare(
      "SELECT r2_key FROM item_photos WHERE item_id = ?"
    ).bind(data.item.id).first<{ r2_key: string }>();
    expect(photo).not.toBeNull();

    const obj = await env.STORAGE.get(photo!.r2_key);
    expect(obj).not.toBeNull();
  });

  it("rejects request without photo", async () => {
    const user = await createTestUser();
    const res = await authRequest("/api/items/upload", {
      method: "POST",
      body: new FormData(),
    }, user.id);
    expect(res.status).toBe(400);
  });

  it("flips status to 'upload_failed' if R2 put throws, and skips the queue", async () => {
    const user = await createTestUser();

    const formData = new FormData();
    formData.append("photo", new Blob([PNG_BYTES], { type: "image/png" }), "test.png");

    const originalPut = env.STORAGE.put.bind(env.STORAGE);
    (env.STORAGE as any).put = async () => {
      throw new Error("simulated R2 failure");
    };

    try {
      const headers = new Headers();
      headers.set("x-test-user-id", user.id);
      const ctx = createExecutionContext();
      const res = await app.request("/api/items/upload",
        { method: "POST", headers, body: formData },
        env, ctx
      );
      expect(res.status).toBe(201);
      const data = await res.json() as any;
      await waitOnExecutionContext(ctx);

      const row = await env.DB.prepare(
        "SELECT status FROM items WHERE id = ?"
      ).bind(data.item.id).first<{ status: string }>();
      expect(row!.status).toBe("upload_failed");

      const photo = await env.DB.prepare(
        "SELECT r2_key FROM item_photos WHERE item_id = ?"
      ).bind(data.item.id).first();
      expect(photo).toBeNull();
    } finally {
      (env.STORAGE as any).put = originalPut;
    }
  });
});
