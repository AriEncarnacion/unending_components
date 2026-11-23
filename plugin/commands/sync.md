---
description: In a project linked to an Unending design system, show what changed in newer versions and pull the changes you approve, keeping the project's own edits
allowed-tools: Read, Edit, Bash(git ls-remote *), Bash(gh repo view *), Bash(npx shadcn@4.23.0 *), Bash(git log *), Bash(git status *), Bash(git diff *), Bash(cat *), Bash(ls *)
---

Pull updates from the Unending design system this project is linked to. The project owns its copies: nothing here is automatic, and nothing is overwritten without the user's yes. This follows shadcn's own update workflow (`--dry-run`, `--diff`, then a smart merge).

1. **Find the link.** Read `unending.json` at the project root: `{ "system": "<owner/repo>", "version": "vN" }`. If it's missing, stop and suggest `/unending:setup`. (A `components.json` with an older `@unending` registry URL also means the project predates versioned systems: offer to re-link with `/unending:setup`.)
2. **Find newer versions.** `git ls-remote --tags https://github.com/<owner/repo>.git 'v*'`. If the newest `vN` is the one in `unending.json`, say it's up to date and stop. Otherwise list the newer versions and use the newest, unless the user picks another. If the repo can't be read, the user may have lost access: say so.
3. **Make sure the tree is clean.** Run `git status`. If there are uncommitted changes, ask the user to commit or stash first, so every pulled change can be reviewed and undone on its own.
4. **List what's installed.** The foundation items are `theme`, `design-rules` and, if present, `lint-colors`. For entries, keep the ones whose files exist in the project (usually `components/<name>.tsx`); `npx shadcn@4.23.0 list <owner/repo>` lists what the system offers.
5. **Preview each item** at the new version: `npx shadcn@4.23.0 add <owner/repo>/<item>#<new> --dry-run` to list the files it would touch, then `--diff <file>` for each file (for the theme, `--diff` the global CSS file). Skip items with no differences. Note any npm dependencies the update would add.
6. **Decide per file.**
   - **Untouched locally:** if `git log --follow --oneline -- <file>` shows only the commit that installed it, the differences are all upstream. Offer to overwrite it.
   - **Edited locally:** read the local file and the upstream diff, and apply the upstream changes while keeping the project's edits (a smart merge). Show the result before writing it.
   - **The theme:** apply only the variables that changed upstream, and keep any the project changed itself.
7. **Summarise and ask.** List each item with what changed and what you propose (overwrite, merge, or skip), plus any new npm packages. Wait for the user's yes on each, or on the whole list. Never use `--overwrite` without that yes.
8. **Apply and report.** Make the approved changes, update `version` in `unending.json`, run the project's typecheck and lint, and report what changed. Don't commit unless asked.
