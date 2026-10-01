# Visage Prompt Builder

## v0.12 stable backup · image-free

This branch is an image-free publication copy of the frozen v0.12 source checkpoint `fe604692cc677a7626c4518082069836443adeb6`, not a byte-for-byte copy of the full original release. The generated demo PNG and its embedded web payload are omitted. The workbench starts with an empty preview and accepts a local reference image; parameter editing, compilation and local reference handling are retained. The original full release archive is preserved separately. No v0.13 changes are included.

Build the offline file locally with `npm run build:web`, then open `dist/visage-workbench.html`. Generated `dist/` output is not included in this source backup. See [image-free backup notes](docs/IMAGE-FREE-BACKUP-v0.12.md).

A versioned face-description schema and prompt-compilation toolkit for AI image generation.

The project currently focuses on a model-neutral **Face Schema** plus an executable compiler target for **GPT Image 2.5** (a project target label, not a verified API model name).

## Scoped bilingual workbench (v0.12)

The offline workbench adds common subject presets with unrestricted custom text, transient copy feedback, separate global/current-tab rerolls, real English/Chinese compilation, and selected-module output with optional neutral, seeded-random or white-clay display context. Full English keeps the legacy compiler output. Output settings do not change character parameters, exact locks or the character seed. Global reroll now includes enabled body axes; legacy API calls still honor their saved body opt-in. See the [Chinese v0.12 guide](docs/WORKBENCH-v0.12.zh-CN.md) and [human-parameter architecture plan](docs/PARAMETER-ARCHITECTURE.zh-CN.md). Browser-rendered design QA remains blocked; tests are not a visual pass.

## Layered card workbench (v0.11)

The local-only workbench now has light/dark card themes, a draggable and keyboard-accessible reference/prompt divider, independent character drafts and version snapshots, and explicitly static reference images. All v0.10 parameter/constraint behavior is retained. Open `dist/visage-workbench.html`; see the [Chinese v0.11 guide](docs/WORKBENCH-v0.11.zh-CN.md). Browser-rendered design QA remains blocked in the implementation environment; automated tests are not a visual pass.

## Fixed controls and bounded randomization (v0.10)

The offline workbench now separates exact locks from random ranges/candidate pools, preserves authored identity text, and exposes mixed region locks. Body reroll is explicitly opt-in; appearance only changes within user-defined pools. Conflicts cancel atomically and pinned correlation groups are skipped transparently. Existing CLI sampling/iteration contracts remain unchanged. See [Chinese v0.10 guide](docs/WORKBENCH-v0.10.zh-CN.md).

## Offline head + body workbench (v0.9)

Open `dist/visage-workbench.html` directly: local-only Chinese controls for head, appearance and 17 independent adult body axes, with live compiled prompt, saved configurations and JSON import/export. No server or image API required. Rebuild with `npm run build:web`. See [Chinese workbench guide](docs/WORKBENCH-v0.9.zh-CN.md).

## Complete-head composition and bounded feature sampling (v0.8)

New samples include five eyebrow and nine nose controls from authored, region-local ranges. Omitted appearance modules inherit the matching legacy layer; explicit `off` suppresses that layer. See [Chinese v0.8 review guide](docs/HEAD-PIPELINE-v0.8.zh-CN.md). Historical sample files are preserved; recompiling under a newer compiler can change prose.

```bash
npm run sample -- --archetype beautiful,elegant --seed demo --appearance examples/appearance/hair-inherit.json --out-dir samples/head-demo
```

## Optional head appearance modules (v0.7)

64 hair presets/variants with exact aliases and 42 source references; see [Chinese v0.7 integration and generation guide](docs/HAIR-SOURCES-v0.7.zh-CN.md).

Hair, regional makeup, adult apparent age and visible expressions live in a separate opt-in configuration. Baseline face parameters stay unchanged; visual identity or geometry preservation is not guaranteed. The representative catalog distinguishes generic authored geometry from source-grounded techniques, dated trends and scoped historical references.

```bash
npm run appearance -- --list
npm run build -- examples/appearance/base-profile.json --preset profile --appearance examples/appearance/hair-only.json
```

See [Chinese module design, usage, limits and deferred face backlog](docs/HEAD-APPEARANCE.zh-CN.md), [hair research](docs/research/HAIR-RESEARCH.zh-CN.md) and [makeup research](docs/research/MAKEUP-RESEARCH.zh-CN.md).

## Coherent archetype sampling (v0.4)

```bash
npm run sample -- --archetype beautiful,elegant --seed demo --out-dir samples/elegant
npm run sample -- --archetype sinister --seed demo --out-dir samples/sinister
```

