import request from "supertest";
import { describe, it, expect, beforeEach } from "vitest";
import { app, resetDb } from "../src/app";

async function registerAndLogin(email: string) {
  await request(app)
    .post("/auth/register")
    .send({ email, password: "Passw0rd!" });

  const login = await request(app)
    .post("/auth/login")
    .send({ email, password: "Passw0rd!" });

  return {
    accessToken: login.body.accessToken as string,
    refreshToken: login.body.refreshToken as string,
  };
}

describe("P07 Auth-protected Todos", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("requires auth for /todos", async () => {
    const res = await request(app).get("/todos");
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: "Unauthorized" });
  });

  it("creates and lists todos for the logged-in user", async () => {
    const { accessToken } = await registerAndLogin("a@example.com");

    const created = await request(app)
      .post("/todos")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ title: "  Buy milk  " });

    expect(created.status).toBe(201);
    expect(created.body.todo.title).toBe("Buy milk");

    const list = await request(app)
      .get("/todos")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(list.status).toBe(200);
    expect(list.body.page.total).toBe(1);
    expect(list.body.todos[0].title).toBe("Buy milk");
  });

  it("isolates todos between users (no cross-tenant access)", async () => {
    const userA = await registerAndLogin("a@example.com");
    const userB = await registerAndLogin("b@example.com");

    const aTodo = await request(app)
      .post("/todos")
      .set("Authorization", `Bearer ${userA.accessToken}`)
      .send({ title: "A1" });

    const aId = aTodo.body.todo.id as string;

    // B cannot see A's todo
    const bList = await request(app)
      .get("/todos")
      .set("Authorization", `Bearer ${userB.accessToken}`);
    expect(bList.status).toBe(200);
    expect(bList.body.page.total).toBe(0);

    // B cannot patch A's todo
    const bPatch = await request(app)
      .patch(`/todos/${aId}`)
      .set("Authorization", `Bearer ${userB.accessToken}`)
      .send({ completed: true });
    expect(bPatch.status).toBe(404);
    expect(bPatch.body).toEqual({ error: "Todo not found" });

    // B cannot delete A's todo
    const bDel = await request(app)
      .delete(`/todos/${aId}`)
      .set("Authorization", `Bearer ${userB.accessToken}`);
    expect(bDel.status).toBe(404);
    expect(bDel.body).toEqual({ error: "Todo not found" });

    // A still can delete it
    const aDel = await request(app)
      .delete(`/todos/${aId}`)
      .set("Authorization", `Bearer ${userA.accessToken}`);
    expect(aDel.status).toBe(200);
  });

  it("supports completed filter and pagination per user", async () => {
    const { accessToken } = await registerAndLogin("a@example.com");

    await request(app)
      .post("/todos")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ title: "A" });

    const b = await request(app)
      .post("/todos")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ title: "B" });

    const bid = b.body.todo.id as string;

    await request(app)
      .patch(`/todos/${bid}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ completed: true });

    const onlyTrue = await request(app)
      .get("/todos?completed=true")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(onlyTrue.status).toBe(200);
    expect(onlyTrue.body.page.total).toBe(1);
    expect(onlyTrue.body.todos[0].title).toBe("B");

    const page = await request(app)
      .get("/todos?limit=1&offset=1")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(page.status).toBe(200);
    expect(page.body.page).toEqual({ limit: 1, offset: 1, total: 2 });
    expect(page.body.todos).toHaveLength(1);
    expect(page.body.todos[0].title).toBe("B");
  });

  it("logout-all invalidates refresh tokens for the user", async () => {
    const { accessToken, refreshToken } = await registerAndLogin(
      "a@example.com"
    );

    const out = await request(app)
      .post("/auth/logout-all")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({});

    expect(out.status).toBe(200);
    expect(out.body).toEqual({ status: "ok" });

    // refresh should fail because token was removed from DB
    const refresh = await request(app)
      .post("/auth/refresh")
      .send({ refreshToken });

    expect(refresh.status).toBe(401);
    expect(refresh.body).toEqual({ error: "Invalid refresh token" });
  });

  it("Unknown routes return 404 Not Found", async () => {
    const res = await request(app).get("/nope");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Not Found" });
  });
});
