import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { sampleProfile, defaultCatalog, SAMPLER_VERSION, validateCatalog } from '../src/sampling/sample.mjs';
import { batchProfiles, iterateProfile, loadProfile, artifactFiles, writeImmutable } from '../src/iteration/variants.mjs';
import { compileFacePrompt } from '../src/compiler/gpt-image-2.5.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const legacyBytes = fs.readFileSync(new URL('../presets/archetypes.v0.1.json', import.meta.url));
const legacyCatalog = JSON.parse(legacyBytes);
const sample = (seed = 'brow-nose-demo', catalog = defaultCatalog, archetypes = ['beautiful', 'elegant']) => sampleProfile({ seed, catalog, archetypes });
const groupByPath = {
  'eyebrows.brow_thickness': 'brow_mass',
  'eyebrows.brow_height': 'brow_height',
  'eyebrows.brow_arch': 'brow_arch',
  'eyebrows.brow_length': 'brow_length',
  'eyebrows.brow_density': 'brow_mass',
  'nose.bridge_height': 'nose_bridge_height',
  'nose.bridge_width': 'nose_width',
  'nose.nose_length': 'nose_length',
  'nose.nose_projection': 'nose_projection',
  'nose.tip_size': 'nose_tip_size',
  'nose.tip_roundness': 'nose_tip_roundness',
  'nose.tip_rotation': 'nose_tip_rotation',
  'nose.alar_width': 'nose_width',
  'nose.nostril_visibility': 'nose_nostril_visibility'
};
const morphologyKeys = ['face_geometry', 'soft_tissue', 'eyes', 'eyebrows', 'nose', 'mouth'];
const morphology = profile => Object.fromEntries(morphologyKeys.map(k => [k, profile[k]]));
const withoutSections = (profile, sections) => Object.fromEntries(Object.entries(profile).filter(([key]) => !sections.includes(key)));
const valueAt = (profile, key) => { const [section, field] = key.split('.'); return profile[section][field]; };
const temp = t => { const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'visage-brow-nose-')); t.after(() => fs.rmSync(dir, { recursive: true, force: true })); return dir; };
const correlate = pairs => {
  const means = [0, 1].map(j => pairs.reduce((sum, p) => sum + p[j], 0) / pairs.length);
  const covariance = pairs.reduce((sum, p) => sum + (p[0] - means[0]) * (p[1] - means[1]), 0);
  const variances = [0, 1].map(j => pairs.reduce((sum, p) => sum + (p[j] - means[j]) ** 2, 0));
  return covariance / Math.sqrt(variances[0] * variances[1]);
};

test('catalog v0.2 adds only 14 region-local axes and freezes the v0.1 catalog bytes', () => {
  assert.equal(createHash('sha256').update(legacyBytes).digest('hex'), '3dc8c43676c2ca3dbc39bc16e035d55dc4924118784bf38fee1914ea07bcab0b');
  assert.equal(SAMPLER_VERSION, 'sampler-v0.1');
  assert.equal(defaultCatalog.version, 'archetypes-v0.2');
  validateCatalog(defaultCatalog);
  const stripped = structuredClone(defaultCatalog);
  stripped.version = legacyCatalog.version;
  stripped.description = legacyCatalog.description;
  for (const bundle of stripped.morphology_bundles) {
    for (const [key, group] of Object.entries(groupByPath)) {
      assert.deepEqual(bundle.ranges[key], { min: key === 'nose.tip_rotation' ? 40 : 35, mode: 50, max: key === 'nose.tip_rotation' ? 60 : 65, group });
      const sections = new Set(Object.entries(bundle.ranges).filter(([, range]) => range.group === group).map(([path]) => path.split('.')[0]));
      assert.deepEqual([...sections], [key.split('.')[0]]);
      delete bundle.ranges[key];
    }
  }
  assert.deepEqual(stripped, legacyCatalog);
});

