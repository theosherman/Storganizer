import { createTestUser, createTestContainer, createTestItem, createTestLocation, authRequest } from "./helpers";

describe("Search /api/items?q=", () => {
  it("finds items by name", async () => {
    const user = await createTestUser();
    await createTestItem(user.id, { name: "USB-C Cable" });
    await createTestItem(user.id, { name: "HDMI Adapter" });

    const res = await authRequest("/api/items?q=USB", {}, user.id);
    const data = await res.json() as any;
    expect(data.items).toHaveLength(1);
    expect(data.items[0].name).toBe("USB-C Cable");
  });

  it("finds items by ai_label", async () => {
    const user = await createTestUser();
    await createTestItem(user.id, { name: "Custom Name", ai_label: "Arduino Nano microcontroller" });

    const res = await authRequest("/api/items?q=Arduino", {}, user.id);
    const data = await res.json() as any;
    expect(data.items).toHaveLength(1);
    expect(data.items[0].name).toBe("Custom Name");
  });

  it("finds items by container name", async () => {
    const user = await createTestUser();
    const container = await createTestContainer(user.id, { name: "Electronics Bin" });
    await createTestItem(user.id, { name: "Resistor", container_id: container.id });

    const res = await authRequest("/api/items?q=Electronics", {}, user.id);
    const data = await res.json() as any;
    expect(data.items).toHaveLength(1);
    expect(data.items[0].container_name).toBe("Electronics Bin");
  });

  it("finds items by location name", async () => {
    const user = await createTestUser();
    const loc = await createTestLocation(user.id, { name: "Attic" });
    const container = await createTestContainer(user.id, { name: "Box", location_id: loc.id });
    await createTestItem(user.id, { name: "Old Photo Album", container_id: container.id });

    const res = await authRequest("/api/items?q=Attic", {}, user.id);
    const data = await res.json() as any;
    expect(data.items).toHaveLength(1);
    expect(data.items[0].location_name).toBe("Attic");
  });

  it("returns breadcrumb trail in results", async () => {
    const user = await createTestUser();
    const loc = await createTestLocation(user.id, { name: "Garage Shelf B" });
    const container = await createTestContainer(user.id, { name: "Parts Drawer", location_id: loc.id });
    await createTestItem(user.id, { name: "USB-C Cable", container_id: container.id });

    const res = await authRequest("/api/items?q=USB", {}, user.id);
    const data = await res.json() as any;
    expect(data.items[0].container_name).toBe("Parts Drawer");
    expect(data.items[0].location_name).toBe("Garage Shelf B");
  });

  it("returns empty results for no match", async () => {
    const user = await createTestUser();
    await createTestItem(user.id, { name: "Widget" });

    const res = await authRequest("/api/items?q=nonexistent", {}, user.id);
    const data = await res.json() as any;
    expect(data.items).toHaveLength(0);
  });

  it("case-insensitive search", async () => {
    const user = await createTestUser();
    await createTestItem(user.id, { name: "USB-C Cable" });

    const res = await authRequest("/api/items?q=usb-c", {}, user.id);
    const data = await res.json() as any;
    expect(data.items).toHaveLength(1);
  });
});
