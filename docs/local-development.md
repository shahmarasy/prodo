# Local Development Guide

## Prerequisites

- Node.js 20+
- npm 10+

## Setup

```bash
npm install
npm run build
```

## Fast Feedback Loop

```bash
npm test
```

Layered suites:

- `tests/scaffold.test.cjs`
- `tests/hooks.test.cjs`
- `tests/pipeline.test.cjs`

Run a single suite:

```bash
node --test tests/scaffold.test.cjs
```

## Smoke Run (CLI)

```bash
node dist/cli.js init .
node dist/cli.js normalize
node dist/cli.js prd
node dist/cli.js validate
```

## Release Verification

```bash
npm run verify:release
```

This verifies:

- compiled CLI exists
- scaffold core assets exist
- bundled preset manifests exist
- `init` smoke output is complete (`registry.json`, commands, state index, brief.md, product-docs/)

