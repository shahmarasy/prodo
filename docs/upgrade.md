# Upgrade Guide

## Goal

Refresh an existing project scaffold safely after upgrading Prodo.

## Recommended Flow

1. Upgrade package version.
2. Run:

```bash
prodo init .
```

3. Review:
   - `.prodo/scaffold-manifest.json` parity summary
   - `.prodo/registry.json` installed presets/overrides
4. Run:

```bash
prodo validate
```

## Non-Destructive Behavior

`init` refresh logic uses file hashes:

- `match`: local file already equals core asset
- `updated`: core changed and local file was not edited
- `protected`: local edits detected, file is preserved
- `missing`: file was absent and restored
- `unmanaged`: local file not tracked in prior manifest

## Preset/Pack Notes

- Presets are loaded from `prodo.config.json` (`presets` array).
- Command packs are loaded from `prodo.config.json` (`command_packs` array).
- Installed preset state is persisted in `.prodo/presets/installed.json` and reflected in `.prodo/registry.json`.

## Troubleshooting

- Invalid `prodo.config.json`: fix JSON syntax and rerun `prodo init .`
- Preset compatibility error: adjust preset manifest `min_prodo_version` / `max_prodo_version`
- Missing command pack: ensure `command-packs/<name>/` exists

