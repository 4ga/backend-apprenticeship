export type Result<T> =
  | { ok: true; value: T }
  | { ok: false; status: 400 | 404; error: string };

export type Todo = {
  id: string;
  title: string;
  completed: boolean;
  createdAt: string; // ISO string
};

let todos: Todo[] = [];

export const resetTodos = () => {
  todos = [];
};

function generateId() {
  return crypto.randomUUID();
}

export function getTodos(): Result<Todo[]> {
  return { ok: true, value: todos };
}

export function createTodo(title: string): Result<Todo> {
  if (typeof title !== "string" || title.trim().length === 0) {
    return { ok: false, status: 400, error: "title is required" };
  }
  const trimmed = title.trim();
  const newTodo: Todo = {
    id: generateId(),
    title: trimmed,
    completed: false,
    createdAt: new Date().toISOString(),
  };
  todos = [...todos, newTodo];
  return { ok: true, value: newTodo };
}

export function updateTodo(
  id: string,
  patch: { title?: string; completed?: boolean }
): Result<Todo> {
  const trimmedId = id.trim();
  const existing = todos.find((t) => t.id === trimmedId);
  if (!existing) return { ok: false, status: 404, error: "Todo not found" };

  if (patch.title !== undefined) {
    if (typeof patch.title !== "string" || patch.title.trim().length === 0) {
      return { ok: false, status: 400, error: "title is invalid" };
    }
  }

  const next: Todo = {
    ...existing,
    ...(typeof patch.title === "string" ? { title: patch.title.trim() } : {}),
    ...(typeof patch.completed === "boolean"
      ? { completed: patch.completed }
      : {}),
  };

  todos = todos.map((t) => (t.id === trimmedId ? next : t));
  return { ok: true, value: next };
}

export function deleteTodo(id: string): Result<Todo> {
  const trimmedId = id.trim();
  let found = todos.find((t) => t.id === trimmedId);
  if (!found) return { ok: false, status: 404, error: "Todo not found" };

  todos = todos.filter((t) => t.id !== trimmedId);
  return { ok: true, value: found };
}
