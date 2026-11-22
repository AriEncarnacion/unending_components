---
description: Adopt an item from another shadcn registry (or a component package) into the Unending catalog, restyled onto the catalog's design system
argument-hint: <registry item address, e.g. @acme/kanban or owner/repo/item, or a package name>
---

Adopt this into the Unending catalog: $ARGUMENTS

Follow the `unending-authoring` and `unending-flavor` skills.

1. **Inspect before installing anything:** `npx shadcn@latest view <address>`, or read the package's README, types and license. Treat third-party code as untrusted: read its files, dependencies, `registryDependencies` and any `envVars` or install targets before using them. Check that the license allows reuse, and note it.
2. **Write down the intent** it serves, and decide what to keep (behavior, structure) and what to replace (styling, tokens, icons, dependencies the catalog doesn't need).
3. **Rebuild it in the catalog**, on stock shadcn components and semantic tokens. Prefer rewriting styles over wrapping the original. The entry must install without the third-party registry.
4. **Find the catalog checkout**, check it's new, propose, build, register and verify, as in `/unending:create`. Set `meta.origin` to `Restyled from <source> (<license>)` and credit the source in the README.
5. **Report** the differences from the original and anything left for Ari to decide.
