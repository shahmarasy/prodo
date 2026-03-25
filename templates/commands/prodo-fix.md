---
description: Fix failing artifacts using latest validation report and brief-aligned regeneration.
agent-role: "Recovery Engineer"
---

## User Input

```text
$ARGUMENTS
```

## Execution Policy

- Execute-first, diagnose-second.
- Do not run shell commands or CLI commands from inside the agent.
- Never invoke `prodo-fix`, `prodo fix`, or any `prodo ...` command in shell.
- Input files are read-only; never modify `brief.md`.
- Write outputs only under `product-docs/` and `.prodo/`.
- Do not print full artifact bodies in chat.

## Execution

1. Minimum prerequisites only:
- `.prodo/` exists
- `brief.md` exists
- `.prodo/briefs/normalized-brief.json` exists (refresh if stale)
- Validation report exists in `product-docs/reports/`

2. Execute fix process immediately:
- Read latest validation report.
- Identify failing artifact types and regenerate only impacted chain.
- Use normalized brief + active templates for regeneration.

3. Verify result:
- Re-run validation.
- Confirm report status is PASS.
- Confirm `brief.md` remained unchanged.

4. Diagnose only on failure:
- Inspect internal hooks/scripts only after fix attempt fails.
- Return concise root cause + next repair action.

## Handoff

If pass: suggest next command `/prodo-validate`.
If fail: suggest highest-priority artifact command to regenerate manually.
