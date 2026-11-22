## Intent

Work on a file: see which file it is and whether it's saved, rename it, reach the actions you use most, and do the one main thing it's for (share, publish, export). The toolbar has to hold up at any width, so actions make room for each other instead of wrapping or clipping.

## When to use

- At the top of a document, sheet, canvas or asset editor.
- Five to ten actions, one of which is the main one.

For app-wide commands that aren't about this file, use a command palette or a menu bar.

## Anatomy

| Part | Built from | Notes |
| --- | --- | --- |
| Frame | Base UI `Toolbar.Root` | Roving focus: Tab enters and leaves the toolbar, and the arrow keys move within it. shadcn has no toolbar wrapper, so this is the one place the primitive is used directly. |
| File name | `Button` (ghost), becomes `Input` | Click it or press F2 to rename. The name is selected without its extension. Enter or blur commits, Escape cancels. It's read-only without `onRename`. |
| Status | text + `Spinner` | Shows "Saved 2 min ago" (refreshed every 30s), "Saving…", "Unsaved changes" or an error with Retry. |
| Actions | `Button` (ghost, sm) + `Tooltip` | Shown in your list order. The tooltip shows the shortcut. |
| More | `DropdownMenu` | Holds the actions that don't fit, then `menuOnly` ones such as Delete, after a separator. |
| Primary | `Button` (default) | Set apart by a `Separator`. It never overflows. |

## Overflow

Each action is measured once, from an invisible copy. As the space shrinks, actions move into More in reverse `priority` order: lower numbers stay visible longer. On screen, actions keep their list order. A `ResizeObserver` re-measures on every size change.

## Not yet decided

- Shortcuts are display-only. Binding them belongs to the app, which knows its focus rules.
- An icon-only step between "with labels" and "in the menu" would keep more actions visible when the toolbar is narrow.
