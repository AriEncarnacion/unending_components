# 1. No code comments

- Status: Accepted
- Date: 2026-11-23

## Context

The codebase had about 600 comments. Most fell into one of four kinds:

- **Tautology:** says again what the code already says.
- **Stale:** describes code that has since changed or moved.
- **Excuse:** explains away a workaround ("keep in step with…", "one-time restore…") so it never gets fixed, and the next change copies it.
- **Decision record:** explains an important choice that isn't obvious from the code.

Only the last kind is worth keeping, and a comment is a poor place for it. Comments drift from the code, they're scattered across files, and an agent reading one file never sees the reasoning behind its neighbours.

## Decision

- Code has no comments. The `unending/no-comments` ESLint rule (`lint/no-comments.mjs`) enforces it for every JS and TS file that ESLint lints.
- Tool directives are allowed, because they're instructions to a tool and not prose. That covers `eslint-disable…`, `@ts-expect-error` and similar, `/// <reference>`, `#__PURE__`, bundler hints and shebangs. Put the reason in the directive's `-- description`.
- Important decisions go in an ADR in `docs/adr/`, grouped by subsystem. Add to the relevant ADR rather than starting a new one for each small choice.
- An excuse becomes a GitHub issue to fix the workaround, not a comment.
- Anything else is said in code: a clearer name, a type (`EpochMs`, not `number // ms`), a named constant or a test.

### Ratchet

Existing comments are grandfathered in `eslint-suppressions.json`, using ESLint's bulk suppressions. The counts work as a ratchet in both directions:

- A file can't gain comments. Going over its count is a lint error.
- When a file loses comments, `npm run lint` fails until `npm run lint:prune` lowers its count in the suppressions file. The count can't creep back up later.

New files start at zero.

### Comments that are still grandfathered

Most of the remaining comments are TSDoc on the public props of installable entries (`registry/unending/*/<name>.tsx` and `lib/tuning.ts`), plus the header of `scripts/templates/unending-colors.mjs`. These ship to apps, where they're the only documentation a person sees in their editor. Where that documentation should live once the comments go is still open (see "Not yet decided").

## Consequences

- The `/delete-comment` skill (`.claude/skills/delete-comment/`) repeats this triage on whatever comments are left.
- Comments in CSS files aren't linted. The three that existed have been moved into ADRs 0004 and 0009.
- Excuses found in the first pass: #18, #19, #20, #21, #22, #23.

## Not yet decided

- Whether public prop documentation on installable entries moves into each entry's README (its "Props" section), into clearer prop names and types, or stays as TSDoc and is exempted from the rule for `registry/unending/*/<name>.tsx`.
