---
name: unending-flavor
description: The design rules that keep UI consistent with the Unending catalog's design system. Use when writing or reviewing React UI (components, Tailwind classes, colors, spacing, motion) in the unending_components repo or in a project that has Unending entries installed, and before adding or harvesting a catalog entry.
---

# Unending flavor

The catalog's design system is currently **stock shadcn**: the `base-nova` style, the neutral base color, Base UI primitives, lucide icons, and Tailwind v4 with CSS variables, plus three status tokens (`success`, `warning`, `info`) that stock shadcn lacks. Fonts are DM Sans for body text (`font-sans`), Manrope for headings (`font-heading`, applied to h1–h6 and stock titles) and Geist Mono for code and data (`font-mono`). A custom flavor will replace this later. Until then, consistency means staying strictly inside shadcn's own system. Following these rules now means a theme swap later restyles everything at once.

## Design systems

The catalog curates several design systems (`design-systems/<id>/`), each a set of differences from stock: palette, tokens, fonts, radius, motion and per-entry tuning. Entries must work on all of them, so they use only the semantic tokens below and read their feel values from `useEntryTuning`. In a project linked to one system, `docs/design-system.md` holds that system's rules and takes precedence for that project.

## Color

- Use only semantic tokens: `background`, `foreground`, `card`, `popover`, `primary`, `secondary`, `muted`, `accent`, `destructive`, `success`, `warning`, `info`, `border`, `input`, `ring`, `chart-1`…`chart-5` and `sidebar-*`, each with `-foreground` where one exists. Opacity modifiers (`bg-primary/10`) are fine.
- Never use raw colors: no hex, `rgb()` or `oklch()` values in components, and no Tailwind palette classes (`bg-zinc-100`, `text-blue-600`). If a color is missing, it's a token decision. Raise it.
- State color is semantic. Errors and destructive actions use `destructive`; done or saved uses `success`; needs attention uses `warning`; neutral notices use `info`. Like `destructive`, the three status tokens are for text, icons and tints (`bg-success/10`), never a solid fill, and they have no `-foreground`. They are the catalog's only additions to stock shadcn. Selection and "now" use `primary`. Secondary information uses `muted-foreground`.

## Shape, type and space

- Radius comes from the `rounded-*` scale, which derives from `--radius`. Never write arbitrary pixel radii.
- Use the Tailwind spacing scale (`gap-2`, `p-4`). Lay out siblings with flex or grid and `gap`, not margins between them.
- Keep to the type scale (`text-xs`…`text-3xl`). Put numbers that line up in `tabular-nums`, and times, IDs and code in `font-mono`.
- Use `text-balance` on headings and `text-pretty` on short paragraphs.
- Titles that aren't h1–h6 elements but read as headings (card or panel titles) get `font-heading`.

## Composition

- Build from `components/ui/*` first. Reach for a primitive (`@base-ui/react`) only when shadcn has no wrapper, as with Base UI's Toolbar, and say so in the entry README.
- Follow shadcn conventions: `data-slot` on each part, `cn()` for merging classes, `cva` for variants, `className` passthrough, and props spread onto the root.
- Icons are lucide. Inside buttons, use `data-icon="inline-start"` or `"inline-end"` rather than manual margins.

## Behavior

- Every interactive element is reachable and operable by keyboard and shows `focus-visible` (`ring-3 ring-ring/50`, the stock pattern).
- Respect `prefers-reduced-motion`: animated jumps become instant.
- Motion is short (120–300ms), eased out, and has a reason: it continues a gesture, shows a change of place, or confirms an action.
- Handle the states: empty, loading, error, long content, many items, and a single item.
- Make server and client render the same. Read time and media queries with `useSyncExternalStore`, using a null or false server snapshot.

## Review

When reviewing UI against these rules, delegate to the `flavor-reviewer` agent, or work through the list above. Report each violation as file:line, the rule broken, and the fix.
