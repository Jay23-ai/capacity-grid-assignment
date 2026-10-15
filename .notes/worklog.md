# Worklog

Running notes on how this got built — decisions, assumptions, dead ends, and anything
left unfinished. Append as you go; a line or two per entry is right.

---

- Scope: capacity only. Treat assignments as inclusive dates on Monday–Friday; selected dates expand to full Monday–Sunday weeks. A partial week should not silently compare a partial allocation with full capacity.
- Seed inspection: 500 people, 12 projects, 126,195 assignments. Many records have identical values but separate IDs. Sum them all; do not deduplicate or reinterpret fractional hours as days. Eli has zero capacity and assigned work.
- API aggregates only overlapping assignments, then fills all person/week combinations. Response stores the week list once and allocations as aligned arrays. Range limited to 106 weeks; weekly hours accept 0–168, including fractions.
- UI uses 40-person pages to bound DOM size, with search and an over-capacity filter. Fetching still returns the full roster for the chosen range; server-side paging/virtualization is deferred, not claimed as solved.
- Saves are pessimistic: keep the form and entered value on failure; on success patch weeklyHours from the server response. Allocation does not depend on capacity, so all week cells and the over-capacity count derive from the updated person. Navigation requests are aborted and guarded against late responses.
