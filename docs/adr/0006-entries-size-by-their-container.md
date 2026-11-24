# 0006. Entries size by their container, not the window

Status: Accepted, 2026-11-23.

Entries lay themselves out by their own width, using named `@container` queries, not viewport breakpoints. An entry can land in a pane, sidebar or drawer of a wide window. Window breakpoints only handle a narrow window, so they miss a narrow space inside a wide one.

Full-page entries, such as app shells and page navigation, are the exception. They own the viewport by nature. They render in their own frame route (`/<id>/preview/<name>`) and are embedded in their demo with an iframe, so their viewport rules don't fight the showcase layout.

## Consequences

- An entry declares a minimum width, and the size audit (`npm run audit:sizes`, `/unending:audit-sizes`) checks every device width from that minimum to 2560px, both as a window and as a narrow container. It must come back clean before an entry change is done.
- The bar is structural: no overlap, overflow or layout shift at any size. Looking cramped at tiny sizes is acceptable.
- Demos can be dragged narrower in the showcase to try container widths. Use that rather than adding width sliders to demos.
- The showcase itself is desktop-only. Container sizing is about entries working in real apps, not about phone layouts for the showcase.
