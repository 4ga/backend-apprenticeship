import bcrypt from "bcryptjs";
import express, { Request, Response, NextFunction } from "express";
import { HttpError, isHttpError } from "./errors";
import { validateBody } from "./validateBody";
import { requireAuth } from "./requireAuth";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "./tokens";
import {
  findUserByEmail,
  findUserById,
  createUser,
  storeRefreshToken,
  hasRefreshToken,
  deleteRefreshToken,
} from "./authRepo";

const app = express();
app.use(express.json());

// ------------ parser ------------
type RegisterBody = { email: string; password: string };
type LoginBody = { email: string; password: string };
type RefreshBody = { refreshToken: string };

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
  async (_req, res, next) => {
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
app.post("/auth/login", validateBody(parseLogin), async (req, res, next) => {
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
