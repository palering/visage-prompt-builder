import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const node = process.execPath;

test('build prints a prompt to stdout by default', () => {
  const result = spawnSync(
    node,
    ['src/cli.mjs', 'baselines/example_synthetic_face_001.json'],
    { cwd: root, encoding: 'utf8' }
  );

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /FACIAL STRUCTURE/);
  assert.match(result.stdout, /EYES AND EYEBROWS/);
});

test('rebuild --all --dry-run prints a plan without requiring confirmation', () => {
  const result = spawnSync(
    node,
    ['src/rebuild.mjs', '--all', '--dry-run'],
    { cwd: root, encoding: 'utf8' }
  );

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Rebuild plan/);
  assert.match(result.stdout, /targets: 3/);
  assert.match(result.stdout, /example-synthetic-face-001\.calibration/);
  assert.match(result.stdout, /Dry run only/);
});

test('rebuild refuses to run without an explicit selector', () => {
  const result = spawnSync(
    node,
    ['src/rebuild.mjs'],
    { cwd: root, encoding: 'utf8' }
  );

  assert.equal(result.status, 1);
  assert.match(result.stdout, /--all/);
});
