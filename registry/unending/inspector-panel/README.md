## Intent

Inspect and edit whatever is selected, without leaving the thing you selected it from. The panel sits beside a canvas, list or timeline and always reflects the current selection: one item, several at once, or nothing.

## When to use

- A main view where people select things and then adjust their properties, as in design tools, schedulers and admin lists.
- Properties that group naturally into a few sections.

Don't use it for creating new things, or for long forms that need focus. A sheet or a dedicated page suits those better.

## Anatomy

| Part | Built from | Notes |
| --- | --- | --- |
| Panel | `aside` with `bg-card`, `ScrollArea` | Has a fixed header, and the body scrolls. Give it a height. |
| Header | text + `Button` (ghost) | Shows the kind and title, or "3 shifts selected" and "Editing 3 at once". Revert appears only when there are unsaved edits. Close is optional. |
| Section | `Collapsible` | A full-width trigger with a chevron. While closed it shows a one-line `summary`, so nothing is hidden without a trace. |
| Row | `Field` (horizontal) + `FieldLabel` | A 6.5rem label column, then the control. An optional hint sits beneath it. |
| Mixed | `Badge` (outline) + `MIXED` placeholder | Use it when a field's value differs across the selection. Editing a mixed field sets it for every selected item. |
| Empty | `Empty` | "Select something to inspect". Replace it with the `empty` prop. |

## Composition

The panel doesn't know your data. It is three parts you compose: `InspectorPanel`, `InspectorSection` and `InspectorRow`, with stock controls (`Input`, `Select`, `Switch`, `Textarea`) inside rows. The demo shows one way to derive shared or mixed values from a multi-selection.

## Not yet decided

- Whether edits apply live or on Save. The demo saves explicitly and keeps a draft. Live apply with per-field undo is the other common choice.
- Field-level validation display. `FieldError` is available but not shown here.
