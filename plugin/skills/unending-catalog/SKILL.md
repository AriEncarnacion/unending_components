---
name: unending-catalog
description: Finds and installs intent-level components from Ari's Unending catalog (a private shadcn registry). Use when building UI such as a toolbar, timeline, chat, navigation, inspector, review flow or agent trace in a project that has a shadcn components.json, or when the user mentions the Unending catalog, @unending, or asks "do we have a component for…". Check the catalog for a matching intent before writing that UI from scratch.
---

# Using the Unending catalog

Ari keeps a private catalog of **intent-level** components: pieces named for what a person is trying to do ("scrub through parallel schedules", "work on a file") rather than what they are ("slider", "toolbar"). Each entry is built from stock shadcn parts, and installs with the shadcn CLI from a private GitHub repo.

The catalog curates several **design systems**. A project is linked to exactly one (`/unending:setup` points the `@unending` namespace at it), and every entry it installs arrives already tuned for that system: plain code, no tuning layer. After install the project owns the code. Later catalog changes come only through `/unending:sync`.

## 1. Match the intent before writing UI

Read `references/catalog.md` (in this skill's folder) for the current entries, their intents and when each fits. Match on what the person is trying to do, not on surface words. For example, "a sidebar for my settings pages" is `page-nav`, and "show what the agent did" is `agent-trace`.

- **Clear match:** install it (step 2), then adapt it with props and composition, not by editing its internals.
- **Partial match:** install the closest entry and extend it. Mention the gap to the user, because it may be worth a catalog update (`/unending:create`).
- **No match:** build with stock shadcn components and follow the `unending-flavor` skill. Tell the user it could become an entry.

The index can lag behind the repo. To see the live list, run `npx shadcn@4.23.0 search @unending`.

## 2. Install

Install through the `@unending` namespace, which points at the project's design system. If `components.json` has no `@unending` registry, run `/unending:setup` first: it asks which design system the project uses.

```bash
npx shadcn@4.23.0 view @unending/<name>   # inspect files and dependencies first
npx shadcn@4.23.0 add @unending/<name>
```

- Don't install with the GitHub address (`AriEncarnacion/unending_components/<name>`) in a linked project: that gives the untuned source, with a small `useEntryTuning` helper, instead of the system's baked version.
- Every entry depends on `@unending/theme`. In a linked project it's normally installed already; if not, preview it with `--dry-run` / `--diff` before it rewrites the project's CSS variables.
- Follow `docs/design-system.md` in the project when building around the entry. It's the linked system's rules.
- Entries install into `components/` (for example `components/timeline-scrubber.tsx`), and their shadcn dependencies install into `components/ui/`.
- Read each entry's `docs` note after installing. Some need a provider, such as `TooltipProvider`, or a parent with an explicit height.

The shadcn MCP server's search, view and add tools work with the `@unending` namespace too.

## 3. Use it well

- Every entry's README in the repo (`registry/unending/<name>/README.md`) explains the anatomy, interactions, states and open questions. Read it before customizing: `gh api repos/AriEncarnacion/unending_components/contents/registry/unending/<name>/README.md -H "Accept: application/vnd.github.raw+json"`.
- Keep the entry's behavior (keyboard, reduced motion, states). The project owns its copy and can change it; if a change would help every project on the system, suggest it for the catalog too.
