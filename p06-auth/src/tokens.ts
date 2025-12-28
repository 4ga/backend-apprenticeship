import jwt from "jsonwebtoken";

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? "dev_access_secret";
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? "dev_refresh_secret";

export function signAccessToken(user: { id: string; email: string }): string {
  return jwt.sign({ email: user.email }, ACCESS_SECRET, {
    subject: user.id,
    expiresIn: "15m",
  });
}

export function signRefreshToken(user: { id: string }): string {
  return jwt.sign({ type: "refresh" }, REFRESH_SECRET, {
    subject: user.id,
    expiresIn: "7d",
    jwtid: crypto.randomUUID(), // ensures uniqueness
  });
}

export function verifyAccessToken(
  token: string
): { sub: string; email: string } | null {
  try {
    const payload = jwt.verify(token, ACCESS_SECRET) as any;
    if (typeof payload?.sub !== "string") return null;
    if (typeof payload?.email !== "string") return null;
    return { sub: payload.sub, email: payload.email };
  } catch {
    return null;
  }
}

export function verifyRefreshToken(
  token: string
): { sub: string; type: "refresh" } | null {
  try {
    const payload = jwt.verify(token, REFRESH_SECRET) as any;
    if (typeof payload?.sub !== "string") return null;
    if (payload?.type !== "refresh") return null;
    return { sub: payload.sub, type: "refresh" };
  } catch {
    return null;
  }
}
