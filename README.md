# Visage Prompt Builder

A versioned face-description schema and prompt-compilation toolkit for AI image generation.

The project currently focuses on a model-neutral **Face Schema** plus an initial compiler target for **GPT Image 2.5**.

## Current baseline

- Face Schema: `v0.1`
- GPT Image 2.5 Prompt Compiler: `v0.1`
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
├─ docs/
│  ├─ face_schema_spec_v0.1.md
│  └─ public_repo_safety.md
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
Render / Calibration Preset
```

The schema stores **what a face is like**. A compiler stores **how a target image model should be told about it**. This separation allows additional model adapters to be added without redesigning the face data model.

## Public-repository rule

This repository is intentionally public. Do not commit user reference images, private face profiles derived from identifiable references, API keys, access tokens, private paths, or other sensitive material. Reference-derived profiles should remain local/private unless they have been explicitly cleared for public release.

See `docs/public_repo_safety.md` for the repository policy.

## Status

Early experimental version. Parameter names, mappings, and compiler behavior are expected to evolve as generation tests reveal which controls are reliable, redundant, or coupled.
