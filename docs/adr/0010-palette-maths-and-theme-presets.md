# 10. Palette maths and theme presets

- Status: Accepted
- Date: 2026-11-23 (recorded from code comments; the decisions are older)

## Decisions

### Two colour modules

- `lib/palette.ts` is the palette maths for `/palette`: OKLCH to and from sRGB without a canvas, gamut checks, contrast (WCAG 2 and APCA), colour-vision simulation and 12-step scale generation. It's all pure functions and safe on the server.
- `lib/color.ts` resolves any CSS colour (oklch, hex, rgb…) to sRGB through a canvas, so it only works in the browser. Its `RGBA` has r, g and b from 0 to 255 and a from 0 to 1. `contrast` lays a translucent foreground over the background first. `hexToOklch` rounds the way shadcn writes tokens.

### Conventions

- `oklchToLinear` is unclamped. Values outside 0 to 1 mean out of gamut.
- `deltaE` is Euclidean distance in OKLab, ×100, so 1 is roughly a just-noticeable step.
- APCA uses a simple 2.4 exponent on the encoded channels. Lc is negative for light text on dark.
- Colour-vision simulation follows Machado et al. 2009, at full severity, in linear RGB.
- Step indexes in code (`Generator.index`, `primaryStep`) are 0-based. Palette refs (`palette:jade-8`) are 1-based.
- Step roles follow Radix, from "App background" at step 1 to "Text, high contrast" at step 12. They're used as column hints and in the usage preview.

### Scale generation

A scale is built around a key colour:

- The reference lightness curve (the mean of the existing scales) is stretched to the scale's own ends.
- It's then bent so the key step lands exactly on the key's lightness. The bend fades to nothing at both ends, so steps 1 and 12 stay put.
- `chroma` multiplies the reference chroma profile; 1 keeps the key's own chroma.
- `hueShift` is the hue drift in degrees from step 1 to step 12, pivoting on the key.
- Editing the key step also moves the generator's key, so they stay together.

### The seed scales

The neutral and status scales are tuned to sit with the jade palette. The neutral is tinted toward jade. Status hues stay recognisable (red, amber, green, blue), but their chroma is held near the palette's muted range. Danger is cinnabar, the split complement of jade. Warning leans toward vein gold. Info moves aqua toward blue so it can't be mistaken for success.

### Theme presets

`lib/theme-presets.ts` maps palette scales onto every stock shadcn colour token, for light and dark. It follows shadcn's recipe (one neutral for surfaces, lines and text; one brand colour for primary, ring and charts) and Radix step roles. It then enforces contrast by walking along the scale until each pair passes:

- **Primary:** the brand step, moved along the scale until it stands off the page (3:1) and carries its own text (4.5:1). `primaryStep` pins it when the brand colour must be exact. `accent` defaults to the neutral.
- **Status colours** work like `destructive`: text and tints on the page.
- **Charts:** each series takes the step that passes 3:1 against the page and is furthest from the series before it. A muted palette still separates by lightness as well as hue, which also helps readers with colour-vision deficiency. The preset checks list chart series against each other, not just against the page.
- **Dark-mode lines** are translucent light, as in shadcn, so they suit any surface.

### Contrast checks in the showcase

Lines are judged against the page; fills against their own foreground. In the palette grid, fixed surfaces get fixed ink, and on the page the theme decides.
