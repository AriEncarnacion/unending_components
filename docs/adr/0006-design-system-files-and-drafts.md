# 6. Design-system files and drafts

- Status: Accepted
- Date: 2026-11-23 (recorded from code comments; the decisions are older)

## Context

A design system is a package of differences from stock (CLAUDE.md). On disk it's `system.json` plus `entries/<name>.json`. The tuner edits a draft in browser storage until Save writes it. The shapes live in `lib/design-systems/schema.ts`.

## Decisions

### Store only differences

- `tokens` holds only what differs from stock. Colours are CSS values or palette refs.
- Fonts are stored by font option id (ADR 0004).
- An entry file holds one entry's tuning in one system, and `knobs` holds only values that differ from the entry's default.
- No file means untuned. `tidy` drops empty entry tunings before saving so that stays true, and `writeWorking` deletes entry files that are gone or empty. It leaves proposals alone.

### Refer to palette steps, don't copy them

- `palette:jade-8` is step 8 (1-based) of the scale with id `jade` in the same system.
- `token:accent` is whatever that token resolves to where it's used.
- When a colour is set to a value that is exactly one of the palette's steps, `toStored` saves it as a reference to that step, so later palette edits flow through. Translucent values (shadcn's dark-mode lines) keep their alpha, so they stay raw.

### Files stay small and diff cleanly

`stable` sorts object keys and rounds long fractions. `serialize` writes pretty JSON with each OKLCH colour kept on one line.

### Shared with the build scripts

`schema.ts`, `type-scale.ts` and `resolve.ts` are also imported by the build scripts, which run with `node --experimental-strip-types`. So they use relative imports with a `.ts` extension and no `@/` aliases.

### Drafts

- A draft is a system's working copy in localStorage. `workingFor` returns the draft if there is one, else the saved files. `active` is `null` on Stock.
- `putWorking` stores a working copy as the draft, or clears the draft once it matches the files again.
- `savedHash` is the hash of the committed files when the draft began (`""` for a system never saved), so a draft can tell when the files changed under it.
- Drafts live in an external store over `localStorage`, read with `useSyncExternalStore`. Its server snapshot is `null`, so the server render and hydration show no drafts and `restored` is false; the client then reads storage. The store follows `storage` events, so edits in the preview iframes and other tabs show up. If a write to storage fails, the draft stays in memory for this tab. A system named in the URL can be an unsaved draft, so it may look missing until drafts restore. The remembered sidebar width works the same way (`useSidebarWidth`).
- The palette is part of the draft. Palette edits share the system's undo history.

### Stock is read-only

Editing Stock asks you to duplicate it first ("Duplicate to edit"). Editing the read-only shadcn base on the home page points you to start a system.

### Migrating older tuner state

Before design systems existed, the tuner kept its overrides in browser storage. If that state exists, `MigrationDialog` turns it into a first system (`readLegacyOverrides`).
