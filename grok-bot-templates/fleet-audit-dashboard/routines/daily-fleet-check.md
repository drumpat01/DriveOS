# Daily fleet check

**Who runs it:** Fleet Auditor
**When:** Every day at {{CHECK_TIME}}
**Stays silent when:** Every routine that should have run in the last day ran and has proof.

## Prompt

Check {{FLEET_NAME}}'s routines for the last 24 hours. Use the Fleet audit skill, steps 1 and 2 only.

If every routine that should have run did, with proof, say nothing.

If any routine is `missed`, `failed`, `silent-failure` or `no-proof`, update the routine statuses in {{SHARED}}audits/fleet-audit.json, refresh {{SHARED}}audits/fleet-audit-dashboard.html, and send {{CHIEF}} one message listing each problem routine, its status and the evidence. Don't change any bot or routine.
