---
description: Link the current project to one Unending design system (a GitHub repo), so its theme, rules and tuned entries install from it, pinned to a version
allowed-tools: Read, Edit, Write, Bash(gh auth status), Bash(gh repo view *), Bash(gh repo list *), Bash(gh api user/orgs *), Bash(gh api user *), Bash(git ls-remote *), Bash(npx shadcn@4.23.0 *), Bash(ls *), Bash(cat *), Bash(git status *)
---

Link this project to one Unending design system. Each design system is its own GitHub repo, built as a shadcn registry and tagged `v1`, `v2` and so on. After this, the project owns everything it installs, and nothing stays linked except where later updates come from (see `/unending:sync`). Do each step only if it's needed, and say what you changed.

1. **GitHub access.** Run `gh auth status`. If gh isn't logged in, ask the user to run `gh auth login` themselves. Private design systems install through that login; never ask for a token or write one anywhere.
2. **shadcn.** If there's no `components.json`, tell the user, and with their go-ahead run `npx shadcn@4.23.0 init --defaults`. If one exists, note its `style`. If it isn't a `base-*` style, warn that catalog entries are built against Base UI.
3. **Pick the design system.** If the user named a repo (`owner/repo`), use it. Otherwise list the ones they can see: `gh repo list <owner> --topic unending-design-system --json nameWithOwner,visibility,description` for their login (`gh api user --jq .login`) and each org (`gh api user/orgs --jq '.[].login'`). Ask which one this project uses. If `unending.json` already exists, say which system it links and ask before changing it: a project uses exactly one system.
4. **Check access and find the version.** Run `gh repo view <owner/repo> --json name,visibility`; if it fails, the user can't read the repo, so stop and say who to ask. Find the newest version with `git ls-remote --tags https://github.com/<owner/repo>.git 'v*'` (take the highest `vN`).
5. **Install the foundation, pinned.** Preview first, because the theme rewrites the CSS variables in the global stylesheet: `npx shadcn@4.23.0 add <owner/repo>/theme#vN <owner/repo>/design-rules#vN --dry-run`, then `--diff <the global css file>`. If the project already has its own theme, show the user what changes and wait for a yes. Then install. The theme brings the system's fonts with it.
   - If the theme item's `docs` says a font is licensed (for example Graphik), tell the user the app must supply those font files; nothing licensed is shipped.
6. **Record the link.** Write `unending.json` at the project root: `{ "system": "<owner/repo>", "version": "vN" }`. Commit it with the installed files when the user commits.
7. **Point agents at the rules.** `design-rules` installs `docs/design-system.md`. Add one line to the project's `AGENTS.md` or `CLAUDE.md` (whichever exists; create `AGENTS.md` if neither does): "UI follows the design system in docs/design-system.md."
8. **Offer the colour lint rule.** Ask whether to add `<owner/repo>/lint-colors#vN`. If yes, install it and add it to `eslint.config.*` as its `docs` note says.
9. **Finish** with how to install an entry: `npx shadcn@4.23.0 add <owner/repo>/<name>#vN`, or just ask Claude for the UI. Entries arrive already tuned for the system.
