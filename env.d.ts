declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    APP_PIN: string;
    SESSION_SECRET: string;
  }
}
