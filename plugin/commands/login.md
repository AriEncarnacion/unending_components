---
description: Get a read-only token for the Unending registry's private design systems, as a member of the GitHub org that owns them
argument-hint: <github-org>
allowed-tools: Bash(node ${CLAUDE_PLUGIN_ROOT}/scripts/unending.mjs:*), Bash(git check-ignore *), Read
---

Get this project a registry token for the private design systems of one GitHub org. Public systems and Stock need no token.

1. **The org.** Use `$ARGUMENTS` if it names one. Otherwise ask which GitHub org's design systems this project uses.
2. **Run the login.** Run `node ${CLAUDE_PLUGIN_ROOT}/scripts/unending.mjs login --org <org>` from the project root. It prints a github.com address and a code. Show both to the user and ask them to approve the "Unending registry" app there. It asks for `read:org` only, which lets the registry check they're an active member. It can't read or change any repo. The command waits until they approve.
3. **Report.** The script saves the token in the project's `.env.local` as `UNENDING_REGISTRY_TOKEN` and never prints it. Never read, print or copy that value yourself. If it warns that git doesn't ignore `.env.local`, offer to add it to `.gitignore`.
4. **Explain the limits.** The token only reads that org's design systems, expires after 30 days, and stops working within a day of the user leaving the org. Run `/unending:login` again when it expires.
