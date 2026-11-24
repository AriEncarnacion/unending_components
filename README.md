# Unending catalog

A local app for building design systems out of **intent-level** shadcn components: pieces named for what someone is trying to do, such as "work through a stack of decisions", rather than the widget they use. Each design system you make ships to its own GitHub repo, and any project can install it with the shadcn CLI.

## Get started

You need Node 22, git and the [GitHub CLI](https://cli.github.com).

```bash
gh auth login
```

```bash
git clone https://github.com/AriEncarnacion/unending_components && cd unending_components
```

```bash
npm install && npm run dev
```

Open <http://localhost:3000>, or run `npm run up` to install, start the server and open it in one step. The dev server only listens on your own machine.

## Make a design system

1. **Start one.** On the home page, choose **New design system**.
2. **Tune it.** Use **Palette** for colour scales and **Design system** for tokens, type, radius and motion. Each entry's page has a tuner for that entry.
3. **Save.** Saves the system to `design-systems/<id>/` on your machine.
4. **Ship.** The first ship asks where the repo goes (your account or an org), its name, and whether it's private or public. Each ship builds the system, tags the next version (`v1`, `v2`, …) and pushes it.
   - **Visibility** is the repo's. Change it on GitHub.
   - **Review first** (optional) has Claude check the change before it ships.
   - **Roll back** ships an earlier version's files as a new version.
5. **Pull** (home page) brings down every design-system repo you or your orgs own. Use it on a new computer.

## Use a design system in a project

Install the Claude Code plugin once:

```bash
claude plugin marketplace add AriEncarnacion/unending_components
```

```bash
claude plugin install unending@unending
```

Then, in a Claude session opened on your project, run `/unending:setup` and pick the system. After that, ask Claude for the UI you need, or install an entry directly:

```bash
npx shadcn@4.23.0 add owner/repo/review-deck#v3
```

Private systems install for anyone who can read the repo, through their own `gh auth login`.

## Plugin commands

| Command | What it does |
| --- | --- |
| `/unending:setup` | Link a project to one design system, and install its theme, fonts and design rules |
| `/unending:sync` | Show what changed in newer versions of the linked system, and pull what you approve |
| `/unending:create <intent>` | Design and build a new entry from what someone is trying to do |
| `/unending:capture <screenshot or URL>` | Rebuild a pattern you spotted as a new entry |
| `/unending:harvest <path>` | Promote a component from one of your apps into the catalog |
| `/unending:restyle <registry item>` | Adopt an item from another shadcn registry, restyled onto the catalog |
| `/unending:audit-sizes <entry or URL>` | Check a component or page at every device size, as windows and narrow containers, and suggest fixes |

The plugin's skills also check the catalog for a matching entry before Claude builds UI from scratch.

## Contribute

- **Entries** live in `registry/unending/<name>/`: the component, a `demo.tsx`, a `README.md` and `knobs.ts`. Follow `plugin/skills/unending-authoring/SKILL.md`, or run `/unending:create` in this repo.
- **Before a PR:**

  ```bash
  npm run registry:build
  ```

  ```bash
  npm run typecheck && npm run lint && npm run registry:check && npm run build
  ```

  Try each example on `/c/<name>` in light and dark, then run the size audit, which checks every device width from the entry's minimum to 2560px:

  ```bash
  npm run audit:sizes -- --entry <name> --system <id> --schemes light,dark
  ```
- **Rules:**
  - Use semantic tokens, never raw colours.
  - Don't edit `components/ui/*`.
  - Never commit `design-systems/`.
  - No code comments. Record decisions in `docs/adr/`. Run `/delete-comment` when the rule flags one.
  
  `CLAUDE.md` has the rest.
- `main` takes changes by PR only, and CI must pass.

MIT licensed.
