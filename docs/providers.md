# LLM Provider Setup

Prodo supports multiple LLM providers via a plugin-based agent system. Each agent is an optional peer dependency — install only what you need.

## Available Agents

| Agent | SDK Package | Env Variable | Default Model |
|-------|------------|--------------|---------------|
| OpenAI | `openai` | `OPENAI_API_KEY` | `gpt-4o-mini` |
| Anthropic Claude | `@anthropic-ai/sdk` | `ANTHROPIC_API_KEY` | `claude-sonnet-4-20250514` |
| Google Gemini | `@google/generative-ai` | `GOOGLE_API_KEY` | `gemini-2.0-flash` |
| Mock (testing) | (built-in) | (none) | n/a |

## Quick Setup

### OpenAI

```bash
npm install openai
export OPENAI_API_KEY=sk-...
export PRODO_AGENT=openai
```

Optional overrides:
- `PRODO_OPENAI_MODEL` — default: `gpt-4o-mini`
- `PRODO_OPENAI_BASE_URL` — default: `https://api.openai.com/v1` (useful for Azure OpenAI or local proxies)

### Anthropic Claude

```bash
npm install @anthropic-ai/sdk
export ANTHROPIC_API_KEY=sk-ant-...
export PRODO_AGENT=anthropic
```

Optional: `PRODO_ANTHROPIC_MODEL` — default: `claude-sonnet-4-20250514`

### Google Gemini

```bash
npm install @google/generative-ai
export GOOGLE_API_KEY=AI...
export PRODO_AGENT=google
```

Optional: `PRODO_GOOGLE_MODEL` — default: `gemini-2.0-flash`

## Agent Selection

Prodo resolves which agent to use in this order:

1. `PRODO_AGENT` environment variable (preferred)
2. `PRODO_LLM_PROVIDER` environment variable (backward compat)
3. `.prodo/settings.json` `ai` field
4. In test mode (`NODE_ENV=test`): falls back to `mock`

## Checking Agent Status

```bash
prodo doctor
```

The doctor command shows which SDKs are installed and which API keys are set.

## Agent Aliases

| Alias | Resolves To |
|-------|-------------|
| `claude` | `anthropic` |
| `gemini` | `google` |
| `mock` | `mock` |
| `openai` | `openai` |

## Error Messages

If an agent is not available, Prodo shows a helpful message:

```
Agent "anthropic" is not available.
  SDK required: npm install @anthropic-ai/sdk
  Set environment variable: ANTHROPIC_API_KEY
```
