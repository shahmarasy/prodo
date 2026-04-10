<div align="center">

# Prodo

**AI-Powered Product Owner for Your Codebase**

Turn a short product brief into a complete documentation suite — PRD, workflows, wireframes, user stories, tech spec — validated for cross-artifact consistency.

[![npm version](https://img.shields.io/npm/v/@shahmarasy/prodo)](https://www.npmjs.com/package/@shahmarasy/prodo)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Tests](https://img.shields.io/badge/tests-99%20passing-brightgreen)]()

</div>

---

## Why Prodo?

| Problem | Prodo's Answer |
|---------|---------------|
| PRDs drift from implementation | **Input is read-only** — `brief.md` never changes during execution |
| Docs contradict each other | **7 validation gates** check cross-artifact consistency |
| Every team reinvents the format | **Strict templates** enforce structure across all artifacts |
| Tied to one AI tool | **Agent-agnostic** — works with Claude, Codex, Gemini, or any LLM |
| Manual doc maintenance | **One command** regenerates everything from the brief |

## Quick Start

```bash
# Install globally
npm i -g @shahmarasy/prodo

# Initialize in your project
prodo init . --ai claude-cli --lang en

# Edit your brief
code brief.md

# Generate everything
prodo generate

# Check environment
prodo doctor
```

**That's it.** Prodo normalizes your brief, generates 5 artifact types, validates them, and writes everything to `product-docs/`.

## What Gets Generated

```
brief.md                          # Your input (read-only)
product-docs/
  prd/                            # Product Requirements Document
  workflows/                      # Flow descriptions + Mermaid diagrams
  wireframes/                     # Screen descriptions + HTML prototypes
  stories/                        # User stories with Gherkin scenarios
  techspec/                       # Architecture, APIs, data models
  reports/                        # Validation report
```

Every artifact includes:
- **Contract tags** (`[G1]`, `[F2]`, `[C1]`) linking back to brief requirements
- **Frontmatter** with version, author, upstream references
- **Companion files** — workflow gets `.mmd` (Mermaid), wireframe gets `.html`

## CLI Reference

### Primary Commands

| Command | Description |
|---------|-------------|
| `prodo init [target]` | Bootstrap project with `.prodo/` scaffold and agent commands |
| `prodo generate` | Full pipeline: normalize → generate all → validate |
| `prodo doctor` | Check environment, SDKs, and agent availability |
| `prodo clean` | Remove generated artifacts, keep brief and config |

### Pipeline Commands

| Command | Description |
|---------|-------------|
| `prodo normalize` | Convert brief.md to structured JSON |
| `prodo prd` | Generate Product Requirements Document |
| `prodo workflow` | Generate workflow (Markdown + Mermaid) |
| `prodo wireframe` | Generate wireframes (Markdown + HTML) |
| `prodo stories` | Generate user stories |
| `prodo techspec` | Generate technical specification |
| `prodo validate` | Run 7-gate cross-artifact validation |
| `prodo fix` | Auto-repair failing artifacts with backup |

### Global Flags

| Flag | Available On | Description |
|------|-------------|-------------|
| `--ai <name>` | `init` | Agent: `codex`, `gemini-cli`, `claude-cli` |
| `--lang <code>` | `init` | Language: `en`, `tr` (extensible) |
| `--agent <name>` | `generate`, `fix` | Override agent profile |
| `--dry-run` | `generate`, `normalize`, `fix`, `clean` | Preview without writing |
| `--strict` | `validate`, `generate`, `fix` | Treat warnings as errors |
| `--interactive` | `normalize` | Q&A loop for low-confidence fields |

## LLM Providers

Prodo supports multiple LLM backends as optional peer dependencies:

```bash
# OpenAI
npm install openai
export PRODO_AGENT=openai OPENAI_API_KEY=sk-...

# Anthropic Claude
npm install @anthropic-ai/sdk
export PRODO_AGENT=anthropic ANTHROPIC_API_KEY=sk-ant-...

# Google Gemini
npm install @google/generative-ai
export PRODO_AGENT=google GOOGLE_API_KEY=AI...
```

Install only the SDK you need. `prodo doctor` shows which agents are available.

> **Full guide:** [docs/providers.md](docs/providers.md)

## Agent Integration

`prodo init --ai <name>` installs native command files for your AI agent:

| Agent | Location | Format | Commands |
|-------|----------|--------|----------|
| Codex | `.agents/skills/` | SKILL.md | `$prodo-normalize`, `$prodo-prd`, ... |
| Gemini CLI | `.gemini/commands/` | TOML | `/prodo-normalize`, `/prodo-prd`, ... |
| Claude CLI | `.claude/commands/` | Markdown | `/prodo-normalize`, `/prodo-prd`, ... |

Agent workflow: edit `brief.md` → run `/prodo-normalize` → `/prodo-prd` → ... → `/prodo-validate`

## Validation Gates

`prodo validate` runs 7 sequential checks:

| # | Gate | Type | What It Checks |
|---|------|------|----------------|
| 1 | **Schema** | Structural | Frontmatter, required headings, content length |
| 2 | **Tag Coverage** | Structural | Contract IDs present in frontmatter |
| 3 | **Contract Relevance** | LLM-based | Tagged content matches contract text |
| 4 | **Semantic Consistency** | LLM-based | No contradictions between artifact pairs |
| 5 | **Terminology** | Heuristic | Consistent naming across documents |
| 6 | **Tracing** | Structural | Every brief requirement referenced in artifacts |
| 7 | **Cross-Reference** | Structural | Inline references point to real sections |

Use `--strict` to promote warnings to errors (recommended for CI).

> **Full guide:** [docs/validation.md](docs/validation.md)

## Human-in-the-Loop Fix

When validation fails:

```bash
prodo fix              # Shows proposal → asks confirmation → backs up → repairs
prodo fix --dry-run    # Preview what would be regenerated
```

The fix command:
1. Runs validation to identify issues
2. Computes affected artifacts + downstream dependencies
3. **Shows a proposal** with issue details
4. **Asks for confirmation** (auto-proceeds in CI)
5. Creates a timestamped backup in `.prodo/state/backups/`
6. Regenerates impacted artifacts with version increment
7. Re-validates to confirm the fix

## Skill Engine

Prodo includes a composable skill system:

```bash
prodo skills list                                    # List all skills
prodo skills run normalize --input '{"cwd": "."}'    # Run a skill
```

Built-in skills: `normalize`, `validate`, `fix`, `generate-artifact`, `generate-pipeline`

> **Full guide:** [docs/skills.md](docs/skills.md)

## Presets

Domain-specific presets enrich generation with industry context:

```bash
prodo init . --preset saas
prodo init . --preset fintech
prodo init . --preset marketplace
```

Presets provide specialized prompt templates, validation rules, and domain vocabulary.

## Internationalization

Prodo supports multiple languages via JSON-based translations:

```bash
prodo init . --lang tr    # Turkish
prodo init . --lang en    # English (default)
```

Language enforcement prevents mixing — Turkish projects are checked for English leaks and vice versa. Add new languages by creating `src/i18n/<code>.json`.

## Project Structure

```
your-project/
  brief.md                    # Your product brief (input)
  product-docs/               # Generated artifacts (output)
  .prodo/
    settings.json             # Language, author, agent config
    hooks.yml                 # Lifecycle hooks
    briefs/                   # Normalized brief JSON
    templates/                # Artifact templates (customizable)
    schemas/                  # Validation schemas
    prompts/                  # LLM prompts
    commands/                 # Agent command templates
    state/                    # Runtime state, backups
```

## Documentation

| Guide | Description |
|-------|-------------|
| [Provider Setup](docs/providers.md) | Configure OpenAI, Anthropic, Google agents |
| [Writing Briefs](docs/writing-briefs.md) | Structure your brief for best results |
| [Validation Gates](docs/validation.md) | Understand all 7 validation checks |
| [Hook System](docs/hooks.md) | Lifecycle hooks with conditions and retries |
| [Skill Engine](docs/skills.md) | Built-in skills and custom development |
| [Local Development](docs/local-development.md) | Dev setup and testing |
| [Upgrade Guide](docs/upgrade.md) | Migrating between versions |

## Development

```bash
git clone https://github.com/shahmarasy/prodo.git
cd prodo
npm install
npm run build
npm test          # 99 tests
```

## Architecture

```
src/
  core/       # Business logic (artifacts, validation, normalization)
  cli/        # Commander entry points and TUI
  agents/     # LLM plugins (OpenAI, Anthropic, Google, Mock)
  skills/     # Composable skill engine
  i18n/       # Translation system (en, tr)
  providers/  # Backward-compatible provider shim
```

## License

MIT &copy; [Shahmarasy](https://github.com/shahmarasy)