test('adding brow and nose controls preserves every pre-existing seeded draw', () => {
  for (let i = 0; i < 100; i++) {
    const current = sample(String(i)), legacy = sample(String(i), legacyCatalog);
    assert.deepEqual(withoutSections(current.profile, ['eyebrows', 'nose', 'metadata']), withoutSections(legacy.profile, ['metadata']));
    assert.equal(current.manifest.morphology_bundle, legacy.manifest.morphology_bundle);
    assert.notEqual(current.manifest.catalog_sha256, legacy.manifest.catalog_sha256);
    for (const [key, range] of Object.entries(legacy.manifest.resolved_ranges)) assert.deepEqual(current.manifest.resolved_ranges[key], range);
    for (const key of Object.keys(groupByPath)) assert.equal(typeof valueAt(current.profile, key), 'number');
  }
});

test('brow and nose morphology is identical across all presentation and beauty directions', () => {
  for (let i = 0; i < 12; i++) {
    const baseline = sample(String(i));
    for (const id of Object.keys(defaultCatalog.archetypes)) {
      assert.deepEqual(morphology(sample(String(i), defaultCatalog, [id]).profile), morphology(baseline.profile));
      if (id !== 'beautiful') assert.deepEqual(morphology(sample(String(i), defaultCatalog, ['beautiful', id]).profile), morphology(baseline.profile));
    }
  }
});

test('brow mass and nose width correlate while independent axes keep separate draws', () => {
  const profiles = Array.from({ length: 200 }, (_, i) => sample(`correlation-${i}`).profile);
  for (const [a, b] of [['eyebrows.brow_thickness', 'eyebrows.brow_density'], ['nose.bridge_width', 'nose.alar_width']]) {
    const pairs = profiles.map(p => [valueAt(p, a), valueAt(p, b)]);
    assert.ok(correlate(pairs) > 0.75, `${a} and ${b} share their authored group`);
    assert.ok(pairs.some(([x, y]) => x !== y), 'field-local sampling variation is retained');
  }
  for (const [a, b] of [['eyebrows.brow_height', 'eyebrows.brow_arch'], ['nose.bridge_height', 'nose.bridge_width'], ['nose.nose_length', 'nose.nose_projection'], ['nose.tip_size', 'nose.tip_roundness'], ['nose.tip_rotation', 'nose.nostril_visibility'], ['eyes.eye_size', 'eyebrows.brow_height']]) {
    assert.ok(Math.abs(correlate(profiles.map(p => [valueAt(p, a), valueAt(p, b)]))) < 0.3, `${a} and ${b} use distinct authored groups`);
  }
});

test('brows and nose reroll independently, stay bounded and preserve locked fields and lineage', () => {
  const source = sample(), before = structuredClone(source);
  for (const regions of [['brows'], ['nose'], ['brows', 'nose']]) {
    const sections = regions.map(region => region === 'brows' ? 'eyebrows' : region);
    const changedKeys = Object.keys(groupByPath).filter(key => sections.includes(key.split('.')[0])).sort();
    for (let i = 0; i < 60; i++) {
      const result = iterateProfile({ profile: source.profile, manifest: source.manifest, regions, seed: `reroll-${i}` });
      assert.deepEqual(withoutSections(result.profile, sections), withoutSections(source.profile, sections));
      assert.deepEqual(result.profile.metadata, source.profile.metadata);
      assert.deepEqual(result.manifest.rerolled_paths, changedKeys);
      assert.equal(result.prompt, compileFacePrompt(result.profile, result.manifest.compiler_options));
      assert.ok(result.manifest.diff.every(change => changedKeys.includes(change.path)));
      assert.ok(result.manifest.diff.length > 0);
      for (const [key, range] of Object.entries(result.manifest.resolved_ranges)) {
        assert.deepEqual(range, source.manifest.resolved_ranges[key]);
        assert.ok(valueAt(result.profile, key) >= range.min && valueAt(result.profile, key) <= range.max, key);
      }
    }
    const first = iterateProfile({ profile: source.profile, manifest: source.manifest, regions, seed: 'repeat' });
    assert.deepEqual(first, iterateProfile({ profile: source.profile, manifest: source.manifest, regions, seed: 'repeat' }));
  }
  assert.deepEqual(source, before);
});

