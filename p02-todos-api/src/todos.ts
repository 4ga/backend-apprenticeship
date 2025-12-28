export type Todo = {
  id: string;
  title: string;
  completed: boolean;
};

let todos: Todo[] = [];

function generateId() {
  return crypto.randomUUID();
}

export function getTodos() {
  return todos;
}

export function createTodo(title: string) {
  if (typeof title !== "string" || title.trim().length === 0) {
    throw new Error("title is required");
  }
  const newTodo: Todo = { id: generateId(), title: title, completed: false };
  todos = [...todos, newTodo];
  return newTodo;
}

export function updateTodo(
  id: string,
  patch: { title?: string; completed?: boolean }
) {
  const trimmedId = id.trim();
  const existing = todos.find((t) => t.id === trimmedId);
  if (!existing) throw new Error("Todo not found");

  if (patch.title !== undefined) {
    if (typeof patch.title !== "string" || patch.title.trim().length === 0) {
      throw new Error("title is required");
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
  return next;
}

export function deleteTodo(id: string) {
  const trimmedId = id.trim();
  let found = todos.find((t) => t.id === trimmedId);
  if (!found) throw new Error("Todo not found");

  todos = todos.filter((t) => t.id !== trimmedId);
  return found;
}

export function resetTodos() {
  todos = [];
}
