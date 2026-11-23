# Unending components

A personal catalog of **intent-level** UI. Entries are named for what someone is trying to do, such as scrubbing through parallel schedules or working through a stack of decisions, rather than for the widget they use. Every entry is built from stock [shadcn/ui](https://ui.shadcn.com) parts on one shared theme. Each one installs into any shadcn project with one command, and Claude Code can find it by intent.

| Entry | Intent |
| --- | --- |
| `timeline-scrubber` | See who or what occupies parallel lanes around a moment, and move that moment through time. |
| `agent-chat` | Read an AI agent's answer as it streams, with full formatting, and reply. |
| `review-deck` | Work through a stack of yes-or-no decisions quickly, with a way to put one off for later. |
| `page-nav` | Move between the pages of an app and always know where you are. |
| `inspector-panel` | Inspect and edit whatever is selected, without leaving where you selected it. |
| `file-toolbar` | Work on a file: see and change its name and state, and reach its actions at any width. |
| `agent-trace` | Watch what an agent is doing, step by step, and check any step closely. |

## Browse

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. The dev server listens on 127.0.0.1 only, so nothing else on your network can reach its Save and Ship routes. The home page lists every design system: open one, duplicate, rename or delete it, or start a new one on the shadcn base. Everything inside a system lives under `/<system-id>/`: the entries (`/<id>`), each entry page (`/<id>/c/<name>`) with live examples, the install command, intent and UX notes and a tuning inspector, `/<id>/system` and `/<id>/palette`.

**Design system** (`/system`) shows every token the catalog is built on, live, and says what uses each one: colour (both schemes, with WCAG contrast), type, spacing, radius, elevation, motion curves and durations, control sizes and breakpoints. A tuner adjusts colours in OKLCH, the radius, the spacing unit, fonts and the default motion. Changes apply across the whole showcase in your browser, and "Export CSS" gives the blocks to paste into `app/globals.css`.

**Design systems.** The catalog curates several design systems; the home page lists them and the URL picks the one every page shows. Stock shadcn is the read-only base. Each system stores only its differences in `design-systems/<id>/`: its palette, token and theme changes in `system.json`, and per-entry tuning in `entries/<name>.json` (scoped tokens, motion and prop defaults from the entry's knobs). Edits are drafts in your browser, one per system; **Save** writes the files on the dev server, and **Ship** puts them on the registry (below). `design-systems/` is git-ignored: systems never enter this public repo. Each entry page has a tuning inspector for the active system. Ship bakes a system into its own registry, so an app linked to it with `/unending:setup` installs plain components with that system's values written in. After that the app owns them; `/unending:sync` pulls later changes on request.

**Palette** (`/palette`) is for grading the raw colour scales: the jade key colours and 12-step scales, the verdant green and jet black scales, and your live background, primary and foreground. Edit any step in OKLCH, drag the lightness, chroma and hue curves, build a scale from a key colour, and check contrast (WCAG and APCA), colour-vision and usage. Hide scales you aren't working on, undo with ⌘Z, push a step into a theme token, and export as Tailwind `@theme`, CSS variables or JSON. It also has neutral and status scales (danger, warning, success, info) tuned to sit with the jade palette. **Theme presets** (on `/palette` and in the `/system` tuner) map the scales onto every shadcn colour token in both schemes and walk each scale until text, controls, focus rings and charts meet their contrast targets; recipes live in `lib/theme-presets.ts`. The tuner's Colour section also offers every visible palette step as a one-click value. The palette is kept in your browser; seeds live in `lib/palette.ts`.

## Ship a design system

**Ship** (next to Save in the sidebar) builds the system's registry from your saved files, checks it with the registry's own upload rules, signs it and uploads it straight to the registry at `https://registry.unending.studio`. There's no branch, PR or Actions run, so nothing about a system ever appears in this public repo or its logs.

- **Signed on your Mac.** Each ship is signed by a key in this Mac's Secure Enclave, and macOS asks for Touch ID every time. The registry only accepts keys you enrolled. Set this up once per Mac with **Ship → Set up this Mac**; see `worker/README.md`.
- **Versions never change.** The registry numbers versions in order and writes each one once. Ship can also serve an earlier version (roll back) without rebuilding anything.
- **Private by default.** A system's first ship names the GitHub org whose active members may read it. Public systems come with the visibility controls, later.
- **New npm packages need your OK.** The registry keeps an allowlist. When a ship would install a package it hasn't seen, Ship lists them and asks before allowing them.
- **Review first** (optional) runs a local Claude review of what changed since the last ship, and stops the ship if it finds something to fix.
- **Pull** (on the home page) fetches every system's current version from the registry, checks its signature, and saves it here. Use it on a new Mac.

Every ship emails you. The registry Worker, its deploy steps and recovery when a Mac goes away are in [`worker/`](worker/README.md).

## Install an entry in another project

Use the plugin (below). In a Claude session opened on the project:

1. `/unending:login <org>` once, for an org's private system. It gets a read-only token, saved in the project's git-ignored `.env.local`.
2. `/unending:setup` links the project to one design system and installs its theme, fonts and design rules.
3. Ask for the UI you need, or for an entry by name.

The plugin checks each release's signature against the keys pinned in `plugin/keys.json`, and every file's hash, before anything installs. Stock is checked against this repo's `main` instead. Plain `npx shadcn add @unending/<name>` also works once a project is linked, but skips those checks, so prefer the plugin. Installing with the GitHub address (`AriEncarnacion/unending_components/<name>`) gives the untuned source.

## Claude Code and Cowork plugin

`plugin/` is a plugin, listed by `.claude-plugin/marketplace.json`. It includes:

- **`unending-catalog` skill:** checks the catalog for a matching intent before Claude builds UI, then installs the entry.
- **`unending-flavor` skill and `flavor-reviewer` agent:** keep new UI on the design system and review it against the rules.
- **`unending-authoring` skill and commands:** `/unending:create`, `/unending:capture`, `/unending:harvest` and `/unending:restyle` grow the catalog. `/unending:login` gets a read-only token for an org's private systems, `/unending:setup` links a project to a design system, and `/unending:sync` pulls later changes into it.
- **shadcn MCP server:** lets any agent search, view and add entries once a project has the `@unending` namespace.

To install it in Claude Code:

```bash
claude plugin marketplace add AriEncarnacion/unending_components
```

```bash
claude plugin install unending@unending
```

To use it everywhere, including Cowork and chat, add the repo as a marketplace at claude.ai under Customize → Plugins. It syncs to Claude Code too.

## How it fits together

```
app/globals.css ──registry:theme──▶ registry.json "theme" item (Stock)
registry/unending/<name>/          component + demo.tsx + README.md + knobs.ts
design-systems/<id>/               system.json + entries/<name>.json (saved from the tuner; git-ignored)
registry.json ──registry:index────▶ plugin/skills/unending-catalog/references/catalog.md
registry.json ──registry:systems──▶ public/r/*.json (Stock) ──publish-stock.yml──▶ registry /r/stock/
design-systems/<id> ──Ship (signed)──▶ registry /r/<id>/ (each system, entries baked)
```

```bash
npm run registry:build   # regenerate the theme item, plugin catalog index and public/r (Stock); check local systems
npm run registry:check   # fail if any of those are stale or the registry is invalid
```

Stock is shadcn (base-nova style, neutral base color, Base UI), plus three status tokens stock lacks: `success`, `warning` and `info`, used like `destructive` for text, icons and tints. The `theme` item carries them, with their Tailwind mappings, so `text-success` and `bg-warning/10` work in any project that installs an entry. `app/globals.css` is the source of Stock's tokens; every design system is a set of differences on top of it.
