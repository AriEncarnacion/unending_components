# 17. Review deck gestures and layout

- Status: Accepted
- Date: 2026-11-23 (recorded from code comments; the decisions are older)

## Decisions

### Gesture model

Distance commits, and direction comes from cones with neutral gaps between them. Screen space: +x is right, +y is down. Movement inside the dead zone is ignored, and `angleBuffer` is the half-width of the neutral gaps at 45°, 135° and 270°.

Touch and pen drag only from the grip, so card content keeps native scrolling. A mouse can drag from anywhere on the card.

### Decision lock

After a decision, the deck stays locked until the queue's first item changes. A new first item ends the previous decision's lock.

### Layout

The deck is a size container. It lays itself out by its own width, so it holds up in a sidebar, drawer or pane, not just a narrow window.

When narrow, the two sideways actions share a row and the down action sits below them, which keeps each button where its drag goes. When wide, the actions sit in a three-column row, and an empty slot holds the middle column when there's no down action.
