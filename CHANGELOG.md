# Changelog

All notable project changes are recorded here.

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
