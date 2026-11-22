@AGENTS.md

# Unending catalog

This repo is Ari's private shadcn registry of intent-level components, plus its showcase site (Next.js) and its Claude Code/Cowork plugin (`plugin/`). Read `README.md` for the layout.

## Invariants

- **Entries are intents.** Each lives in `registry/unending/<name>/` with `<name>.tsx` (installable), `demo.tsx` (variants and states for the showcase), `README.md` (intent and UX notes) and `knobs.ts` (what design systems can tune). Feel values go through one `useEntryTuning("<name>", {...})` call, and the root carries `data-slot="<name>"`. The authoring guide is `plugin/skills/unending-authoring/SKILL.md`. Follow it.
- **Design systems are packages of differences.** Each lives in `design-systems/<id>/`: `system.json` (palette, token and theme differences from stock) and `entries/<name>.json` (one entry's tuning; no file means untuned). The tuner writes them through a dev-only Save; don't hand-edit them unless asked. Stock (`app/globals.css`) is the read-only base. An app is linked to exactly one system and owns what it installs.
- **Stock shadcn only, for now.** The flavor is stock base-nova/neutral, plus the `success`, `warning` and `info` status tokens Ari approved, used like `destructive`. Use semantic tokens, never raw colors or palette classes (see `plugin/skills/unending-flavor/SKILL.md`). Anything the stock system can't express goes in the entry README under "Not yet decided" for Ari. Don't invent tokens.
- **`app/globals.css` is the stock token source.** Don't hand-edit the `theme` item in `registry.json`. Run `npm run registry:theme`.
- **Generated files are committed and must stay in sync:** the `theme` item, `plugin/skills/unending-catalog/references/catalog.md`, `public/r/*.json` (Stock) and `public/r/<id>/*.json` (each design system, entries baked). Run `npm run registry:build` after changing an entry, tokens or a design system. `npm run registry:check` verifies them.
- **Stock files are upstream.** `components/ui/*`, `hooks/use-mobile.ts`, `hooks/use-highlighted-code.ts` and `lib/highlighter.tsx` come from `shadcn add`. Don't edit them. Wrap or compose instead.
- **Same-repo registry dependencies** use the full GitHub address (`AriEncarnacion/unending_components/theme`), as the shadcn GitHub-registry docs require.
- **Routes are per system.** `/` is the design systems home; everything else lives under `app/[system]/` (`/<id>/system`, `/<id>/palette`, `/<id>/c/<name>`). Links inside a system use `useDesignSystems().href(path)`. System ids can't be `api`, `preview`, `r` and the other reserved names in `lib/design-systems/schema.ts`.
- **Full-page entries** (app shells, navigation) get a frame under `app/[system]/(frame)/preview/[name]` and are embedded in their demo with an iframe (`/<id>/preview/<name>`), so they don't fight the showcase layout.
- **Ship, don't hand-commit design systems.** Ship (`lib/ship/server.ts`) opens a PR from a clean worktree, waits for CI and the Claude review, and merges. Keep `.github/workflows/ci.yml` and `claude-review.yml` passing; Ship depends on them.

## Commands

- `npm run dev` runs the showcase at http://localhost:3000.
- `npm run typecheck`, `npm run lint` and `npm run build` check the code.
- `npm run registry:build` regenerates the theme item, the plugin catalog index and `public/r` (Stock plus every design system). `npm run registry:check` validates them, including the design systems' references and knobs.

Before finishing any entry change, try each example on `/c/<name>` in light and dark, and at phone width.
