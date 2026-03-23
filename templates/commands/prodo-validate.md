---
description: Validate artifact set.
run:
  action: validate
  mode: internal-runtime
---

## User Input

```text
$ARGUMENTS
```

Execution policy:
- Execute-first, diagnose-second.
- Use Prodo internal runtime process; do not invoke CLI or shell scripts.
- Input files are read-only; never modify or rewrite `brief.md`.

## Execution

1. Verify minimal prerequisites (`.prodo/`, `brief.md`, normalized brief).
2. Execute validation process with provided arguments.
3. Confirm validation report exists and status is clear.
4. Diagnose internals only if command fails.
