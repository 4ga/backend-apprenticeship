import request from "supertest";
import { describe, it, expect, beforeEach } from "vitest";
import { app, resetDb } from "../src/app";
import { findUserByEmail, setUserRole } from "../src/authRepo";

async function register(email: string) {
  return request(app)
    .post("/auth/register")
    .send({ email, password: "Passw0rd!" });
}

async function login(email: string) {
  return request(app)
    .post("/auth/login")
    .send({ email, password: "Passw0rd!" });
}

describe("P08 RBAC", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("admin routes require auth", async () => {
    const res = await request(app).get("/admin/users");
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: "Unauthorized" });
  });

  it("non-admin gets 403 on admin routes", async () => {
    await register("user@example.com");
    const logged = await login("user@example.com");

    const res = await request(app)
      .get("/admin/users")
      .set("Authorization", `Bearer ${logged.body.accessToken}`);

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: "Forbidden" });
  });

  it("admin can list users", async () => {
    await register("admin@example.com");
    await register("user@example.com");

    const admin = await findUserByEmail("admin@example.com");
    expect(admin).not.toBeNull();
    await setUserRole(admin!.id, "admin");

    const logged = await login("admin@example.com");

    const res = await request(app)
      .get("/admin/users")
      .set("Authorization", `Bearer ${logged.body.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.users.length).toBe(2);
    expect(res.body.page.total).toBe(2);
  });

  it("admin can view another user's todos", async () => {
    await register("admin@example.com");
    await register("user@example.com");

    const adminRow = await findUserByEmail("admin@example.com");
    await setUserRole(adminRow!.id, "admin");

    const userLogged = await login("user@example.com");
    await request(app)
      .post("/todos")
      .set("Authorization", `Bearer ${userLogged.body.accessToken}`)
      .send({ title: "U1" });

    const userRow = await findUserByEmail("user@example.com");

    const adminLogged = await login("admin@example.com");
    const res = await request(app)
      .get(`/admin/users/${userRow!.id}/todos`)
      .set("Authorization", `Bearer ${adminLogged.body.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.page.total).toBe(1);
    expect(res.body.todos[0].title).toBe("U1");
  });

  it("admin can delete user (cascade todos + refresh tokens)", async () => {
    await register("admin@example.com");
    await register("user@example.com");

    const adminRow = await findUserByEmail("admin@example.com");
    await setUserRole(adminRow!.id, "admin");

    const userLogged = await login("user@example.com");
    await request(app)
      .post("/todos")
      .set("Authorization", `Bearer ${userLogged.body.accessToken}`)
      .send({ title: "U1" });

    const userRow = await findUserByEmail("user@example.com");

    const adminLogged = await login("admin@example.com");
    const del = await request(app)
      .delete(`/admin/users/${userRow!.id}`)
      .set("Authorization", `Bearer ${adminLogged.body.accessToken}`);

    expect(del.status).toBe(200);

    // user can't login anymore
    const userLoginAgain = await login("user@example.com");
    expect(userLoginAgain.status).toBe(401);

    // admin viewing deleted user's todos should 404 user not found (or total 0 depending on your design)
    const view = await request(app)
      .get(`/admin/users/${userRow!.id}/todos`)
      .set("Authorization", `Bearer ${adminLogged.body.accessToken}`);
    expect(view.status).toBe(404);
  });
});
