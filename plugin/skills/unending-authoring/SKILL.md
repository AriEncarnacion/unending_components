---
name: unending-authoring
description: How to add or change an entry in Ari's Unending component catalog (the unending_components repo). Use when working inside that repo, or when the user wants to capture, harvest, design or restyle a component into the catalog via /unending:capture, /unending:harvest, /unending:create or /unending:restyle.
---

# Authoring a catalog entry

An entry is one **intent**, written as something a person is trying to do. It has three parts, and all three are required:

1. **Installable code:** `registry/unending/<name>/<name>.tsx`. Add extra files only when they're needed. Imports use `@/components/ui/*` and `@/hooks/*`, and other files in the same entry use relative imports (`./chat-markdown`).
2. **Intent and UX notes:** `registry/unending/<name>/README.md`, following `references/readme-template.md`. Use the headings Intent, When to use, Anatomy (a table of part, built from, notes), Interactions or a topic of your own, States, and Not yet decided.
3. **Variants and states:** `registry/unending/<name>/demo.tsx`. Its default export renders several `<Example title description>` blocks from `@/components/showcase/example`. Use realistic data, not lorem ipsum, and include the edge states (empty, error, long, many).
4. **Knobs:** `registry/unending/<name>/knobs.ts`, for design systems to tune. The component reads the values that shape its feel (durations, easings, distances, thresholds, default variants) from one call: `const tuning = useEntryTuning("<name>", { flightMs: 180, ... })` from `@/lib/tuning`. Defaults are literal numbers, strings or booleans. Prop defaults read from it too (`span ?? tuning.spanDays * DAY`). `knobs.ts` exports `knobs: Knob[]` with the same keys and defaults, plus labels and ranges for the tuner. Add the entry to `lib/entry-knobs.ts`. The build bakes each design system's values into the code, so installed components have no tuning layer.
5. **A root `data-slot="<name>"`**, so design systems can scope token overrides to the entry. If the root is another component's element, wrap it in `<div data-slot="<name>" className="contents">`.

Then register it:

- Add an item to `registry.json`:
  - `type: "registry:component"`.
  - A `description` written for an AI reader, saying what it does and when to use it.
  - `categories`.
  - `dependencies`: npm packages only.
  - `registryDependencies`: stock shadcn names, plus `AriEncarnacion/unending_components/tuning` and `AriEncarnacion/unending_components/theme`.
  - `files`.
  - `docs`: setup the consumer must do.
  - `meta: { entry: true, intent, status: "draft", origin }`.
- Add the demo to the `demos` map in `lib/catalog.ts`.
- If the entry needs a full page, such as an app shell, add a frame under `app/[system]/(frame)/preview/[name]` and embed it with an iframe whose `src` is `/<system>/preview/<name>` (read `system` with `useParams`).

## Design systems

Design systems live in `design-systems/<id>/` (`system.json`, plus `entries/<name>.json` for each entry tuned in that system). Ari tunes them in the showcase and saves them there; don't edit those files by hand unless asked.

After building a new entry, you may propose a tuning per system: write `design-systems/<id>/entries/<name>.proposed.json` (an entry tuning with a short `note` saying why), only where the system clearly calls for it (its radius, motion or palette). Scoped colours must be palette refs (`palette:jade-8`) or token refs (`token:accent`). Ari accepts or rejects each on `/c/<name>`; a rejected proposal leaves the entry untuned, which means it ships as it is.

## Rules

- Follow the `unending-flavor` skill. Build from stock components first and only then write custom markup.
- Name things for the intent: `review-deck`, not `swipe-cards`.
- Status starts at `draft`. Ari promotes entries to `refined` or `stable`.
- Write down what is left open. Anything the stock system can't express belongs under "Not yet decided" in the README, for Ari to review. Never resolve it silently with custom colors or one-off styles.
- Credit the origin in `meta.origin` and the README: harvested from an app, rebuilt from a package (with its license), or designed from intent.

## Checks before finishing

```bash
npm run registry:check   # theme sync, catalog index, design-system builds, shadcn registry validate
npm run typecheck && npm run lint
npm run dev              # open /c/<name> and try every example in light and dark, and at phone width
```

`npm run registry:build` regenerates the theme item, the plugin's catalog index, `public/r/*.json` (Stock) and `public/r/<id>/*.json` (each design system, with entries baked). Run it and commit its output with the entry.
