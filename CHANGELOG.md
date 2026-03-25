# Changelog

All notable changes to this project are documented in this file.

Format is inspired by [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and follows Semantic Versioning.

## [Unreleased]

### Added
- `prodo init` now captures `author` (interactive + `--author`) and stores it in `.prodo/settings.json`.
- New advanced command: `prodo fix` (agent alias: `prodo-fix`) to regenerate impacted artifacts after validation failures.
- New command template: `.prodo/commands/prodo-fix.md`.

### Changed
- Artifact generation now uses configured `author` in frontmatter and template placeholders (prevents random author names).
- `init` now aligns schema `x_required_headings` with real scaffolded templates.
- Workflow generation now supports multiple workflow pairs (`.md` + `.mmd`) when multiple flow needs are detected.
- Wireframe screen selection logic improved to generate multiple screens when required by coverage/feature set.
- Agent command sets now include `prodo-fix` in recommended sequence and shortcuts.

### Fixed
- Turkish normalization no longer transliterates characters (e.g. `Yonetim` -> `Yönetim` is preserved from source brief).
- Normalize prompt/provider guidance now explicitly enforces Unicode preservation for Turkish characters.
- Schema heading validation no longer silently skips Turkish mode.

## [0.1.3] - 2026-03-24

### Changed
- Refined command/skill execution policies to be more action-oriented.
- Improved output handling guidance in command templates.
- Updated template and command text consistency across normalize/prd/workflow/wireframe/stories/techspec/validate flows.

## [0.1.2] - 2026-03-24

### Added
- Stronger language consistency checks in artifact generation and validation flows.

### Changed
- Execution policy docs and command templates were tightened for safer and more deterministic agent behavior.
- CLI/init/artifact internals were updated to better enforce language-aware output contracts.

## [0.1.1] - 2026-03-24

### Added
- Product brief, normalize, and PRD template coverage was expanded.
- Workflow and wireframe template structures were improved.
- Dynamic command installation for agent environments (Codex/Gemini/Claude) was strengthened.

### Changed
- CLI and generation flow updated to better resolve templates and artifact paths.
- Test coverage expanded for scaffold and pipeline behavior.

## [0.1.0] - 2026-03-24

### Added
- Initial public release of Prodo CLI.
- Core scaffold workflow (`prodo init`) with `.prodo/` workspace setup.
- Brief normalization (`prodo normalize`) and artifact generation pipeline.
- Initial artifact commands: PRD, workflow, wireframe, stories, techspec, validate.
- Base templates, prompts, schemas, and initial test suite.
