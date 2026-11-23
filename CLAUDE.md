@AGENTS.md

# Unending catalog

This repo is Ari's public catalog of intent-level shadcn components, plus its showcase site (Next.js) and its Claude Code/Cowork plugin (`plugin/`). It's a local-only tool: design systems live in their own GitHub repos. Read `README.md` for the layout.

## Invariants

- **Entries are intents.** Each lives in `registry/unending/<name>/` with `<name>.tsx` (installable), `demo.tsx` (variants and states for the showcase), `README.md` (intent and UX notes) and `knobs.ts` (what design systems can tune). Feel values go through one `useEntryTuning("<name>", {...})` call, and the root carries `data-slot="<name>"`. The authoring guide is `plugin/skills/unending-authoring/SKILL.md`. Follow it.
- **Design systems are packages of differences, each in its own GitHub repo.** `design-systems/<id>/` is a clone of that repo: `system.json` (palette, token and theme differences from stock) and `entries/<name>.json` (one entry's tuning; no file means untuned) are its source, and Ship builds the registry next to them. `design-systems/` is git-ignored here, because this repo is public and some systems are private. The tuner writes them through a dev-only Save; don't hand-edit them unless asked, and never commit them. Stock (`app/globals.css`) is the read-only base. An app is linked to exactly one system and owns what it installs.
- **Stock shadcn only, for now.** The flavor is stock base-nova/neutral, plus the `success`, `warning` and `info` status tokens Ari approved, used like `destructive`. Use semantic tokens, never raw colors or palette classes (see `plugin/skills/unending-flavor/SKILL.md`). Anything the stock system can't express goes in the entry README under "Not yet decided" for Ari. Don't invent tokens.
- **`app/globals.css` is the stock token source.** Don't hand-edit the `theme` item in `registry.json`. Run `npm run registry:theme`.
- **Generated files are committed and must stay in sync:** the `theme` item and `plugin/skills/unending-catalog/references/catalog.md`. Run `npm run registry:build` after changing an entry or tokens. `npm run registry:check` verifies them and validates `registry.json`.
- **Stock files are upstream.** `components/ui/*`, `hooks/use-mobile.ts`, `hooks/use-highlighted-code.ts` and `lib/highlighter.tsx` come from `shadcn add`. Don't edit them. Wrap or compose instead.
- **Same-repo registry dependencies** use the full GitHub address (`AriEncarnacion/unending_components/theme`), as the shadcn GitHub-registry docs require.
- **Routes are per system.** `/` is the design systems home; everything else lives under `app/[system]/` (`/<id>/system`, `/<id>/palette`, `/<id>/c/<name>`). Links inside a system use `useDesignSystems().href(path)`. System ids can't be `api`, `preview`, `r` and the other reserved names in `lib/design-systems/schema.ts`.
- **Full-page entries** (app shells, navigation) get a frame under `app/[system]/(frame)/preview/[name]` and are embedded in their demo with an iframe (`/<id>/preview/<name>`), so they don't fight the showcase layout.
- **Ship pushes to the system's own repo with the user's `git` and `gh`.** Ship (`lib/ship/server.ts`) builds the system into its clone (`scripts/build-systems.ts --system <id> --address owner/repo --version N`), commits, tags `vN` and pushes. Tags never move; roll back by shipping an earlier version's files as a new version. Same-repo dependencies in a system's `registry.json` are pinned (`owner/repo/<item>#vN`). There's no server, account or token of our own: access is GitHub repo access.
- **Stock is this repo.** Its root `registry.json` is a shadcn GitHub registry (`AriEncarnacion/unending_components/<item>`) of the untuned entries.

## Commands

- `npm run dev` runs the showcase at http://localhost:3000.
- `npm run typecheck`, `npm run lint` and `npm run build` check the code.
- `npm run registry:build` regenerates the theme item and the plugin catalog index, and validates local design systems. `npm run registry:check` checks they're in sync.

Before finishing any entry change, try each example on `/c/<name>` in light and dark, and at phone width.
