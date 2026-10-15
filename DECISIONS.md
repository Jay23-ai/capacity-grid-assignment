# Decisions

## What did the spec not tell you?

- Weeks run Monday–Sunday and only Monday–Friday counts. A sensible default for planning, not a universal truth - people do work weekends. The spec didn't define a work calendar, so I picked one and said so in the UI rather than quietly invent a scheduling model. Assignment dates are inclusive.
- `weekly_hours` lives on the person with no effective date, so changing it rewrites every week, including the past. Consistent for this task, but as a product I wouldn't want "part-time from next Monday" to rewrite last year. The editor warns about it.
- After a save I take the value the server confirmed and swap that one person's limit. Allocations didn't change, so refetching the whole range buys nothing - every cell, the over-capacity count and the filter derive from the new limit. It's not optimistic; I wait for the response. If a save ever changed allocations as a side effect, I'd refetch.
- Also unspecified: partial weeks (expanded to full weeks), whether the end date counts (it does), valid hours (0–168), and whether we edit a person's standing limit or a single week (standing - the schema has nothing else). Small things, each one changes the numbers.

## What did you notice that looked wrong?

- `hours_per_day = 0.5` next to a dozen identical rows looks suspicious. They have different IDs and the data is fixed input, so I have no grounds to drop them - and I'm not turning half an hour into half a day because it fits a nicer result. Summed, they come out sensible (Ana: 14 × 0.5 + 1.0 = 8 h/day, 40 h/week).
- Eli has 0 hours of capacity and work assigned. Deliberate edge case or not, zero capacity doesn't make the work disappear: it shows as over capacity, without dividing by zero.
- Plenty of assignments start or end on a weekend; with the Monday–Friday rule those days don't count.
- "Saved" proves nothing on its own, so after an edit I looked at every week, the over-capacity count and the filter. The API was also cross-checked against a separate day-by-day SQL count for 2024–2026 - no differences.

## What did the AI get wrong that you caught?

- I asked the AI to help me prepare this file by asking me questions and working from my answers. Instead, it went ahead and replaced the file with its own version. I caught that and told it to stick to the approach I’d asked for.
- Smaller one: the first version of the editor lost keyboard focus after Escape. Visually fine, but focus landed on the page instead of the button you came from. Now it returns to that button, or to search if the person drops out of the filtered list.

## What would you do differently with a week?

- Server-side paging and filtering. The brief talks about thousands of people and two years; paging in the browser keeps the DOM small, but I still download the whole roster. That isn't solving scale.
- Edit conflicts: two managers change the same person and the last save silently wins. That can make a real mess.
- Keep the current weeks on screen while the next range loads instead of blanking the grid, and validate the date range in the UI before the API rejects it.
- Safari and Firefox testing. Holidays, individual schedules and capacity history need product rules first - I'd rather not spend the week quickly coding the wrong assumptions.

I came down with the flu while doing this, so it is what it is.