// Blackbaud rotates the refresh token every time it's used — the old one
// stops working the moment a new one is issued. Storing it only in a
// Vercel environment variable means the dashboard breaks after the first
// live data pull, since nothing saves the new token anywhere.
//
// This stores the current refresh token in a small Redis store (via
// Vercel's "Upstash for Redis" marketplace integration) instead, so it's
// read fresh and updated automatically on every sync. If that integration
// isn't set up yet, this quietly falls back to the environment variable —
// so the app still works, it just won't stay connected long-term until
// Redis is added (see README).

const KEY = "blackbaud_refresh_token";

function redisConfigured() {
    // Redis.fromEnv() checks KV_REST_API_URL/TOKEN first, then falls back to
  // UPSTASH_REDIS_REST_URL/TOKEN — covers both naming conventions Vercel's
  // marketplace integrations may use.
  return (
        (!!process.env.KV_REST_API_URL && !!process.env.KV_REST_API_TOKEN) ||
        (!!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN)
      );
}

export async function getStoredRefreshToken(): Promise<string> {
    if (redisConfigured()) {
          try {
                  const { Redis } = await import("@upstash/redis");
                  const redis = Redis.fromEnv();
                  const stored = await redis.get<string>(KEY);
                  if (stored) return stored;
          } catch (err) {
                  console.error("Redis read failed, falling back to env var:", err);
          }
    }
    return process.env.BLACKBAUD_REFRESH_TOKEN || "";
}

export async function saveRefreshToken(token: string): Promise<void> {
    if (!redisConfigured()) return; // nothing to persist to — env var stays static
  try {
        const { Redis } = await import("@upstash/redis");
        const redis = Redis.fromEnv();
        await redis.set(KEY, token);
  } catch (err) {
        console.error("Redis write failed — next refresh may fail:", err);
  }
}
