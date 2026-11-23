# Architecture decision records

Why the code is the way it is. Code carries no comments (ADR 0001), so a choice that isn't obvious from the code is recorded here instead. Add to the ADR for that subsystem when there is one, and start a new numbered file when there isn't.

| ADR | Covers |
| --- | --- |
| [0001](0001-no-code-comments.md) | No code comments, and the lint ratchet |
| [0002](0002-routes-frames-and-rendering.md) | Per-system routes, size and preview frames, static rendering |
| [0003](0003-dev-only-routes.md) | Dev-only API routes and their CSRF and DNS-rebinding guards |
| [0004](0004-fonts.md) | Theme fonts, font options, licensed local faces |
| [0005](0005-demo-loading-and-frame-readiness.md) | Demo code-splitting and the frame-ready signal |
| [0006](0006-design-system-files-and-drafts.md) | Design-system files, palette refs, drafts, Stock |
| [0007](0007-strict-value-grammar.md) | Value grammar and reserved names |
| [0008](0008-ship-roll-back-and-pull.md) | Ship, roll back, pull and baking |
| [0009](0009-token-tuning-and-type-scale.md) | Override scoping, the resolver, Size, Leading and Flow |
| [0010](0010-palette-maths-and-theme-presets.md) | Colour maths, scale generation, theme presets |
| [0011](0011-showcase-panes-and-browser-state.md) | Panes, floating tuners, browser-only state, leave guard |
| [0012](0012-size-audit.md) | How the size audit loads, waits and judges layout |
| [0013](0013-agent-chat-and-agent-trace.md) | Agent chat and agent trace |
| [0014](0014-file-toolbar-overflow.md) | File toolbar overflow |
| [0015](0015-inspector-panel-layout.md) | Inspector panel layout |
| [0016](0016-page-navigation.md) | Page navigation |
| [0017](0017-review-deck-gestures-and-layout.md) | Review deck gestures and layout |
| [0018](0018-timeline-scrubber.md) | Timeline scrubber |
