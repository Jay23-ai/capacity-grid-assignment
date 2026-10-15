# Decisions

## What did the spec not tell you?

- I treated weeks as Monday–Sunday, with work counted Monday–Friday. Assignment dates include both ends. Picking part of a week shows the whole week; comparing three days of work with a full week's capacity would be misleading. The UI says this explicitly.
- Weekly hours belong to the person, not to a dated capacity record. Editing them therefore changes every week, including history. The editor explains that before saving. Values from 0 to 168 are allowed, including fractions.
- I wait for the save to succeed, then use the value returned by the API. Allocations haven't changed, so there is no reason to reload them. Every cell and the over-capacity filter derive from the updated limit. Failed saves keep the editor open and preserve what was typed. Old range requests are cancelled and cannot replace newer results.
- I chose 40-person pages over virtualization for this version. It keeps the rendered table bounded without adding a library. The API still returns the whole roster for the selected range, capped at 106 weeks. That is a conscious limit of this implementation.

## What did you notice that looked wrong?

- The seed looks odd at first: tiny fractional hours and many identical assignments with different IDs. I kept them all. Deduplicating them or treating the fractions as days would change the answer.
- In the week of 5 January, Dee has 45 allocated hours against 40 available. Eli has 20 against zero. Both show as over capacity, without dividing by zero. Ana's week crossing New Year totals 40 hours.
- The running API matched a separate day-by-day calculation for all 52,500 cells across 2025–2026. The two-year request took about 0.13 seconds locally on the supplied seed. That is not a claim about production load.

## What did the AI get wrong that you caught?

- The first editor lost keyboard focus when closed with Escape. Using a native dialog wasn't enough: React removed it before the browser restored focus. The browser check caught this. Focus now returns explicitly to the edit button, or to search if the saved change removes that person from the filtered results.
- To be clear about attribution: the implementation, checks and this draft were produced with AI assistance. These are issues found during that process, not a claim that I manually caught them independently.

## What would you do differently with a week?

- Move roster paging and filtering to the server and measure on several thousand people. Add virtualization if the interaction warrants it; client pagination only solves the DOM side.
- Agree on holidays, individual work schedules and dated capacity changes. The current schema cannot represent those.
- Add conflict detection for two managers editing the same person. Today the last successful save wins. Also test keyboard/screen-reader flows more deeply and cover Safari and Firefox. This run checked Chromium on desktop and mobile-sized viewports, including failed saves and retries.
