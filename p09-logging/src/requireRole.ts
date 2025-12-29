import { Request, Response, NextFunction } from "express";

export function requireRole(role: "admin") {
  return (_req: Request, res: Response, next: NextFunction) => {
    const user = res.locals.user as { role?: string };
    if (user?.role !== role)
      return res.status(403).json({ error: "Forbidden" });
    next();
  };
}
