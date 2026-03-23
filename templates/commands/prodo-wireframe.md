---
description: Generate wireframe artifacts.
---

## User Input

```text
$ARGUMENTS
```

Execution policy:
- Execute-first, diagnose-second.
- Do not run shell/CLI commands from inside the agent.
- Never run `prodo-wireframe`, `prodo wireframe`, or `prodo ...` in shell.
- Input files are read-only; never modify or rewrite `brief.md`.
- Never print full artifact JSON/Markdown in chat.
- Write outputs to files, then reply with short status + written file path(s).

## Execution

1. Verify minimal prerequisites (`.prodo/`, `brief.md`, normalized brief).
2. Use normalized brief + latest PRD/workflow and apply wireframe templates (`.prodo/templates/wireframe.md` and `.prodo/templates/wireframe.html`).
3. Confirm paired outputs exist under `product-docs/wireframes/` (`.md` + `.html`).
4. Confirm `brief.md` content did not change.
5. Do not create manual fallback files under `.prodo/`.
6. Diagnose internals only if command fails.
