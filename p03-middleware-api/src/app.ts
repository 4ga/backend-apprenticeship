import express from "express";
import { HttpError, isHttpError } from "./errors";
import { validateBody } from "./validateBody";

type EchoBody = { message: string };
type SumBody = { numbers: number[] };

function parseEchoBody(body: unknown): EchoBody {
  if (typeof body !== "object" || body === null) {
    throw new HttpError(400, "message is required");
  }
  const maybe = body as { message?: unknown };
  const msg = typeof maybe.message === "string" ? maybe.message.trim() : "";
  if (msg.length < 1) throw new HttpError(400, "message is required");
  return { message: msg };
}

function parseSumBody(body: unknown): SumBody {
  if (typeof body !== "object" || body === null) {
    throw new HttpError(400, "numbers must be an arry of numbers");
  }
  const maybe = body as { numbers?: unknown };
  const nums = maybe.numbers;
  if (!Array.isArray(nums) || nums.length < 1) {
    throw new HttpError(400, "numbers must be an array of numbers");
  }

  if (!nums.every((n) => typeof n === "number" && Number.isFinite(n))) {
    throw new HttpError(400, "numbers must be an array of numbers");
  }
  return { numbers: nums };
}

const app = express();
app.use(express.json());

app.post("/echo", validateBody(parseEchoBody), (_req, res) => {
  const body = res.locals.body as EchoBody;
  return res.status(200).json({ youSent: { message: body.message } });
});

app.post("/sum", validateBody(parseSumBody), (_req, res) => {
  const body = res.locals.body as SumBody;
  const sum = body.numbers.reduce((acc, n) => acc + n, 0);
  return res.status(200).json({ sum });
});

app.get("/errors/demo", (req, res) => {
  throw new Error("Boom");
});

app.use((_req, res) => {
  res.status(404).json({ error: "Not Found" });
});

app.use(
  (
    err: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    if (isHttpError(err)) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    return res.status(500).json({ error: "Internal Server Error" });
  }
);

export { app };
