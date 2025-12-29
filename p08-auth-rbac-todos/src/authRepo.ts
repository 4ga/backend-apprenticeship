import crypto from "node:crypto";
import { getDb } from "./db";

type Role = "user" | "admin";

export async function createUser(
  email: string,
  passwordHash: string,
  role: Role = "user"
): Promise<{ id: string; email: string }> {
  const db = await getDb();
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();

  await db.run(
    `INSERT INTO users (id, email, passwordHash, role, createdAt) VALUES (?, ?, ?, ?, ?);`,
    id,
    email,
    passwordHash,
    role,
    createdAt
  );

  return { id, email };
}

export async function findUserByEmail(email: string): Promise<{
  id: string;
  email: string;
  passwordHash: string;
  role: Role;
} | null> {
  const db = await getDb();
  const row = await db.get<any>(
    `SELECT id, email, passwordHash, role FROM users WHERE email = ?;`,
    email
  );
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.passwordHash,
    role: row.role,
  };
}

export async function findUserById(
  id: string
): Promise<{ id: string; email: string; role: Role } | null> {
  const db = await getDb();
  const row = await db.get<any>(
    `SELECT id, email, role FROM users WHERE id = ?;`,
    id
  );
  if (!row) return null;
  return { id: row.id, email: row.email, role: row.role };
}

export async function listUsers(opts: {
  limit: number;
  offset: number;
}): Promise<{
  users: { id: string; email: string; role: Role; createdAt: string }[];
  total: number;
}> {
  const db = await getDb();

  const totalRow = await db.get<{ total: number }>(
    `SELECT COUNT(*) as total FROM users;`
  );

  const rows = await db.all<any[]>(
    `SELECT id, email, role, createdAt 
     FROM users
     ORDER BY createdAt ASC
     LIMIT ? OFFSET ?;`,
    opts.limit,
    opts.offset
  );
  return {
    users: rows.map((r) => ({
      id: r.id,
      email: r.email,
      role: r.role,
      createdAt: r.createdAt,
    })),
    total: totalRow?.total ?? 0,
  };
}

export async function setUserRole(
  userId: string,
  role: Role
): Promise<boolean> {
  const db = await getDb();
  const result = await db.run(
    `UPDATE users SET role= ? WHERE id = ?;`,
    role,
    userId.trim()
  );
  return (result.changes ?? 0) > 0; // prevents "success" on non-existent users.
}

export async function deleteUserById(
  userId: string
): Promise<{ id: string; email: string; role: Role } | null> {
  const db = await getDb();
  const id = userId.trim();

  const existing = await db.get<any>(
    `SELECT id, email, role FROM users WHERE id =?;`,
    id
  );
  if (!existing) return null;

  const result = await db.run(`DELETE FROM users WHERE id = ?; `, id);
  if ((result.changes ?? 0) < 1) return null;

  return { id: existing.id, email: existing.email, role: existing.role };
}

export async function storeRefreshToken(
  token: string,
  userId: string
): Promise<void> {
  const db = await getDb();
  const createdAt = new Date().toISOString();
  await db.run(
    `INSERT INTO refresh_tokens (token, userId, createdAt) VALUES (?, ?, ?);`,
    token,
    userId,
    createdAt
  );
}

export async function hasRefreshToken(token: string): Promise<boolean> {
  const db = await getDb();
  const row = await db.get<any>(
    `SELECT token FROM refresh_tokens WHERE token = ?;`,
    token
  );
  return !!row;
}

export async function deleteRefreshToken(token: string): Promise<void> {
  const db = await getDb();
  await db.run(`DELETE FROM refresh_tokens WHERE token = ?;`, token);
}
