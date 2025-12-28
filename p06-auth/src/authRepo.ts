import { getDb } from "./db";

export async function createUser(
  email: string,
  passwordHash: string
): Promise<{ id: string; email: string }> {
  const db = await getDb();
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();

  await db.run(
    `INSERT INTO users (id, email, passwordHash, createdAt) VALUES (?, ?, ?, ?);`,
    id,
    email,
    passwordHash,
    createdAt
  );

  return { id, email };
}

export async function findUserByEmail(
  email: string
): Promise<{ id: string; email: string; passwordHash: string } | null> {
  const db = await getDb();
  const row = await db.get<any>(
    `SELECT id, email, passwordHash FROM users WHERE email = ?;`,
    email
  );
  if (!row) return null;
  return { id: row.id, email: row.email, passwordHash: row.passwordHash };
}

export async function findUserById(
  id: string
): Promise<{ id: string; email: string } | null> {
  const db = await getDb();
  const row = await db.get<any>(
    `SELECT id, email FROM users WHERE id = ?;`,
    id
  );
  if (!row) return null;
  return { id: row.id, email: row.email };
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