test('cross-region partial groups reject without changing the source, full groups work', () => {
  const { profile } = sample();
  profile.metadata.sampling.resolved_ranges['eyebrows.brow_density'].group = 'nose_width';
  const before = structuredClone(profile);
  for (const regions of [['brows'], ['nose']]) {
    assert.throws(() => iterateProfile({ profile, regions, seed: 'partial' }), /Partial correlation group nose_width/);
    assert.deepEqual(profile, before);
  }
  const a = iterateProfile({ profile, regions: ['brows', 'nose'], seed: 'full' });
  const b = iterateProfile({ profile, regions: ['nose', 'brows'], seed: 'full' });
  assert.deepEqual(a.profile, b.profile);
  assert.deepEqual(a.manifest.rerolled_paths, b.manifest.rerolled_paths);
  for (const [region, key] of [['brows', 'eyebrows.brow_arch'], ['nose', 'nose.nose_projection']]) {
    assert.throws(() => iterateProfile({ profile: sample().profile, regions: [region], edits: [{ path: key, value: 50 }] }), /reroll\/edit conflict/);
  }
});

test('legacy sampled profiles and saved iteration branches never acquire current catalog ranges', () => {
  const legacy = sample('old-ranges', legacyCatalog);
  const historic = loadProfile(path.join(root, 'examples/iterations/eyes-v2/profile.json'));
  for (const source of [legacy, historic]) {
    const before = structuredClone(source.profile);
    for (const region of ['brows', 'nose']) assert.throws(() => iterateProfile({ profile: source.profile, manifest: source.manifest, regions: [region], seed: 'not-backfilled' }), /no configured ranges/);
    const next = iterateProfile({ profile: source.profile, manifest: source.manifest, regions: ['eyes'], seed: 'old-next' });
    const branch = iterateProfile({ profile: next.profile, manifest: next.manifest, regions: ['lips'], seed: 'old-branch' });
    assert.deepEqual(branch.profile.metadata, source.profile.metadata);
    assert.equal(branch.profile.eyebrows, undefined);
    assert.equal(branch.profile.nose, undefined);
    assert.equal(branch.manifest.parent_revision_id, next.manifest.revision_id);
    assert.deepEqual(source.profile, before);
    assert.throws(() => iterateProfile({ profile: branch.profile, manifest: branch.manifest, regions: ['brows'] }), /no configured ranges/);
  }
});

test('batch and CLI brow/nose iteration round-trip, with explicit v0.1 sampling still available', t => {
  const dir = temp(t);
  const candidate = batchProfiles({ archetypes: ['elegant'], count: 1, seed: 'brow-nose-cli' }).candidates[0];
  const original = path.join(dir, 'original');
  writeImmutable(original, artifactFiles(candidate));
  const run = (file, args) => spawnSync(process.execPath, [file, ...args], { cwd: root, encoding: 'utf8' });
  let source = path.join(original, 'profile.json');
  for (const [region, section] of [['brows', 'eyebrows'], ['nose', 'nose']]) {
    const destination = path.join(dir, region);
    const before = loadProfile(source);
    const result = run('src/variants.mjs', ['iterate', '--input', source, '--regions', region, '--seed', `cli-${region}`, '--out-dir', destination]);
    assert.equal(result.status, 0, result.stderr);
    const after = loadProfile(path.join(destination, 'profile.json'));
    assert.deepEqual(withoutSections(after.profile, [section]), withoutSections(before.profile, [section]));
    assert.equal(after.manifest.parent_revision_id, before.manifest.revision_id);
    assert.equal(fs.readFileSync(path.join(destination, 'prompt.txt'), 'utf8'), compileFacePrompt(after.profile, after.manifest.compiler_options) + '\n');
    source = path.join(destination, 'profile.json');
  }
  const legacy = run('src/sample.mjs', ['--archetype', 'elegant', '--seed', 'legacy-cli', '--catalog', 'presets/archetypes.v0.1.json']);
  assert.equal(legacy.status, 0, legacy.stderr);
  assert.deepEqual(JSON.parse(legacy.stdout), sample('legacy-cli', legacyCatalog, ['elegant']));
});
