import { createTestUser, authRequest } from "./helpers";

describe("POST /api/admin/invite", () => {
  it("admin can invite an email", async () => {
    const admin = await createTestUser({ role: "admin" });
    const res = await authRequest("/api/admin/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "friend@example.com" }),
    }, admin.id);
    expect(res.status).toBe(201);
  });

  it("non-admin cannot invite", async () => {
    const member = await createTestUser({ role: "member" });
    const res = await authRequest("/api/admin/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "friend@example.com" }),
    }, member.id);
    expect(res.status).toBe(403);
  });
});

describe("GET /api/admin/invites", () => {
  it("admin can list invited emails", async () => {
    const admin = await createTestUser({ role: "admin" });
    await authRequest("/api/admin/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "a@b.com" }),
    }, admin.id);

    const res = await authRequest("/api/admin/invites", {}, admin.id);
    expect(res.status).toBe(200);
    const data = await res.json() as any;
    expect(data.invites.some((i: any) => i.email === "a@b.com")).toBe(true);
  });
});

describe("DELETE /api/admin/invite/:email", () => {
  it("admin can remove an invite", async () => {
    const admin = await createTestUser({ role: "admin" });
    await authRequest("/api/admin/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "remove@me.com" }),
    }, admin.id);

    const res = await authRequest("/api/admin/invite/remove@me.com", {
      method: "DELETE",
    }, admin.id);
    expect(res.status).toBe(200);

    const listRes = await authRequest("/api/admin/invites", {}, admin.id);
    const data = await listRes.json() as any;
    expect(data.invites.some((i: any) => i.email === "remove@me.com")).toBe(false);
  });
});
