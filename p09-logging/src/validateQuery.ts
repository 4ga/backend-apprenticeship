import { Request, Response, NextFunction } from "express";

export function validateQuery<T>(parser: (query: unknown) => T) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = parser(req.query);
      res.locals.query = parsed;
      next();
    } catch (err) {
      next(err);
    }
  };
}
