import sqlite3 from "sqlite3";
import { open, type Database } from "sqlite";
import path from "node:path";

let db: Database<sqlite3.Database, sqlite3.Statement> | null = null;

async function initDb() {
  const filename =
    process.env.SQLITE_FILE ?? path.join(process.cwd(), "todos09.db");

  const instance = await open({ filename, driver: sqlite3.Database });

  // good defaults
  await instance.exec("PRAGMA foreign_keys = ON;");

  // schema
  await instance.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      passwordHash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('user', 'admin')) DEFAULT 'user',
      createdAt TEXT NOT NULL,
      deletedAt TEXT
    );
  `);

  await instance.exec(`
    CREATE TABLE IF NOT EXISTS todos (
      id TEXT PRIMARY KEY,
      ownerUserId TEXT NOT NULL,
      title TEXT NOT NULL,
      completed INTEGER NOT NULL CHECK (completed IN (0, 1)),
      createdAt TEXT NOT NULL,
      deletedAt TEXT,
      FOREIGN KEY (ownerUserId) REFERENCES users(id)
    );`);

  await instance.exec(`
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      token TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (userId) REFERENCES users(id) 
    );
  `);

  // No foreign keys in audit logs
  await instance.exec(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      createdAt TEXT NOT NULL,
      actorUserId TEXT,
      actorEmail TEXT,
      actorRole TEXT NOT NULL CHECK (actorRole IN ('user', 'admin')),
      action TEXT NOT NULL,
      targetUserId TEXT,
      targetTodoId TEXT,
      ip TEXT,
      userAgent TEXT,
      metaJson TEXT NOT NULL
    );
  `);

  await instance.exec(`
    CREATE INDEX IF NOT EXISTS idx_todos_owner_deleted_createdAt
    ON todos(ownerUserId, deletedAt, createdAt);    
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

  await instance.exec(`
    CREATE INDEX IF NOT EXISTS idx_audit_createdAt
    ON audit_logs(createdAt);
  `);

  await instance.exec(`
    CREATE INDEX IF NOT EXISTS idx_audit_actor_createdAt
    ON audit_logs(actorUserId, createdAt);
  `);

  await instance.exec(`
    CREATE INDEX IF NOT EXISTS idx_audit_action_createdAt
    ON audit_logs(action, createdAt);
  `);

  await instance.exec(`
    CREATE INDEX IF NOT EXISTS idx_audit_action_createdAt_desc
    ON audit_logs(action, createdAt DESC);
    `);

  await instance.exec(`
    CREATE INDEX IF NOT EXISTS idx_audit_target_createdAt
    ON audit_logs(targetUserId, createdAt);
  `);

  await instance.exec(`
    CREATE INDEX IF NOT EXISTS idx_users_deleted_createdAt
    ON users(deletedAt, createdAt);
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
  await db.run("DELETE FROM audit_logs;");
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
