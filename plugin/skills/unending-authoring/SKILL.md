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
- `npm run registry:build` adds the demo to the generated map in `components/showcase/demo-loaders.ts`. Don't edit that file by hand.
- Set `meta.minWidth` (px) in `registry.json` if the entry can't work down to 320px, WCAG's reflow width, and say why in its README.
- If the entry needs a full page, such as an app shell, add a frame under `app/[system]/(frame)/preview/[name]` and embed it with an iframe whose `src` is `/<system>/preview/<name>` (read `system` with `useParams`).

## Design systems

Design systems live in `design-systems/<id>/` (`system.json`, plus `entries/<name>.json` for each entry tuned in that system), each a clone of the system's own GitHub repo: the folder is git-ignored here, and Ship builds, tags and pushes each system to its repo. Ari tunes them in the showcase and saves them there; don't edit those files by hand unless asked, and never commit them.

After building a new entry, you may propose a tuning per system: write `design-systems/<id>/entries/<name>.proposed.json` (an entry tuning with a short `note` saying why), only where the system clearly calls for it (its radius, motion or palette). Scoped colours must be palette refs (`palette:jade-8`) or token refs (`token:accent`). Ari accepts or rejects each on `/c/<name>`; a rejected proposal leaves the entry untuned, which means it ships as it is.

## Rules

- Follow the `unending-flavor` skill. Build from stock components first and only then write custom markup.
- Name things for the intent: `review-deck`, not `swipe-cards`.
- No code comments, TSDoc on props included (`unending/no-comments`). Let names and types carry meaning, with units as type aliases declared in the entry (`EpochMs`, `Pixels`). A rule the caller must follow goes in the README and in `docs`.
- Status starts at `draft`. Ari promotes entries to `refined` or `stable`.
- Write down what is left open. Anything the stock system can't express belongs under "Not yet decided" in the README, for Ari to review. Never resolve it silently with custom colors or one-off styles.
- Credit the origin in `meta.origin` and the README: harvested from an app, rebuilt from a package (with its license), or designed from intent.

## Checks before finishing

```bash
npm run registry:check   # theme sync, catalog index, design-system builds, shadcn registry validate
npm run typecheck && npm run lint
npm run dev              # open /c/<name> and try every example in light and dark; drag each Example frame narrower
npm run audit:sizes -- --entry <name> --system <id> --schemes light,dark
```

The size audit (the `unending-size-audit` skill, or `/unending:audit-sizes`) loads the entry at every device checkpoint from its minimum width to a 2560px window, as windows and as narrow containers, and must come back clean. Look at its screenshots too: it catches crushed, spilling, overlapping and clipped layout, but not truncation that leaves nothing useful.

`npm run registry:build` regenerates the theme item and the plugin's catalog index, and checks every local design system. Run it and commit its output with the entry. Design systems are built and pushed to their own repos by Ship, never committed here.
