// Typed HTTP errors plus the infrastructure-error translation that used to live
// inline in the route handlers. Throwing one of these from any route or service
// lets the central error middleware (middleware/error.middleware.ts) map it to
// the exact HTTP response, so handlers no longer carry their own
// try/catch -> console.error -> res.status(500) boilerplate.

// The JSON body an HttpError carries: always an `error` string, optionally a
// `message`, plus any extra fields a caller needs (e.g. the `details` array of a
// validation error). The body is sent VERBATIM, which is what lets the auth
// routes carry the richer `{ error, message }` shape the web client branches on
// (e.g. error === "username") without it being reshaped.
export interface HttpErrorBody {
  error: string;
  message?: string;
  [key: string]: unknown;
}

// Carries the HTTP status and the exact JSON body to send.
export class HttpError extends Error {
  readonly status: number;
  readonly body: HttpErrorBody;
  // Lets the middleware recognise the error across module/realm boundaries
  // without relying solely on `instanceof` — see isHttpError() below.
  readonly isHttpError = true;

  constructor(status: number, body: HttpErrorBody) {
    super(body.message ?? body.error);
    this.status = status;
    this.body = body;
    this.name = "HttpError";
  }
}

// Recognise an HttpError without relying solely on `instanceof`, which breaks if
// two copies of this module ever load (duplicate installs / separate realms).
// The `isHttpError` brand makes the check copy-proof.
export function isHttpError(err: unknown): err is HttpError {
  return (
    err instanceof HttpError ||
    (typeof err === "object" &&
      err !== null &&
      (err as { isHttpError?: unknown }).isHttpError === true)
  );
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
