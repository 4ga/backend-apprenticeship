import request from "supertest";
import { describe, it, expect, beforeEach } from "vitest";
import { app, resetDb } from "../src/app";

describe("P06 Auth API", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("registers a user", async () => {
    const res = await request(app)
      .post("/auth/register")
      .send({ email: "USER@Example.com ", password: "Passw0rd!" });

    expect(res.status).toBe(201);
    expect(res.body.user).toEqual({
      id: expect.any(String),
      email: "user@example.com",
    });
  });

  it("prevents duplicate registration", async () => {
    await request(app)
      .post("/auth/register")
      .send({ email: "user@example.com", password: "Passw0rd!" });

    const dup = await request(app)
      .post("/auth/register")
      .send({ email: "user@example.com", password: "Passw0rd!" });

    expect(dup.status).toBe(409);
    expect(dup.body).toEqual({ error: "Email already registered" });
  });

  it("rejects invalid registration input", async () => {
    const res = await request(app)
      .post("/auth/register")
      .send({ email: "not-an-email", password: "short" });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "email or password is invalid" });
  });

  it("logs in and returns tokens", async () => {
    await request(app)
      .post("/auth/register")
      .send({ email: "user@example.com", password: "Passw0rd!" });

    const res = await request(app)
      .post("/auth/login")
      .send({ email: "user@example.com", password: "Passw0rd!" });

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe("user@example.com");
    expect(typeof res.body.accessToken).toBe("string");
    expect(typeof res.body.refreshToken).toBe("string");
    expect(res.body.accessToken.length).toBeGreaterThan(10);
    expect(res.body.refreshToken.length).toBeGreaterThan(10);
  });

  it("rejects invalid credentials", async () => {
    await request(app)
      .post("/auth/register")
      .send({ email: "user@example.com", password: "Passw0rd!" });

    const res = await request(app)
      .post("/auth/login")
      .send({ email: "user@example.com", password: "WrongPass!" });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: "Invalid credentials" });
  });

  it("GET /me works with access token", async () => {
    await request(app)
      .post("/auth/register")
      .send({ email: "user@example.com", password: "Passw0rd!" });

    const login = await request(app)
      .post("/auth/login")
      .send({ email: "user@example.com", password: "Passw0rd!" });

    const accessToken = login.body.accessToken as string;

    const me = await request(app)
      .get("/me")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe("user@example.com");
  });

  it("GET /me rejects missing token", async () => {
    const me = await request(app).get("/me");
    expect(me.status).toBe(401);
    expect(me.body).toEqual({ error: "Unauthorized" });
  });

  it("refresh rotates refresh token and returns new tokens", async () => {
    await request(app)
      .post("/auth/register")
      .send({ email: "user@example.com", password: "Passw0rd!" });

    const login = await request(app)
      .post("/auth/login")
      .send({ email: "user@example.com", password: "Passw0rd!" });

    const oldRefresh = login.body.refreshToken as string;

    const refreshed = await request(app)
      .post("/auth/refresh")
      .send({ refreshToken: oldRefresh });

    expect(refreshed.status).toBe(200);
    expect(typeof refreshed.body.accessToken).toBe("string");
    expect(typeof refreshed.body.refreshToken).toBe("string");
    expect(refreshed.body.refreshToken).not.toBe(oldRefresh);

    // old refresh should no longer work
    const again = await request(app)
      .post("/auth/refresh")
      .send({ refreshToken: oldRefresh });

    expect(again.status).toBe(401);
    expect(again.body).toEqual({ error: "Invalid refresh token" });
  });

  it("logout invalidates refresh token", async () => {
    await request(app)
      .post("/auth/register")
      .send({ email: "user@example.com", password: "Passw0rd!" });

    const login = await request(app)
      .post("/auth/login")
      .send({ email: "user@example.com", password: "Passw0rd!" });

    const refreshToken = login.body.refreshToken as string;

    const out = await request(app).post("/auth/logout").send({ refreshToken });

    expect(out.status).toBe(200);
    expect(out.body).toEqual({ status: "ok" });

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
