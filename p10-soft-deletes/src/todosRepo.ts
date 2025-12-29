import crypto from "node:crypto";
import { getDb } from "./db";

export type Todo = {
  id: string;
  title: string;
  ownerUserId: string;
  completed: boolean;
  createdAt: string;
  deletedAt: string | null;
};

function rowToTodo(row: any): Todo {
  return {
    id: row.id,
    title: row.title,
    ownerUserId: row.ownerUserId,
    completed: row.completed === 1,
    createdAt: row.createdAt,
    deletedAt: row.deletedAt ?? null,
  };
}

export async function listTodos(opts: {
  ownerUserId: string;
  completed?: boolean;
  includeDeleted?: boolean; // new
  limit: number;
  offset: number;
}): Promise<{ todos: Todo[]; total: number }> {
  const db = await getDb();

  const whereParts: string[] = ["ownerUserId = ?"];
  const params: any[] = [opts.ownerUserId.trim()];

  // default: hide deleted
  if (!opts.includeDeleted) {
    whereParts.push("deletedAt IS NULL");
  }

  if (opts.completed !== undefined) {
    whereParts.push("completed = ?");
    params.push(opts.completed ? 1 : 0);
  }

  const where = `WHERE ${whereParts.join(" AND ")}`;

  const totalRow = await db.get<{ total: number }>(
    `SELECT COUNT(*) as total FROM todos ${where}`,
    ...params
  );

  const rows = await db.all<any[]>(
    `
    SELECT id, title, ownerUserId, completed, createdAt, deletedAt
    FROM todos
    ${where}
    ORDER BY createdAt ASC
    LIMIT ? OFFSET ?;
    `,
    ...params,
    opts.limit,
    opts.offset
  );

  return { todos: rows.map(rowToTodo), total: totalRow?.total ?? 0 };
}

export async function createTodo(
  ownerUserId: string,
  title: string
): Promise<Todo> {
  const db = await getDb();
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const deletedAt = null;

  const trimmed = title.trim();
  const trimmedUserId = ownerUserId.trim();

  await db.run(
    `INSERT INTO todos (id, title, ownerUserId, completed, createdAt, deletedAt) VALUES (?, ?, ?, ?, ?, ?);`,
    id,
    trimmed,
    trimmedUserId,
    0,
    createdAt,
    deletedAt
  );

  return {
    id,
    title: trimmed,
    ownerUserId: trimmedUserId,
    completed: false,
    createdAt,
    deletedAt,
  };
}

export async function updateTodo(
  ownerUserId: string,
  id: string,
  patch: { title?: string; completed?: boolean }
): Promise<Todo | null> {
  const db = await getDb();
  const owner = ownerUserId.trim();

  const existing = await db.get<any>(
    `SELECT id, title, ownerUserId, completed, createdAt, deletedAt
     FROM todos
     WHERE id = ? AND ownerUserId = ? AND deletedAt IS NULL;`,
    id,
    owner
  );

  if (!existing) return null;

  const nextTitle =
    patch.title === undefined ? existing.title : patch.title.trim();

  let nextCompleted = existing.completed;
  if (patch.completed !== undefined) {
    nextCompleted = patch.completed ? 1 : 0;
  }

  await db.run(
    `UPDATE todos SET title = ?, completed = ? WHERE id = ? AND ownerUserId = ?;`,
    nextTitle,
    nextCompleted,
    id,
    owner
  );

  return rowToTodo({
    ...existing,
    title: nextTitle,
    completed: nextCompleted,
  });
}

export async function deleteTodo(
  ownerUserId: string,
  id: string
): Promise<Todo | null> {
  const db = await getDb();
  const owner = ownerUserId.trim();
  const now = new Date().toISOString();

  const existing = await db.get<any>(
    `SELECT id, title, ownerUserId, completed, createdAt, deletedAt
     FROM todos
     WHERE id = ? AND ownerUserId = ? AND deletedAt IS NULL;`,
    id,
    owner
  );

  if (!existing) return null;

  await db.run(
    `UPDATE todos SET deletedAt = ? WHERE id = ? AND ownerUserId = ? 
     AND deletedAt IS NULL;`,
    now,
    id,
    owner
  );

  return rowToTodo({ ...existing, deletedAt: now });
}
