---
description: Generate workflow artifacts.
---

## User Input

```text
$ARGUMENTS
```

Execution policy:
- Execute-first, diagnose-second.
- Do not run shell/CLI commands from inside the agent.
- Input files are read-only; never modify or rewrite `brief.md`.

## Execution

1. Verify minimal prerequisites (`.prodo/`, `brief.md`, normalized brief).
2. Use normalized brief + latest PRD and apply workflow templates (`.prodo/templates/workflow.md` and `.prodo/templates/workflow.mmd`).
3. Confirm paired outputs exist under `product-docs/workflows/` (`.md` + `.mmd`).
4. Confirm `brief.md` content did not change.
5. Do not create manual fallback files under `.prodo/`.
6. Diagnose internals only if command fails.
