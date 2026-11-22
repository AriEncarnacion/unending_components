## Intent

Work through a stack of yes-or-no decisions quickly, with a third way out ("later") that makes no decision. Examples: approvals, curation passes and quality checks. One card is in front of you at a time, and every decision is a single gesture or key.

## When to use

- Many items, each needing the same decision, where speed matters more than comparing items side by side.
- The evidence for a decision fits on one card. The card scrolls if it needs to.

Don't use it when people need to compare items or decide on several at once. Use a table with row selection for that.

## Anatomy

| Part | Built from | Notes |
| --- | --- | --- |
| Remaining count, Undo | text, `Button` (ghost) + `Kbd` | Undo appears only when you pass `onUndo`. |
| Active card | `Card` | Your `renderCard` output. The content scrolls independently. |
| Grip | lucide grip icon | Touch and pen drags start here, so swiping the card's content still scrolls it. Mouse drags work from anywhere that isn't interactive. |
| Backing card | `bg-muted/60` layer | Shows there is more to come. Only the active card is rendered, however long the queue. |
| Drag feedback | tint + progress ring + action icon | Fades in between the 18px dead zone and the 110px commit distance. Positive uses `primary`, negative uses `destructive`, later uses `muted`. |
| Actions | `Button` × 3 + `Kbd` | Defaults: positive is left/F, later is down/Q, negative is right/J. Minimum height 48px. |
| Finished | `Empty` | Replace it with `emptyState`. |

## Interactions

- **Gesture:** direction cones with neutral 15° gaps at 45°, 135° and straight up. Down is later, and the upper cones belong to left and right. The decision is made at release, from where the pointer is then, so you can pull back to cancel. A quick flick that stays short of 110px also cancels: velocity alone never decides.
- **Flight:** a decided card leaves from exactly where you released it and continues 260px along the release direction while fading over 180ms. Cards decided by button or key leave from the center.
- **Cancel:** Escape, a lost pointer, or the window losing focus sends a drag back to the center.
- **Keys** work only while the deck has focus, so several decks on one page don't compete. They're ignored in text fields, on held repeats, during IME composition, and with Ctrl, Alt or Meta.
- **Async:** `onDecision` can return a promise. The deck stays locked while it's pending. A rejection brings the card back and shows a retry message.
- **Reduced motion:** no flight. The next card simply appears.

## Data model

The parent owns everything: the queue (`items[0]` is the active card), what "later" means, the history, and persistence. Remove an item once its decision succeeds. If the same item is still first after a decision, the deck shows "Waiting for the next item…" rather than deciding it twice. For undo, record the previous value before applying each decision, then restore it in `onUndo`.

## Origin

This rebuilds the UX of the `@review-deck/react` 0.1.0 package (MIT). The gesture constants, flight math, action defaults and copy model are kept. The package's scoped `--rd-*` theme is replaced by stock shadcn tokens and components.

## Not yet decided

- Per-instance light and dark themes (the package had a `theme` prop). This entry follows the app theme.
- Forced-colors styling has not been checked.
