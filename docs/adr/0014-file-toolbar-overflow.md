# 14. File toolbar overflow

- Status: Accepted
- Date: 2026-11-23 (recorded from code comments; the decisions are older)

## Decisions

### Two layers, after Primer's ActionBar and Fluent's overflow manager

- **CSS guarantees nothing overlaps.** Actions sit in a one-row, clipped, wrapping strip, so an action that doesn't fit drops onto a hidden second row. That holds in the server HTML, before measuring, mid-resize and inside a scaled or zooming parent. The strip is padded so focus rings aren't clipped, and the second row starts below the clip.
- **JS picks which actions show,** by priority. It works from layout sizes (`offsetWidth` and `clientWidth`, which transforms don't change) and the measured gap, padding and More button, rather than fixed pixels.

### Measuring

- An off-screen ruler holds a copy of every inline action and of More, and is measured to decide what fits.
- `offsetWidth` rounds to whole pixels, so each width gets 1px added. Otherwise a rounded-down action could be clipped by the strip.
- It re-measures when the set of actions changes, not on every render, because `actions` is often a fresh array. Label and font changes resize the ruler instead.
- A `ResizeObserver` reports the first size right away, before paint. The ruler is observed too, because its actions grow when the web font loads without the slot resizing.

### Priorities in the layout

- The name is the file's identifier. It truncates before anything overlaps.
- There's always room for More, so it never lands on the name.
- The toolbar is a size container. Below 20rem, the primary action shows just its icon; its label stays for screen readers.

### Smaller behaviours

- Renaming selects the name without its extension, as file managers do.
- Disabled actions use `aria-disabled`, so they stay focusable in the toolbar.
- "Saved 2 min ago" uses a minute-resolution clock. It's `null` on the server, so the first client render matches and the relative time fills in after.
