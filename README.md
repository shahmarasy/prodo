<div align="center">
  <h1>Prodo</h1>
  <h3><em>Product Artifact Toolkit</em></h3>
</div>

<p align="center">
  <strong>Build consistent product documentation from a stable brief with a CLI-first workflow.</strong>
</p>

---

## Table of Contents

- [What is Prodo?](#what-is-prodo)
- [Install](#install)
- [Quick Start](#quick-start)
- [Core Workflow](#core-workflow)
- [Supported Agents](#supported-agents)
- [CLI Reference](#cli-reference)
- [Output Structure](#output-structure)
- [Validation Model](#validation-model)
- [Development](#development)
- [License](#license)

## What is Prodo?

Prodo is a CLI-first toolkit for product-document pipelines.

It helps teams move from a raw brief to structured artifacts such as:

- PRD
- Workflow (Markdown explanation + Mermaid)
- Wireframe (Markdown explanation + HTML)
- Stories
- Tech Spec

Prodo is designed to keep input stable, outputs deterministic, and cross-artifact consistency measurable.

## Install

```bash
npm i -g @shahmarasy/prodo
```

## Quick Start

```bash
# 1) Initialize in your project
prodo init . --ai codex --lang tr

# 2) Edit brief
# brief.md

# 3) Check environment (optional)
prodo doctor
```

## Core Workflow

After initialization, Prodo installs agent-native command files.

Recommended flow inside your AI agent:

1. Normalize the brief
2. Produce artifacts in sequence
3. Validate consistency

Prodo keeps:

- `brief.md` as input
- `.prodo/` as internal runtime state
- `product-docs/` as user-facing outputs

## Supported Agents

`prodo init --ai <name>` supports:

- `codex`
- `gemini-cli`
- `claude-cli`

Agent command files are installed to native locations:

- Codex: `.agents/skills/`
- Gemini CLI: `.gemini/commands/`
- Claude CLI: `.claude/commands/`

## Agent Commands

Prodo agent command set:

- `/prodo-normalize`
- `/prodo-prd`
- `/prodo-workflow`
- `/prodo-wireframe`
- `/prodo-stories`
- `/prodo-techspec`
- `/prodo-validate`

Codex skills mode equivalents:

- `$prodo-normalize`
- `$prodo-prd`
- `$prodo-workflow`
- `$prodo-wireframe`
- `$prodo-stories`
- `$prodo-techspec`
- `$prodo-validate`

## CLI Reference

Primary commands:

- `prodo init [target] [--ai <name>] [--lang <code>] [--preset <name>]`
- `prodo doctor` (alias: `prodo check`)

Version:

- `prodo --version`
- `prodo -v`

## Output Structure

Project-level:

- `brief.md` (input, read-only during execution)
- `product-docs/` (all generated product documents)
- `.prodo/` (internal runtime state: prompts, schemas, templates, index, context)

Paired artifact behavior:

- Workflow: `*.md` + `*.mmd`
- Wireframe: `*.md` + `*.html`

## Validation Model

Validation reports include gate-based checks:

- Schema pass
- Tag coverage pass
- Contract relevance pass
- Semantic consistency pass

All applicable gates must pass for final success.

## Development

```bash
npm install
npm run build
npm test
npm run verify:release
```

## License

MIT
