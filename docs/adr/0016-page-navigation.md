# 16. Page navigation

- Status: Accepted
- Date: 2026-11-23 (recorded from code comments; the decisions are older)

## Decisions

- **No layout wrapper.** The `data-slot="page-nav"` wrapper only marks the entry for design-system tuning. It's `display: contents`, so it stays out of layout.
- **Filtering opens groups.** Groups are keyed by whether a filter is active, so they remount when filtering starts or stops. That lets `defaultOpen` open every group to show matches, then restore the current page's group afterwards.
- **Demo frames keep a desktop width.** The stock sidebar switches to a sheet below 768px. The demo's desktop frames keep a desktop width and scroll sideways on small screens. A separate 390px frame shows the mobile sheet.
