# Hook System

Prodo supports lifecycle hooks that run before and after each pipeline step. Hooks are configured in `.prodo/hooks.yml`.

## Hook Lifecycle

Available hook points:

| Phase | Trigger |
|-------|---------|
| `before_normalize` | Before brief normalization |
| `after_normalize` | After normalized-brief.json is written |
| `before_prd` | Before PRD generation |
| `after_prd` | After PRD is written |
| `before_workflow` | Before workflow generation |
| `after_workflow` | After workflow files are written |
| `before_wireframe` | Before wireframe generation |
| `after_wireframe` | After wireframe files are written |
| `before_stories` | Before stories generation |
| `after_stories` | After stories are written |
| `before_techspec` | Before techspec generation |
| `after_techspec` | After techspec is written |
| `before_validate` | Before validation |
| `after_validate` | After validation report is written |

## Configuration Format

```yaml
hooks:
  before_prd:
    - command: "node scripts/check-brief.js"
      description: "Verify brief completeness"
      optional: false
      enabled: true
      timeout_ms: 30000
      retry: 2
      retry_delay_ms: 500

  after_validate:
    - command: "node scripts/notify-slack.js"
      description: "Post validation results to Slack"
      optional: true
      prompt: "Post results to Slack?"
```

## Hook Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `command` | string | (required) | Shell command to execute |
| `description` | string | — | Human-readable label |
| `optional` | boolean | `false` | If true, shown as suggestion (not auto-run) |
| `enabled` | boolean | `true` | Set to false to disable |
| `condition` | string | — | Shell command; hook runs only if exit code is 0 |
| `timeout_ms` | number | `30000` | Maximum execution time in milliseconds |
| `retry` | number | `0` | Number of retry attempts on failure |
| `retry_delay_ms` | number | `500` | Delay between retries |
| `prompt` | string | — | Message shown for optional hooks |

## Mandatory vs Optional Hooks

- **Mandatory hooks** (`optional: false`): Run automatically. If they fail, the pipeline aborts.
- **Optional hooks** (`optional: true`): Displayed as a suggestion with the prompt message. The user decides whether to run them manually.

## Conditions

A condition is a shell command that determines whether the hook runs:

```yaml
hooks:
  before_prd:
    - command: "npm run lint"
      condition: "test -f .eslintrc.json"
      description: "Lint only if ESLint is configured"
```

If the condition command exits with code 0, the hook runs. Otherwise, it's skipped.

## Security Notes

- Hook commands run with `shell: false` (no shell injection via command string)
- Commands are parsed into binary + arguments
- Conditions also run as parsed commands
- Timeout prevents runaway processes
