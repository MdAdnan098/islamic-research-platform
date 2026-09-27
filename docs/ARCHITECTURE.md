# Architecture Notes (Phase 1)

## Separation of concerns
- `frontend/` and `backend/` are independent projects with their own
  `package.json`. The frontend only ever talks to the backend over HTTP,
  through `frontend/src/services/api.js`.
- Public and admin code are split at every layer (routes, pages, layouts,
  components) on the frontend, and at the route/middleware level on the
  backend, since they will always have very different auth requirements.

## Database access
- MongoDB Atlas is accessed with the official `mongodb` Node.js driver,
  running inside the Worker with Node.js compatibility (`cloudflare:sockets`
  TCP support), which is on **by default** as of compatibility date
  2026-08-04. `wrangler.toml` is pinned to today's date and deliberately
  does **not** list `nodejs_compat` explicitly — workerd now rejects that
  flag as redundant once the date already implies it. If you ever roll
  `compatibility_date` back before 2026-08-04, you must add
  `compatibility_flags = ["nodejs_compat"]` back in.
- The older MongoDB Atlas Data API (HTTPS-based) is **not** used — it has
  been deprecated/retired by MongoDB. The driver-based approach is
  Cloudflare's current recommended integration path.
- The connection is cached at module scope (`mongo.service.js`) so a warm
  Worker isolate reuses its connection pool across requests instead of
  reconnecting every time. `serverSelectionTimeoutMS: 8000` makes a broken
  connection fail fast with a clear error rather than hanging.
- The database starts empty. No collections, indexes, or sample documents
  are created in this phase.
- `backend/scripts/verify-db-connection.mjs` (`npm run verify:db`) is a
  standalone Node script — same driver dependency, no new package — for
  testing real Atlas connectivity directly from a machine with network
  access to Atlas, independent of the Worker/`wrangler dev` runtime.

## File storage
- Cloudflare R2 is bound to the Worker as `MEDIA_BUCKET` and wrapped by
  `backend/src/services/storage/r2.service.js`. It is not used by any
  route yet — image/PDF block support comes in a later phase.

## Routing
- The backend uses a small hand-written router in `src/index.js`
  (method + exact path match) rather than a routing library, to avoid an
  unnecessary dependency at this stage. It can be swapped for a router
  library later without touching route handler code.
- The frontend uses `react-router-dom`, with public and admin route trees
  defined separately and merged in `AppRouter.jsx`.

## Admin authentication
- Not implemented in this phase. `middleware/adminAuth.js` and
  `context/AuthContext.jsx` define the shape future auth will plug into,
  but currently reject/stub every call on purpose, so nothing is
  accidentally left open.

## Content architecture (future phases)
This phase intentionally does not implement:
- Aqeedah / Masail / Categories / Articles data models
- The block-based article editor (Text, Heading, Reference, Quote, Image, PDF)
- Structured references (book, author, volume, page) or scanned reference images
- Hindi / Urdu / Roman language versions and AI-assisted translation
- Search
- Draft / publish / archive workflow

The folder structure (`controllers/`, `services/`, empty component folders)
is laid out so these can be added incrementally without restructuring.
