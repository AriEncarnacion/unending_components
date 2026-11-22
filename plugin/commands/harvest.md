---
description: Promote a component from one of Ari's apps into the Unending catalog, generalized and rebuilt on stock shadcn parts
argument-hint: <path to the component file or folder in the app>
---

Harvest this component into the Unending catalog: $ARGUMENTS

Follow the `unending-authoring` and `unending-flavor` skills.

1. **Read the source thoroughly:** the component, its styles, its types and any tests. Run it if you can (a small harness with synthetic data is fine) so you see its behavior, not only its code. Don't modify the source app.
2. **Generalize it.** Separate the reusable intent from domain specifics. Domain types become generic props, with the app's types as examples in the demo. Behavior that is truly valuable, such as gestures, snapping, keyboard or edge cases, stays. Domain-only logic is dropped or becomes an exported helper.
3. **Restyle it onto stock shadcn.** Map each visual part to the closest stock component and token, and list the mapping in the README's Anatomy table. Anything with no stock equivalent goes under "Not yet decided" for Ari's review. Don't invent custom colors.
4. **Find the catalog checkout**, check it's new, and propose the anatomy and generalized API before coding, as in `/unending:create` steps 1, 2 and 4.
5. **Build, register and verify**, as in `/unending:create` steps 5 and 6. Set `meta.origin` to `Harvested from <app>`.
6. **Report** what changed from the original and why, and suggest how the app could adopt the catalog version later. Don't make that change in the app unless asked.

After verifying, look at each design system in `design-systems/`. Where one clearly calls for it, write an optional tuning proposal for the new entry, as the `unending-authoring` skill describes. Mention any proposals in the report; Ari accepts or rejects them on `/c/<name>`.
