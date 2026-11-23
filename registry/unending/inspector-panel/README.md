## Intent

Inspect and edit whatever is selected, without leaving the thing you selected it from. The panel sits beside a canvas, list or timeline and always reflects the current selection: one item, several at once, or nothing.

## When to use

- A main view where people select things and then adjust their properties, as in design tools, schedulers and admin lists.
- Properties that group naturally into a few sections.

Don't use it for creating new things, or for long forms that need focus. A sheet or a dedicated page suits those better.

## Anatomy

| Part | Built from | Notes |
| --- | --- | --- |
| Panel | `aside` with `bg-card` | Has a fixed header. Give it a height or a max height: it grows with its content up to that. |
| Header | text + `Button` (ghost) | Shows the kind and title, or "3 shifts selected" and "Editing 3 at once". Revert appears only when there are unsaved edits. Close is optional. |
| Section | `Collapsible` + `ScrollArea` | A full-width trigger with a chevron. While closed it shows a one-line `summary`, so nothing is hidden without a trace. Open sections share the panel's height, and each scrolls on its own, so scrolling one never moves the others. There's no outer scroll: when several open sections don't fit, each shrinks, down to its header; close one to give the rest room. Content outside sections (a status line, a footer) always keeps its full height. |
| Row | `Field` (horizontal) + `FieldLabel` | A 6.5rem label column, then the control. An optional hint sits beneath it. |
| Mixed | `Badge` (outline) + `MIXED` placeholder | Use it when a field's value differs across the selection. Editing a mixed field sets it for every selected item. |
| Empty | `Empty` | "Select something to inspect". Replace it with the `empty` prop. |

## Spacing

Content sits 16px from the panel's edges. A section's scrollbar has a gutter of its own: 6px in from the right edge, then 16px of space before the content, the same as the left edge. Every section reserves it, scrolling or not, so rows line up. Scrolled content has room above and below, so it doesn't run into the section header.

## Composition

The panel doesn't know your data. It is three parts you compose: `InspectorPanel`, `InspectorSection` and `InspectorRow`, with stock controls (`Input`, `Select`, `Switch`, `Textarea`) inside rows. The demo shows one way to derive shared or mixed values from a multi-selection.

## Not yet decided

- Whether edits apply live or on Save. The demo saves explicitly and keeps a draft. Live apply with per-field undo is the other common choice.
- Field-level validation display. `FieldError` is available but not shown here.
