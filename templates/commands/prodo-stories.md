---
description: Generate user stories artifact.
run:
  action: stories
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
2. Execute stories generation process with provided arguments.
3. Confirm stories output was created.
4. Diagnose internals only if command fails.
