# 0005. A version is a tag that never moves

Status: Accepted, 2026-11-23.

Every ship is a new commit on the system repo's `main` and an annotated tag `vN`. N is one past the highest `v*` tag on the remote, read with `git ls-remote --tags`, so ships from two clones can't pick the same number. Tags are never moved or deleted. Rolling back to `vK` ships a commit whose tree equals `vK`'s, tagged as the next version, with the message "Roll back to vK". History only moves forward.

Same-repo dependencies in a system's `registry.json` are pinned: `owner/repo/<item>#vN`. shadcn doesn't pass a ref down to dependencies, so an unpinned dependency would install from `main` and mix versions. Apps install pinned too, and record the version in `unending.json`.

We considered moving tags or rewriting history to roll back. We rejected it because an installed app points at a tag. If that tag changed what it meant, `/unending:sync` diffs and reinstalls would no longer be reproducible.

## Consequences

- `vN` always means the same files, for everyone, forever.
- A bad ship is fixed by a new ship, never by force-pushing or retagging.
- If a push is rejected because the remote moved, the answer is "Pull first", not force.
- The build takes `--address owner/repo --version N`, because the version is written into the files before tagging.
