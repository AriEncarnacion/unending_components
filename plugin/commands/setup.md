---
description: Link the current project to one Unending design system, so its theme, rules and tuned entries install from that system
allowed-tools: Read, Edit, Write, Bash(node ${CLAUDE_PLUGIN_ROOT}/scripts/unending.mjs:*), Bash(npx shadcn@4.23.0 *), Bash(ls *), Bash(cat package.json), Bash(git status *), Bash(git check-ignore *)
---

Link this project to one of Ari's Unending design systems. A design system is handed off like a contractor's work: after this, the project owns everything it installs, and nothing stays linked except where later updates come from (see `/unending:sync`). Do each step only if it's needed, and say what you changed.

Everything installs from the Unending registry at `https://registry.unending.studio`, and only after the plugin has verified who released it. Never install with a GitHub token, and never send one to the registry.

1. **shadcn.** If there's no `components.json`, tell the user, and with their go-ahead run `npx shadcn@4.23.0 init --defaults`. If one exists, note its `style`. If it isn't a `base-*` style, warn that catalog entries are built against Base UI.
2. **Pick the design system.** Run `node ${CLAUDE_PLUGIN_ROOT}/scripts/unending.mjs systems`. It lists Stock, the public systems, and the private ones this project's token can read. If the user expects a private system that isn't listed, run `/unending:login` first. Ask which one this project uses. If `components.json` already has an `@unending` registry, say which system it points at and ask before changing it: a project uses exactly one system.
3. **Point the namespace at it.** Under `registries` in `components.json`, set:
   ```json
   "@unending": {
     "url": "https://registry.unending.studio/r/<system>/{name}.json",
     "headers": { "Authorization": "Bearer ${UNENDING_REGISTRY_TOKEN}" }
   }
   ```
   For Stock and public systems, leave out `headers`. The token lives in the git-ignored `.env.local`, which the shadcn CLI and its MCP server read. Don't write the token anywhere else. This namespace is for search and the MCP server; installs go through step 4.
4. **Install the foundation, verified.** Run `node ${CLAUDE_PLUGIN_ROOT}/scripts/unending.mjs fetch <system> theme design-rules`. It checks the release's signature against the keys pinned in this plugin and every file's hash, then prints local paths and the npm packages they bring. If it refuses, stop and show the user why; never fall back to installing unverified. Preview first, because the theme rewrites the CSS variables in the global stylesheet: `npx shadcn@4.23.0 add <paths> --dry-run`, then `--diff <the global css file>`. If the project already has its own theme, show the user what changes and wait for a yes. List the npm packages and get a yes for them too. Then run the same `add` without `--dry-run`.
   - If the theme item's `docs` says a font is licensed (for example Graphik), tell the user the app must supply those font files; nothing licensed is shipped.
5. **Point agents at the rules.** `design-rules` installs `docs/design-system.md`. Add one line to the project's `AGENTS.md` or `CLAUDE.md` (whichever exists; create `AGENTS.md` if neither does): "UI follows the design system in docs/design-system.md."
6. **Offer the colour lint rule.** Ask whether to add `lint-colors`. If yes, fetch and install it the same way, and add it to `eslint.config.*` as its `docs` note says.
7. **Check.** Run `npx shadcn@4.23.0 search @unending` and show the entries. To install one later, use `node ${CLAUDE_PLUGIN_ROOT}/scripts/unending.mjs fetch <system> <name>` and then `npx shadcn@4.23.0 add <paths>`, or ask Claude to install it. Entries arrive already tuned for the linked system.
