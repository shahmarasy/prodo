# Validation Gates

Prodo runs multi-gate validation to ensure cross-artifact consistency. Run with `prodo validate` or as part of `prodo generate`.

## Gate Overview

| Gate | Check Type | Source | Severity |
|------|-----------|--------|----------|
| Schema | Structure + headings | AJV JSON Schema | error |
| Tag Coverage | Contract ID presence | Frontmatter inspection | error |
| Contract Relevance | Semantic tag matching | LLM-based | error |
| Semantic Consistency | Cross-artifact contradictions | LLM-based | error |
| Terminology | Term naming consistency | Levenshtein + stem matching | warning |
| Tracing | Requirement completeness | Contract ID scan | warning |
| Cross-Reference | Inline reference validity | Regex + section lookup | warning |

## Schema Gate

Validates each artifact against its JSON schema (`.prodo/schemas/{type}.yaml`):

- Required frontmatter fields: `artifact_type`, `version`, `source_brief`, `generated_at`, `status`
- Required headings from templates (e.g., PRD must have `## Problem`, `## Goals`, `## Scope`, `## Requirements`)
- Minimum content length per heading (20 characters)
- Placeholder detection (flags `TBD`, `N/A`, `TODO` as weak content)
- Companion file validation: workflow requires `.mmd`, wireframe requires `.html`

## Tag Coverage Gate

Verifies each artifact's frontmatter includes required contract IDs:

- PRD: must cover `goals` and `core_features`
- Workflow: must cover `core_features`
- Wireframe: must cover `core_features`
- Stories: must cover `core_features`
- Techspec: must cover `core_features` and `constraints`

Contract IDs follow the pattern: `G1`, `G2` (goals), `F1`, `F2` (features), `C1`, `C2` (constraints).

## Contract Relevance Gate (LLM)

For each tagged line (e.g., `[F1] User can upload files`), the LLM verifies:
- Does the tagged content semantically match the contract text?
- Returns `{ relevant: boolean, score: number }`
- Fails if `relevant === false`

## Semantic Consistency Gate (LLM)

Compares paired artifacts for contradictions:
- PRD vs Stories
- Workflow vs Techspec
- Workflow vs Wireframe

The LLM checks for conflicting requirements (e.g., "guest checkout" in workflow but "auth required" in techspec).

## Terminology Gate

Detects inconsistent naming across documents:
- Builds a term map from brief + all artifacts
- Extracts terms from headings, bold text, and contract texts
- Flags similar terms (Levenshtein distance < 25%) used in different documents
- Example: "user" in PRD but "customer" in stories

## Tracing Gate

Ensures every brief requirement is referenced in at least one artifact:
- Scans for `[G1]`, `[F1]`, `[C1]` tags across all artifact bodies
- Flags untraced contracts as warnings
- Checks goals appear in PRD specifically

## Cross-Reference Gate

Validates inline cross-references:
- Detects patterns like "see PRD section X", "as defined in workflow"
- Verifies the referenced artifact exists
- Verifies the referenced section heading exists

## Report Format

Validation reports are written to `product-docs/reports/latest-validation.md`:

```markdown
# Prodo Validation Report
Status: **PASS** or **FAIL**

## Gate Results
- Schema pass: PASS/FAIL
- Tag coverage pass: PASS/FAIL
- Contract relevance pass: PASS/FAIL
- Semantic consistency pass: PASS/FAIL

## Findings
- [ERROR] missing_contract_coverage [tag_coverage]: ...
- [WARNING] untraced_requirement [tracing]: ...
```

## Strict Mode

With `--strict`, all warnings are promoted to errors. Useful for CI pipelines:

```bash
prodo validate --strict
```
