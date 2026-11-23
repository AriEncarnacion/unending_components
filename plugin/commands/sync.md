---
description: In a project linked to an Unending design system, show what changed upstream and pull the changes you approve, keeping the project's own edits
allowed-tools: Read, Edit, Bash(node ${CLAUDE_PLUGIN_ROOT}/scripts/unending.mjs:*), Bash(npx shadcn@4.23.0 *), Bash(git log *), Bash(git status *), Bash(git diff *), Bash(cat *), Bash(ls *)
---

Pull updates from the Unending design system this project is linked to. The project owns its copies: nothing here is automatic, and nothing is overwritten without the user's yes. This follows shadcn's own update workflow (`--dry-run`, `--diff`, then a smart merge), on files the plugin has verified first.

1. **Find the link.** Read the `@unending` registry URL in `components.json`. The segment after `/r/` names the design system. If there's no `@unending` registry, stop and suggest `/unending:setup`. If the URL points at `api.github.com`, the project predates the registry: offer to re-link it with `/unending:setup`.
2. **Make sure the tree is clean.** Run `git status`. If there are uncommitted changes, ask the user to commit or stash first, so every pulled change can be reviewed and undone on its own.
3. **List what's installed.** The foundation items are `theme`, `design-rules` and, if present, `lint-colors`. For entries, run `npx shadcn@4.23.0 search @unending` and keep the ones whose files exist in the project (usually `components/<name>.tsx`).
4. **Fetch and verify.** Run `node ${CLAUDE_PLUGIN_ROOT}/scripts/unending.mjs fetch <system> <every installed item>`. It verifies the release's signature and every file's hash, and prints local paths, the version and the npm packages. If it refuses anything, stop and show the user why; never fall back to installing unverified. A 401 or 403 means the token expired or the user left the org: suggest `/unending:login`.
5. **Preview each item.** For each local path, run `npx shadcn@4.23.0 add <path> --dry-run` to list the files it would touch, then `--diff <file>` for each file (for the theme, `--diff` the global CSS file). Skip items with no differences.
6. **Decide per file.**
   - **Untouched locally:** if `git log --follow --oneline -- <file>` shows only the commit that installed it, the differences are all upstream. Offer to overwrite it.
   - **Edited locally:** read the local file and the upstream diff, and apply the upstream changes while keeping the project's edits (a smart merge). Show the result before writing it.
   - **The theme:** apply only the variables that changed upstream, and keep any the project changed itself.
7. **New packages.** Compare the printed npm packages with `package.json`. List every package the update would add and ask before installing any of them.
8. **Summarise and ask.** List each item with what changed upstream and what you propose (overwrite, merge, or skip), and the release it came from (the version and who signed it). Wait for the user's yes on each, or on the whole list. Never use `--overwrite` without that yes.
9. **Apply and report.** Make the approved changes, run the project's typecheck and lint, and report what changed. Don't commit unless asked.
