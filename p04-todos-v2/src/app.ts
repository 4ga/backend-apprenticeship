import express, { Request, Response, NextFunction } from "express";
import { validateBody } from "./validateBody";
import { validateQuery } from "./validateQuery";
import { HttpError, isHttpError } from "./errors";
import { getTodos, createTodo, updateTodo, deleteTodo } from "./todos";

const app = express();
type TodoBody = { title: string };
type PatchBody = { title?: string; completed?: boolean };
type TodosQuery = { completed?: boolean; limit: number; offset: number };

function parsePatchBody(body: unknown): PatchBody {
  if (typeof body !== "object" || body === null) {
    throw new HttpError(400, "patch must include title and/or completed");
  }
  const maybe = body as { title?: unknown; completed?: unknown };

  const hasTitle = "title" in maybe;
  const hasCompleted = "completed" in maybe;

  if (!hasTitle && !hasCompleted) {
    throw new HttpError(400, "patch must include title and/or completed");
  }

  const out: PatchBody = {};

  if (hasTitle) {
    if (typeof maybe.title !== "string" || maybe.title.trim().length < 1) {
      throw new HttpError(400, "title is invalid");
    }
    out.title = maybe.title.trim();
  }

  if (hasCompleted) {
    if (typeof maybe.completed !== "boolean") {
      throw new HttpError(400, "completed is valid");
    }
    out.completed = maybe.completed;
  }
  return out;
}

function parseBodyTodo(body: unknown): TodoBody {
  if (typeof body !== "object" || body === null) {
    throw new HttpError(400, "title is required");
  }
  const maybe = body as { title?: unknown };

  const todo = typeof maybe.title === "string" ? maybe.title.trim() : "";
  if (todo.length < 1) throw new HttpError(400, "title is required");
  return { title: todo };
}

function parseQuery(query: unknown): TodosQuery {
  const q = query as Record<string, unknown>;

  // completed
  let completed: boolean | undefined = undefined;
  if (q.completed !== undefined) {
    if (q.completed === "true") completed = true;
    else if (q.completed === "false") completed = false;
    else throw new HttpError(400, "completed must be true or false");
  }

  // limit/offset defaults
  const limitRaw = q.limit ?? "10";
  const offsetRaw = q.offset ?? "0";

  const limit = typeof limitRaw === "string" ? Number(limitRaw) : Number.NaN;
  const offset = typeof offsetRaw === "string" ? Number(offsetRaw) : Number.NaN;

  const limitOk = Number.isInteger(limit) && limit >= 1 && limit <= 50;
  const offsetOk = Number.isInteger(offset) && offset >= 0;

  if (!limitOk || !offsetOk) {
    throw new HttpError(400, "limit must be 1-50 and offset must be >= 0");
  }
  return { completed, limit, offset };
}

app.use(express.json());

app.get("/todos", validateQuery(parseQuery), (_req, res) => {
  const q = res.locals.query as TodosQuery;

  const result = getTodos();
  const all = result.ok ? result.value : [];

  const filtered =
    q.completed === undefined
      ? all
      : all.filter((t) => t.completed === q.completed);

  const total = filtered.length;
  const pageTodos = filtered.slice(q.offset, q.offset + q.limit);

  return res.status(200).json({
    todos: pageTodos,
    page: { limit: q.limit, offset: q.offset, total },
  });
});
app.post("/todos", validateBody(parseBodyTodo), (_req, res) => {
  const t = res.locals.body as TodoBody;
  const result = createTodo(t.title);
  if (!result.ok)
    return res.status(result.status).json({ error: result.error });
  return res.status(201).json({ todo: result.value });
});

app.patch("/todos/:id", validateBody(parsePatchBody), (req, res) => {
  const id = req.params.id;
  const patch = res.locals.body as PatchBody;

  const result = updateTodo(id, patch);
  if (!result.ok)
    return res.status(result.status).json({ error: result.error });

  return res.status(200).json({ todo: result.value });
});
app.delete("/todos/:id", (req, res) => {
  const id = req.params.id;

  const result = deleteTodo(id);
  if (!result.ok)
    return res.status(result.status).json({ error: result.error });

  return res.status(200).json({ deleted: result.value });
});

app.use((_req, res) => {
  res.status(404).json({ error: "Not Found" });
});

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (isHttpError(err)) {
    return res.status(err.statusCode).json({ error: err.message });
  }
  return res.status(500).json({ error: "Internal Server Error" });
});

export { app };
export { resetTodos } from "./todos";
