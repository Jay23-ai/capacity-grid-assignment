# Worklog

Running notes on how this got built — decisions, assumptions, dead ends, and anything
left unfinished. Append as you go; a line or two per entry is right.

---

- Scope: capacity only. Treat assignments as inclusive dates on Monday–Friday; selected dates expand to full Monday–Sunday weeks. A partial week should not silently compare a partial allocation with full capacity.
- Seed inspection: 500 people, 12 projects, 126,195 assignments. Many records have identical values but separate IDs. Sum them all; do not deduplicate or reinterpret fractional hours as days. Eli has zero capacity and assigned work.
- API aggregates only overlapping assignments, then fills all person/week combinations. Response stores the week list once and allocations as aligned arrays. Range limited to 106 weeks; weekly hours accept 0–168, including fractions.
- UI uses 40-person pages to bound DOM size, with search and an over-capacity filter. Fetching still returns the full roster for the chosen range; server-side paging/virtualization is deferred, not claimed as solved.
- Saves are pessimistic: keep the form and entered value on failure; on success patch weeklyHours from the server response. Allocation does not depend on capacity, so all week cells and the over-capacity count derive from the updated person. Navigation requests are aborted and guarded against late responses.
- Verification: frontend tests cover failed save/retry, all-week updates, late range responses, fetch failure/retry, filtering after save, zero capacity and calendar boundaries. Go tests cover bad input, seed totals, saving 0/47.5/168 hours, persistence, missing people and empty periods. Integration tests restore the edited value.
- Independent check: parsed the fixed seed and summed Decimal hours one working day at a time, separately from the SQL formula. All 52,500 cells (500 people × 105 weeks) matched the 2025–2026 API response. One local request took 0.133 s and returned 151,560 bytes; this is seed-scale evidence, not a production benchmark.
- Browser QA: the Codex browser backend could not connect (no IAB backend discovered, including after opening the preview). Used bundled Playwright Chromium instead. Checked 1440×1000 and 390×844, actual save + reload + restore, injected 503 save failure and retry, week navigation, search, empty results, over-capacity filtering, paging, and load failure/retry. No page runtime exceptions. Screenshots are outside the repository in /tmp/capacity-*.png.
- Caught during verification: the first browser test matched every edit button when asking for “Hours per week”; narrowed it to the exact input label. The first range test also assumed whitespace in a header's accessible name; corrected the assertion rather than changing working UI to fit the test.
- Review fix: reused Intl formatters instead of constructing one per cell, added a client read timeout, and close the native dialog on cleanup so focus can return to the triggering control. No production dependency was added.
- Additional browser check found an actual keyboard issue: Escape closed the editor but focus fell back to body. Native dialog cleanup alone did not restore focus after React unmounted it. Added explicit focus restoration after the editor closes, with search as the fallback when the edited row disappears from the filter; covered both save paths in regression tests.
- Final range/keyboard browser pass: custom dates rendered 105 weeks with 41 DOM rows (header + 40 people), ready in roughly 0.4 s locally. Escape returns focus to the original button. At 390 px the page stays within the viewport and the table scrolls horizontally. Fresh-page console had no warnings/errors. Final Vitest and production build pass.
