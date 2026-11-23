# 12. Size audit

- Status: Accepted
- Date: 2026-11-23 (recorded from code comments; the decisions are older)

The audit's usage is in `plugin/skills/unending-size-audit/SKILL.md`. This records why it works the way it does.

## Decisions

### One browser, the one you have

`audit-sizes.mjs` uses `playwright-core` with the installed Google Chrome, so there's no browser download. It checks every device checkpoint from the entry's minimum width to 2560px, one size at a time, in one headless tab. At each size it runs the layout check and saves a screenshot with the problems outlined. Claude reads the report and screenshots and suggests fixes.

### A fresh load per size

Each size is a new page load, so each one tests a first render at that size, not a resize from the last one.

### Wait for the frame to settle

The audit waits for `data-frame-ready="true"` (ADR 0005). Until then the page holds the server HTML, not the hydrated layout.

### The layout check

`layout-check.js` is one bare function expression. The audit evaluates it inside the page under test, so it must stay self-contained (hence its `no-unused-expressions` directive). It reports four kinds of problem:

- **crushed:** text wrapping to a few characters per line ("Anyt / hing").
- **spill:** content poking out of the box it's drawn in.
- **overlap:** a control on top of another control or of text, or text on text.
- **clipped:** text cut off by hidden overflow with no ellipsis.

It skips hidden content: `display: none`, `visibility: hidden`, opacity 0, `aria-hidden` or `inert` (measuring copies), screen-reader-only text, and anything clipped out of view by a scrolling or clipping ancestor. A subtree marked `data-layout-check="ignore"` is skipped on purpose.

Overlap is measured on the boxes an element actually paints, each clipped to what's visible. An inline element that wraps paints one box per line, but its bounding box spans both lines and would falsely "overlap" its neighbours.

Each problem's element gets `data-layout-issue="<kind>"`, so the screenshot taken afterwards can outline it.
