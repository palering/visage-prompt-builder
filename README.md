# Visage Prompt Builder

A versioned face-description schema and prompt-compilation toolkit for AI image generation.

The project currently focuses on a model-neutral **Face Schema** plus an executable compiler target for **GPT Image 2.5**.

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

Build one prompt into a file:

```bash
npm run build -- baselines/example_synthetic_face_001.json --out prompt.txt
```

Rebuild all configured output snapshots:

```bash
npm run rebuild -- --all
```

Before writing anything, `rebuild` prints its plan and asks for confirmation. Use `--dry-run` to inspect the plan only, or `--yes` for non-interactive/CI use.

See [docs/USAGE.md](docs/USAGE.md) for the complete command reference.

## Current baseline

- Face Schema: `v0.1`
- GPT Image 2.5 Prompt Compiler: `v0.1`
- Build CLI: `v0.2`
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

## Public-repository rule

This repository is intentionally public. Do not commit user reference images, private face profiles derived from identifiable references, API keys, access tokens, private paths, or other sensitive material. Public rebuild targets must use public-safe/synthetic input profiles.

See `docs/public_repo_safety.md` for the repository policy.

## Status

Early experimental version. Parameter names, mappings, and compiler behavior are expected to evolve as generation tests reveal which controls are reliable, redundant, or coupled.
