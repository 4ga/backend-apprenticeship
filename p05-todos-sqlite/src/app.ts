import express, { Request, Response, NextFunction } from "express";
import { HttpError, isHttpError } from "./errors";
import { validateQuery } from "./validateQuery";
import { createTodo, deleteTodo, listTodos, updateTodo } from "./todosRepo";
import { validateBody } from "./validateBody";

const app = express();

app.use(express.json());

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

  if (!hasTitle && !hasCompleted)
    throw new HttpError(400, "patch must include title and/or completed");

  const out: PatchBody = {};

  if (hasTitle) {
    if (typeof maybe.title !== "string" || maybe.title.trim().length < 1) {
      throw new HttpError(400, "title is invalid");
    }
    out.title = maybe.title.trim();
  }

  if (hasCompleted) {
    if (typeof maybe.completed !== "boolean") {
      throw new HttpError(400, "completed is invalid");
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

app.get("/todos", validateQuery(parseQuery), async (_req, res, next) => {
  try {
    const q = res.locals.query as TodosQuery;

    const { todos, total } = await listTodos({
      completed: q.completed,
      limit: q.limit,
      offset: q.offset,
    });

    return res.status(200).json({
      todos,
      page: { limit: q.limit, offset: q.offset, total },
    });
  } catch (err) {
    next(err);
  }
});

app.post("/todos", validateBody(parseBodyTodo), async (_req, res, next) => {
  try {
    const b = res.locals.body as TodoBody;

    const todo = await createTodo(b.title);
    return res.status(201).json({ todo });
  } catch (err) {
    next(err);
  }
});

app.patch(
  "/todos/:id",
  validateBody(parsePatchBody),
  async (req, res, next) => {
    try {
      const patch = res.locals.body as PatchBody;

      const updated = await updateTodo(req.params.id, patch);
      if (!updated) return res.status(404).json({ error: "Todo not found" });

      return res.status(200).json({ todo: updated });
    } catch (err) {
      next(err);
    }
  }
);

app.delete("/todos/:id", async (req, res, next) => {
  try {
    const deleted = await deleteTodo(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Todo not found" });

    return res.status(200).json({ deleted });
  } catch (err) {
    next(err);
  }
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
export { resetDb } from "./db";
