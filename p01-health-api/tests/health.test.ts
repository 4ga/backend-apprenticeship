import request from "supertest";
import { describe, it, expect } from "vitest";
import { app } from "../src/app";

describe("GET /health", () => {
  it("return 200", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
  });

  it(`returns {status: "ok"}`, async () => {
    const res = await request(app).get("/health");
    expect(res.body.status).toBe("ok");
  });

  it("returns uptimeSeconds as a number >= 0", async () => {
    const res = await request(app).get("/health");

    expect(typeof res.body.uptimeSeconds).toBe("number");
    expect(Number.isFinite(res.body.uptimeSeconds)).toBe(true);
    expect(res.body.uptimeSeconds).toBeGreaterThanOrEqual(0);
  });
});
