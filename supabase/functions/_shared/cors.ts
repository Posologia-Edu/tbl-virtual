// Shared CORS helper for all edge functions called from the browser.
// Echoes the request's Origin back only when it matches a known app origin
// (production domain, Cloudflare Pages preview subdomains, legacy Lovable
// domains kept while the two run in parallel, or local dev), instead of
// blindly allowing "*". These functions authenticate via Bearer tokens (not
// cookies), so a wide-open CORS policy isn't itself exploitable, but scoping
// it is basic defense-in-depth and avoids exposing responses to arbitrary
// third-party pages via fetch().
const DEFAULT_ORIGIN = "https://tbl.posologia.app";

const ALLOWED_ORIGIN_PATTERNS = [
  /^https:\/\/([a-z0-9-]+\.)?tbl-virtual\.pages\.dev$/i,
  /^https:\/\/[a-z0-9-]+\.lovable\.app$/i,
  /^https:\/\/[a-z0-9-]+\.lovableproject\.com$/i,
  /^http:\/\/localhost:\d+$/i,
];

function isAllowedOrigin(origin: string): boolean {
  return origin === DEFAULT_ORIGIN || ALLOWED_ORIGIN_PATTERNS.some((re) => re.test(origin));
}

export function getCorsHeaders(req: Request, allowHeaders: string): Record<string, string> {
  const origin = req.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": isAllowedOrigin(origin) ? origin : DEFAULT_ORIGIN,
    "Access-Control-Allow-Headers": allowHeaders,
    "Vary": "Origin",
  };
}

export const CORS_HEADERS_LONG =
  "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version";
export const CORS_HEADERS_SHORT = "authorization, x-client-info, apikey, content-type";
