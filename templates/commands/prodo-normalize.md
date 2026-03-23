---
description: Normalize product brief.
run:
  action: normalize
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

1. Verify minimal prerequisites (`.prodo/`, `brief.md`).
2. Execute normalization process with provided arguments.
3. Confirm `.prodo/briefs/normalized-brief.json` exists.
4. Diagnose internals only if command fails.
