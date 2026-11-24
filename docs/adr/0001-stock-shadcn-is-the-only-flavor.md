# 0001. Stock shadcn is the only flavor, for now

Status: Accepted, 2026-11-20. Amended 2026-11-21 (status tokens).

Every entry is styled with stock shadcn: base-nova, neutral, Base UI. `app/globals.css` is the stock token source and stays read-only. We considered giving the catalog a house style built from earlier work, and three directions were drawn from the archival MU system and Bearing. None was good enough, so we chose no house style rather than a weak one. Tuning a look is what design systems are for (ADR 0002). The catalog's job is the intent and the behaviour.

The one exception so far is `success`, `warning` and `info`. Entries needed to show status, and stock has only `destructive`. They're single tokens with no `-foreground`, and they're used the way `destructive` is.

## Consequences

- Entries use semantic tokens only. Raw colours and palette classes aren't allowed (`plugin/skills/unending-flavor/SKILL.md`).
- New tokens need Ari's approval. When stock can't express something, it goes under "Not yet decided" in the entry's README. It's never decided silently, and no token is invented to cover it.
- Don't bring MU or Bearing styling back in unless asked.
- Multiple flavors are wanted eventually. "For now" is deliberate, and a new ADR will replace this one when that happens.
