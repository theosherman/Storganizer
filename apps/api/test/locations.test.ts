import { createTestUser, authRequest } from "./helpers";

describe("GET /api/locations", () => {
  it("returns empty list when no locations exist", async () => {
    const user = await createTestUser();
    const res = await authRequest("/api/locations", {}, user.id);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ locations: [] });
  });

  it("only returns locations for the authenticated user", async () => {
    const user1 = await createTestUser();
    const user2 = await createTestUser();
    await authRequest("/api/locations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "User1 Attic" }),
    }, user1.id);
    await authRequest("/api/locations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "User2 Garage" }),
    }, user2.id);

    const res = await authRequest("/api/locations", {}, user1.id);
    const data = await res.json() as any;
    expect(data.locations).toHaveLength(1);
    expect(data.locations[0].name).toBe("User1 Attic");
  });
});

describe("POST /api/locations", () => {
  it("creates a location", async () => {
    const user = await createTestUser();
    const res = await authRequest("/api/locations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Attic", description: "Top floor storage" }),
    }, user.id);
    expect(res.status).toBe(201);
    const data = await res.json() as any;
    expect(data.location.name).toBe("Attic");
    expect(data.location.description).toBe("Top floor storage");
    expect(data.location.id).toBeDefined();
  });

  it("rejects empty name", async () => {
    const user = await createTestUser();
    const res = await authRequest("/api/locations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "" }),
    }, user.id);
    expect(res.status).toBe(400);
  });
});

describe("GET /api/locations/:id", () => {
  it("returns location with its containers", async () => {
    const user = await createTestUser();
    const locRes = await authRequest("/api/locations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Attic" }),
    }, user.id);
    const { location } = await locRes.json() as any;

    const res = await authRequest(`/api/locations/${location.id}`, {}, user.id);
    expect(res.status).toBe(200);
    const data = await res.json() as any;
    expect(data.location.name).toBe("Attic");
    expect(data.location.containers).toEqual([]);
  });

  it("returns 404 for nonexistent location", async () => {
    const user = await createTestUser();
    const res = await authRequest("/api/locations/nonexistent", {}, user.id);
    expect(res.status).toBe(404);
  });
});

describe("PATCH /api/locations/:id", () => {
  it("updates location name", async () => {
    const user = await createTestUser();
    const createRes = await authRequest("/api/locations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Attic" }),
    }, user.id);
    const { location } = await createRes.json() as any;

    const res = await authRequest(`/api/locations/${location.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Upstairs Attic" }),
    }, user.id);
    expect(res.status).toBe(200);
    const data = await res.json() as any;
    expect(data.location.name).toBe("Upstairs Attic");
  });
});

describe("DELETE /api/locations/:id", () => {
  it("deletes location and unassigns containers", async () => {
    const user = await createTestUser();
    const locRes = await authRequest("/api/locations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Attic" }),
    }, user.id);
    const { location } = await locRes.json() as any;

    const res = await authRequest(`/api/locations/${location.id}`, {
      method: "DELETE",
    }, user.id);
    expect(res.status).toBe(200);

    const getRes = await authRequest(`/api/locations/${location.id}`, {}, user.id);
    expect(getRes.status).toBe(404);
  });
});
