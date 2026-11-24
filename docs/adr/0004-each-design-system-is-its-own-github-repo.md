# 0004. Each design system is its own GitHub repo

Status: Accepted, 2026-11-23. Replaces the registry Worker design from PR #8, which was never deployed.

Each design system is a GitHub repo built as a shadcn GitHub registry. `design-systems/<id>/` in this repo is a clone of it. Ship builds the system into that clone, commits, tags and pushes with the user's own `git` and `gh` login. Pull clones or fast-forwards every repo tagged `unending-design-system` that the user or their orgs own. Stock is this repo's own root `registry.json`.

We first built a Cloudflare Worker and R2 registry, with releases signed by a Secure Enclave key, an allowlist and a `/unending:login`. It was too heavy for what it did. GitHub already provides hosting, access control and versioning. The Secure Enclave key also tied publishing to one Mac, and the dev Mac is a work laptop that will eventually be lost. With GitHub, trust is the user's GitHub account security, which isn't ours to solve.

## Consequences

- No server, accounts, tokens or signing keys of our own. Don't reintroduce them.
- Visibility is the repo's visibility, changed on GitHub. A private system installs for anyone who can read the repo, through their own `gh auth login`.
- `design-systems/` is git-ignored here. This repo is public and some systems are private. Never commit it.
- A new computer recovers everything with `gh auth login` and Pull. Nothing lives only on this machine.
- The catalog is a local-only tool. The dev server listens on 127.0.0.1, because Save, Delete and Ship write to disk and push.
