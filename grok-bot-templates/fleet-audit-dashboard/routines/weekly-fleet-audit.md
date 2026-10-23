# Weekly fleet audit

**Who runs it:** Fleet Auditor
**When:** Every {{AUDIT_DAY}} at {{AUDIT_TIME}}
**Stays silent when:** Never. This one always reports, in one message.

## Prompt

Run the weekly fleet audit of {{FLEET_NAME}} for the last seven days. Use the Fleet audit skill.

Check every bot and every routine. Give each routine one status with evidence. Look for silent failures, missed runs, "done" with no proof, overlap, waste and drift. Count the fleet's runs a day and compare them with {{RUN_BUDGET}}.

Save {{SHARED}}audits/fleet-audit.json, update {{SHARED}}audits/fleet-audit-dashboard.html with the new data, and save the written report as {{SHARED}}audits/fleet-audit-(date).md.

Send {{CHIEF}} one message: how many findings, the top one, and the file names. Don't change any bot or routine. List any change you recommend as a question for {{OWNER}}.
