import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { compileFacePrompt } from '../src/compiler/gpt-image-2.5.mjs';

const profile = JSON.parse(fs.readFileSync(new URL('../baselines/example_synthetic_face_001.json', import.meta.url), 'utf8'));
const minimal = { schema_version: 'face-v0.1' };
const compile = (p, options = {}) => compileFacePrompt(p, { preset: 'none', ...options });

test('default prompt is standalone and substantially shorter than original synthetic snapshot', () => {
  const prompt = compileFacePrompt(profile);
  assert.match(prompt, /Create a realistic portrait of one adult fictional female/);
  assert.match(prompt, /moderately narrow jaw width/);
  assert.match(prompt, /Front-facing head-and-shoulders/);
  assert.ok(prompt.split(/\s+/).length < 300);
  assert.doesNotMatch(prompt, /MAKEUP|FACIAL STRUCTURE|:\s*\.|undefined|NaN|_/);
});

test('sparse profiles do not invent anatomy or styling; explicit neutral and zero remain meaningful', () => {
  const prompt = compile({ ...minimal, face_geometry: { face_width: 34 }, eyes: { eye_size: 50, eye_tilt: 0 } });
  assert.match(prompt, /Moderately narrow facial width/);
  assert.match(prompt, /Medium eye size/);
  assert.match(prompt, /extremely downturned outer eye corners/);
  assert.doesNotMatch(prompt, /oval|hair|skin tone|makeup|nose|brow|capture/i);
});

test('no capture preset or source metadata leaks into none output', () => {
  const prompt = compile({ ...minimal, source: 'PRIVATE_SOURCE_MARKER', capture: { background: 'BACKGROUND_MARKER' } });
  assert.doesNotMatch(prompt, /MARKER|Capture:|85mm|studio/);
});

test('enhancers are opt-in and preserve structural clauses', () => {
  const core = compile(profile);
  const full = compile(profile, { enhancers: true });
  assert.doesNotMatch(core, /muted rose|fair neutral cool|Overall impression/);
  assert.match(full, /muted rose lip color/);
  assert.match(full, /fair neutral cool skin tone/);
  assert.ok(full.startsWith(core.split('\n\nPrioritize')[0]));
});

test('calibration cannot contradict profile styling', () => {
  const p = { ...profile, expression: { expression: 'laughing_open_mouth' }, makeup: { intensity: 100 } };
  assert.doesNotMatch(compileFacePrompt(p), /laughing|Very strong/);
  assert.match(compileFacePrompt(p), /relaxed neutral expression/);
  assert.throws(() => compileFacePrompt(p, { enhancers: true }), /conflict with calibration/);
  assert.match(compile(p, { enhancers: true, preset: 'profile' }), /laughing open mouth expression/);
});

test('makeup zero overrides optional style, and absent makeup never emits an empty clause', () => {
  assert.match(compile({ ...minimal, makeup: { intensity: 0, eyeliner: 'heavy' } }, { enhancers: true }), /No makeup\./);
  assert.doesNotMatch(compile({ ...minimal, makeup: { intensity: 0, eyeliner: 'heavy' } }, { enhancers: true }), /heavy/);
  assert.doesNotMatch(compile(minimal, { enhancers: true }), /makeup/i);
});

test('profile capture includes explicit orientation and rendering controls without fabricated defaults', () => {
  const prompt = compile({ ...minimal, capture: { head_yaw: -15, head_pitch: 0, head_roll: 5, image_softness: 0, beauty_filter_strength: 0 } }, { preset: 'profile' });
  assert.match(prompt, /head yaw -15 degrees; head pitch 0 degrees; head roll 5 degrees/);
  assert.match(prompt, /no image softening; no beauty filter/);
  assert.doesNotMatch(prompt, /85mm|studio|front view/);
});

for (const value of ['50', 'bad', null, true, [], {}, NaN, Infinity, -1, 101]) {
  test(`invalid numeric axis rejected: ${String(value)}`, () => {
    assert.throws(() => compile({ ...minimal, eyes: { eye_size: value } }), /eyes.eye_size must be a finite number from 0 to 100/);
  });
}

test('invalid structure, text, enum and options produce useful errors', () => {
  for (const value of [null, [], 'bad']) assert.throws(() => compile(value), /Profile must be an object/);
  for (const value of [null, [], 'bad']) assert.throws(() => compile({ ...minimal, eyes: value }), /eyes must be an object/);
  assert.throws(() => compile({ ...minimal, eyes: { upper_eyelid: 123 } }), /eyes.upper_eyelid/);
  assert.throws(() => compile({ ...minimal, eyes: { eye_szie: 50 } }), /Unknown control: eyes.eye_szie/);
  assert.throws(() => compile({ schema_version: 'face-v9' }), /Unsupported schema_version/);
  assert.throws(() => compile(minimal, { preset: 'typo' }), /Unknown preset/);
  assert.throws(() => compile(minimal, { enhancers: 'yes' }), /enhancers must be a boolean/);
  assert.throws(() => compile(minimal, { typo: true }), /Unknown compiler option/);
});

