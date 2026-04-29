import { createStart } from "@tanstack/react-start";
import { createMiddleware } from "@tanstack/react-start";
import { setResponseHeaders } from "@tanstack/react-start/server";

// Baseline security headers applied to every server-rendered response.
// CSP is intentionally permissive enough to allow the Supabase REST/Realtime
// endpoint, Google Fonts, and inline styles emitted by Tailwind/Vite, while
// still blocking arbitrary third-party script execution.
const securityHeadersMiddleware = createMiddleware({ type: "request" }).server(
  async ({ next }) => {
    const supabaseUrl = process.env.SUPABASE_URL ?? "";
    const supabaseHost = supabaseUrl ? new URL(supabaseUrl).host : "";

    const csp = [
      "default-src 'self'",
      `connect-src 'self' https://${supabaseHost} wss://${supabaseHost} https://*.lovable.app https://*.lovableproject.com`,
      "img-src 'self' data: blob: https:",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' data: https://fonts.gstatic.com",
      // 'unsafe-inline' needed for hydration scripts; 'unsafe-eval' for some
      // dev tooling. In a future iteration consider switching to nonces.
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self' https://wa.me",
      "object-src 'none'",
    ].join("; ");

    setResponseHeaders({
      "Content-Security-Policy": csp,
      "X-Frame-Options": "DENY",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
      "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
    });

    return next();
  },
);

export const startInstance = createStart(() => ({
  requestMiddleware: [securityHeadersMiddleware],
}));
