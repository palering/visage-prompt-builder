# Usage

Visage Prompt Builder currently generates **prompt text** from a Face Schema JSON profile. It does not call an image-generation API yet.

## 1. Prepare a face profile

Start from:

```text
schemas/face_schema_v0.1.json
```

or use the public synthetic example:

```text
baselines/example_synthetic_face_001.json
```

Edit the JSON values to represent the desired face.

## 2. Compile the profile into a GPT Image 2.5 prompt

Node.js 18 or newer is required. There are currently no external npm dependencies.

```bash
npm run prompt -- baselines/example_synthetic_face_001.json
```

The generated prompt is printed to stdout.

Equivalent direct command:

```bash
node src/cli.mjs baselines/example_synthetic_face_001.json
```

## 3. Save the prompt to a file

```bash
npm run prompt -- baselines/example_synthetic_face_001.json --out prompt.txt
```

## Capture presets

### calibration

Default. Uses a standardized front-facing portrait setup so morphology changes are easier to compare.

```bash
npm run prompt -- baselines/example_synthetic_face_001.json --preset calibration
```

### profile

Uses the `capture` block from the profile when present.

```bash
npm run prompt -- schemas/face_schema_v0.1.json --preset profile
```

### none

Omits the CAPTURE section entirely.

```bash
npm run prompt -- baselines/example_synthetic_face_001.json --preset none
```

## Programmatic use

The compiler can also be imported by a future web UI or another Node.js tool:

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
Copy/send prompt to image model
```

The important boundary is that the Face Schema remains model-neutral. Future model support should normally add another compiler instead of changing the stored face profile.

## Tests

```bash
npm test
```

The initial tests verify that the compiler produces the expected prompt sections, supports capture presets, and rejects unsupported schema versions.
