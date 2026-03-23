---
description: Generate technical specification artifact.
---

## User Input

```text
$ARGUMENTS
```

Execution policy:
- Execute-first, diagnose-second.
- Do not run shell/CLI commands from inside the agent.`n- Never run `prodo-techspec`, `prodo techspec`, or `prodo ...` in shell.
- Input files are read-only; never modify or rewrite `brief.md`.

## Execution

1. Verify minimal prerequisites (`.prodo/`, `brief.md`, normalized brief).
2. Use normalized brief + latest upstream artifacts and apply techspec template from `.prodo/templates/techspec.md`.
3. Confirm techspec output was created under `product-docs/techspec/`.
4. Confirm `brief.md` content did not change.
5. Do not create manual fallback files under `.prodo/`.
6. Diagnose internals only if command fails.
