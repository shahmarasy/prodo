---
description: Generate PRD artifact.
---

## User Input

```text
$ARGUMENTS
```

Execution policy:
- Execute-first, diagnose-second.
- Do not run shell/CLI commands from inside the agent.`n- Never run `prodo-prd`, `prodo prd`, or `prodo ...` in shell.
- Input files are read-only; never modify or rewrite `brief.md`.

## Execution

1. Verify minimal prerequisites (`.prodo/`, `brief.md`, normalized brief).
2. Read `.prodo/briefs/normalized-brief.json` and apply PRD template from `.prodo/templates/prd.md`.
3. Confirm PRD output was created under `product-docs/prd/`.
4. Confirm `brief.md` content did not change.
5. Do not create manual fallback files under `.prodo/`.
6. Diagnose internals only if command fails.
