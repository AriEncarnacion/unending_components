# 5. Demo loading and frame readiness

- Status: Accepted
- Date: 2026-11-23 (recorded from code comments; the decisions are older)

## Decisions

### The demo map lives in a client module

`components/showcase/demo-view.tsx` maps each entry to `import()` of its `demo.tsx`. It's a client module on purpose. If a server component imported it, every `import()` would become a client reference, and Next would list all of their chunks in the page's HTML. Every page would then download every demo, Agent Chat's markdown and highlighting included.

The map must list every entry in `registry.json`. Nothing checks that yet (#19).

### One lazy component per entry

Each demo is wrapped in `React.lazy` once, at module load, so each is its own chunk, loaded only when that entry is shown. `DemoView`'s `after` renders inside the same Suspense boundary, so it mounts only once the demo itself has.

### Frames say when they're ready

`FrameReady` sets `<html data-frame-ready="true">` once the demo is hydrated, its fonts are in and it has painted. The size audit waits for that attribute, so it checks the settled layout rather than the server HTML (see ADR 0012).
