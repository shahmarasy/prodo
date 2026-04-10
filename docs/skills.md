# Skill Engine

Prodo includes a built-in skill engine that wraps pipeline operations as composable, executable units. Skills are pure functions with typed inputs and outputs.

## Built-in Skills

| Skill | Category | Description |
|-------|----------|-------------|
| `normalize` | core | Normalize brief.md into structured JSON |
| `validate` | validation | Run cross-artifact validation |
| `fix` | validation | Auto-regenerate failing artifacts with backup |
| `generate-artifact` | artifact | Generate a single artifact by type |
| `generate-pipeline` | core | Full pipeline: normalize + generate + validate |

## CLI Usage

### List Skills

```bash
prodo skills list
```

Output:
```
Available skills:

  normalize                 [core] Normalize a product brief into structured JSON
  validate                  [validation] Run cross-artifact validation
  fix                       [validation] Auto-regenerate artifacts with backup
  generate-artifact         [artifact] Generate a single artifact
  generate-pipeline         [core] Full pipeline: normalize + generate + validate
```

### Run a Skill

```bash
prodo skills run normalize --input '{"cwd": "."}'
prodo skills run generate-artifact --input '{"cwd": ".", "artifactType": "prd"}'
prodo skills run validate --input '{"cwd": ".", "strict": true}'
```

## Skill Interface

Each skill exports a manifest and an execute function:

```typescript
type Skill = {
  manifest: SkillManifest;
  execute: SkillFunction;
};

type SkillManifest = {
  name: string;
  description: string;
  category: "core" | "artifact" | "validation" | "custom";
  inputs: SkillInput[];
  outputs: SkillOutput[];
};

type SkillFunction = (
  context: SkillContext,
  inputs: Record<string, unknown>
) => Promise<Record<string, unknown>>;
```

## Creating Custom Skills

1. Create a file in `src/skills/`:

```typescript
import type { Skill } from "./types";

export const mySkill: Skill = {
  manifest: {
    name: "my-custom-skill",
    description: "Does something useful",
    category: "custom",
    inputs: [
      { name: "cwd", type: "path", required: true, description: "Working directory" }
    ],
    outputs: [
      { name: "result", type: "string", description: "Operation result" }
    ]
  },
  async execute(context, inputs) {
    context.log("Running my custom skill...");
    return { result: "done" };
  }
};
```

2. Register it in the skill engine (see `src/skills/engine.ts`).

## Input Validation

The skill engine validates required inputs before execution. If a required input is missing, an error is thrown with a descriptive message.
