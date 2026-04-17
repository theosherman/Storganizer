export interface Env {
  DB: D1Database;
  STORAGE: R2Bucket;
  IMAGE_QUEUE: Queue<{ item_id: string; photo_r2_key: string }>;
  AI: Ai;
  ADMIN_EMAIL: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  JWT_SECRET: string;
  FRONTEND_URL: string;
}

declare module "cloudflare:workers" {
  interface ProvidedEnv extends Env {}
}
