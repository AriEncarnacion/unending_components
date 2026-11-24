# 0003. An app links to one system and owns what it installs

Status: Accepted, 2026-11-22.

An app is linked to exactly one design system, recorded in its `unending.json` (`{ "system": "owner/repo", "version": "vN" }`). What `/unending:setup` installs becomes the app's own code, as with any shadcn install. The catalog never reaches back in. Updates are pulled on request with `/unending:sync`, which shows what changed in newer versions and applies only what the app's owner approves.

We considered pushing updates to linked apps and letting an app mix entries from several systems. We rejected both. Apps are often handed to someone else, such as a contractor, and they need code they can read and change without a live dependency. That's shadcn's open-code model. Mixing systems would make "which tokens is this?" unanswerable.

## Consequences

- Local edits in an app are allowed and expected. Sync must show diffs, never overwrite.
- Moving an app to another system means relinking it, not adding a second one.
- An app can fall behind indefinitely, by design. Nothing breaks when the catalog moves.
