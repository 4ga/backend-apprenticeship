import sqlite3 from "sqlite3";
import { open, type Database } from "sqlite";
import path from "node:path";

let db: Database<sqlite3.Database, sqlite3.Statement> | null = null;

async function initDb() {
  const filename =
    process.env.SQLITE_FILE ?? path.join(process.cwd(), "todos07.db");

  const instance = await open({ filename, driver: sqlite3.Database });

  // good defaults
  await instance.exec("PRAGMA foreign_keys = ON;");

  // schema
  await instance.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      passwordHash TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );
  `);

  await instance.exec(`
    CREATE TABLE IF NOT EXISTS todos (
      id TEXT PRIMARY KEY,
      ownerUserId TEXT NOT NULL,
      title TEXT NOT NULL,
      completed INTEGER NOT NULL CHECK (completed IN (0, 1)),
      createdAt TEXT NOT NULL,
      FOREIGN KEY (ownerUserId) REFERENCES users(id) ON DELETE CASCADE
    );`);

  await instance.exec(`
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      token TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  await instance.exec(`
    CREATE INDEX IF NOT EXISTS idx_refresh_tokens_userId
    ON refresh_tokens(userId);
  `);

  await instance.exec(`
    CREATE INDEX IF NOT EXISTS idx_todos_owner_createdAt
    ON todos(ownerUserId, createdAt);
  `);

  await instance.exec(`
    CREATE INDEX IF NOT EXISTS idx_todos_owner_completed_createdAt
    ON todos(ownerUserId, completed, createdAt);
  `);
  return instance;
}

export async function getDb() {
  db ??= await initDb();
  return db;
}

export async function deleteAllRefreshTokensForUser(userId: string) {
  const db = await getDb();
  await db?.run("DELETE FROM refresh_tokens WHERE userId = ?", userId.trim());
}

export async function resetDb() {
  const db = await getDb();
  await db.run("DELETE FROM refresh_tokens;");
  await db.run("DELETE FROM todos;");
  await db.run("DELETE FROM users;");
}

// optional (nice for cleanup later)
export async function closeDb() {
  if (db) {
    await db.close();
    db = null;
  }
}
