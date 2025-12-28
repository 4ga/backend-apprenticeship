export class HttpError extends Error {
  statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;

    // makes instanceof work reliably in TS/JS
    Object.setPrototypeOf(this, HttpError.prototype);
  }
}

export function isHttpError(err: unknown): err is HttpError {
  return err instanceof HttpError;
}
