# Changelog

All notable changes to Prodo are documented in this file.

This project follows Semantic Versioning.

## [0.1.4] - 2026-03-25

### Added
- `prodo init` now captures `author` in both CLI and interactive TUI flows and stores it in `.prodo/settings.json`.
- `prodo fix` was added as an advanced repair command for validation-driven regeneration.

### Changed
- Generated artifact filenames now use a clean publish-friendly pattern such as `prd-20260325-013939.md`.
- Workflow generation can now produce multiple paired outputs (`.md` + `.mmd`) when the brief requires more than one flow.
- Wireframe generation is more willing to create multiple screens when the product scope requires them.
- Artifact generation now applies the configured author consistently in frontmatter and template placeholders.
- Init scaffolding now derives schema heading requirements from the actual installed templates instead of stale defaults.

### Fixed
- Turkish normalization now preserves original Unicode characters instead of transliterating them to ASCII.
- Schema heading validation no longer silently weakens itself for Turkish projects.
- `fix` revisions now create a new artifact version instead of overwriting the previous output.
- Document Control defaults are now filled automatically during generation and fix flows.
- Fix revisions now increment document versions automatically (`v1.1`, `v1.2`, `v1.3`, ...).

## [0.1.3] - 2026-03-24

### Changed
- Refined command and skill execution policies to make agent behavior more direct and action-oriented.
- Improved command output handling guidance so agent flows feel less like wrapped prompts.
- Tightened template and command wording across normalize, PRD, workflow, wireframe, stories, techspec, and validate flows.

## [0.1.2] - 2026-03-24

### Added
- Stronger language consistency checks across artifact generation and validation.

### Changed
- Tightened execution-policy documentation and command templates for more deterministic agent behavior.
- Improved CLI, init, and artifact generation rules around language-aware output handling.

## [0.1.1] - 2026-03-24

### Added
- Expanded brief, normalization, and PRD template coverage.
- Improved workflow and wireframe template structure.
- Strengthened native command installation for Codex, Gemini CLI, and Claude CLI environments.

### Changed
- Improved CLI and generation flow around template resolution and output paths.
- Expanded scaffold and pipeline test coverage.

## [0.1.0] - 2026-03-24

### Added
- Initial public release of Prodo CLI.
- Project scaffold flow with `prodo init` and `.prodo/` workspace setup.
- Brief normalization and artifact generation pipeline.
- Initial artifact set: PRD, workflow, wireframe, stories, techspec, and validation.
- Base prompts, templates, schemas, and test coverage.
