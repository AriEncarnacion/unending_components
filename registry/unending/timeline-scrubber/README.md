
## Intent

Answer "who has it at this moment, and what's next?" across several parallel schedules. Examples include an on-call rotation, room bookings and a release train. The moment under the playhead is the subject. Everything else is context that fades toward the edges.

## When to use

- Two to four lanes that share one time axis, where overlap between lanes matters.
- Moving through time is the main interaction, not editing events.
- Every moment in a lane has at most one owner. For lanes where events overlap, use a calendar instead.

Don't use it to create or resize events. It is read-and-navigate only.

## Anatomy

| Part | Built from | Notes |
| --- | --- | --- |
| Readout | `Badge` (outline) | The moment under the playhead. Announced politely. |
| Back to now | `Button` (secondary, sm) | Hidden while the playhead is within a minute of now. |
| Lane labels | text | Fixed column, so the track width doesn't depend on label length. |
| Lanes | positioned blocks + `Tooltip` | `bg-muted` at rest, `bg-primary` when under the playhead, dashed `border-primary` for overrides. Optional `tone` uses `chart-1`…`chart-5`. |
| Day ruler | mono `text-xs` + dots | Placed after the first lane. Today in `text-primary`, month starts in `text-foreground`. |
| Playhead | `bg-primary` line | Always at the center of the strip. |
| Now marker | dashed `border-muted-foreground` | Shows where the present is once the playhead has moved away. |
| Scrub control | `Slider` | Keyboard and assistive-tech access: 1 hour per arrow, 1 day per Page Up/Down. |
| Details | `dl` | Per lane: owner, range, and time left or time until. Can be replaced with `renderDetail`. |

## Interactions

- **Drag** the track to scrub. Movement under 4px counts as a click, not a drag, so tooltips still work.
- **Flick** the track: release velocity carries the playhead on with an ease-out of up to 700ms.
- **Snap**: after a drag, flick or wheel, the playhead settles on the nearest event edge or on now, if one is within 4% of the span. Turn this off with `snapToEdges={false}`.
- **Wheel**: horizontal trackpad scroll, or Shift with a vertical wheel, scrubs. It snaps 140ms after the scrolling stops.
- **Keyboard**: the Slider animates each step, and the readout and details update as it moves.
- **Reduced motion**: every animated jump becomes an instant move.

## States

- Loading: before the clock is known on the client, it shows pulsing lane placeholders. This avoids a hydration mismatch.
- Empty lane: the lane's `emptyLabel` (default "Nothing in this range") stays in place.
- Away from now: the now marker and the Now button appear.

## Not yet decided (flavor work)

These Bearing behaviors were left out because stock shadcn has no equivalent. They are candidates when the design system gets its own flavor:

- Edge blur (stacked `backdrop-filter` strips) instead of a plain mask fade.
- Scrambled-text transitions in the details as the owner changes.
- Collapsing a recurring half-day pattern into one "rotation" block that shows its daily hours.
- A floating readout pinned over the playhead, instead of the badge in the header row.
- On phone widths, 14 days in one view makes the blocks too small to label. The span could shrink automatically below a breakpoint, or the parent can pass a shorter `span`.
- A flick is capped at one span so it can't fling to the end of the range. Bearing let velocity carry it further.
