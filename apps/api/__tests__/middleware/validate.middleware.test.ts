import { z } from "zod";
import { validate } from "../../middleware/validate.middleware";

// validate() is pure (no DB/HTTP), so it's driven directly with mock req/res/next
// — the same style as auth.middleware.test.ts. We use real Zod schemas so the
// coercion + error-shape behaviour is the production behaviour.

function mockRes(): any {
  const res: any = { statusCode: null, body: undefined };
  res.status = jest.fn((code: number) => {
    res.statusCode = code;
    return res;
  });
  res.json = jest.fn((payload: any) => {
    res.body = payload;
    return res;
  });
  return res;
}

describe("validate — success path", () => {
  test("coerces and writes back params + body, then calls next", () => {
    const req: any = { params: { id: "7" }, body: { n: "5" } };
    const res = mockRes();
    const next = jest.fn();

    validate({
      params: z.object({ id: z.coerce.number() }),
      body: z.object({ n: z.coerce.number() }),
    })(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.params.id).toBe(7);
    expect(req.body.n).toBe(5);
    expect(res.status).not.toHaveBeenCalled();
  });

  test("writes validated query to req.validatedQuery (Express-5 query has no setter)", () => {
    const req: any = { body: {}, params: {} };
    // Emulate Express 5: req.query is a getter with no setter.
    Object.defineProperty(req, "query", {
      get: () => ({ name: "abc" }),
      configurable: true,
    });
    const res = mockRes();
    const next = jest.fn();

    expect(() =>
      validate({ query: z.object({ name: z.string() }) })(req, res, next)
    ).not.toThrow();

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.validatedQuery).toEqual({ name: "abc" });
  });
});

describe("validate — failure path", () => {
  test("returns a 400 with a flat { error, details } shape and does not call next", () => {
    const req: any = { body: { n: "not-a-number" }, params: {}, query: {} };
    const res = mockRes();
    const next = jest.fn();

    validate({ body: z.object({ n: z.number() }) })(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.body.error).toBe("Validation failed");
    expect(res.body.details[0]).toMatchObject({ path: "n" });
    expect(typeof res.body.details[0].message).toBe("string");
    expect(next).not.toHaveBeenCalled();
  });

  test("joins nested error paths with a dot", () => {
    const req: any = { body: { a: { b: "x" } }, params: {}, query: {} };
    const res = mockRes();
    const next = jest.fn();

    validate({ body: z.object({ a: z.object({ b: z.number() }) }) })(
      req,
      res,
      next
    );

    expect(res.body.details[0].path).toBe("a.b");
  });

  test("rethrows a non-Zod error to next()", () => {
    const boom = new Error("boom");
    const throwingSchema: any = {
      parse: () => {
        throw boom;
      },
    };
    const req: any = { body: {}, params: {}, query: {} };
    const res = mockRes();
    const next = jest.fn();

    validate({ body: throwingSchema })(req, res, next);

    expect(next).toHaveBeenCalledWith(boom);
    expect(res.status).not.toHaveBeenCalled();
  });
});
