---
description: Normalize product brief.
---

## User Input

```text
$ARGUMENTS
```

Execution policy:
- Execute-first, diagnose-second.
- Do not run shell/CLI commands from inside the agent.
- Never run `prodo-normalize`, `prodo normalize`, or `prodo ...` in shell.
- Input files are read-only; never modify or rewrite `brief.md`.
- Never print full normalized JSON in chat.
- Write `.prodo/briefs/normalized-brief.json`, then reply with short status + file path.

## Execution

1. Verify minimal prerequisites (`.prodo/`, `brief.md`).
2. Read only `brief.md` and normalize it into `.prodo/briefs/normalized-brief.json`.
3. Confirm `.prodo/briefs/normalized-brief.json` exists.
4. Verify normalized file is strict JSON only:
   - first non-space char is `{`
   - no markdown fences like ```json or ```
   - JSON parses successfully as an object
5. If format is not strict JSON, rewrite the same file as pure JSON object only.
6. Confirm `brief.md` content did not change.
7. Do not create any manual files under `.prodo/` except expected runtime outputs.
8. Diagnose internals only if command fails.
