import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { compileFacePrompt } from '../src/compiler/gpt-image-2.5.mjs';

const profile = JSON.parse(
  fs.readFileSync(new URL('../baselines/example_synthetic_face_001.json', import.meta.url), 'utf8')
);

test('compiles a Face Schema v0.1 profile into a structured prompt', () => {
  const prompt = compileFacePrompt(profile, { preset: 'calibration' });
  assert.match(prompt, /FACIAL STRUCTURE/);
  assert.match(prompt, /EYES AND EYEBROWS/);
  assert.match(prompt, /NOSE/);
  assert.match(prompt, /CAPTURE/);
  assert.match(prompt, /moderately narrow/);
});

test('none preset omits the capture block', () => {
  const prompt = compileFacePrompt(profile, { preset: 'none' });
  assert.doesNotMatch(prompt, /\nCAPTURE\n/);
});

test('rejects unsupported schema versions', () => {
  assert.throws(
    () => compileFacePrompt({ ...profile, schema_version: 'face-v9.9' }),
    /Unsupported schema_version/
  );
});
