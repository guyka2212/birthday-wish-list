import { Hono } from "hono";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import { bodyLimit } from "hono/body-limit";
import { HTTPException } from "hono/http-exception";
import type { AppEnv, Deps } from "./context";
import { ApiError } from "./lib/errors";
import { kidAuth } from "./routes/kidAuth";
import { kid } from "./routes/kid";
import { pub } from "./routes/public";
import { shop, shopAuth } from "./routes/shop";
import { shopApi } from "./routes/shopApi";
import { admin, adminAuth } from "./routes/admin";
import { openApiSpec } from "./openapi";
import { CITIES, THEMES } from "@bwl/shared";

export function createApp(deps: Deps) {
  const app = new Hono<AppEnv>();

  app.use("*", async (c, next) => {
    c.set("deps", deps);
    await next();
  });

  // HTTPS only in production (Vercel terminates TLS and sets x-forwarded-proto)
  app.use("*", async (c, next) => {
    if (deps.config.NODE_ENV === "production" && c.req.header("x-forwarded-proto") === "http") {
      return c.redirect(c.req.url.replace(/^http:/, "https:"), 301);
    }
    await next();
  });

  app.use(
    "*",
    secureHeaders({
      strictTransportSecurity: "max-age=63072000; includeSubDomains; preload",
      contentSecurityPolicy: { defaultSrc: ["'none'"], styleSrc: ["'unsafe-inline'"], frameAncestors: ["'none'"] },
      referrerPolicy: "no-referrer",
    }),
  );

  // Browsers: only the known front-end origins. (The Android app and server-to-server API calls send no Origin.)
  app.use(
    "*",
    cors({
      origin: (origin) => (deps.config.allowedOrigins.includes(origin.replace(/\/$/, "")) ? origin : null),
      allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowHeaders: ["Content-Type", "Authorization"],
      maxAge: 600,
    }),
  );
  app.use("*", bodyLimit({ maxSize: 512 * 1024, onError: (c) => c.json({ error: { code: "too_large", message: "request body too large" } }, 413) }));

  app.get("/", (c) => c.json({ name: "Birthday Wish List API", docs: "/openapi.json", health: "/health" }));
  app.get("/health", async (c) => {
    await deps.db.execute("SELECT 1");
    return c.json({ ok: true, time: deps.now() });
  });
  app.get("/openapi.json", (c) => c.json(openApiSpec(deps.config.API_PUBLIC_URL)));
  app.get("/themes", (c) => c.json({ items: Object.values(THEMES) }));
  // public: the cities a kid can pick at sign-up (no coordinates needed by clients)
  app.get("/cities", (c) => c.json({ items: CITIES.map(({ id, he, en }) => ({ id, he, en })) }));

  app.route("/auth/kid", kidAuth);
  app.route("/auth/shop", shopAuth);
  app.route("/auth/admin", adminAuth);
  app.route("/kid", kid);
  app.route("/public", pub);
  app.route("/shop", shop);
  app.route("/api/shop", shopApi);
  app.route("/admin", admin);

  app.notFound((c) => c.json({ error: { code: "not_found", message: "route not found" } }, 404));

  app.onError((err, c) => {
    if (err instanceof ApiError) {
      return c.json({ error: { code: err.code, message: err.message, details: err.details } }, err.status);
    }
    if (err instanceof HTTPException) {
      return c.json({ error: { code: "http_error", message: err.message } }, err.status);
    }
    console.error("[api] unhandled error:", err);
    return c.json({ error: { code: "internal", message: "something went wrong" } }, 500);
  });

  return app;
}
