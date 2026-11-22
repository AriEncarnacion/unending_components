## Intent

Move between the pages of an app, and always know where you are. The navigation is a list of pages, grouped the way people think about the app. It marks the current page, opens the group that contains it, and gets out of the way when space is tight.

## When to use

- Apps with roughly 5 to 40 pages that people move between often.
- Two levels at most: pages and sub-pages.

For deeper trees use a file-tree pattern, and for a handful of top-level pages use top tabs. A page-jumping command palette is a separate intent.

## Anatomy

| Part | Built from | Notes |
| --- | --- | --- |
| Frame | `Sidebar` (`collapsible="icon"`) + `SidebarRail` | ⌘B or Ctrl+B toggles it, the state is kept in a cookie, and narrow screens get a `Sheet`. All of this is stock behavior. |
| Header slot | `SidebarHeader` | App or workspace identity. |
| Filter | `SidebarInput` | Appears once there are `filterThreshold` (default 12) pages. Groups open to reveal matches, and Escape clears it. |
| Sections | `SidebarGroup` + `SidebarGroupLabel` | Unlabelled sections suit a lone "Overview". |
| Page | `SidebarMenuButton` with `tooltip` | The tooltip shows only when the sidebar is collapsed to icons. |
| Badge | `SidebarMenuBadge` | Short counts or statuses, in tabular numerals. |
| Sub-pages | `Collapsible` + `SidebarMenuSub` | The parent row shows as active while you're anywhere inside it. |
| Footer slot | `SidebarFooter` | Usually the signed-in person. |

## Routing

The component never imports a router. Pass `currentPath` from your router, and `renderLink` to render its link. Spread every prop onto the link, because the sidebar's active styling and `aria-current` travel through them:

```tsx
<PageNav
  sections={sections}
  currentPath={usePathname()}
  renderLink={(props) => <Link {...props} />}
/>
```

A page counts as current when the path equals its `href` or sits beneath it. `/rotations/primary` therefore keeps Rotations open and highlighted.

## Not yet decided

- Pinned or recent pages.
- Drag to reorder sections.
