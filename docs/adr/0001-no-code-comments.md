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

### Installable entries too

The rule has no exemption for files that ship to apps, TSDoc on public props included. An installed entry is documented by its prop names and types (units are type aliases such as `EpochMs`, `Pixels` and `Degrees`, declared in each entry so it installs on its own), its README, and its `docs` in `registry.json`, which the shadcn CLI prints after install. A rule the caller must follow, such as Page Nav's `renderLink` spreading every prop, goes in both the README and `docs`.

### No suppressions

ESLint's bulk suppressions grandfathered the comments left after the first pass, as a ratchet. The follow-up removed them all, so there's no `eslint-suppressions.json` and the rule is an error everywhere. Don't add suppressions to get a comment through.

## Consequences

- The `/delete-comment` skill (`.claude/skills/delete-comment/`) repeats this triage on whatever comments are left.
- Comments in CSS files aren't linted. The three that existed have been moved into ADRs 0004 and 0009.
- Excuses found in the first pass: #18, #19, #20, #21, #22, #23, all fixed in the PR that followed.
