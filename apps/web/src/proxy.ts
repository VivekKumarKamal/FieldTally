import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Baseline security headers for every response.
 *
 * Next 16 renamed the `middleware` file convention to `proxy` — see
 * node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md.
 *
 * This deliberately does no authentication: auth lives in the route handlers,
 * which is the only place it can be enforced reliably. Proxy runs at the edge
 * and is documented as not being a place to depend on shared modules or globals.
 */

const SECURITY_HEADERS: Record<string, string> = {
  // Don't let the browser second-guess a declared content type.
  "X-Content-Type-Options": "nosniff",
  // Public form pages are meant to be embedded nowhere by default.
  "X-Frame-Options": "DENY",
  // Send the origin only on cross-origin requests, never the full path.
  "Referrer-Policy": "strict-origin-when-cross-origin",
  // The app requests geolocation and camera itself; deny everything else.
  "Permissions-Policy": "geolocation=(self), camera=(self), microphone=(), payment=()",
};

export function proxy(request: NextRequest) {
  const response = NextResponse.next();

  for (const [header, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(header, value);
  }

  // API responses carry user data — keep them out of shared and browser caches.
  if (request.nextUrl.pathname.startsWith("/api/")) {
    response.headers.set("Cache-Control", "no-store, private");
  }

  return response;
}

export const config = {
  // Skip Next's internals and static assets — they gain nothing from these headers.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|mp4)$).*)"],
};
