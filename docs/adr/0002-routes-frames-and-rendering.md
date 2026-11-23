# 2. Routes, frames and rendering

- Status: Accepted
- Date: 2026-11-23 (recorded from code comments; the decisions are older)

## Decisions

### Every page lives under its design system

`app/[system]/layout.tsx`. Everything under `/<system>/` shows that design system: the catalog pages and the full-page preview frames. The id is the system's folder name, so renaming a system never changes its URLs.

### Entry pages aren't statically generated

`app/[system]/(catalog)/c/[name]/page.tsx` has no `generateStaticParams`. A version with it listed entry names but not systems, so nothing was prerendered. Each page was then cached on its first visit, which froze the layout's read of the design systems on disk in production.

### Size frames are dynamic

`app/[system]/(frame)/frame/[name]/page.tsx` shows just an entry's demo, with no showcase around it, for checking sizes. The Sizes view and the size audit load it in a frame sized to a device. `?w=<px>` puts the demo in a container that wide, to test a narrow container in a wide window. It reads `searchParams`, a request-time API, so it's dynamic on purpose and has no `generateStaticParams`.

A frame shows the component alone: the Next dev overlay is hidden there.

### Full-page entries get preview frames

`app/[system]/(frame)/preview/[name]`. Entries that own the page (navigation, app shells) render here, and the catalog embeds them in iframes so they don't fight the showcase layout. This is also an invariant in CLAUDE.md.

### Ship status only runs in the catalog

`app/[system]/(catalog)/layout.tsx` wraps the catalog in `ShipProvider`, which polls git for each system's ship status. That's only for the catalog's menus, so preview and size frames don't poll.

### The dev indicator sits bottom-right

`next.config.ts` sets `devIndicators.position` to `bottom-right`, because the catalog's info button owns the bottom-left corner.
