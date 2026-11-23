---
name: unending-size-audit
description: Audit a component or page at every size from its minimum width to a 2560px window, as a window of each device size and as a narrow container (pane, sidebar, drawer) inside a wide window. Finds crushed, spilling, overlapping and clipped layout, judges what a checker can't, and suggests fixes. Use after adding or changing a catalog entry, before finishing one, when the user asks whether UI holds up when small or large, or via /unending:audit-sizes.
---

# Size audit

Components ship into apps of every size, and into narrow places inside big windows. This audit loads the UI at each device checkpoint, one size at a time in one headless Chrome tab, and runs the same geometry check at each. You then look at the results the way a designer would: confirm what's real, catch what a script can't, and propose fixes.

## Checkpoints

From the minimum width (an entry's `meta.minWidth` in `registry.json`, else 320, WCAG's reflow width) up to:

| Width | Device |
|---|---|
| 320 | Smallest phone |
| 375 | iPhone SE / mini |
| 393 | iPhone 15 / Pixel |
| 430 | iPhone Pro Max |
| 768 | iPad portrait |
| 1024 | iPad landscape / small laptop |
| 1280 | Laptop |
| 1440 | Desktop |
| 1920 | Full HD |
| 2560 | QHD |

Each width is checked in two modes:

- **Window:** a window that size, which exercises window breakpoints and stock overlays.
- **Container:** a container that wide in a 1440px window, as in a pane or sidebar. This is where components that size themselves by the window, rather than by their container, break.

## 1. Run it

The dev server must be running (`npm run dev`, or `npm run up`).

**In the catalog repo**, for an entry:

```bash
npm run audit:sizes -- --entry <name> --system <design system id>
```

- It loads `/<system>/frame/<name>`, which shows the entry's demo alone; `?w=<px>` sets the container width.
- It waits for `<html data-frame-ready="true">`, which the frame sets once the demo is hydrated, its fonts are in and it has painted.
- Use the design system being worked on; the default is `stock`.
- Add `--schemes light,dark` before you call an entry finished.

**In an app**, for any page:

```bash
node <this skill>/scripts/audit-sizes.mjs --url http://127.0.0.1:3000/path [--root "<selector>"]
```

- This checks window sizes only.
- It needs `playwright-core` in the app's devDependencies. Ask before installing it.
- It uses the installed Google Chrome, so there's no browser download.

**Output:**

- One line per check while it runs.
- A summary of every size with problems: kind, element, detail and a `data-slot` path to the element.
- `report.json`.
- One screenshot per check, with problems outlined in dashed red.

## 2. Read the results

The checker reports four kinds of problem:

- **crushed:** text wrapping to a handful of characters per line ("Anyt / hing").
- **spill:** content outside the box it's drawn in, such as a label poking out of its button.
- **overlap:** a control on top of another control or of text, or text on text.
- **clipped:** text cut off by hidden overflow with no ellipsis.

**Open the screenshot for every check with problems.** Also open the minimum width, 768 and 2560 in both modes, even when they're clean.

**The bar is structural, not usability.** At the smallest sizes a dense component is expected to be cramped: chips shrinking to slivers, titles truncating hard, numbers crowding. That's fine. What's never fine at any size is:

- content overlapping other content or controls;
- content overflowing or spilling out of its box;
- layout shifting or jumping, for example between the server render and hydration, or as fonts load;
- anything covering a control.

Report screenshot observations that fall short of those as notes, not problems, and don't propose fixes for them unless asked. The one exception: at the largest sizes, prose lines over about 75 characters and controls stretched far apart are worth a note.

**Known false positives:** check these before reporting.

- An element that's intentionally layered, such as a playhead over a track or a badge on an avatar. Mark it `data-layout-check="ignore"` in the demo if it's deliberate.
- Native control internals: date and time inputs clip their own text without the checker seeing it. Judge those from the screenshot.
- Content inside a nested iframe isn't checked. For a full-page entry whose demo embeds its preview in iframes (Page Navigation), audit the preview directly: `--url <base>/<system>/preview/<name>`.

## 3. Find the cause and suggest the fix

Trace each real problem to code with its `data-slot` path. The usual causes and fixes:

- **Sized by the window, not its container.** `sm:` / `md:` / `lg:` inside a component that can live in a pane.
  - Give the root a named size container, `@container/<name>`, and switch with `@sm/<name>:`, `@md/<name>:` and so on.
  - Exceptions that keep window breakpoints: full-page entries, such as app shells that own the window, and stock overlay internals (`DialogContent sm:max-w-*`).
- **Text with no rule.**
  - Identifiers (names, titles, file names) get `min-w-0 truncate` on their row, with the full text in `title` or a tooltip.
  - Atomic labels (times, counts, badges, button text, Kbd) get `whitespace-nowrap shrink-0`.
  - Prose wraps with `text-pretty` and is never truncated.
- **A label and its control that no longer fit side by side.** Stack them below a container width.
- **A row of actions.**
  - Wrap it, or fold actions into an overflow menu, never overlap.
  - If it measures what fits, read layout sizes (`offsetWidth` / `clientWidth`, which CSS transforms don't change) and the real gap and button sizes.
  - Clip the row so that before measuring, nothing can overlap. See File Toolbar.
- **A fixed grid** (`grid-cols-3`, `grid-cols-[6.5rem_1fr]`) with no narrow layout. Change it by container width.

Propose fixes as concrete diffs. Apply them when you're in an authoring flow or the user asked you to fix things; otherwise report and let the user choose. Fix the base component when the problem is in the component, not in one demo.

## 4. Re-run and report

Re-run after fixing until every check is clean. Report:

- Each size and mode, and its result.
- What you fixed and how.
- What you judged from the screenshots that the checker didn't flag.
- Anything left for a decision.

Keep findings short, specific and tied to a width.
