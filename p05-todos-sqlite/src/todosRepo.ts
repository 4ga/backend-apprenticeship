import { getDb } from "./db";

export type Todo = {
  id: string;
  title: string;
  completed: boolean;
  createdAt: string;
};

function rowToTodo(row: any): Todo {
  return {
    id: row.id,
    title: row.title,
    completed: row.completed === 1,
    createdAt: row.createdAt,
  };
}

export async function listTodos(opts: {
  completed?: boolean;
  limit: number;
  offset: number;
}): Promise<{ todos: Todo[]; total: number }> {
  const db = await getDb();

  const where = opts.completed === undefined ? "" : "WHERE completed = ?";
  const params = opts.completed === undefined ? [] : [opts.completed ? 1 : 0];

  const totalRow = await db.get<{ total: number }>(
    `SELECT COUNT(*) as total FROM todos ${where}`,
    ...params
  );

  const rows = await db.all<any[]>(
    `
    SELECT id, title, completed, createdAt
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

export async function createTodo(title: string): Promise<Todo> {
  const db = await getDb();
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();

  const trimmed = title.trim();

  await db.run(
    `INSERT INTO todos (id, title, completed, createdAt) VALUES (?, ?, ?, ?);`,
    id,
    trimmed,
    0,
    createdAt
  );

  return { id, title: trimmed, completed: false, createdAt };
}

export async function updateTodo(
  id: string,
  patch: { title?: string; completed?: boolean }
): Promise<Todo | null> {
  const db = await getDb();

  const existing = await db.get<any>(
    `SELECT id, title, completed, createdAt FROM todos WHERE id = ?;`,
    id
  );

  if (!existing) return null;

  const nextTitle =
    patch.title === undefined ? existing.title : patch.title.trim();

  let nextCompleted = existing.completed;
  if (patch.completed !== undefined) {
    nextCompleted = patch.completed ? 1 : 0;
  }

  await db.run(
    `UPDATE todos SET title = ?, completed = ? WHERE id = ?;`,
    nextTitle,
    nextCompleted,
    id
  );

  return rowToTodo({
    id: existing.id,
    title: nextTitle,
    completed: nextCompleted,
    createdAt: existing.createdAt,
  });
}

export async function deleteTodo(id: string): Promise<Todo | null> {
  const db = await getDb();

  const existing = await db.get<any>(
    `SELECT id, title, completed, createdAt FROM todos WHERE id = ?;`,
    id
  );
  if (!existing) return null;

  await db.run(`DELETE FROM todos WHERE id = ?;`, id);

  return rowToTodo(existing);
}