A versioned, bounded sampler separates shared morphology families, appearance and fictional character presentation. Same seed preserves morphology across directions; output includes profile JSON, compiled prompt and reproducibility metadata. Ranges are authored artistic hypotheses, not universal beauty metrics or personality inference. See [Chinese design and usage](docs/ARCHETYPE_SAMPLING.zh-CN.md).

## Quick start

Requires Node.js 18 or newer. There are currently no external npm dependencies.

```bash
git clone https://github.com/palering/visage-prompt-builder.git
cd visage-prompt-builder
```

Build one prompt and print it directly:

```bash
npm run build -- baselines/example_synthetic_face_001.json
```

Default output is concise, structure-first and uses neutral calibration capture. Supplied neutral controls are retained; missing morphology is not invented. Add optional appearance without changing structure:

```bash
npm run build -- baselines/example_synthetic_face_001.json --preset profile --enhancers
```

For optional regional cheek volume and contour controls, use a `face-v0.2` profile. The old `face-v0.1` input remains supported.

Build one prompt into a file:

```bash
npm run build -- baselines/example_synthetic_face_001.json --out prompt.txt
```

Rebuild all configured output snapshots:

```bash
npm run rebuild -- --all
```

Before writing anything, `rebuild` prints its plan and asks for confirmation. Use `--dry-run` to inspect the plan only, or `--yes` for non-interactive/CI use.

Documentation:

- [Usage and command reference](docs/USAGE.md)
- [Skill / agent integration](docs/SKILL_INTEGRATION.md)
- [Face Schema v0.2 and migration](docs/face_schema_spec_v0.2.md)
- [Compiler v0.3 contract](compilers/gpt-image-2.5/prompt_compiler_v0.3.md)
- [Face Schema v0.1 specification](docs/face_schema_spec_v0.1.md)
- [Public repository safety](docs/public_repo_safety.md)

## Current baseline

- Face Schema: `v0.2` (v0.1 profiles remain supported)
- GPT Image 2.5 Prompt Compiler: `v0.3`
- Build CLI: `v0.3`
- Rebuild CLI: `v0.1`
- Calibration Preset: `v0.1`

## Repository structure

```text
visage-prompt-builder/
├─ schemas/
│  └─ face_schema_v0.1.json
├─ baselines/
│  └─ example_synthetic_face_001.json
├─ compilers/
│  └─ gpt-image-2.5/
│     └─ prompt_compiler_v0.1.md
├─ presets/
│  └─ rebuild_targets.json
├─ output/
│  └─ gpt-image-2.5/
│     ├─ example_synthetic_face_001.calibration.txt
│     ├─ example_synthetic_face_001.profile.txt
│     └─ example_synthetic_face_001.none.txt
├─ src/
│  ├─ cli.mjs
│  ├─ rebuild.mjs
│  ├─ lib/
│  │  └─ confirm.mjs
│  └─ compiler/
│     └─ gpt-image-2.5.mjs
├─ test/
│  ├─ compiler.test.mjs
│  └─ cli.test.mjs
├─ docs/
│  ├─ USAGE.md
│  ├─ SKILL_INTEGRATION.md
│  ├─ face_schema_spec_v0.1.md
│  └─ public_repo_safety.md
├─ package.json
├─ CHANGELOG.md
└─ .gitignore
```

## Architecture

```text
Reference Image
      ↓
Observation Layer
      ↓
Face Schema / Face DNA
      ↓
Model-specific Prompt Compiler
      ↓
Natural-language Prompt
      ↓
Output Snapshot / Image Model
```

The schema stores **what a face is like**. A compiler stores **how a target image model should be told about it**. This separation allows additional model adapters to be added without redesigning the face data model.

The tracked `output/` snapshots make compiler changes reviewable with ordinary Git diffs.

## Integration principle

For external tools, Skills, and agents, prefer the documented CLI as the integration boundary. This keeps schema-to-prompt behavior centralized in the repository and prevents wrappers from drifting away from compiler semantics.

See [docs/SKILL_INTEGRATION.md](docs/SKILL_INTEGRATION.md).

## Public-repository rule

This repository is intentionally public. Do not commit user reference images, private face profiles derived from identifiable references, API keys, access tokens, private paths, or other sensitive material. Public rebuild targets must use public-safe/synthetic input profiles.

See `docs/public_repo_safety.md` for the repository policy.

## Status

Early experimental version. Parameter names, mappings, and compiler behavior are expected to evolve as generation tests reveal which controls are reliable, redundant, or coupled.

## Batch and local iteration (v0.5)

Generate 3–4 candidates with `npm run batch`, select a saved profile, reroll configured complete regions or use validated `--set` edits with `npm run iterate`, and inspect `npm run compare`. New version directories never overwrite history. See [Chinese quickstart](docs/ITERATIVE_SAMPLING.zh-CN.md). This is a parameter/prompt CLI, not image generation or an identity-preserving image editor.
