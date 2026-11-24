# 3. Dev-only routes and their guards

- Status: Accepted
- Date: 2026-11-23 (recorded from code comments; the decisions are older)

## Context

The catalog is a local tool. Its API routes write to `design-systems/` and run your own `git`, `gh` and `claude`:

- `app/api/design-systems/route.ts`: Save, Delete and dismissing a proposal.
- `app/api/ship/route.ts`: Ship, roll back and Pull.

## Decisions

### They only run under `next dev`

Both routes refuse to run anywhere else, and the design-systems route only ever touches `design-systems/`.

### Other machines are kept out by the network, not by the guards

`npm run dev` listens on 127.0.0.1 only, so nothing else on the network can connect. The guards in `lib/dev-guard.ts` read headers, which any non-browser client can set, so they don't try to stop other machines. Their job is other sites open in your browser:

- **DNS rebinding.** A hostile name that resolves to 127.0.0.1 still carries its own `Host` header, so the Host must be local.
- **CSRF.** Writes must be `application/json`. That content type can't be sent cross-site without a CORS preflight, and these routes never approve one.
- **Origin.** Browsers say where a request came from. Only the catalog's own pages may write.

`guardDevRead` covers reads that still run `git` and `gh` (Ship's status): local dev server, local Host, same origin.

### Names come from disk, never the request

When Ship needs a system's name, it reads it from the saved files, not from the request body.
