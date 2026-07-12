/**
 * Browser authority granted to Vellum's host application.
 *
 * Generated artifacts receive a much narrower, scriptless policy from the
 * generated-artifact boundary. This host policy deliberately permits only
 * local application resources and the local development transport.
 */
export const VELLUM_APP_CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'none'",
  "object-src 'none'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "media-src 'self' data: blob:",
  "frame-src 'self' blob:",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "connect-src 'self' http://127.0.0.1:* ws://127.0.0.1:* http://localhost:* ws://localhost:* http://[::1]:* ws://[::1]:*",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

export const VELLUM_BROWSER_SECURITY_HEADERS = Object.freeze({
  "Content-Security-Policy": VELLUM_APP_CONTENT_SECURITY_POLICY,
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "Permissions-Policy":
    "camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), bluetooth=()",
});
