# 0002. A design system is a package of differences, not a fork

Status: Accepted, 2026-11-22.

A design system stores only how it differs from stock. `system.json` holds palette, token and theme differences, and `entries/<name>.json` holds one entry's tuning. An entry with no file is untuned, which means it's fine as it is and ships unchanged. We considered letting a system fork an entry's classes or code. That would make each system a copy of the catalog that slowly drifts from it, and nobody had a real case that needed it. Rejected for now (YAGNI).

Entry tuning is limited to what the entry declares in its `knobs.ts`: scoped tokens, motion knobs and prop defaults. It's read through one `useEntryTuning("<name>", …)` call. The palette ships as CSS variables only, with no Tailwind classes, so agents building in an app reach for semantic tokens rather than raw scale steps.

## Consequences

- A fix to an entry reaches every system on its next ship. Systems don't carry their own copies of entries.
- A system can't change an entry's structure. If it needs something structurally different, that's a new entry (or a new knob), not a system override.
- Adding a knob is a catalog change to the entry, and every system can then tune it.
- Global style fixes go in the entry itself, not in a showcase or system override.
- The tuner writes these files through the dev-only Save. Don't hand-edit them unless asked.
