## v0.12.0 — scoped bilingual prompt workbench

- Add subject text presets plus direct custom input without anatomical inference or changed locks
- Dismiss copy success after 2.5 seconds, restart the timer on repeat, preserve honest errors and ignore stale asynchronous completion
- Split global reroll from current-tab reroll; enabled body participates globally, no disabled body/axis is enabled; all scopes preserve ranges/locks and group undo
- Keep legacy no-options sampler behavior, persist the new scope in provenance, and isolate unrelated tab conflicts
- Add true local Chinese compilation for owned templates, geometry/body descriptions and all appearance catalog phrasing; custom text remains original
- Add full or selected-module combinations, optional neutral/seeded-random/white-clay support context, explicit empty output, and separately persisted output settings
- Preserve full English compilation, the card/light/dark shell, reference images and draggable divider; no image API or external network dependency
- Add Chinese guide and future human-parameter taxonomy plan; retain explicit browser-rendering verification blocker

## v0.11.0 — Layered card themes and local character workspace

- Preserve the v0.10 compiler, sampling, constraints, import/export and CLI contracts
- Add light/dark translucent layered cards, four-zone layout, responsive inspector tabs and vendored Feather icons
- Add bounded keyboard/pointer preview divider with persisted theme/layout preferences
- Add independent character drafts, immutable version snapshots and explicit browser-local workspace persistence
- Add local-only static reference import with source/stale labels, clear empty states and asynchronous switching guards
- Add atomic workspace prevalidation and source/offline event regressions
- Real-browser visual QA is blocked by the missing supported preview service; no deployment or image-generation integration

## v0.10.0 — Fixed controls and constrained workbench randomization

- Versioned workbench-v0.2 and constraints-v0.1 with strict ranges, candidate lists, body scope and backward-compatible imports
- Exact identity text and presence-aware section/field locks; manual editing remains available while locked
- Stable selected numeric presets, atomic conflicts, whole-group skip for pinned correlated controls, no-op preservation and undo
- Explicit opt-in body reroll, appearance candidate pools and legacy appearance projection guards
- Separate applied/changed/skipped provenance without overwriting original sample metadata; shared Node/browser logic
- Extended regression and DOM event tests; no real-browser visual verification or image/3D preview claim

# v0.9.0 — Offline workbench and adult body-v0.1

- Added 17 opt-in body controls separating frame, muscle volume, and surface/soft-tissue targets
- Added explicit head/full-body capture and adult-only validation; body off preserves legacy compiler output
- Added shared-core offline Chinese workbench, guarded JSON import/export and browser-local saves
- Added deterministic browser SHA-256 adapter and reproducibility/compatibility tests
- Historical sample snapshots remain unchanged

## v0.8.0 — Complete-head composition and bounded brow/nose sampling

- Add 27-state omitted/off/selected layer regressions; preserve semantics and add true hair-only inheritance example
- Compiler v0.3 retains explicit neutral controls, removes stacked fullness wording, and skips exact unspecified sentinels without discarding resolved metadata or meaningful none controls
- Suppress empty formatted paragraphs when a selected module resolves only to unspecified values
- New archetypes-v0.2 catalog adds 5 brow and 9 nose axes with conservative authored ranges and region-local correlations; sampler algorithm and earlier field draws remain unchanged
- Preserve old catalog and sampled-range lineage; historical records remain unmodified and unconfigured reroll regions still fail
- Record compiler version and a matching complete dependency hash for sampling and iteration
- Add a reproducible complete-head sample and Chinese usage/rationale/limits guide; archive historical prompt bytes rather than claiming new-compiler exact prose replay
- 106 tests passing; independent 300-seed compatibility and isolated-reroll checks pass

## v0.7.0 — source-grounded hair expansion

- Preserve 51 presets and add 13 structural recipes/variants, with 42 text-only evidence records
- Add exact alias resolution, canonical/requested metadata and ambiguity validation
- Keep character identities and historical uncertainties in provenance; exclude copyrighted thumbnails and accessory-only museum objects from hair presets
- Add reproducible anime/historical prompt fixtures using the same adult East Asian base and full-hairstyle framing
- Preserve 87 existing tests and add 5 regression tests (92 passing)

## v0.6.0 — Pluggable head appearance

- Add optional appearance-v0.1 sidecar: hair, structured makeup, adult apparent age and expression; preserve base face schema and morphology sampling
- Explicit omitted/off/selected semantics; selected modules replace matching legacy blocks; calibration conflicts reject
- Add labeled 51-hair / 21-makeup representative catalog, source metadata, qualitative occlusion, impact/warning metadata and research notes
- Carry full appearance options/resolution/hash into sampling, batches and immutable iterations; compare compiler-option changes as well as profile fields
- Reject sample manifest provenance conflicting with hashed profile metadata; preserve previous workflow tests
- Add module isolation, validation, source coverage, adult bounds, capture, precedence, override, aliasing, round-trip and CLI tests
- Include fixed-base module comparison prompts and defer further face tuning explicitly

# Changelog

## Unreleased — package / iterative CLI v0.5

- Add deterministic bounded candidate batches, saved-profile region rerolls, explicit typed manual edits, and comparisons
- Preserve every unselected profile field and missing field, compiler options, immutable parent snapshots and sidecar lineage
- Reject unknown paths, overlapping operations, incomplete correlation groups and unsupported region ranges
- Add immutable output directories, complete replay metadata, synthetic workflows and Chinese quickstart
- Preserve v0.3/v0.4 compiler/capture/enhancer behavior; no image API, public push or deployment

## Unreleased — package / sampling CLI v0.4

- Add versioned archetype catalog and deterministic bounded correlated sampling over shared morphology families
- Separate appearance and fictional character presentation with explicit conflict detection
- Emit replayable face-v0.2 profiles, profile/enhancers prompts and provenance manifests
- Preserve calibration behavior and existing v0.3 work; protect paired outputs using a dedicated-directory transaction
- Add sampling, safety, round-trip and across-seed tests plus Chinese design/usage documentation

## Unreleased — package / build CLI v0.3, compiler v0.2

- Replace exhaustive repetitive paragraphs with concise standalone prompt text; preserve explicit neutral controls and omit missing morphology
- Make profile styling opt-in with `--enhancers`; reject conflicts with calibration
- Support explicitly versioned Face Schema v0.2 regional cheek volume and contour fields while retaining v0.1
- Validate supplied controls and options without numeric coercion; report field paths
- Compile supplied profile capture angles and rendering settings
- Compile all rebuild targets before destructive cleanup to protect snapshots on invalid input
- Add synthetic regression coverage and regenerate public-safe snapshots
- Document intentional text-format/default-styling changes and migration; no image model API calls or likeness validation


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
