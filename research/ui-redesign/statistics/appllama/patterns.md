# Statistics synthesis

## What the benchmark apps consistently do

- Keep the time-range control at the top.
- Lead with one primary result and its trend instead of six equally dominant cards.
- Present supporting totals compactly.
- Treat calendars and deeper charts as explicit modes or drill-downs.
- Group related analysis instead of rendering every chart in one continuous feed.
- Keep records and recent activity concise.
- Give empty states a small honest explanation rather than an oversized blank chart.
- Maintain enough bottom clearance that persistent navigation never covers content.

## JourneyDeck implementation

- `Overview` leads with total miles and the selected period's daily trend.
- Five supporting KPIs use compact two-column cards.
- `Days` owns the calendar, selected-day totals, and journey drill-down.
- `Insights` owns distributions, departure rhythm, distance/duration, music, averages, records, and activity split.
- Selecting a day in the overview trend opens that date in `Days`.
- Atlas and Year on the Road remain available but follow primary data on iPhone.
- iPad retains the full dashboard layout.
- Compact scroll content reserves space for the floating tab bar.

