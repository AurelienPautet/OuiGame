// Typed HTTP errors plus the infrastructure-error translation that used to live
// inline in the route handlers. Throwing one of these from any route or service
// lets the central error middleware (middleware/error.middleware.ts) map it to
// the exact HTTP response, so handlers no longer carry their own
// try/catch -> console.error -> res.status(500) boilerplate.

// Carries the HTTP status and the EXACT JSON body to send. Most callers use the
// helpers below (the conventional `{ error }` shape), but the body is kept fully
// caller-controlled because the auth routes send a richer `{ error, message }`
// the web client branches on (e.g. error === "username"), and that contract must
// survive verbatim.
export class HttpError extends Error {
  readonly status: number;
  readonly body: { error: string; message?: string };
  // Lets the middleware (and tests) recognise the error across module/realm
  // boundaries without relying solely on `instanceof`.
  readonly isHttpError = true;

  constructor(status: number, body: { error: string; message?: string }) {
    super(body.message ?? body.error);
    this.status = status;
    this.body = body;
    this.name = "HttpError";
  }
}

// Conventional `{ error: "<message>" }` responses, by status. These replace the
// scattered `res.status(4xx).json({ error })` guard clauses in the routes.
export const badRequest = (error: string) => new HttpError(400, { error });
export const unauthorized = (error: string) => new HttpError(401, { error });
export const forbidden = (error: string) => new HttpError(403, { error });
export const notFound = (error: string) => new HttpError(404, { error });
export const conflict = (error: string) => new HttpError(409, { error });

// Postgres unique-constraint (SQLSTATE 23505) detection. Lives here — at the
// error boundary — so neither the HTTP routes nor the Drizzle repositories have
// to know the driver's error shape. node-postgres puts the code on the error;
// Drizzle additionally nests the original error under `.cause`.
export function isUniqueViolation(err: unknown): boolean {
  const e = err as { code?: string; cause?: { code?: string } } | null;
  return !!e && (e.code === "23505" || e.cause?.code === "23505");
}
