# Usage

Visage Prompt Builder compiles **Face Schema JSON** into natural-language prompt text. It currently does not call an image-generation API.

There are two primary commands:

- `build`: compile one profile.
- `rebuild`: regenerate configured output snapshots in bulk.

## Build one prompt

### Print directly to stdout

```bash
npm run build -- baselines/example_synthetic_face_001.json
```

This is the default build behavior. Nothing is written to disk.

### Write to a file

```bash
npm run build -- baselines/example_synthetic_face_001.json --out prompt.txt
```

Parent directories are created automatically.

If the output file already exists, the CLI asks for confirmation before overwriting it.

For non-interactive use or when an overwrite is intentional:

```bash
npm run build -- baselines/example_synthetic_face_001.json --out prompt.txt --force
```

### Choose a capture preset

```bash
npm run build -- baselines/example_synthetic_face_001.json --preset calibration
npm run build -- baselines/example_synthetic_face_001.json --preset profile
npm run build -- baselines/example_synthetic_face_001.json --preset none
```

- `calibration`: standardized front-facing portrait setup. This is the default.
- `profile`: use the profile's `capture` block when available.
- `none`: omit the CAPTURE section.

The older `npm run prompt -- ...` command remains as a compatibility alias for `build`.

## Rebuild generated snapshots

Rebuild targets are declared in:

```text
presets/rebuild_targets.json
```

Generated snapshots are written under:

```text
output/
```

The repository intentionally tracks these public-safe generated files so changes to the schema/compiler can be reviewed as Git diffs.

A rebuild always requires **one explicit selector**. Running `rebuild` with no selector does nothing.

### Rebuild everything

```bash
npm run rebuild -- --all
```

### Rebuild one logical block

```bash
npm run rebuild -- --block gpt-image-2.5
```

Blocks are named groups in `presets/rebuild_targets.json`.

### Rebuild one output subdirectory

```bash
npm run rebuild -- --dir gpt-image-2.5
```

`--dir` is relative to `output/`. Path traversal outside `output/` is rejected.

### Rebuild one target

```bash
npm run rebuild -- --target example-synthetic-face-001.calibration
```

A single-target rebuild overwrites only that target file and does not remove its containing directory.

## Rebuild safety

Before changing files, `rebuild` prints:

- the selector,
- the cleanup scope,
- every output that will be generated,
- the total target count.

Then it asks:

```text
Proceed with rebuilding N target(s)? [y/N]
```

The default answer is **No**.

### Dry run

Preview the exact plan without deleting or writing anything:

```bash
npm run rebuild -- --all --dry-run
```

This is recommended before larger compiler/schema changes.

### Skip confirmation

For CI or a deliberate non-interactive rebuild:

```bash
npm run rebuild -- --all --yes
```

Without a TTY, a real rebuild fails unless `--yes` is supplied.

## Cleanup behavior

The selector also controls what is cleaned before generation:

| Selector | Cleanup |
| --- | --- |
| `--all` | configured block output directories |
| `--block <name>` | that block's output directory |
| `--dir <subdir>` | that output-relative subdirectory |
| `--target <name>` | no directory deletion; target file only |

This keeps narrow rebuilds narrow while still removing stale files during broader rebuilds.

## Rebuild configuration

The initial configuration looks like:

```json
{
  "output_root": "output",
  "blocks": {
    "gpt-image-2.5": {
      "output_dir": "gpt-image-2.5",
      "targets": [
        {
          "name": "example-synthetic-face-001.calibration",
          "input": "baselines/example_synthetic_face_001.json",
          "compiler": "gpt-image-2.5",
          "preset": "calibration",
          "output": "example_synthetic_face_001.calibration.txt"
        }
      ]
    }
  }
}
```

Because this repository is public, only public-safe or synthetic inputs should be added to this file.

## Programmatic use

```js
import fs from 'node:fs';
import { compileFacePrompt } from './src/compiler/gpt-image-2.5.mjs';

const profile = JSON.parse(
  fs.readFileSync('./baselines/example_synthetic_face_001.json', 'utf8')
);

const prompt = compileFacePrompt(profile, {
  preset: 'calibration'
});

console.log(prompt);
```

## Current data flow

```text
Face Schema JSON
      ↓
GPT Image 2.5 compiler
      ↓
Natural-language prompt
      ↓
stdout / explicit output file / tracked rebuild snapshot
```

## Tests

```bash
npm test
```

Tests cover compiler output, capture presets, build stdout behavior, rebuild planning, and explicit-selector safety.
