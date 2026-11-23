---
name: unending-catalog
description: Finds and installs intent-level components from Ari's Unending catalog (a private shadcn registry). Use when building UI such as a toolbar, timeline, chat, navigation, inspector, review flow or agent trace in a project that has a shadcn components.json, or when the user mentions the Unending catalog, @unending, or asks "do we have a component for…". Check the catalog for a matching intent before writing that UI from scratch.
---

# Using the Unending catalog

Ari keeps a private catalog of **intent-level** components: pieces named for what a person is trying to do ("scrub through parallel schedules", "work on a file") rather than what they are ("slider", "toolbar"). Each entry is built from stock shadcn parts, and installs with the shadcn CLI from a design system's GitHub repo.

The catalog curates several **design systems**. Each one is its own GitHub repo, built as a shadcn registry and tagged by version. A project is linked to exactly one (`/unending:setup` records it in `unending.json` as `{ "system": "owner/repo", "version": "vN" }`), and every entry it installs arrives already tuned for that system: plain code, no tuning layer. After install the project owns the code. Later catalog changes come only through `/unending:sync`.

## 1. Match the intent before writing UI

Read `references/catalog.md` (in this skill's folder) for the current entries, their intents and when each fits. Match on what the person is trying to do, not on surface words. For example, "a sidebar for my settings pages" is `page-nav`, and "show what the agent did" is `agent-trace`.

- **Clear match:** install it (step 2), then adapt it with props and composition, not by editing its internals.
- **Partial match:** install the closest entry and extend it. Mention the gap to the user, because it may be worth a catalog update (`/unending:create`).
- **No match:** build with stock shadcn components and follow the `unending-flavor` skill. Tell the user it could become an entry.

The index can lag behind. To see what the linked system offers, run `npx shadcn@4.23.0 list <owner/repo>`.

## 2. Install

Install from the project's design system, at the version in `unending.json`. If there's no `unending.json`, run `/unending:setup` first: it asks which design system the project uses. Private systems install through the user's own `gh auth login`.

```bash
npx shadcn@4.23.0 view <owner/repo>/<name>#<version>   # inspect files and dependencies first
npx shadcn@4.23.0 add <owner/repo>/<name>#<version>
```

- Always pin the version from `unending.json`. Without `#<version>`, shadcn installs whatever is on the repo's main branch.
- Mention any npm packages the entry brings that the project doesn't have yet.
- Every entry depends on `theme`. In a linked project it's normally installed already; if not, preview with `--dry-run` / `--diff` before it rewrites the project's CSS variables.
- Follow `docs/design-system.md` in the project when building around the entry. It's the linked system's rules.
- Entries install into `components/` (for example `components/timeline-scrubber.tsx`), and their shadcn dependencies install into `components/ui/`.
- Read each entry's `docs` note after installing. Some need a provider, such as `TooltipProvider`, or a parent with an explicit height.

The shadcn MCP server's search, view and add tools take the same `owner/repo/<name>#<version>` addresses.

## 3. Use it well

- Every entry's README in the repo (`registry/unending/<name>/README.md`) explains the anatomy, interactions, states and open questions. Read it before customizing: `https://github.com/AriEncarnacion/unending_components/blob/main/registry/unending/<name>/README.md`.
- Keep the entry's behavior (keyboard, reduced motion, states). The project owns its copy and can change it; if a change would help every project on the system, suggest it for the catalog too.
