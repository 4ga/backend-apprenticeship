import type { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "./tokens";

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.header("Authorization");
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const token = header.slice("Bearer ".length).trim();
  const payload = verifyAccessToken(token);
  if (!payload) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  res.locals.user = { id: payload.sub, email: payload.email };
  next();
}
