import * as dotenv from "dotenv";
dotenv.config();

import bcrypt from "bcryptjs";
import express, { Request, Response, NextFunction } from "express";
import { HttpError, isHttpError } from "./errors";
import { validateBody } from "./validateBody";
import { validateQuery } from "./validateQuery";
import { requireAuth } from "./requireAuth";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "./tokens";
import { createTodo, deleteTodo, listTodos, updateTodo } from "./todosRepo";
import {
  findUserByEmail,
  findUserById,
  createUser,
  storeRefreshToken,
  hasRefreshToken,
  deleteRefreshToken,
} from "./authRepo";
import { deleteAllRefreshTokensForUser } from "./db";

const app = express();
app.use(express.json());

// ------------ parser ------------
type RegisterBody = { email: string; password: string };
type LoginBody = { email: string; password: string };
type RefreshBody = { refreshToken: string };
type TodoBody = { title: string };
type PatchBody = { title?: string; completed?: boolean };
type TodosQuery = { completed?: boolean; limit: number; offset: number };

function normalizeEmail(raw: string) {
  return raw.trim().toLowerCase();
}

function isValidEmailSimple(email: string) {
  const at = email.indexOf("@");
  if (at < 1) return false;
  const dot = email.indexOf(".", at + 2);
  return dot > at + 1 && dot < email.length - 1;
}

function parseRegister(body: unknown): RegisterBody {
  if (typeof body !== "object" || body === null) {
    throw new HttpError(400, "email or password is invalid");
  }
  const b = body as { email?: unknown; password?: unknown };
  const email = typeof b.email === "string" ? normalizeEmail(b.email) : "";
  const password = typeof b.password === "string" ? b.password : "";

  if (!isValidEmailSimple(email) || password.length < 8) {
    throw new HttpError(400, "email or password is invalid");
  }
  return { email, password };
}

function parseLogin(body: unknown): LoginBody {
  // same rules as register input validation in tests
  return parseRegister(body);
}

function parseRefresh(body: unknown): RefreshBody {
  if (typeof body !== "object" || body === null) {
    throw new HttpError(401, "Invalid refresh token");
  }
  const b = body as { refreshToken?: unknown };
  if (typeof b.refreshToken !== "string" || b.refreshToken.trim().length < 1) {
    throw new HttpError(401, "Invalid refresh token");
  }
  return { refreshToken: b.refreshToken };
}

function parsePatchBody(body: unknown): PatchBody {
  if (typeof body !== "object" || body === null) {
    throw new HttpError(400, "patch must include title and/or completed");
  }
  const maybe = body as { title?: unknown; completed?: unknown };

  const hasTitle = "title" in maybe;
  const hasCompleted = "completed" in maybe;

  if (!hasTitle && !hasCompleted)
    throw new HttpError(400, "patch must include title and/or completed");

  const out: PatchBody = {};

  if (hasTitle) {
    if (typeof maybe.title !== "string" || maybe.title.trim().length < 1) {
      throw new HttpError(400, "title is invalid");
    }
    out.title = maybe.title.trim();
  }

  if (hasCompleted) {
    if (typeof maybe.completed !== "boolean") {
      throw new HttpError(400, "completed is invalid");
    }
    out.completed = maybe.completed;
  }
  return out;
}

function parseBodyTodo(body: unknown): TodoBody {
  if (typeof body !== "object" || body === null) {
    throw new HttpError(400, "title is required");
  }
  const maybe = body as { title?: unknown };

  const todo = typeof maybe.title === "string" ? maybe.title.trim() : "";
  if (todo.length < 1) throw new HttpError(400, "title is required");

  return { title: todo };
}

function parseQuery(query: unknown): TodosQuery {
  const q = query as Record<string, unknown>;

  let completed: boolean | undefined = undefined;
  if (q.completed !== undefined) {
    if (q.completed === "true") completed = true;
    else if (q.completed === "false") completed = false;
    else throw new HttpError(400, "completed must be true or false");
  }

  // limit/offset defaults
  const limitRaw = q.limit ?? "10";
  const offsetRaw = q.offset ?? "0";

  const limit = typeof limitRaw === "string" ? Number(limitRaw) : Number.NaN;
  const offset = typeof offsetRaw === "string" ? Number(offsetRaw) : Number.NaN;

  const limitOk = Number.isInteger(limit) && limit >= 1 && limit <= 50;
  const offsetOk = Number.isInteger(offset) && offset >= 0;

  if (!limitOk || !offsetOk) {
    throw new HttpError(400, "limit must be 1-50 and offset must be >= 0");
  }
  return { completed, limit, offset };
}

// ------------- routes ------------

/**
 * 1. Validate input (email/password)
 * 2. Normalize email (trim.toLowerCase())
 * 3. Hash password (bcryptjs.hash)
 * 4. Insert user in DB.
 * 5. Return {user: {id, email}}
 * No tokens are required by tests on register
 */
