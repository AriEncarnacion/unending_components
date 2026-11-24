# 7. Strict value grammar and reserved names

- Status: Accepted
- Date: 2026-11-23 (recorded from code comments; the decisions are older)

## Context

A design system's values end up in consumers' global CSS and in the design rules their agents read. The shadcn CLI writes CSS values into stylesheets as-is. A design system can come from someone else's repo, so its values have to be treated as untrusted.

## Decisions

### Every kind of value has a strict grammar

`lib/design-systems/schema.ts` gives each kind of value (colour, length, easing, font id, name and so on) a strict grammar, so nothing can close a rule, add one, or smuggle in markup. Validation fails closed: anything that isn't a well-formed palette ref must be a colour in the strict grammar.

`scripts/build-systems.ts` checks again at build time. Every string in every CSS object it emits must be unable to close or open a rule.

Display names are short, one line, and made of letters, digits, spaces, hyphens and apostrophes.

### Reserved system ids

Systems live at `/<id>/`, so an id can't be a top-level path the app uses (`api`, `preview`, `r`, `fonts`, `_next` and the rest of `reservedSystemIds`).

### Reserved scale ids

Scales become `--<scale>-<n>` variables, so a scale id can't take a token's name or prefix (`reservedScaleIds`). `safeScaleId` turns `primary` into `primary-scale`. The semantic scales are named by role on purpose (`--success-3`), and those can't collide with the single `--success` token.
