import sqlite3 from "sqlite3";
import { open, type Database } from "sqlite";
import path from "node:path";

let db: Database<sqlite3.Database, sqlite3.Statement> | null = null;

async function initDb() {
  const filename =
    process.env.SQLITE_FILE ?? path.join(process.cwd(), "auth.db");

  const instance = await open({ filename, driver: sqlite3.Database });

  await instance.exec("PRAGMA foreign_keys = ON;");

  await instance.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      passwordHash TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );
  `);

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

  return instance;
}

export async function getDb() {
  db ??= await initDb();
  return db;
}

export async function resetDb() {
  const db = await getDb();
  await db.run("DELETE FROM refresh_tokens;");
  await db.run("DELETE FROM users;");
}

export async function closeDb() {
  if (db) {
    await db.close();
    db = null;
  }
}
