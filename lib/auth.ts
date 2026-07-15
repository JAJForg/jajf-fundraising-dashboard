// Minimal signed-cookie auth. Good enough for a small internal/board
// dashboard with shared per-group passwords — not meant to replace real
// user accounts. Uses Web Crypto so it works in both middleware (edge)
// and API routes (node).

const encoder = new TextEncoder();

async function getKey(secret: string) {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

function toHex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function signValue(value: string): Promise<string> {
  const secret = process.env.SESSION_SECRET || "dev-secret-change-me";
  const key = await getKey(secret);
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return `${value}.${toHex(sig)}`;
}

export function randomState(): string {
  return toHex(crypto.getRandomValues(new Uint8Array(16)).buffer);
}

export async function verifyValue(cookieValue: string): Promise<string | null> {
  const [value, sig] = cookieValue.split(".");
  if (!value || !sig) return null;

  const expected = await signValue(value);
  return expected === cookieValue ? value : null;
}
