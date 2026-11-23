@AGENTS.md

# Unending catalog

This repo is Ari's public catalog of intent-level shadcn components, plus its showcase site (Next.js), its Claude Code/Cowork plugin (`plugin/`) and the registry Worker that serves every design system (`worker/`). Read `README.md` for the layout.

## Invariants

- **Entries are intents.** Each lives in `registry/unending/<name>/` with `<name>.tsx` (installable), `demo.tsx` (variants and states for the showcase), `README.md` (intent and UX notes) and `knobs.ts` (what design systems can tune). Feel values go through one `useEntryTuning("<name>", {...})` call, and the root carries `data-slot="<name>"`. The authoring guide is `plugin/skills/unending-authoring/SKILL.md`. Follow it.
- **Design systems are packages of differences, and never enter this repo.** Each lives in `design-systems/<id>/` on Ari's Mac: `system.json` (palette, token and theme differences from stock) and `entries/<name>.json` (one entry's tuning; no file means untuned). `design-systems/` and `public/r/*/` are git-ignored, because the repo is public and some systems are private. The tuner writes them through a dev-only Save; don't hand-edit them unless asked, and never commit them. Stock (`app/globals.css`) is the read-only base. An app is linked to exactly one system and owns what it installs.
- **Stock shadcn only, for now.** The flavor is stock base-nova/neutral, plus the `success`, `warning` and `info` status tokens Ari approved, used like `destructive`. Use semantic tokens, never raw colors or palette classes (see `plugin/skills/unending-flavor/SKILL.md`). Anything the stock system can't express goes in the entry README under "Not yet decided" for Ari. Don't invent tokens.
- **`app/globals.css` is the stock token source.** Don't hand-edit the `theme` item in `registry.json`. Run `npm run registry:theme`.
- **Generated files are committed and must stay in sync:** the `theme` item, `plugin/skills/unending-catalog/references/catalog.md` and `public/r/*.json` (Stock). Run `npm run registry:build` after changing an entry or tokens. `npm run registry:check` verifies them, and also runs the registry Worker's upload checks on Stock.
- **Stock files are upstream.** `components/ui/*`, `hooks/use-mobile.ts`, `hooks/use-highlighted-code.ts` and `lib/highlighter.tsx` come from `shadcn add`. Don't edit them. Wrap or compose instead.
- **Same-repo registry dependencies** use the full GitHub address (`AriEncarnacion/unending_components/theme`), as the shadcn GitHub-registry docs require.
- **Routes are per system.** `/` is the design systems home; everything else lives under `app/[system]/` (`/<id>/system`, `/<id>/palette`, `/<id>/c/<name>`). Links inside a system use `useDesignSystems().href(path)`. System ids can't be `api`, `preview`, `r` and the other reserved names in `lib/design-systems/schema.ts`.
- **Full-page entries** (app shells, navigation) get a frame under `app/[system]/(frame)/preview/[name]` and are embedded in their demo with an iframe (`/<id>/preview/<name>`), so they don't fight the showcase layout.
- **Ship goes straight to the registry, never through GitHub.** Ship (`lib/ship/server.ts`) builds a system, checks it with the Worker's own rules (`worker/src/shared/validate.ts`), signs the release and the upload with the Mac's Secure Enclave key (`signer/`, Touch ID per ship) and uploads it. Stock is published by `.github/workflows/publish-stock.yml` with GitHub OIDC. Never add a route, workflow or script that writes to the registry another way, or that sends a GitHub token to it.
- **The registry Worker is security-critical.** `worker/` has its own package, types and tests (`cd worker && npm test`). Versions are create-only, admin requests are signed, private reads need an org member's token, and nothing logs headers or bodies. Keep its tests passing, and add a test for any rule you change. `worker/README.md` has the deploy and recovery steps.
- **Releases are verified by consumers.** `plugin/scripts/unending.mjs` checks each release against `plugin/keys.json` before installing. Only Ship's Set up this Mac adds keys there; changing that file changes who apps trust.

## Commands

- `npm run dev` runs the showcase at http://localhost:3000.
- `npm run typecheck`, `npm run lint` and `npm run build` check the code.
- `npm run registry:build` regenerates the theme item, the plugin catalog index and `public/r` (Stock), and validates local design systems. `npm run registry:check` checks they're in sync.
- `cd worker && npm test` runs the registry Worker's tests; `node --test plugin/scripts/unending.test.mjs` runs the plugin's release verification tests.

Before finishing any entry change, try each example on `/c/<name>` in light and dark, and at phone width.
