import { createTestUser, createTestContainer, createTestItem, createTestLocation, authRequest } from "./helpers";

describe("GET /api/items", () => {
  it("returns all items for user", async () => {
    const user = await createTestUser();
    await createTestItem(user.id, { name: "USB Cable" });
    await createTestItem(user.id, { name: "HDMI Adapter" });

    const res = await authRequest("/api/items", {}, user.id);
    expect(res.status).toBe(200);
    const data = await res.json() as any;
    expect(data.items).toHaveLength(2);
  });

  it("filters unorganized items", async () => {
    const user = await createTestUser();
    const container = await createTestContainer(user.id);
    await createTestItem(user.id, { name: "Organized", container_id: container.id });
    await createTestItem(user.id, { name: "Loose" });

    const res = await authRequest("/api/items?unorganized=true", {}, user.id);
    const data = await res.json() as any;
    expect(data.items).toHaveLength(1);
    expect(data.items[0].name).toBe("Loose");
  });

  it("filters by status", async () => {
    const user = await createTestUser();
    await createTestItem(user.id, { name: "Done", status: "ready" });
    await createTestItem(user.id, { name: "Pending", status: "processing" });

    const res = await authRequest("/api/items?status=processing", {}, user.id);
    const data = await res.json() as any;
    expect(data.items).toHaveLength(1);
    expect(data.items[0].name).toBe("Pending");
  });
});

describe("GET /api/items/:id", () => {
  it("returns item with photos", async () => {
    const user = await createTestUser();
    const item = await createTestItem(user.id, { name: "Widget" });

    const res = await authRequest(`/api/items/${item.id}`, {}, user.id);
    expect(res.status).toBe(200);
    const data = await res.json() as any;
    expect(data.item.name).toBe("Widget");
    expect(data.item.photos).toEqual([]);
  });

  it("includes container and location info", async () => {
    const user = await createTestUser();
    const loc = await createTestLocation(user.id, { name: "Attic" });
    const container = await createTestContainer(user.id, { name: "Box 1", location_id: loc.id });
    const item = await createTestItem(user.id, { name: "Cable", container_id: container.id });

    const res = await authRequest(`/api/items/${item.id}`, {}, user.id);
    const data = await res.json() as any;
    expect(data.item.container_name).toBe("Box 1");
    expect(data.item.location_name).toBe("Attic");
  });
});

describe("PATCH /api/items/:id", () => {
  it("updates item name and container", async () => {
    const user = await createTestUser();
    const container = await createTestContainer(user.id, { name: "Box A" });
    const item = await createTestItem(user.id, { name: "Unknown item", ai_label: "Unknown item" });

    const res = await authRequest(`/api/items/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "USB-C Cable", container_id: container.id }),
    }, user.id);
    expect(res.status).toBe(200);
    const data = await res.json() as any;
    expect(data.item.name).toBe("USB-C Cable");
    expect(data.item.container_id).toBe(container.id);
  });

  it("preserves ai_label when name is edited", async () => {
    const user = await createTestUser();
    const item = await createTestItem(user.id, { name: "USB cable", ai_label: "USB cable" });

    await authRequest(`/api/items/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "USB-C to Lightning Cable (3ft)" }),
    }, user.id);

    const getRes = await authRequest(`/api/items/${item.id}`, {}, user.id);
    const data = await getRes.json() as any;
    expect(data.item.name).toBe("USB-C to Lightning Cable (3ft)");
    expect(data.item.ai_label).toBe("USB cable");
  });
});

describe("DELETE /api/items/:id", () => {
  it("deletes item", async () => {
    const user = await createTestUser();
    const item = await createTestItem(user.id, { name: "Trash" });

    const res = await authRequest(`/api/items/${item.id}`, {
      method: "DELETE",
    }, user.id);
    expect(res.status).toBe(200);

    const getRes = await authRequest(`/api/items/${item.id}`, {}, user.id);
    expect(getRes.status).toBe(404);
  });
});
