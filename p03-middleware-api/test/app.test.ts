import request from "supertest";
import { describe, it, expect } from "vitest";
import { app } from "../src/app";

describe("P03 Middleware API", () => {
  describe("POST /echo", () => {
    it("returns trimmed message", async () => {
      const res = await request(app)
        .post("/echo")
        .send({ message: "  hello  " });
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ youSent: { message: "hello" } });
    });

    it("validates message is required", async () => {
      const res = await request(app).post("/echo").send({});
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: "message is required" });
    });

    it("validates message cannot be blank", async () => {
      const res = await request(app).post("/echo").send({ message: "   " });
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: "message is required" });
    });
  });

  describe("POST /sum", () => {
    it("sums numbers", async () => {
      const res = await request(app)
        .post("/sum")
        .send({ numbers: [1, 2, 3.5] });
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ sum: 6.5 });
    });

    it("validates numbers must be array of numbers", async () => {
      const res = await request(app)
        .post("/sum")
        .send({ numbers: ["1", 2] });
      expect(res.status).toBe(400);
      expect(res.body).toEqual({
        error: "numbers must be an array of numbers",
      });
    });

    it("validates numbers must not be empty", async () => {
      const res = await request(app).post("/sum").send({ numbers: [] });
      expect(res.status).toBe(400);
      expect(res.body).toEqual({
        error: "numbers must be an array of numbers",
      });
    });
  });

  describe("GET /errors/demo", () => {
    it("returns 500 Internal Server Error for unexpected errors", async () => {
      const res = await request(app).get("/errors/demo");
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: "Internal Server Error" });
    });
  });

  describe("404 handler", () => {
    it("returns 404 Not Found for unknown routes", async () => {
      const res = await request(app).get("/nope");
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: "Not Found" });
    });
  });
});
