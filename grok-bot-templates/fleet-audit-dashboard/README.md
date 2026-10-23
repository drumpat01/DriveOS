# Fleet Audit Dashboard

A Grok Bot template for anyone running a team of bots. One read-only bot, Fleet Auditor, checks every bot's routines each week, finds the silent failures, missed runs and "done" claims with no proof, and keeps a one-page dashboard of the whole fleet that opens in any browser.

It's built on the Auditor role from the Grok Bot Team Kit, packaged as a single bot with its own skills, routines and dashboard.

## What's in the folder

| File | What it is |
|---|---|
| README.md | This page: what it is, setup and the placeholders |
| bot.md | The bot: name, description to paste in, suggested routines and the first message |
| skills/fleet-audit/SKILL.md | How to run the audit, and the data format the dashboard reads |
| skills/proof-before-done/SKILL.md | Bonus skill: nothing counts as done without evidence |
| routines/weekly-fleet-audit.md | The weekly audit, with its prompt and schedule |
| routines/daily-fleet-check.md | A quiet daily check that only speaks up when a routine failed or didn't run |
| dashboard/fleet-audit-dashboard.html | The dashboard page. One file, works offline, makes no internet requests |
| dashboard/fleet-audit.schema.json | The audit data format, as a JSON Schema |
| dashboard/sample-fleet-audit.json | Made-up sample data, already loaded into the dashboard page |
| LICENSE.md | Personal and team use |

## What the dashboard shows

- Bots, routines and total runs a day, against your run budget.
- How many routines have problems, and how many findings by severity.
- The top three things to fix first.
- Every routine with its schedule, last run, status and evidence.
- Every finding with where it is, the evidence, the recommended fix and the runs a day it saves.

Open dashboard/fleet-audit-dashboard.html to see it with the sample data. The bot saves its own copy in your shared folder with real data inside. You can also open any fleet-audit.json with the "Open another audit file" button, or drop the file on the page.

## Set it up (about 10 minutes)

1. **Add the bot.** Make a new Grok Bot, or add it from the template link. Paste the part of bot.md below the line as its description.
2. **Fill in the placeholders.** Replace them yourself, or let the bot ask you for each one in its first chat.
3. **Add the skills.** Save skills/fleet-audit/SKILL.md as a skill named "Fleet audit" and skills/proof-before-done/SKILL.md as "Proof before Done".
4. **Give it something to read.** It needs to see your other bots' descriptions and routines. Where it can't read a bot's run history, it asks that bot. Connect your task board read-only if you keep one.
5. **Run the first audit by hand.** Send the first message from bot.md. Check the findings make sense and the dashboard file opens.
6. **Turn on the routines when you trust it.** Start with the weekly audit. Add the daily check later.

## Placeholders

| Placeholder | What to put | Example |
|---|---|---|
| {{OWNER}} | Your name | Alex |
| {{FLEET_NAME}} | What you call your team of bots | Acme Notes bots |
| {{CHIEF}} | The bot that gets reports (your chief of staff), or your own name if you don't have one | Harbor |
| {{SHARED}} | The shared folder all your bots can read, ending in / | team/ |
| {{TIMEZONE}} | Your time zone | America/Chicago |
| {{RUN_BUDGET}} | Most routine runs a day you want across the fleet, or "no budget" | 40 runs a day |
| {{AUDIT_DAY}} | Day for the weekly audit | Monday |
| {{AUDIT_TIME}} | Time for the weekly audit; odd minutes help | 9:07 AM |
| {{CHECK_TIME}} | Time for the daily check | 6:13 PM |

## Safety limits built in

Fleet Auditor is read-only. It never edits another bot, pauses or deletes a routine, deletes a file or sends anything outside your team. Every change it recommends comes to you as a question.

It never copies a password, key or token into a report or the dashboard. If it finds one in a bot's description or a log, it says where without repeating it.

This folder holds no keys, tokens, account names or links to anyone's accounts. The sample data is made up.

## Publishing

The template is ready to publish once the Grok Bot template issue that blocks publishing is fixed. Nothing here needs to change for that.

## Testing it (for reviewers)

- Open dashboard/fleet-audit-dashboard.html in a browser, at phone width and desktop width, in light and dark mode. It should show the sample fleet: 4 bots, 8 routines, 49.1 runs a day over a budget of 40, 3 routines with problems and 5 findings.
- Open dashboard/sample-fleet-audit.json with the button. Then try a file with a mistake in it (for example, change a status to "great"). The page should list what's wrong instead of drawing the dashboard.
- `node --test --import tsx server/tests/grok-bot-templates.test.ts` from the repository root checks that the folder is complete, holds no secrets and makes no outside requests, and that the sample data is valid.
