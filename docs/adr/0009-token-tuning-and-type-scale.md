# 9. Token tuning, scoping and the type scale

- Status: Accepted
- Date: 2026-11-23 (recorded from code comments; the decisions are older)

## Decisions

### The scheme being tuned is the site's scheme

The tuner and the palette editor edit whichever scheme the site is showing. The tuner's light/dark toggle and the header theme button always agree; flipping either flips both.

### How overrides apply

`components/showcase/token-overrides.tsx`:

- Light overrides go on the root only when it isn't dark. Dark overrides follow the `.dark` class wherever it is.
- `.ds-light` and `.ds-dark` are full scopes the system page uses to show both schemes side by side.
- The palette's steps are CSS variables too.
- Each tuned entry gets rules scoped to its `data-slot`. In `scopedSelectors` the light rule is guarded so it can't leak into dark.
- An entry may only use palette steps or other tokens for its colours (`RefPicker`).

### One resolver, two outputs

`lib/design-systems/resolve.ts` turns stored values (palette refs, token refs, font ids) into CSS. The showcase gets concrete colours. The installed theme gets `var()` references (`palette:jade-8` becomes `var(--jade-8)`).

### Which scales ship

Hidden scales are exploratory. The showcase only emits visible scales as variables. A build ships every visible scale, plus any hidden one that something refers to.

### Type scale: Size, Leading and Flow

`lib/design-systems/type-scale.ts`:

- **Size** is Tailwind's `--text-sm`, the size shadcn sets UI text at. Changing it scales every `text-*` step by the same ratio.
- **Leading** sets one line height for the running-text steps (`xs` to `lg`). Headings keep Tailwind's tight line heights. Stock has no single body line height, so stock shows each step keeping Tailwind's own.
- **Flow** is `--spacing-flow`, the space between paragraphs (`space-y-flow`, `mt-flow`). It's declared in `@theme`, not `@theme inline`, so the tuner can change it live.

Tailwind v4's text scale is stored as a size in rem and a line height as a ratio of it. Lengths given in px are read at 16px to the rem.

### Headings use the heading face

`app/globals.css` sets semantic headings in the heading face. Stock shadcn titles opt in with `font-heading`.

### What travels with the theme item

`scripts/sync-theme.mjs` copies `app/globals.css` into the registry's `theme` item. From `@theme inline` it only takes the mappings that `shadcn init` doesn't already set up: the fonts (`--font-heading` has to point at its own variable for the heading font to apply) and the status colours the catalog adds. It also takes the catalog's own theme variables, like `--spacing-flow`.
