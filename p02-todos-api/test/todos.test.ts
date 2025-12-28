import request from "supertest";
import { describe, it, expect, beforeEach } from "vitest";
import { app, resetTodos } from "../src/app";

describe("Todos API", () => {
  beforeEach(() => resetTodos());

  it("GET /todos returns empty list initially", async () => {
    const res = await request(app).get("/todos");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ todos: [] });
  });

  it("POST /todos creates a todo", async () => {
    const res = await request(app).post("/todos").send({ title: "Buy milk" });

    expect(res.status).toBe(201);
    expect(res.body.todo).toEqual({
      id: expect.any(String),
      title: "Buy milk",
      completed: false,
    });

    const list = await request(app).get("/todos");
    expect(list.body.todos).toHaveLength(1);
    expect(list.body.todos[0].title).toBe("Buy milk");
  });
  it("POST /todos validates title", async () => {
    const res = await request(app).post("/todos").send({});
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "title is required" });
  });

  it("PATCH /todos/:id updates completed", async () => {
    const created = await request(app).post("/todos").send({ title: "A" });
    const id = created.body.todo.id as string;

    const res = await request(app)
      .patch(`/todos/${id}`)
      .send({ completed: true });
    expect(res.status).toBe(200);
    expect(res.body.todo.completed).toBe(true);
  });

  it("PATCH /todos/:id returns 404 when not found", async () => {
    const res = await request(app)
      .patch("/todos/nope")
      .send({ completed: true });
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Todo not found" });
  });

  it("DELETE /todos/:id deletes and returns deleted todo", async () => {
    const created = await request(app)
      .post("/todos")
      .send({ title: "Delete me" });
    const id = created.body.todo.id as string;

    const res = await request(app).delete(`/todos/${id}`);
    expect(res.status).toBe(200);
    expect(res.body.deleted).toEqual({
      id,
      title: "Delete me",
      completed: false,
    });

    const list = await request(app).get("/todos");
    expect(list.body).toEqual({ todos: [] });
  });

  it("DELETE /todos/:id returns 404 when not found", async () => {
    const res = await request(app).delete("/todos/nope");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Todo not found" });
  });
});