test('axis intensity boundaries remain monotonic and explicit', () => {
  const values = [0,14,15,29,30,42,43,47,48,52,53,57,58,70,71,85,86,100];
  const expected = ['extremely narrow','extremely narrow','distinctly narrow','distinctly narrow','moderately narrow','moderately narrow','slightly narrow','slightly narrow','moderate','moderate','slightly wide','slightly wide','moderately wide','moderately wide','distinctly wide','distinctly wide','extremely wide','extremely wide'];
  values.forEach((v, i) => assert.ok(compile({ ...minimal, face_geometry: { face_width: v } }).toLowerCase().includes(`${expected[i]} facial width`)));
});

const relational = {
  schema_version: 'face-v0.2',
  face_geometry: { cheek_to_chin_contour: 'smooth_taper' },
  soft_tissue: { cheek_fullness: 90, upper_medial_cheek_fullness: 65, lateral_cheek_fullness: 35 },
  eyes: { eye_size: 50, eye_length: 65, eye_roundness: 35, eye_socket_depth: 35 }
};

test('regional cheek controls override global fullness without leaking inferred anatomy', () => {
  const prompt = compile(relational);
  assert.match(prompt, /Moderately full upper-medial cheek volume; moderately restrained lateral cheek volume/);
  assert.match(prompt, /continuous smooth contour tapering from the cheeks through the jaw to the chin/);
  assert.doesNotMatch(prompt, /extremely full cheek volume|small chin|pointed|East Asian/);
  assert.match(prompt, /Medium eye size; moderately long horizontal eye length; moderately narrow eye aperture; moderately shallow eye sockets/);
});

test('one regional field suppresses global only and does not invent other region', () => {
  const prompt = compile({ ...relational, soft_tissue: { cheek_fullness: 90, upper_medial_cheek_fullness: 50 } });
  assert.match(prompt, /Moderate upper-medial cheek volume/);
  assert.doesNotMatch(prompt, /lateral cheek volume|extremely full cheek/);
});

test('localized changes remain localized and inputs are not mutated', () => {
  const before = structuredClone(relational);
  const original = compile(relational);
  const modified = compile({ ...relational, soft_tissue: { ...relational.soft_tissue, lateral_cheek_fullness: 70 } });
  assert.equal(original.replace('moderately restrained lateral cheek volume', 'moderately full lateral cheek volume'), modified);
  assert.deepEqual(relational, before);
});

test('v0.2 fields require explicit migration, invalid contour and regional values fail', () => {
  assert.throws(() => compile({ ...relational, schema_version: 'face-v0.1' }), /Unknown control/);
  assert.throws(() => compile({ ...relational, face_geometry: { cheek_to_chin_contour: 'pointy' } }), /face_geometry.cheek_to_chin_contour/);
  assert.throws(() => compile({ ...relational, soft_tissue: { lateral_cheek_fullness: 101 } }), /soft_tissue.lateral_cheek_fullness/);
  assert.equal(compile({ ...profile, schema_version: 'face-v0.2' }), compile(profile));
});

test('tracked synthetic snapshots match the compiler exactly', () => {
  for (const preset of ['calibration', 'profile', 'none']) {
    const expected = fs.readFileSync(new URL(`../output/gpt-image-2.5/example_synthetic_face_001.${preset}.txt`, import.meta.url), 'utf8');
    assert.equal(`${compileFacePrompt(profile, { preset })}\n`, expected);
  }
});

test('v0.2 preserves explicitly authored appearance with styling off; never supplies a default', () => {
  assert.match(compile({ schema_version: 'face-v0.2', subject: { appearance: 'East Asian appearance' } }), /adult fictional person with East Asian appearance/);
  assert.doesNotMatch(compile({ schema_version: 'face-v0.2' }), /Asian|appearance/);
  assert.throws(() => compile({ ...minimal, subject: { appearance: 'East Asian appearance' } }), /Unknown control/);
  assert.throws(() => compile({ schema_version: 'face-v0.2', subject: { appearance: 'a'.repeat(201) } }), /subject.appearance/);
});

test('unknown root fields and normalized-empty strings cannot silently erase controls', () => {
  assert.throws(() => compile({ ...minimal, eyez: { eye_size: 90 } }), /Unknown profile field: eyez/);
  for (const bad of ['_', '___', ' __ \t ']) {
    assert.throws(() => compile({ ...minimal, subject: { gender_presentation: bad } }), /subject.gender_presentation/);
    assert.throws(() => compile({ ...minimal, subject: { overall_impression: [bad] } }), /subject.overall_impression/);
  }
});


test('regional synthetic rebuild snapshot matches v0.2 compiler', () => {
  const regionalProfile = JSON.parse(fs.readFileSync(new URL('../baselines/example_synthetic_regional_001.json', import.meta.url), 'utf8'));
  const snapshot = fs.readFileSync(new URL('../output/gpt-image-2.5/example_synthetic_regional_001.calibration.txt', import.meta.url), 'utf8');
  assert.equal(`${compileFacePrompt(regionalProfile)}\n`, snapshot);
});
