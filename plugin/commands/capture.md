---
description: Capture a UI pattern spotted in the wild (screenshot, URL or recording) as a new Unending catalog entry, rebuilt from stock shadcn parts
argument-hint: <screenshot path, URL, or description of what you saw>
---

Ari spotted something worth keeping: $ARGUMENTS

Turn it into an Unending catalog entry, following the `unending-authoring` and `unending-flavor` skills.

1. **Study the source.** Open the image, or open the URL in a browser tool and interact with it. If no browser tool is available, ask the user for screenshots or a short recording of the states and interactions that matter. Write down the **intent** it serves (what the person is doing, not what it looks like), its anatomy, its states, and the interactions that make it good, such as timing, gestures and keyboard. Separate the UX you're keeping from the visual styling you're replacing.
2. **Don't copy.** Rebuild the behavior and structure from stock shadcn components on the catalog theme. Don't copy its assets, brand colors, fonts or copy. Name the entry for the intent, not the product.
3. **Find the catalog checkout**, check it's new, and propose the anatomy before coding, as in `/unending:create` steps 1, 2 and 4.
4. **Build, register and verify**, as in `/unending:create` steps 5 and 6. In `meta.origin` and the README, say where the idea came from (for example "Spotted in <product>'s <screen>").
5. **Report** what was kept, what was dropped or approximated because the stock system can't express it (list these under "Not yet decided"), and how to try it.

After verifying, look at each design system in `design-systems/`. Where one clearly calls for it, write an optional tuning proposal for the new entry, as the `unending-authoring` skill describes. Mention any proposals in the report; Ari accepts or rejects them on `/c/<name>`.
