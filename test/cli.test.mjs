import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

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
  assert.match(result.stdout, /Oval face shape/);
  assert.match(result.stdout, /eye size/);
});

test('rebuild --all --dry-run prints a plan without requiring confirmation', () => {
  const result = spawnSync(
    node,
    ['src/rebuild.mjs', '--all', '--dry-run'],
    { cwd: root, encoding: 'utf8' }
  );

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Rebuild plan/);
  assert.match(result.stdout, /targets: 4/);
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

for (const args of [
  ['--preset', 'unknown'], ['--enhancers'], ['--unknown']
]) {
  test(`invalid build options fail without stdout: ${args.join(' ')}`, () => {
    const result = spawnSync(node, ['src/cli.mjs', 'baselines/example_synthetic_face_001.json', ...args], { cwd: root, encoding: 'utf8' });
    assert.equal(result.status, 1);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, /Build failed:/);
  });
}

test('enhancers flag compiles optional styling with profile capture', () => {
  const result = spawnSync(node, ['src/cli.mjs', 'baselines/example_synthetic_face_001.json', '--preset', 'profile', '--enhancers'], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /muted rose lip color/);
});

test('invalid profiles cannot overwrite an existing output, even with force', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'visage-test-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const input = path.join(dir, 'input.json');
  const output = path.join(dir, 'output.txt');
  fs.writeFileSync(input, JSON.stringify({ schema_version: 'face-v0.1', eyes: { eye_size: 'bad' } }));
  fs.writeFileSync(output, 'original');
  const result = spawnSync(node, ['src/cli.mjs', input, '--out', output, '--force'], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /eyes.eye_size/);
  assert.equal(fs.readFileSync(output, 'utf8'), 'original');
});

test('existing output requires confirmation or explicit force', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'visage-test-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const output = path.join(dir, 'output.txt');
  fs.writeFileSync(output, 'original');
  const args = ['src/cli.mjs', 'baselines/example_synthetic_face_001.json', '--out', output];
  const denied = spawnSync(node, args, { cwd: root, encoding: 'utf8' });
  assert.equal(denied.status, 1);
  assert.match(denied.stderr, /--force/);
  assert.equal(fs.readFileSync(output, 'utf8'), 'original');
  const forced = spawnSync(node, [...args, '--force'], { cwd: root, encoding: 'utf8' });
  assert.equal(forced.status, 0, forced.stderr);
  assert.match(fs.readFileSync(output, 'utf8'), /realistic portrait/);
});

function sandboxRepo(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'visage-rebuild-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  for (const item of ['src', 'schemas', 'presets', 'baselines', 'output', 'package.json']) fs.cpSync(path.join(root, item), path.join(dir, item), { recursive: true });
  return dir;
}

test('a bad later rebuild target preserves all existing output before cleanup', (t) => {
  const dir = sandboxRepo(t);
  const configPath = path.join(dir, 'presets/rebuild_targets.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  config.blocks['gpt-image-2.5'].targets[2].preset = 'typo';
  fs.writeFileSync(configPath, JSON.stringify(config));
  const sentinel = path.join(dir, 'output/gpt-image-2.5/existing.txt');
  fs.writeFileSync(sentinel, 'keep me');
  const result = spawnSync(node, ['src/rebuild.mjs', '--all', '--yes'], { cwd: dir, encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Unknown preset/);
  assert.equal(fs.readFileSync(sentinel, 'utf8'), 'keep me');
});

test('target rebuild supports enhancers and leaves siblings untouched', (t) => {
  const dir = sandboxRepo(t);
  const configPath = path.join(dir, 'presets/rebuild_targets.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  config.blocks['gpt-image-2.5'].targets[1].enhancers = true;
  fs.writeFileSync(configPath, JSON.stringify(config));
  const sentinel = path.join(dir, 'output/gpt-image-2.5/existing.txt');
  fs.writeFileSync(sentinel, 'keep me');
  const result = spawnSync(node, ['src/rebuild.mjs', '--target', 'example-synthetic-face-001.profile', '--yes'], { cwd: dir, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.readFileSync(sentinel, 'utf8'), 'keep me');
  const built = fs.readFileSync(path.join(dir, 'output/gpt-image-2.5/example_synthetic_face_001.profile.txt'), 'utf8');
  const direct = spawnSync(node, ['src/cli.mjs', 'baselines/example_synthetic_face_001.json', '--preset', 'profile', '--enhancers'], { cwd: dir, encoding: 'utf8' });
  assert.equal(built, direct.stdout);
});

test('dry-run leaves selected files untouched; dir rebuild keeps outside files', (t) => {
  const dir = sandboxRepo(t);
  const sentinel = path.join(dir, 'output/outside.txt');
  const inside = path.join(dir, 'output/gpt-image-2.5/stale.txt');
  fs.writeFileSync(sentinel, 'outside');
  fs.writeFileSync(inside, 'inside');
  const dry = spawnSync(node, ['src/rebuild.mjs', '--dir', 'gpt-image-2.5', '--dry-run'], { cwd: dir, encoding: 'utf8' });
  assert.equal(dry.status, 0, dry.stderr);
  assert.equal(fs.readFileSync(inside, 'utf8'), 'inside');
  const rebuilt = spawnSync(node, ['src/rebuild.mjs', '--dir', 'gpt-image-2.5', '--yes'], { cwd: dir, encoding: 'utf8' });
  assert.equal(rebuilt.status, 0, rebuilt.stderr);
  assert.equal(fs.existsSync(inside), false);
  assert.equal(fs.readFileSync(sentinel, 'utf8'), 'outside');
});
