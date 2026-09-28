# Skill / Agent Integration Guide

This document defines the intended integration contract for wrapping Visage Prompt Builder in a future ChatGPT Skill, agent, local automation, or other orchestration layer.

The goal is to keep the integration thin: the Skill should describe user intent, prepare safe input files, and invoke the repository's stable CLI rather than duplicating prompt-compilation logic.

## Integration boundary

Use the CLI as the preferred integration surface:

```text
User / Skill / Agent
        ↓
Face Schema JSON
        ↓
Visage Prompt Builder CLI
        ↓
Natural-language prompt text
```

The model-specific compiler implementation remains inside this repository.

A Skill should normally avoid reimplementing the 0–100 semantic mapping rules itself. Otherwise the Skill and repository can silently drift apart.

## Supported commands

### Build one prompt

Print to stdout:

```bash
npm run build -- <profile.json>
```

With an explicit preset:

```bash
npm run build -- <profile.json> --preset calibration
npm run build -- <profile.json> --preset profile
npm run build -- <profile.json> --preset none
```

Write to a file:

```bash
npm run build -- <profile.json> --out <prompt.txt>
```

Overwrite an existing output file non-interactively:

```bash
npm run build -- <profile.json> --out <prompt.txt> --force
```

For Skill/agent use, stdout is preferred when the caller only needs the generated prompt. File output is preferred when the prompt should become an artifact or be passed to another local step.

### Rebuild snapshots

Rebuild is intentionally explicit and scoped.

```bash
npm run rebuild -- --all
npm run rebuild -- --block <name>
npm run rebuild -- --dir <output-subdir>
npm run rebuild -- --target <target-name>
```

Preview only:

```bash
npm run rebuild -- --all --dry-run
```

Confirmed non-interactive execution:

```bash
npm run rebuild -- --all --yes
```

A Skill should prefer this sequence for destructive/bulk rebuilds:

```text
1. Run --dry-run
2. Present the rebuild scope to the user
3. Obtain explicit confirmation
4. Run the same selector with --yes
```

Do not silently translate a vague request such as "update things" into `rebuild --all --yes`.

## Input contract

The current compiler accepts:

```text
schema_version = face-v0.1
```

Profiles should be UTF-8 JSON.

The canonical public schema template is:

```text
schemas/face_schema_v0.1.json
```

A Skill that infers a profile from an image should keep three concepts separate:

```text
reference observation
      ↓
inferred Face Schema
      ↓
compiled prompt
```

Camera angle, lighting, beauty filters, hair occlusion, and makeup should not be mistaken for bone structure.

## Output contract

A successful single build emits UTF-8 natural-language prompt text.

When no `--out` flag is supplied:

- generated prompt goes to stdout,
- no prompt file is created.

When `--out` is supplied:

- generated prompt is written to the specified file,
- the CLI prints a short completion message.

Rebuild outputs are configured through:

```text
presets/rebuild_targets.json
```

and are written beneath:

```text
output/
```

## Exit behavior

The CLI follows conventional process status behavior:

- `0`: successful build/rebuild, dry run, help, or user-cancelled interactive confirmation.
- non-zero: invalid arguments, unsupported schema/preset/compiler, unsafe path, missing input, parse failure, or confirmation required in a non-interactive environment.

A wrapper should treat stderr/non-zero status as an execution failure and surface the message rather than guessing a replacement action.

## Determinism and versioning

Within a fixed repository revision, the compiler is intended to be deterministic:

```text
same Face Schema
+ same compiler version
+ same preset
= same prompt text
```

Generated snapshots under `output/` make semantic compiler changes visible in Git diffs.

When a Skill needs reproducible output, record at least:

- Face Schema version,
- compiler target,
- preset,
- repository commit or release version.

## Recommended Skill actions

A future Skill can expose a small action set without leaking repository internals.

### compile_face_prompt

Intent:

```text
Compile one Face Schema profile into prompt text.
```

Maps to:

```bash
npm run build -- <profile> [--preset <preset>]
```

Preferred return value: stdout prompt text.

### save_face_prompt

Intent:

```text
Compile one Face Schema profile and save the generated prompt as an artifact.
```

Maps to:

```bash
npm run build -- <profile> --out <file>
```

If the file already exists, the Skill should ask before overwriting or deliberately use a unique output path.

### plan_rebuild

Intent:

```text
Show what a bulk rebuild would change.
```

Maps to:

```bash
npm run rebuild -- <selector> --dry-run
```

### execute_rebuild

Intent:

```text
Execute an already-reviewed rebuild plan.
```

Maps to:

```bash
npm run rebuild -- <same-selector> --yes
```

The Skill should not broaden the selector between planning and execution.

## Public repository safety

This repository is public.

A Skill or agent must not automatically add any of the following to committed rebuild targets or tracked output:

- user-supplied/private reference images,
- private face profiles,
- face profiles derived from identifiable private references unless explicitly cleared,
- API keys, access tokens, cookies, or credentials,
- personal names or source metadata that are unnecessary for the compiler,
- absolute local paths,
- private model-provider configuration.

Important: excluding the source image is not enough. A generated prompt or Face Schema derived from a private identifiable reference may itself contain information the user did not intend to publish.

Public rebuild targets should therefore use synthetic or explicitly cleared profiles only.

## Skill-friendly repository workflow

A future repository-maintenance Skill can use this sequence:

```text
modify schema/compiler
      ↓
npm test
      ↓
npm run rebuild -- --all --dry-run
      ↓
review scope
      ↓
user confirms
      ↓
npm run rebuild -- --all --yes
      ↓
inspect Git diff
      ↓
commit
```

The Skill should inspect the diff for public-repository safety before committing.

## Future integration work

The following are useful future additions but are not yet implemented:

- `validate` command for schema-only validation,
- machine-readable JSON output from build/rebuild,
- compiler registry for multiple image models,
- explicit compiler/schema compatibility metadata,
- generated manifest for snapshot provenance,
- stable JSON diagnostics for Skill/agent error handling.

Until those exist, integrations should rely only on the documented CLI behavior above.
