import sqlite3 from "sqlite3";
import path from "node:path";
import { open, type Database } from "sqlite";

let db: Database<sqlite3.Database, sqlite3.Statement> | null = null;

async function initDb() {
  const filename =
    process.env.SQLITE_FILE ?? path.join(process.cwd(), "auth.db");

  const instance = await open({ filename, driver: sqlite3.Database });

  // good defaults
  await instance.exec("PRAGMA foreign_keys = ON;");

  // schema
  await instance.exec(`
    CREATE TABLE IF NOT EXISTS todos (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      completed INTEGER NOT NULL,
      createdAt TEXT NOT NULL
    );`);
  return instance;
}

export async function getDb() {
  db ??= await initDb();
  return db;
}

export async function resetDb() {
  const db = await getDb();
  await db.run("DELETE FROM todos;");
}

// optional (nice for cleanup later)
export async function closeDb() {
  if (db) {
    await db.close();
    db = null;
  }
}
