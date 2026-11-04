// Single source of the session-signing secret, shared by lib/auth.ts and
// middleware.ts. In production a real AUTH_SECRET is required and the process
// refuses to sign/verify sessions without one; locally a dev fallback keeps a
// fresh checkout running. Edge-runtime safe (middleware.ts runs there on
// Netlify) -- plain process.env reads and TextEncoder only, no node: imports.

const DEV_FALLBACK = "dev-only-secret-change-me-in-production";
const MIN_LENGTH = 32;

let warned = false;

function resolve(): string {
  const configured = process.env.AUTH_SECRET?.trim();
  const isProduction = process.env.NODE_ENV === "production";

  if (configured && configured !== DEV_FALLBACK && configured.length >= MIN_LENGTH) {
    return configured;
  }

  if (isProduction) {
    const reason = !configured
      ? "AUTH_SECRET is not set"
      : configured === DEV_FALLBACK
        ? "AUTH_SECRET is still the development placeholder"
        : `AUTH_SECRET is too short (${configured.length} chars; needs at least ${MIN_LENGTH})`;
    throw new Error(
      `${reason}. Set AUTH_SECRET in the site's environment variables. Generate one with: ` +
        `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`
    );
  }

  if (!warned) {
    warned = true;
    console.warn("[auth] Using the built-in development AUTH_SECRET. Any deployment must set a real AUTH_SECRET.");
  }
  return DEV_FALLBACK;
}

export function authSecretKey(): Uint8Array {
  return new TextEncoder().encode(resolve());
}
