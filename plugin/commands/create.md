---
description: Design and build a new Unending catalog entry from an intent ("a timeline to view parallel calendar events")
argument-hint: <intent, in the words of someone trying to do something>
---

Create a new entry in Ari's Unending catalog for this intent: $ARGUMENTS

Follow the `unending-authoring` and `unending-flavor` skills.

1. **Find the catalog checkout.** Use the current repo if its `registry.json` has `"name": "unending"`. Otherwise ask the user for the path, or offer to clone it with `gh repo clone AriEncarnacion/unending_components`.
2. **Check it's new.** Read `registry.json` and the entry READMEs. If an existing entry covers this intent, say which one and propose extending it instead.
3. **Interview briefly.** Ask at most three questions, only where the answer changes the design: who uses it and in what situation, what data it shows, and which interactions matter most. Skip anything the intent already answers.
4. **Propose the anatomy before coding.** Give a name (kebab-case, named for the intent), a list of parts mapped to stock shadcn components (install any missing ones with `npx shadcn@4.23.0 add <name>`), the states, and the keyboard and pointer behavior. Wait for a go-ahead.
5. **Build** the component, README and demo, then register it in `registry.json` and `lib/catalog.ts`.
6. **Verify** with `npm run registry:build`, `npm run typecheck` and `npm run lint`. Then run the dev server, open `/c/<name>`, and try each example in light and dark, and at phone width. Fix what you find.
7. **Report** what was built, how to try it, and the "Not yet decided" items for Ari to review. Don't commit unless asked.

After verifying, look at each design system in `design-systems/`. Where one clearly calls for it, write an optional tuning proposal for the new entry, as the `unending-authoring` skill describes. Mention any proposals in the report; Ari accepts or rejects them on `/c/<name>`.
