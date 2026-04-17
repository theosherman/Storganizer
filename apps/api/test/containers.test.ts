import { env } from "cloudflare:test";
import { createTestUser, createTestLocation, createTestItem, authRequest } from "./helpers";

describe("POST /api/containers", () => {
  it("creates a container without a location", async () => {
    const user = await createTestUser();
    const res = await authRequest("/api/containers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Blue Bin #3" }),
    }, user.id);
    expect(res.status).toBe(201);
    const data = await res.json() as any;
    expect(data.container.name).toBe("Blue Bin #3");
    expect(data.container.location_id).toBeNull();
  });

  it("creates a container with a location", async () => {
    const user = await createTestUser();
    const location = await createTestLocation(user.id, { name: "Attic" });
    const res = await authRequest("/api/containers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Blue Bin #3", location_id: location.id }),
    }, user.id);
    expect(res.status).toBe(201);
    const data = await res.json() as any;
    expect(data.container.location_id).toBe(location.id);
  });

  it("rejects empty name", async () => {
    const user = await createTestUser();
    const res = await authRequest("/api/containers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "" }),
    }, user.id);
    expect(res.status).toBe(400);
  });
});

describe("GET /api/containers", () => {
  it("returns containers for authenticated user", async () => {
    const user = await createTestUser();
    await authRequest("/api/containers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Box A" }),
    }, user.id);

    const res = await authRequest("/api/containers", {}, user.id);
    expect(res.status).toBe(200);
    const data = await res.json() as any;
    expect(data.containers).toHaveLength(1);
    expect(data.containers[0].name).toBe("Box A");
  });

  it("filters by location_id", async () => {
    const user = await createTestUser();
    const loc = await createTestLocation(user.id, { name: "Attic" });
    await authRequest("/api/containers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Attic Box", location_id: loc.id }),
    }, user.id);
    await authRequest("/api/containers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Floating Box" }),
    }, user.id);

    const res = await authRequest(`/api/containers?location_id=${loc.id}`, {}, user.id);
    const data = await res.json() as any;
    expect(data.containers).toHaveLength(1);
    expect(data.containers[0].name).toBe("Attic Box");
  });
});

describe("GET /api/containers/:id", () => {
  it("returns container with its items", async () => {
    const user = await createTestUser();
    const createRes = await authRequest("/api/containers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Parts Drawer" }),
    }, user.id);
    const { container } = await createRes.json() as any;
    await createTestItem(user.id, { name: "Resistor Pack", container_id: container.id });

    const res = await authRequest(`/api/containers/${container.id}`, {}, user.id);
    const data = await res.json() as any;
    expect(data.container.name).toBe("Parts Drawer");
    expect(data.container.items).toHaveLength(1);
    expect(data.container.items[0].name).toBe("Resistor Pack");
  });

  it("returns 404 for nonexistent", async () => {
    const user = await createTestUser();
    const res = await authRequest("/api/containers/nonexistent", {}, user.id);
    expect(res.status).toBe(404);
  });
});

describe("PATCH /api/containers/:id", () => {
  it("updates container name and location", async () => {
    const user = await createTestUser();
    const loc = await createTestLocation(user.id, { name: "Garage" });
    const createRes = await authRequest("/api/containers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Old Name" }),
    }, user.id);
    const { container } = await createRes.json() as any;

    const res = await authRequest(`/api/containers/${container.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "New Name", location_id: loc.id }),
    }, user.id);
    expect(res.status).toBe(200);
    const data = await res.json() as any;
    expect(data.container.name).toBe("New Name");
    expect(data.container.location_id).toBe(loc.id);
  });
});

describe("DELETE /api/containers/:id", () => {
  it("deletes container and unassigns items", async () => {
    const user = await createTestUser();
    const createRes = await authRequest("/api/containers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Temp Box" }),
    }, user.id);
    const { container } = await createRes.json() as any;
    const item = await createTestItem(user.id, { name: "Widget", container_id: container.id });

    const res = await authRequest(`/api/containers/${container.id}`, {
      method: "DELETE",
    }, user.id);
    expect(res.status).toBe(200);

    const dbItem = await env.DB.prepare(
      "SELECT id, container_id FROM items WHERE id = ?"
    ).bind(item.id).first<{ id: string; container_id: string | null }>();
    expect(dbItem).toBeDefined();
    expect(dbItem!.container_id).toBeNull();
  });
});
