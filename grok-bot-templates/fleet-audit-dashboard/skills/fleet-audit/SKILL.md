---
name: Fleet audit
description: >-
  Use when asked to audit the bot fleet, check the bots' routines, or update
  the fleet-audit dashboard.
---
# Steps

1. **List the fleet.** For every bot: its name, its role in a few words, and each routine with its schedule. Turn each schedule into runs a day (every hour from 8 AM to 10 PM is 15; weekly is 0.14).
2. **Check each routine's last run.** Give it exactly one status:
   - `ok`: it ran when it should and there's proof it did its job.
   - `silent-failure`: it ran but didn't do its job (empty output, wrong file, posted nothing, error swallowed).
   - `missed`: it should have run and didn't.
   - `failed`: it ran and reported an error.
   - `no-proof`: it says done, but there's no evidence.
   - `paused`: turned off on purpose.
   - `unverified`: you couldn't check it. Say why in the evidence.
3. **Look across the fleet.** Two routines doing the same job (overlap). A routine that runs far more often than its results change (waste). A bot whose description no longer matches what it does (drift).
4. **Write findings.** One per problem, each with a severity:
   - `high`: something {{OWNER}} relies on isn't happening, or a credential is exposed.
   - `medium`: wasted runs, overlap, or unproven claims that could hide a failure.
   - `low`: tidy-ups.
   Add the evidence and one recommended fix. For a cut or merge, add `runsSavedPerDay`.
5. **Pick the top three** finding ids to fix first, worst first.
6. **Save the data** as {{SHARED}}audits/fleet-audit.json in the format below, and check it before you save: every routine has a status, every finding has evidence and a fix, and every id in `topThree` is a real finding.
7. **Update the dashboard.** Copy dashboard/fleet-audit-dashboard.html to {{SHARED}}audits/ and replace everything inside its `<script type="application/json" id="fleet-data">` block with the new JSON. Change nothing else in the file. If any text in the JSON contains `</`, write it as `<\/` so the page still opens. Open the saved page and check that its "Updated" time matches this audit.
8. **Report** to {{CHIEF}} in one message: how many findings, the top one, and the file names.

# Data format

```json
{
  "schemaVersion": 1,
  "fleet": "{{FLEET_NAME}}",
  "generatedAt": "2026-10-22T09:07:00-05:00",
  "period": { "from": "2026-10-15", "to": "2026-10-22" },
  "runBudgetPerDay": 60,
  "bots": [
    {
      "id": "site-ops",
      "name": "Site ops bot",
      "role": "Keeps the website healthy",
      "routines": [
        {
          "id": "weekly-site-audit",
          "name": "Weekly site audit",
          "schedule": "Mondays 9:07 AM",
          "runsPerDay": 0.14,
          "lastRun": "2026-10-20T09:07:00-05:00",
          "status": "ok",
          "evidence": "audits/site-audit-2026-10-20.md saved, 4 findings"
        }
      ]
    }
  ],
  "findings": [
    {
      "id": "F1",
      "severity": "high",
      "kind": "silent-failure",
      "bot": "site-ops",
      "routine": "weekly-site-audit",
      "summary": "What is wrong, in one sentence",
      "evidence": "The log line, file or link that shows it",
      "fix": "The one change you recommend",
      "runsSavedPerDay": 0
    }
  ],
  "topThree": ["F1"]
}
```

- `kind` is one of `silent-failure`, `missed-run`, `no-proof`, `overlap`, `waste`, `drift`, `exposed-credential`.
- `bot` and `routine` use the ids from `bots`. Leave `routine` out when the finding is about the whole bot.
- `lastRun` is `null` if the routine never ran.
- `runBudgetPerDay` is `null` if {{OWNER}} hasn't set {{RUN_BUDGET}}.
- Never put a password, key or token anywhere in this file.
