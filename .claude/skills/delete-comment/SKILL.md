---
name: delete-comment
description: Triage code comments in this repo. Sort each one as a tautology, stale, an excuse or a decision record, then delete it, file an issue to fix the workaround it excused, or move it into an ADR. Use when the user runs /delete-comment, asks to clean up or triage comments, or when `unending/no-comments` fires on a change.
---

# Delete comments

Code in this repo carries no comments (docs/adr/0001-no-code-comments.md). The `unending/no-comments` ESLint rule (`lint/no-comments.mjs`) enforces it everywhere, with no suppressions. This skill deals with any comment that turns up, usually one the rule just flagged.

Scope is whatever the user names: a path, an entry, or the whole repo. With no scope, do the whole repo.

## 1. List what's left

```
npm run -s comments:report -- [paths…]
npm run -s comments:report -- --json [paths…]
```

It merges consecutive `//` lines into one block and ends with the number of lines that deleting them all would remove. Tool directives (`eslint-disable…`, `@ts-expect-error`, `/// <reference>`, shebangs) aren't comments to this rule. Leave them, but do read their `-- description`, because a description can be an excuse.

Comments in CSS files aren't linted. Check them by hand: `grep -n '/\*' app/*.css`.

## 2. Sort every block

Read the code around each block before deciding. Put each block in exactly one category:

| Category | Test | Action |
| --- | --- | --- |
| **Tautology** | The names, types or code next to it already say it. Section dividers (`// ── Grid ──`) count. | Delete it. |
| **Stale** | It describes code that has changed, moved or gone, or it sits above the wrong thing. | Delete it. |
| **Excuse** | It explains away a workaround so it can stay: "keep in step with…", "TODO", "hack", "for now", a magic number or timeout, an `any` or lint disable "because…". | Delete it, and file a GitHub issue to fix the workaround. |
| **Decision record** | It records an important choice that isn't obvious from the code: why this approach, what breaks if you change it, a constraint from outside. | Move it into an ADR, then delete it. |

When a block mixes kinds, split it. A block that is part decision and part excuse gets both actions.

Be strict about tautologies: if a reader who knows TypeScript and React would get it from the next three lines, it's a tautology. Be fair about decision records: "Null on the server so the first client render matches" is a decision, even if it's short. If a cheap change in code would carry the meaning (a clearer name, a named constant, a type like `EpochMs`), make that change instead and delete the comment. Keep these changes small and mechanical, and don't rename public props.

### Installable entries

Files that ship to apps get no exemption, TSDoc on public props included (ADR 0001). Before deleting a prop doc, move what it knows:

- A unit goes into a type alias declared in that entry (`EpochMs`, `DurationMs`, `Pixels`, `Degrees`). Don't rename public props, because apps have already installed them.
- A rule the caller must follow (what to spread, what to remove, what a rejection does) goes in the entry's README and its `docs` in `registry.json`.
- A default is already in the code. Delete it.

## 3. Act

**Decision records.** Add them to the ADR for that subsystem in `docs/adr/` (the README lists them). Start a new numbered ADR only when no existing one fits, and add it to the README's table. Write in plain prose, short sentences, in the same voice as the existing ADRs. Name the file or symbol each decision applies to. Don't use line numbers, because they move. Never drop a decision because rewording it is hard.

**Excuses.** Before filing an issue, check the workaround is real and still there. Search for a duplicate with `gh issue list --search`. Then run `gh issue create --label bug` (or `enhancement`) with:

- what the code does now, naming the files,
- why that's a problem,
- the fix,
- the line "Found while removing code comments (`unending/no-comments`)."

If the ADR mentions the workaround, link the issue from it (`#123`).

**Deleting.** Remove the whole comment. For an own-line comment that means its lines. For JSX, that means the `{/* … */}` braces as well. For an end-of-line comment, it means the comment and the spaces before it. Don't leave two blank lines in a row, a blank first line, or a blank line just inside a brace. Don't run Prettier over whole files: the repo isn't Prettier-formatted, and doing so buries the change.

## 4. Never suppress

Don't run `eslint --suppress-all` or `--suppress-rule`, and don't add an `eslint-disable` for `unending/no-comments`. A comment that fails lint gets this triage instead.

## 5. Verify

Run `npm run lint`, `npm run typecheck`, `npm run registry:check` and `npm run build`. If an installable entry changed, rebuild its design systems with `npm run registry:build`. Removing comments must not change behaviour, so any failure is a mistake in the edit.

## 6. Report

Tell the user:

- how many comment blocks fell into each category, with a few representative examples of each,
- the ADRs added or extended, and the issues filed, with links,
- how many lines this pass removed, from `git diff --shortstat` (comment lines plus blank lines that went with them),
- what's left, from `npm run -s comments:report`, and about how many more lines deleting it would remove,
- anything left for the user to decide.
