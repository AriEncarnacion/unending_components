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

Open <http://localhost:3000>. The home page lists every design system: open one, duplicate, rename or delete it, or start a new one on the shadcn base. Everything inside a system lives under `/<system-id>/`: the entries (`/<id>`), each entry page (`/<id>/c/<name>`) with live examples, the install command, intent and UX notes and a tuning inspector, `/<id>/system` and `/<id>/palette`.

**Design system** (`/system`) shows every token the catalog is built on, live, and says what uses each one: colour (both schemes, with WCAG contrast), type, spacing, radius, elevation, motion curves and durations, control sizes and breakpoints. A tuner adjusts colours in OKLCH, the radius, the spacing unit, fonts and the default motion. Changes apply across the whole showcase in your browser, and "Export CSS" gives the blocks to paste into `app/globals.css`.

**Design systems.** The catalog curates several design systems; the home page lists them and the URL picks the one every page shows. Stock shadcn is the read-only base. Each system stores only its differences in `design-systems/<id>/`: its palette, token and theme changes in `system.json`, and per-entry tuning in `entries/<name>.json` (scoped tokens, motion and prop defaults from the entry's knobs). Edits are drafts in your browser, one per system; **Save** writes the files on the dev server, and **Ship** puts them on GitHub (below). Each entry page has a tuning inspector for the active system. `npm run registry:build` bakes every system into its own registry (`public/r/<id>/`), so an app linked to one system with `/unending:setup` installs plain components with that system's values written in. After that the app owns them; `/unending:sync` pulls later changes on request.

**Palette** (`/palette`) is for grading the raw colour scales: the jade key colours and 12-step scales, the Verdant green and jet black scales, and your live background, primary and foreground. Edit any step in OKLCH, drag the lightness, chroma and hue curves, build a scale from a key colour, and check contrast (WCAG and APCA), colour-vision and usage. Hide scales you aren't working on, undo with ⌘Z, push a step into a theme token, and export as Tailwind `@theme`, CSS variables or JSON. It also has neutral and status scales (danger, warning, success, info) tuned to sit with the jade palette. **Theme presets** (on `/palette` and in the `/system` tuner) map the scales onto every shadcn colour token in both schemes and walk each scale until text, controls, focus rings and charts meet their contrast targets; recipes live in `lib/theme-presets.ts`. The tuner's Colour section also offers every visible palette step as a one-click value. The palette is kept in your browser; seeds live in `lib/palette.ts`.

## Ship a design system

**Ship** (next to Save in the sidebar) is one action in the catalog and a pull request behind it. It saves the system, builds the registry from it in a clean copy of `main` (so nothing else on your machine is included), pushes `ship/<id>`, and opens a PR (or updates the open one). Two checks run on the PR: **CI** (lint, `registry:check`, build, typecheck) and **Claude review** (`.github/workflows/claude-review.yml`, which fails when it finds a blocking problem). When both pass, the catalog squash-merges the PR and, if you're on `main` with nothing else changed in those files, fast-forwards your local `main`. When either fails, the PR stays open and the Ship panel shows the findings; fix them and Ship again, which updates the same PR. Deleting a shipped system ships its removal the same way.

It needs, once:

- The GitHub repo, with this code on `main`, and `gh auth login` on this machine.
- The Claude review's token: run `/install-github-app` in Claude Code (it installs the Claude GitHub App and adds `CLAUDE_CODE_OAUTH_TOKEN`), or run `claude setup-token` and `gh secret set CLAUDE_CODE_OAUTH_TOKEN` yourself.

The Ship panel lists whatever is still missing. Shipping runs from the dev server only; the job and its log live in `.generated/ship/`.

## Install an entry in another project

This repo is the registry. It's private. Link the project to a design system first with `/unending:setup` (from the plugin below): it points the `@unending` namespace at that system's build and installs its theme, fonts and design rules. Then:

```bash
npx shadcn@latest add @unending/timeline-scrubber
```

The entry arrives tuned for the linked system, as plain code the project owns. `/unending:sync` shows what changed in the catalog later and pulls what you approve. Installing with the GitHub address (`AriEncarnacion/unending_components/<name>`) still works through your `gh` login, and gives the untuned source.

## Claude Code and Cowork plugin

`plugin/` is a plugin, listed by `.claude-plugin/marketplace.json`. It includes:

- **`unending-catalog` skill:** checks the catalog for a matching intent before Claude builds UI, then installs the entry.
- **`unending-flavor` skill and `flavor-reviewer` agent:** keep new UI on the design system and review it against the rules.
- **`unending-authoring` skill and commands:** `/unending:create`, `/unending:capture`, `/unending:harvest` and `/unending:restyle` grow the catalog. `/unending:setup` links a project to a design system, and `/unending:sync` pulls later changes into it.
- **shadcn MCP server:** lets any agent search, view and add entries once a project has the `@unending` namespace.

To install it in Claude Code:

```bash
claude plugin marketplace add AriEncarnacion/unending_components
```

```bash
claude plugin install unending@unending
```

To use it everywhere, including Cowork and chat, add the repo as a marketplace at claude.ai under Customize → Plugins. It syncs to Claude Code too. The repo is private, so it has to be added by its GitHub repo (with the Claude GitHub App given access), not by a raw URL to `marketplace.json`.

## How it fits together

```
app/globals.css ──registry:theme──▶ registry.json "theme" item (Stock)
registry/unending/<name>/          component + demo.tsx + README.md + knobs.ts
design-systems/<id>/               system.json + entries/<name>.json (saved from the tuner)
registry.json ──registry:index────▶ plugin/skills/unending-catalog/references/catalog.md
registry.json + design-systems ──registry:systems──▶ public/r/*.json (Stock), public/r/<id>/*.json (each system, entries baked)
```

```bash
npm run registry:build   # regenerate the theme item, plugin catalog index and public/r (Stock + every system)
npm run registry:check   # fail if any of those are stale or the registry is invalid
```

Stock is shadcn (base-nova style, neutral base color, Base UI), plus three status tokens stock lacks: `success`, `warning` and `info`, used like `destructive` for text, icons and tints. The `theme` item carries them, with their Tailwind mappings, so `text-success` and `bg-warning/10` work in any project that installs an entry. `app/globals.css` is the source of Stock's tokens; every design system is a set of differences on top of it.
