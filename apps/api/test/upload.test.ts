import { env } from "cloudflare:test";
import { createTestUser, authRequest } from "./helpers";

const PNG_BYTES = new Uint8Array([
  137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82,0,0,0,1,0,0,0,1,8,2,0,0,0,
  144,119,83,222,0,0,0,12,73,68,65,84,8,215,99,248,207,192,0,0,0,3,0,1,54,
  40,207,136,0,0,0,0,73,69,78,68,174,66,96,130
]);

describe("POST /api/items/upload", () => {
  it("uploads a photo and creates an item with processing status", async () => {
    const user = await createTestUser();

    const formData = new FormData();
    formData.append("photo", new Blob([PNG_BYTES], { type: "image/png" }), "test.png");

    const res = await authRequest("/api/items/upload", {
      method: "POST",
      body: formData,
    }, user.id);

    expect(res.status).toBe(201);
    const data = await res.json() as any;
    expect(data.item.status).toBe("processing");
    expect(data.item.name).toBe("Processing...");
    expect(data.item.id).toBeDefined();
  });

  it("stores image in R2", async () => {
    const user = await createTestUser();

    const formData = new FormData();
    formData.append("photo", new Blob([PNG_BYTES], { type: "image/png" }), "test.png");

    const res = await authRequest("/api/items/upload", {
      method: "POST",
      body: formData,
    }, user.id);
    const data = await res.json() as any;

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
});
