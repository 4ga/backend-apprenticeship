import express from "express";
import {
  createTodo,
  deleteTodo,
  getTodos,
  resetTodos,
  updateTodo,
} from "./todos";

const app = express();
app.use(express.json());

app.get("/todos", (_req, res) => {
  const todos = getTodos();
  res.status(200).json({ todos });
});
app.post("/todos", (req, res) => {
  const { title } = req.body;
  try {
    const todo = createTodo(title);
    return res.status(201).json({ todo });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return res.status(400).json({ error: message });
  }
});
app.patch("/todos/:id", (req, res) => {
  const id = req.params.id.trim();
  const { title, completed } = req.body;
  try {
    const updated = updateTodo(id, { title, completed });
    return res.status(200).json({ todo: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return res.status(404).json({ error: message });
  }
});
app.delete("/todos/:id", (req, res) => {
  const id = req.params.id.trim();
  try {
    const deleted = deleteTodo(id);
    return res.status(200).json({ deleted });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return res.status(404).json({ error: message });
  }
});

export { app, resetTodos };
