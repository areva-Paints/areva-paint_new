import crypto from "node:crypto";
import type { RequestHandler, ErrorRequestHandler } from "express";

// Only these public sites may embed the catalogue or read public content cross-origin.
// Admin/auth APIs always remain same-origin, even for an allowed public site.
export function publicOrigins(): string[] {
  return [
    ...new Set(
      [
        "https://areva-paint-new.onrender.com",
        "https://areva-paint-new-admin.onrender.com",
        ...(process.env.PUBLIC_SITE_ORIGINS || "").split(","),
      ]
        .map((value) => value.trim())
        .filter(Boolean)
        .map((value) => {
          const url = new URL(value);
          if (
            !["http:", "https:"].includes(url.protocol) ||
            url.username ||
            url.password ||
            url.origin !== value
          )
            throw Error(
              "PUBLIC_SITE_ORIGINS must contain comma-separated HTTP(S) origins without paths.",
            );
          return url.origin;
        }),
    ),
  ];
}

export const sensitiveRequestGuard: RequestHandler = (req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    const expected = `${req.protocol}://${req.get("host")}`;
    // Origin can be absent in non-browser clients. Fetch Metadata still blocks
    // cross-site browser requests, including Origin-less form/navigation attacks.
    if (
      req.get("sec-fetch-site") === "cross-site" ||
      (req.get("origin") && req.get("origin") !== expected)
    )
      return res
        .status(403)
        .json({ error: "Cross-origin requests are not allowed." });
    if (!req.is("application/json"))
      return res
        .status(415)
        .json({ error: "Send an application/json request." });
  }
  next();
};

export function securityHeaders(production: boolean): RequestHandler {
  const origins = publicOrigins();
  return (req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader(
      "Permissions-Policy",
      `camera=(self ${origins.map((v) => '"' + v + '"').join(" ")}), microphone=(), geolocation=()`,
    );
    if (production && req.secure)
      res.setHeader("Strict-Transport-Security", "max-age=31536000");
    const admin = /^\/(admin(?:\/|$)|api\/(?:admin|auth|project)(?:\/|$))/.test(
      req.path,
    );
    if (admin) {
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("X-Frame-Options", "DENY");
    }
    // A nonce permits the legacy page's reviewed inline script without permitting
    // event-handler attributes or arbitrary injected <script> elements.
    const nonce = crypto.randomBytes(18).toString("base64");
    res.locals.scriptNonce = nonce;
    if (production)
      res.setHeader(
        "Content-Security-Policy",
        [
          "default-src 'self'",
          `script-src 'self' 'nonce-${nonce}'`,
          "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
          "font-src 'self' https://fonts.gstatic.com data:",
          "img-src 'self' data: blob: https:",
          `connect-src 'self' ${origins.join(" ")} https://images.unsplash.com`,
          `frame-src 'self' ${origins.join(" ")}`,
          `frame-ancestors ${admin ? "'none'" : "'self' " + origins.join(" ")}`,
          "worker-src 'self' blob:",
          "media-src 'self' blob:",
          "object-src 'none'",
          "base-uri 'none'",
          "form-action 'self'",
        ].join("; "),
      );
    next();
  };
}

export const publicCors: RequestHandler = (req, res, next) => {
  const origin = req.get("origin");
  res.vary("Origin");
  if (origin && publicOrigins().includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
  }
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
};

// Bounded fixed windows: never evict an active blocked IP to admit a new one.
// This is a single-process backstop; multi-instance hosting needs a shared limiter.
export function rateLimit(
  max: number,
  windowMs: number,
  maxKeys = 4096,
): RequestHandler {
  const entries = new Map<string, { count: number; until: number }>();
  return (req, res, next) => {
    const now = Date.now();
    for (const [key, entry] of entries)
      if (entry.until <= now) entries.delete(key);
    const key = req.ip || "unknown";
    let entry = entries.get(key);
    if (!entry && entries.size < maxKeys) {
      entry = { count: 0, until: now + windowMs };
      entries.set(key, entry);
    }
    if (!entry || entry.count >= max) {
      res.setHeader(
        "Retry-After",
        String(
          Math.max(
            1,
            Math.ceil(((entry?.until || now + windowMs) - now) / 1000),
          ),
        ),
      );
      return res
        .status(429)
        .json({ error: "Too many requests. Please try again later." });
    }
    entry.count++;
    next();
  };
}

export const errorHandler: ErrorRequestHandler = (error, _req, res, next) => {
  if (res.headersSent) return next(error);
  if (error.type === "entity.too.large")
    return res
      .status(413)
      .json({ error: "The request exceeds the allowed size." });
  if (error.type === "entity.parse.failed")
    return res.status(400).json({ error: "Send valid JSON." });
  console.error(
    "[Areva request failed]",
    error instanceof Error ? error.name : "Unknown error",
  );
  res
    .status(500)
    .json({ error: "The request could not be completed. Please try again." });
};
