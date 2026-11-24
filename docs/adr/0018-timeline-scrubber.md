# 18. Timeline scrubber

- Status: Accepted
- Date: 2026-11-23 (recorded from code comments; the decisions are older)

## Decisions

### Time

- The scrubber shares one 15-second clock. Its server snapshot is `null`, so the first client render matches the server and the real time arrives right after hydration.
- The demo uses a fixed "now", so it renders the same on the server and the client.

### Movement

- The latest playhead is kept in a ref for animation frames and pointer handlers, which run between renders. `moveTo` writes it directly while animating.
- A flick carries on, but never further than one visible span.

### Drawing

- Tones keep the muted fill and mark the leading edge, so events stay legible however close the chart colours sit to the background.
- The day ruler sits under the first lane, as in a two-lane rota.

### Accessibility

The slider's value is given in hours from now, so assistive tech reads "+36 hours" rather than a timestamp. The stock `Slider` has no custom value text.
