# Visage Prompt Builder

A versioned face-description schema and prompt-compilation toolkit for AI image generation.

The project currently focuses on a model-neutral **Face Schema** plus an initial executable compiler target for **GPT Image 2.5**.

## Quick start

Requires Node.js 18 or newer. There are currently no external npm dependencies.

```bash
git clone https://github.com/palering/visage-prompt-builder.git
cd visage-prompt-builder

npm run prompt -- baselines/example_synthetic_face_001.json
```

The command reads the Face Schema JSON and prints a ready-to-copy natural-language prompt.

To save it:

```bash
npm run prompt -- baselines/example_synthetic_face_001.json --out prompt.txt
```

See [docs/USAGE.md](docs/USAGE.md) for capture presets and programmatic use.

## Current baseline

- Face Schema: `v0.1`
- GPT Image 2.5 Prompt Compiler: `v0.1`
- CLI: `v0.1`
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
├─ src/
│  ├─ cli.mjs
│  └─ compiler/
│     └─ gpt-image-2.5.mjs
├─ test/
│  └─ compiler.test.mjs
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
Render / Calibration Preset
```

The schema stores **what a face is like**. A compiler stores **how a target image model should be told about it**. This separation allows additional model adapters to be added without redesigning the face data model.

## What the project does today

The repository currently compiles Face Schema JSON into prompt text. It does **not** yet call an image-generation API or provide a graphical face editor.

The executable entry point is:

```bash
node src/cli.mjs <profile.json>
```

The compiler itself can also be imported from:

```text
src/compiler/gpt-image-2.5.mjs
```

## Public-repository rule

This repository is intentionally public. Do not commit user reference images, private face profiles derived from identifiable references, API keys, access tokens, private paths, or other sensitive material. Reference-derived profiles should remain local/private unless they have been explicitly cleared for public release.

See `docs/public_repo_safety.md` for the repository policy.

## Status

Early experimental version. Parameter names, mappings, and compiler behavior are expected to evolve as generation tests reveal which controls are reliable, redundant, or coupled.
