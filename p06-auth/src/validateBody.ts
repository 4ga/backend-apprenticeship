import { Request, Response, NextFunction } from "express";

export function validateBody<T>(parser: (body: unknown) => T) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = parser(req.body);
      res.locals.body = parsed;
      next();
    } catch (err) {
      next(err);
    }
  };
}
