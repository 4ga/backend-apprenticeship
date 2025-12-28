import request from "supertest";
import { describe, it, expect, beforeEach } from "vitest";
import { app, resetTodos } from "../src/app";

describe("P04 Todos API v2", () => {
  beforeEach(() => resetTodos());

  it("GET /todos returns empty list with default paging", async () => {
    const res = await request(app).get("/todos");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      todos: [],
      page: { limit: 10, offset: 0, total: 0 },
    });
  });

  it("POST /todos creates todo with trimmed title and createdAt", async () => {
    const res = await request(app)
      .post("/todos")
      .send({ title: "  Buy milk  " });
    expect(res.status).toBe(201);

    expect(res.body.todo).toEqual({
      id: expect.any(String),
      title: "Buy milk",
      completed: false,
      createdAt: expect.any(String),
    });

    // createdAt should be parseable date
    expect(Number.isNaN(Date.parse(res.body.todo.createdAt))).toBe(false);
  });

  it("POST /todos validates title", async () => {
    const res = await request(app).post("/todos").send({ title: "   " });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "title is required" });
  });

  it("PATCH /todos/:id updates title and completed", async () => {
    const created = await request(app).post("/todos").send({ title: "A" });
    const id = created.body.todo.id as string;

    const res = await request(app)
      .patch(`/todos/${id}`)
      .send({ title: "  New  ", completed: true });

    expect(res.status).toBe(200);
    expect(res.body.todo.id).toBe(id);
    expect(res.body.todo.title).toBe("New");
    expect(res.body.todo.completed).toBe(true);
    expect(res.body.todo.createdAt).toBe(created.body.todo.createdAt);
  });

  it("PATCH /todos/:id validates patch must include fields", async () => {
    const created = await request(app).post("/todos").send({ title: "A" });
    const id = created.body.todo.id as string;

    const res = await request(app).patch(`/todos/${id}`).send({});
    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: "patch must include title and/or completed",
    });
  });

  it("PATCH /todos/:id returns 404 when not found", async () => {
    const res = await request(app)
      .patch("/todos/nope")
      .send({ completed: true });
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Todo not found" });
  });

  it("DELETE /todos/:id deletes", async () => {
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
      createdAt: created.body.todo.createdAt,
    });

    const list = await request(app).get("/todos");
    expect(list.body.page.total).toBe(0);
    expect(list.body.todos).toEqual([]);
  });

  it("GET /todos supports completed filter", async () => {
    await request(app).post("/todos").send({ title: "A" });
    const b = await request(app).post("/todos").send({ title: "B" });
    const bid = b.body.todo.id as string;

    await request(app).patch(`/todos/${bid}`).send({ completed: true });

    const onlyTrue = await request(app).get("/todos?completed=true");
    expect(onlyTrue.status).toBe(200);
    expect(onlyTrue.body.page.total).toBe(1);
    expect(onlyTrue.body.todos[0].title).toBe("B");

    const onlyFalse = await request(app).get("/todos?completed=false");
    expect(onlyFalse.status).toBe(200);
    expect(onlyFalse.body.page.total).toBe(1);
    expect(onlyFalse.body.todos[0].title).toBe("A");
  });

  it("GET /todos supports limit/offset pagination", async () => {
    await request(app).post("/todos").send({ title: "A" });
    await request(app).post("/todos").send({ title: "B" });
    await request(app).post("/todos").send({ title: "C" });

    const res = await request(app).get("/todos?limit=2&offset=1");
    expect(res.status).toBe(200);
    expect(res.body.page).toEqual({ limit: 2, offset: 1, total: 3 });
    expect(res.body.todos).toHaveLength(2);
    expect(res.body.todos.map((t: any) => t.title)).toEqual(["B", "C"]);
  });

  it("GET /todos validates completed query", async () => {
    const res = await request(app).get("/todos?completed=maybe");
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "completed must be true or false" });
  });

  it("GET /todos validates limit/offset query", async () => {
    const res = await request(app).get("/todos?limit=0&offset=-1");
    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: "limit must be 1-50 and offset must be >= 0",
    });
  });
});
