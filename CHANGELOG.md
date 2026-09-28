# Changelog

All notable project changes are recorded here.

## [0.2.1] - 2026-09-28

### Documentation

- Added a Skill / agent integration guide defining the CLI integration boundary.
- Documented build/rebuild invocation patterns, exit behavior, deterministic-output expectations, and version metadata.
- Added recommended Skill actions for compile, save, rebuild planning, and confirmed rebuild execution.
- Documented public-repository safety requirements for future Skill/agent automation.

## [0.2.0] - 2026-09-28

### Added

- `npm run build -- <profile>` as the primary single-profile build command.
- Safe output-file overwrite confirmation for `build --out`.
- `--force` for deliberate/non-interactive build overwrites.
- Bulk `rebuild` command with `--all`, `--block`, `--dir`, and `--target` selectors.
- Rebuild plan preview and interactive confirmation before destructive changes.
- `--dry-run` and `--yes` rebuild safety modes.
- Declarative rebuild target configuration under `presets/rebuild_targets.json`.
- Tracked generated prompt snapshots under `output/`.
- CLI/rebuild smoke tests.

### Changed

- `prompt` remains available as a compatibility alias for `build`.
- README and usage documentation now describe the complete build/rebuild workflow.

### Safety

- Rebuild path validation prevents configured output cleanup from escaping the repository's `output/` root.
- Public rebuild targets use only the synthetic baseline profile.

## [0.1.1] - 2026-09-28

### Added

- Executable Node.js CLI for compiling Face Schema JSON into GPT Image 2.5 prompt text.
- Importable `compileFacePrompt()` compiler module.
- `calibration`, `profile`, and `none` capture presets.
- `--out` support for saving generated prompts.
- Usage documentation.
- Initial compiler tests using Node's built-in test runner.

### Changed

- README now includes a runnable quick-start flow.

## [0.1.0] - 2026-09-28

### Added

- Initial model-neutral Face Schema v0.1.
- Initial GPT Image 2.5 prompt compiler specification.
- Face Calibration Preset v0.1.
- Synthetic example face profile.
- Public-repository safety policy and ignore rules.

### Privacy / repository hygiene

- User-supplied reference images are not included.
- Face profiles derived from identifiable reference images are not included by default.
- Public examples should be synthetic or explicitly cleared for publication.
