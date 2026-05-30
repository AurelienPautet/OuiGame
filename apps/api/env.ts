// Loads the repo-root .env BEFORE anything that reads process.env at import time
// — notably @ouigame/db's connection pool, which is created when its module is
// first imported. In ESM, imports are hoisted and evaluated in source order, so
// the entrypoints (server.ts, scripts/*) MUST `import "./env"` as their very
// first import, before importing @ouigame/db (directly or transitively).
// (Under the old CommonJS server this was just a require() at the top; ESM
// hoisting reorders that, which is why this dedicated, first-imported module
// exists.) On Heroku the file is absent and real config vars are already set, so
// a missing file is a no-op.
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.join(import.meta.dirname, "../../.env") });
