import { env } from "cloudflare:test";
import { ulid } from "../src/lib/ulid";
import { app } from "../src/index";

export async function createTestUser(overrides: Partial<{
  id: string;
  google_id: string;
  email: string;
  name: string;
  role: string;
}> = {}) {
  const id = overrides.id ?? ulid();
  const user = {
    id,
    google_id: overrides.google_id ?? `google_${id}`,
    email: overrides.email ?? `${id}@test.com`,
    name: overrides.name ?? "Test User",
    role: overrides.role ?? "member",
  };
  await env.DB.prepare(
    "INSERT INTO users (id, google_id, email, name, role) VALUES (?, ?, ?, ?, ?)"
  ).bind(user.id, user.google_id, user.email, user.name, user.role).run();
  return user;
}

export async function createTestLocation(userId: string, overrides: Partial<{
  id: string;
  name: string;
  description: string;
}> = {}) {
  const id = overrides.id ?? ulid();
  const name = overrides.name ?? "Test Location";
  const description = overrides.description ?? null;
  await env.DB.prepare(
    "INSERT INTO locations (id, user_id, name, description) VALUES (?, ?, ?, ?)"
  ).bind(id, userId, name, description).run();
  return { id, user_id: userId, name, description };
}

export async function createTestContainer(userId: string, overrides: Partial<{
  id: string;
  name: string;
  location_id: string | null;
}> = {}) {
  const id = overrides.id ?? ulid();
  const name = overrides.name ?? "Test Container";
  const location_id = overrides.location_id ?? null;
  await env.DB.prepare(
    "INSERT INTO containers (id, user_id, name, location_id) VALUES (?, ?, ?, ?)"
  ).bind(id, userId, name, location_id).run();
  return { id, user_id: userId, name, location_id };
}

export async function createTestItem(userId: string, overrides: Partial<{
  id: string;
  name: string;
  container_id: string | null;
  ai_label: string | null;
  description: string | null;
  status: string;
}> = {}) {
  const id = overrides.id ?? ulid();
  const name = overrides.name ?? "Test Item";
  const container_id = overrides.container_id ?? null;
  const ai_label = overrides.ai_label ?? null;
  const description = overrides.description ?? null;
  const status = overrides.status ?? "ready";
  await env.DB.prepare(
    "INSERT INTO items (id, user_id, container_id, name, ai_label, description, status) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).bind(id, userId, container_id, name, ai_label, description, status).run();
  return { id, user_id: userId, name, container_id, ai_label, description, status };
}

export function authRequest(path: string, init: RequestInit = {}, userId: string) {
  const headers = new Headers(init.headers);
  headers.set("x-test-user-id", userId);
  return app.request(path, { ...init, headers }, env);
}
