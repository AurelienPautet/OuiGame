// Express middleware that validates the request against Zod schemas from
// @ouigame/shared/api. On success it writes the parsed (coerced) value back so
// downstream handlers read normalized data; on failure it returns a 400 with a
// flat { error, details } shape. Place it AFTER the auth middleware so an
// unauthenticated request still 401s before any validation runs.
const { ZodError } = require("zod");

// schemas: { body?, params?, query? } — each a Zod schema. params and body are
// reassigned in place; query is written to req.validatedQuery because Express 5
// exposes req.query as a getter with no setter (assigning it throws).
function validate(schemas) {
  return (req, res, next) => {
    try {
      if (schemas.params) req.params = schemas.params.parse(req.params);
      if (schemas.query) req.validatedQuery = schemas.query.parse(req.query);
      if (schemas.body) req.body = schemas.body.parse(req.body);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        return res.status(400).json({
          error: "Validation failed",
          details: err.issues.map((i) => ({
            path: i.path.join("."),
            message: i.message,
          })),
        });
      }
      next(err);
    }
  };
}

module.exports = { validate };
