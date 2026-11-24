# 4. Fonts

- Status: Accepted
- Date: 2026-11-23 (recorded from code comments; the decisions are older)

## Decisions

### The theme's fonts

DM Sans for body text, Manrope for headings and Geist Mono for code and data. They're loaded with `next/font` in `app/fonts.ts`, named in `stockFonts` in `lib/design-systems/fonts.ts`, and installed by the `font-sans`, `font-heading` and `font-mono` items in `registry.json`. Nothing checks yet that these three agree (#18).

### Options load only when picked

The other fonts offered on the design system page are declared with `preload: false`, so each one downloads only when someone picks it. The first option in each list is the theme's own font.

### Licensed fonts stay on this machine

Graphik is a licensed commercial font. It's offered as an option on `/system`, loaded by `@font-face` in `app/graphik.css` from `public/fonts/graphik/`, which is git-ignored. It must never be committed or shipped in a registry. Without the files, those rules 404 and the option falls back to the system sans.

### How a font ships to an app

`lib/design-systems/fonts.ts` maps each font option (ids from `app/fonts.ts`) to what an app receives. `item` is the shadcn `registry:font` payload. `null` means there's nothing to install: either a system stack, or a licensed face (`licensed: true`) whose files the app has to supply itself.
