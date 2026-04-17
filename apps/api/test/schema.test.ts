import { env } from "cloudflare:test";

describe("D1 schema", () => {
  it("has all expected tables", async () => {
    const result = await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
    ).all();
    const tables = result.results.map((r: any) => r.name);
    expect(tables).toContain("users");
    expect(tables).toContain("allowed_emails");
    expect(tables).toContain("locations");
    expect(tables).toContain("containers");
    expect(tables).toContain("items");
    expect(tables).toContain("item_photos");
  });
});
