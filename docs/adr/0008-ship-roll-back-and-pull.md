# 8. Ship, roll back and pull

- Status: Accepted
- Date: 2026-11-23 (recorded from code comments; the decisions are older)

## Context

Each design system is its own GitHub repo, cloned at `design-systems/<id>/` (CLAUDE.md). `system.json` and `entries/` are its source. Ship builds a shadcn GitHub registry next to them: `registry.json` plus baked files. `lib/ship/server.ts` runs it, and only on the dev server. Jobs live in memory and in `.generated/ship/jobs.json`.

## Decisions

### Three actions

- **Ship:** build, optionally review with Claude, commit, tag `vN`, push.
- **Roll back:** ship a new version `vN+1` whose files equal an earlier `vK`. Tags never move, so apps pinned to any version keep it.
- **Pull:** find every repo with the `unending-design-system` topic that you or your orgs own, clone the ones missing here and fast-forward the rest. A system with changes that haven't shipped is left alone.

Ship puts that topic on every system repo so Pull can find them.

### Baking

`scripts/build-systems.ts` bakes each entry: its `useEntryTuning(...)` call becomes a plain object with the system's values, and the import is removed. An app receives an ordinary component with no tuning layer. Same-repo dependencies are pinned to `owner/repo/<item>#v<n>`, so a version only pulls its own items. With no flags, the script just checks the entries' knobs and every local design system.

### Your own login, nothing else

Everything runs through your `git` and `gh` login. `git` is authenticated through `gh` for each command only, so your global git config is untouched. A repo's visibility is the system's visibility; change it on GitHub.

### Safe steps

- Before shipping, fetch the remote and refuse to go on if it has commits this clone doesn't.
- Rebuild at the latest version first. If nothing changes, there's nothing to ship.
- Push the branch and tag atomically. If the push fails, delete the local tag and undo the local commit, leaving nothing half-made, so the next ship can start clean.

### The Claude review is a bare session

The optional review runs `claude` locally with your Claude login, with no tools, MCP servers, skills, settings or project files. A review costs cents, and the diff can't make it do anything.

### Status

- `shipped`: the latest tag has what's saved here.
- `changed`: saved here since the latest tag.
- `behind`: unchanged here, but the catalog's entries changed since it shipped.
- `unshipped`: no repo yet.

Preflight (your GitHub login, your orgs, whether `claude` is on the PATH) is cached for 30 seconds, because checking spawns processes. A repo's visibility and URL are cached for five minutes.

### Reload after rollback or pull

A rollback or pull rewrites the saved files on disk. The showcase reloads the page afterwards so every page reads the new files.
