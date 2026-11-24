# 13. Agent chat and agent trace

- Status: Accepted
- Date: 2026-11-23 (recorded from code comments; the decisions are older)

## Agent chat

- **Code blocks.** In the markdown renderer, a code element is a fenced block (rather than inline code) when it carries a language class or spans several lines.
- **Demo under Strict Mode.** The demo answers the seeded question in an effect and cancels on cleanup. That lets Strict Mode's mount, unmount, mount cycle restart the reply instead of stranding it half-written.

## Agent trace

- **One clock.** Live step timers share a single one-second clock, which only runs while a step is live.
- **Pending steps stay at full opacity.** Their icon already sets them apart, and stock's 60% fade drops muted text below 4.5:1 contrast.
