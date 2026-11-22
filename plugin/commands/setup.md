---
description: Link the current project to one Unending design system, so its theme, rules and tuned entries install from that system
allowed-tools: Read, Edit, Write, Bash(gh auth status), Bash(gh api *), Bash(npx shadcn@latest *), Bash(ls *), Bash(cat *), Bash(git status *)
---

Link this project to one of Ari's Unending design systems. A design system is handed off like a contractor's work: after this, the project owns everything it installs, and nothing stays linked except where later updates come from (see `/unending:sync`). Do each step only if it's needed, and say what you changed.

1. **GitHub access.** Run `gh auth status`. The catalog repo is private. If gh isn't logged in, stop and ask the user to run `gh auth login` themselves.
2. **shadcn.** If there's no `components.json`, tell the user, and with their go-ahead run `npx shadcn@latest init --defaults`. If one exists, note its `style`. If it isn't a `base-*` style, warn that catalog entries are built against Base UI.
3. **Pick the design system.** List them with `gh api repos/AriEncarnacion/unending_components/contents/public/r --jq '.[] | select(.type == "dir") | .name'`. Stock shadcn (the files directly in `public/r`) is always available too. Ask the user which one this project uses. If `components.json` already has an `@unending` registry, say which system it points at and ask before changing it: a project uses exactly one system.
4. **Point the namespace at it.** Under `registries` in `components.json`, set:
   ```json
   "@unending": {
     "url": "https://api.github.com/repos/AriEncarnacion/unending_components/contents/public/r/<system>/{name}.json",
     "headers": {
       "Authorization": "Bearer ${GITHUB_TOKEN}",
       "Accept": "application/vnd.github.raw+json"
     }
   }
   ```
   For Stock, drop the `<system>/` segment. It needs a `GITHUB_TOKEN` environment variable that can read the repo. Suggest the user export it in their shell (`export GITHUB_TOKEN=$(gh auth token)`) or put it in a git-ignored `.env.local`. Don't write their token anywhere yourself.
5. **Install the foundation.** Preview first, because the theme rewrites the CSS variables in the project's global stylesheet: `npx shadcn@latest add @unending/theme @unending/design-rules --dry-run`, then `--diff <the global css file>`. If the project already has its own theme, show the user what changes and wait for a yes. Then install. The theme brings the system's fonts with it.
   - If the theme item's `docs` says a font is licensed (for example Graphik), tell the user the app must supply those font files; nothing licensed is shipped.
6. **Point agents at the rules.** `@unending/design-rules` installs `docs/design-system.md`. Add one line to the project's `AGENTS.md` or `CLAUDE.md` (whichever exists; create `AGENTS.md` if neither does): "UI follows the design system in docs/design-system.md."
7. **Offer the colour lint rule.** Ask whether to add `@unending/lint-colors`. If yes, install it and add it to `eslint.config.*` as its `docs` note says.
8. **Check.** Run `npx shadcn@latest search @unending` and show the entries. Finish with the install command for any entry the user mentioned (`npx shadcn@latest add @unending/<name>`). Entries arrive already tuned for the linked system.
