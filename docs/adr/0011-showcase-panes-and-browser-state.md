# 11. Showcase panes, tuners and browser-only state

- Status: Accepted
- Date: 2026-11-23 (recorded from code comments; the decisions are older)

## Decisions

### Panes

`components/showcase/pane.tsx`. A pane is a column of the showcase: a header bar, a body that scrolls on its own, and a tuner that floats over the body's top-right corner, toggled from the header.

- The tuner may cover content, never the pane's controls or its scrollbar. It sits 12px in from the scrollbar and narrows with the pane. Hide it to see everything. The scrollbar width is re-measured when the content changes as well as on resize, because content can add or remove the scrollbar without a resize.
- The tuner card fits its contents up to the pane's height. Its sections scroll on their own (as in the inspector panel), so the card itself never scrolls.
- The pane uses `overflow-clip`, not `hidden`. The resizable panel around a pane scrolls anything that spills out of it, and a hidden-overflow box can still be scrolled by focus or `scrollIntoView`. Either would slide the whole pane, header included. Clip can't be scrolled at all.
- The scroller is `relative`, so absolutely positioned content (sr-only text, popups) stays inside it instead of spilling out of the pane.
- The pane title is plain text, because the page's own `h1` names it for assistive tech.

On the design system page and entry pages, the panes lay themselves out at full height, each scrolling on its own. On the design system page an entry opens in a pane beside the system instead of replacing it, so a token change on the left and a knob change on the right show at once. Everywhere else, an entry link goes to the entry's own page, which is one pane with the same floating tuner.

In the tuner, Colour starts open and the other sections closed, whatever the inspector's default.

### Remembered sizes render only in the browser

Resizable panel groups restore their sizes from localStorage, which the server can't see. They render only after hydration (`useHydrated`), which avoids a hydration mismatch. Only sizes the person chose are saved; sizes forced by a small window aren't. localStorage access is wrapped so private windows and previews just don't remember.

The palette page also renders only once the palette has been restored from the browser. That avoids a flash of the seed colours and server/client float drift in the charts.

### The sidebar resizer leaves stock alone

`SidebarResizer` sets the stock sidebar's `--sidebar-width` through `SidebarProvider`'s style, so `components/ui/sidebar` stays as shadcn ships it. It turns off the sidebar's width transition while dragging, because the animation lags the drag. Double-click resets to the stock width.

### Examples can be narrowed

`Example` frames one live state of an entry. Drag its right edge (or use the arrow keys on it) to try the example in a narrower container. Double-click or Reset goes back to full width.

### Undo

Text fields keep their own undo; sliders, buttons and swatches use the page's. The OKLCH control reports which channel moved, so a drag merges into one undo step.

### Leave guard

`BackButton` asks to save or discard unsaved changes before leaving a system. It does this from the button itself, and from the browser's back and forward buttons where the browser lets a page cancel them (the Navigation API). TypeScript 5.9's DOM types don't include the Navigation API, so the few parts the guard uses are typed by hand. After Save or Discard, the guard lets through only the history entry it is leaving to, and switches back on when that traverse's `finished` promise settles, whether it succeeds or fails.

### Small things that are easy to undo by accident

- Scrollbars have no track background anywhere. `scrollbar-color` is inherited, so it's set once on the root.
- In the composed example, CSS picks the theme button's label from the scheme ("Switch to dark" or "Switch to light"), so the server and client render the same text. The example is laid out by its own width, not the window's, because it lives in a resizable pane.
- The stock `Dialog` doesn't supply a cmdk root, so a command list inside one needs its own `Command`.
