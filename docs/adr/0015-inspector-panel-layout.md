# 15. Inspector panel layout

- Status: Accepted
- Date: 2026-11-23 (recorded from code comments; the decisions are older)

## Decisions

### Sharing height between sections

Each grid row is sized between its minimum and its content:

- Content outside sections keeps its full height.
- A section's minimum is its header.
- The rest of the height is split evenly. A section never takes more than its content, and whatever it doesn't need goes to the others.
- Open sections then scroll on their own, so nothing outside them moves.
- The body itself scrolls only if even the headers and the content outside sections don't fit.

### A scrollbar gutter of its own

Each section's scroller has its scrollbar in its own gutter: 6px in from the panel's edge, 10px wide, then the same 16px of space before the content as on the left. Every section reserves the gutter whether it scrolls or not, so rows line up across sections.

### Narrow panels

The panel is a size container. When the panel itself is narrower than 24rem, a row's label sits above its control, so neither the control nor its hint is squeezed. A badge wraps below as a whole rather than splitting the label.
