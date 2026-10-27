import { createHash, randomBytes } from "node:crypto";
import type { RequestHandler } from "express";

// Anonymous ownership is a secret held by this browser, not a public recipe ID.
// Only its hash is stored with records. It is never returned in JSON or exports.
export const workspace: RequestHandler = (req, res, next) => {
  const production = process.env.NODE_ENV === "production";
  const cookieName = production
    ? "__Host-brewmaster_owner"
    : "brewmaster_owner";
  const existing = req
    .get("cookie")
    ?.match(
      new RegExp(`(?:^|;\\s*)${cookieName}=([A-Za-z0-9_-]{43})(?:;|$)`),
    )?.[1];
  const token = existing ?? randomBytes(32).toString("base64url");
  if (!existing) {
    res.cookie(cookieName, token, {
      httpOnly: true,
      secure: production,
      sameSite: "lax",
      path: production ? "/" : "/api",
      maxAge: 365 * 24 * 60 * 60 * 1000,
    });
  }
  res.locals.ownerId = createHash("sha256").update(token).digest("hex");
  res.set("Cache-Control", "no-store");
  res.vary("Cookie");
  next();
};