app.post(
  "/auth/register",
  validateBody(parseRegister),
  async (req, res, next) => {
    try {
      const { email, password } = res.locals.body as RegisterBody;

      const existing = await findUserByEmail(email);
      if (existing) {
        return res.status(409).json({ error: "Email already registered" });
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const user = await createUser(email, passwordHash);

      return res.status(201).json({ user });
    } catch (err: any) {
      // unique constraint race condition safety
      if (typeof err?.message === "string" && err.message.includes("UNIQUE")) {
        return res.status(409).json({ error: "Email already registered" });
      }
      next(err);
    }
  }
);

/**
 *1. Normalize email
 2. Find user by email
 3. Compare password with hash (bcryptjs.compare)
 4. If invalid -> 401 Invalid credentials
 5. If valid: 
       - create access token (JWT)
       - create refresh token (JWT with {type: "refresh"})
       - store refresh token in DB (so it can be revoked/rotated)
  6. Return tokens + user.
 */
app.post("/auth/login", validateBody(parseLogin), async (_req, res, next) => {
  try {
    const { email, password } = res.locals.body as LoginBody;

    const user = await findUserByEmail(email);
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });

    const accessToken = signAccessToken({ id: user.id, email: user.email });
    const refreshToken = signRefreshToken({ id: user.id });

    await storeRefreshToken(refreshToken, user.id);

    return res.status(200).json({
      accessToken,
      refreshToken,
      user: { id: user.id, email: user.email },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * 1. Receive refresh token.
 * 2. Verify refresh JWT signature + expiry
 * 3. Ensure it's the right type (type: "refresh")
 * 4. Check DB: is this token currently stored?
 *      - if not -> 401 Invalid refresh token
 * 5. Rotate:
 *      - delete old refresh token from DB
 *      - generate a new refresh token
 *      - store new refresh token in DB
 *      - generate new access token
 * 6. Return new tokens
 * Rotation is why the old refresh token stops working.
 */
app.post(
  "/auth/refresh",
  validateBody(parseRefresh),
  async (_req, res, next) => {
    try {
      const { refreshToken } = res.locals.body as RefreshBody;

      const payload = verifyRefreshToken(refreshToken);
      if (!payload)
        return res.status(401).json({ error: "Invalid refresh token" });

      const exists = await hasRefreshToken(refreshToken);
      if (!exists)
        return res.status(401).json({ error: "Invalid refresh token" });

      // email not required for access token in this endpoint (tests don't check),
      // but our token requires email; fetch user
      const user = await findUserById(payload.sub);
      if (!user)
        return res.status(401).json({ error: "Invalid refresh token" });

      // rotate: delete old, issue new
      await deleteRefreshToken(refreshToken);

      const newRefresh = signRefreshToken({ id: payload.sub });
      await storeRefreshToken(newRefresh, payload.sub);

      const accessToken = signAccessToken({ id: user.id, email: user.email });

      return res.status(200).json({ accessToken, refreshToken: newRefresh });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * 1. Receive refresh token
 * 2. Delete it from DB if it exists
 * 3. Always return {status: "ok"}.
 */
app.post(
  "/auth/logout",
  validateBody(parseRefresh),
  async (_req, res, next) => {
    try {
      const { refreshToken } = res.locals.body as RefreshBody;
      // delete if exists; always ok
      await deleteRefreshToken(refreshToken);
      return res.status(200).json({ status: "ok" });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * 1. Read Authorization: Bear <accessToken>
 * 2. Verify JWT signature + expiry
 * 3. If invalid/missing -> 401 Unauthorized
 * 4. If valid:
 *      - token contains sub userId and email
 *      - return {user: {id, email}}
 */
app.get("/me", requireAuth, (_req, res, next) => {
  try {
    const u = res.locals.user as { id: string; email: string };
    return res.status(200).json({ user: { id: u.id, email: u.email } });
  } catch (err) {
    next(err);
  }
});

app.get(
  "/todos",
  requireAuth,
  validateQuery(parseQuery),
  async (_req, res, next) => {
    try {
      const q = res.locals.query as TodosQuery;
      const user = res.locals.user as { id: string; email: string };

      const { todos, total } = await listTodos({
        ownerUserId: user.id,
        completed: q.completed,
        limit: q.limit,
        offset: q.offset,
      });

      return res.status(200).json({
        todos: todos.map(({ ownerUserId, ...rest }) => rest), // hide ownerUserId
        page: { limit: q.limit, offset: q.offset, total },
      });
    } catch (err) {
      next(err);
    }
  }
);

app.post(
  "/todos",
  requireAuth,
  validateBody(parseBodyTodo),
  async (_req, res, next) => {
    try {
      const b = res.locals.body as TodoBody;
      const user = res.locals.user as { id: string; email: string };

      const todo = await createTodo(user.id, b.title);
      const { ownerUserId, ...publicTodo } = todo; // hide ownerUserId
      return res.status(201).json({ todo: publicTodo });
    } catch (err) {
      next(err);
    }
  }
);

app.patch(
  "/todos/:id",
  requireAuth,
  validateBody(parsePatchBody),
  async (req, res, next) => {
    try {
      const patch = res.locals.body as PatchBody;
      const user = res.locals.user as { id: string; email: string };

      const updated = await updateTodo(user.id, req.params.id, patch);
      if (!updated) return res.status(404).json({ error: "Todo not found" });

      const { ownerUserId, ...publicTodo } = updated;
      return res.status(200).json({ todo: publicTodo });
    } catch (err) {
      next(err);
    }
  }
);

app.delete("/todos/:id", requireAuth, async (req, res, next) => {
  try {
    const user = res.locals.user as { id: string; email: string };

    const deleted = await deleteTodo(user.id, req.params.id);
    if (!deleted) return res.status(404).json({ error: "Todo not found" });

    const { ownerUserId, ...publicTodo } = deleted;
    return res.status(200).json({ deleted: publicTodo });
  } catch (err) {
    next(err);
  }
});

app.post("/auth/logout-all", requireAuth, async (_req, res, next) => {
  try {
    const u = res.locals.user as { id: string; email: string };
    await deleteAllRefreshTokensForUser(u.id);
    return res.status(200).json({ status: "ok" });
  } catch (err) {
    next(err);
  }
});

app.use((_req, res) => {
  res.status(404).json({ error: "Not Found" });
});

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (isHttpError(err)) {
    return res.status(err.statusCode).json({ error: err.message });
  }
  return res.status(500).json({ error: "Internal Server Error" });
});

export { app };
export { resetDb } from "./db";
