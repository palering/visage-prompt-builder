import fs from 'node:fs';
import { createHash, randomBytes } from 'node:crypto';
import { validateProfile } from '../compiler/validate.mjs';
import { resolveAppearance } from '../appearance/modules.mjs';
import { compileFacePrompt, COMPILER_VERSION } from '../compiler/gpt-image-2.5.mjs';

export const SAMPLER_VERSION = 'sampler-v0.1';
// Catalog additions do not change the keyed random algorithm or old saved ranges.
export const defaultCatalog = JSON.parse(fs.readFileSync(new URL('../../presets/archetypes.v0.2.json', import.meta.url), 'utf8'));
const hash = (value) => createHash('sha256').update(value).digest('hex');
const compilerHash = hash(['../compiler/gpt-image-2.5.mjs', '../compiler/validate.mjs', '../../schemas/face_schema_v0.1.json', '../../schemas/face_schema_v0.2.json', '../appearance/modules.mjs', '../../presets/appearance.v0.1.json', '../body/body.mjs'].map(p => fs.readFileSync(new URL(p, import.meta.url), 'utf8')).join('\n'));
const morphologySections = new Set(['face_geometry', 'soft_tissue', 'eyes', 'eyebrows', 'nose', 'mouth']);
const stylingSections = new Set(['subject', 'makeup', 'skin', 'hair', 'expression', 'capture']);
const set = (obj, key, value) => {
  const [section, field] = key.split('.');
  obj[section] ??= {};
  obj[section][field] = structuredClone(value);
};
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
function keysOnly(value, allowed, label) {
  if (!isObject(value)) throw new Error(`${label} must be an object.`);
  for (const key of Object.keys(value)) if (!allowed.includes(key)) throw new Error(`Unknown ${label} field: ${key}`);
}
function checkFields(definition, morphology) {
  keysOnly(definition, morphology ? ['id','weight','fixed','ranges'] : ['layer','label','description','fixed','ranges'], 'definition');
  for (const name of ['fixed','ranges']) if (Object.hasOwn(definition, name) && !isObject(definition[name])) throw new Error(`Invalid ${name} definition.`);
  if (!Object.keys(definition.fixed ?? {}).length && !Object.keys(definition.ranges ?? {}).length) throw new Error('Empty sampling definition.');
  for (const [kind, fields] of Object.entries({ fixed: definition.fixed ?? {}, ranges: definition.ranges ?? {} })) {
    if (!fields || typeof fields !== 'object' || Array.isArray(fields)) throw new Error(`Invalid ${kind} definition.`);
    for (const [key, value] of Object.entries(fields)) {
      if (!/^[a-z_]+\.[a-z_]+$/.test(key) || key.includes('__proto__') || key.includes('constructor')) throw new Error(`Unsupported sampling field: ${key}`);
      const [section] = key.split('.');
      if (!(morphology ? morphologySections : stylingSections).has(section) || ['subject.age_group', 'subject.gender_presentation', 'subject.appearance', 'skin.tone'].includes(key)) throw new Error(`Unsupported sampling field: ${key}`);
      if (kind === 'ranges') {
        keysOnly(value, ['min','mode','max','group'], 'range');
        if (!value || !['min','mode','max'].every(k => Number.isFinite(value[k])) || value.min < 0 || value.max > 100 || value.min > value.mode || value.mode > value.max || typeof value.group !== 'string' || !value.group) throw new Error(`Invalid range: ${key}`);
        // A string control must never masquerade as a numeric sampled field.
        for (const endpoint of ['min', 'mode', 'max']) {
          const probe = { schema_version: 'face-v0.2' };
          set(probe, key, value[endpoint]); validateProfile(probe);
        }
      } else {
        const probe = { schema_version: 'face-v0.2' };
        set(probe, key, value); validateProfile(probe);
      }
    }
  }
  for (const key of Object.keys(definition.fixed ?? {})) if (Object.hasOwn(definition.ranges ?? {}, key)) throw new Error(`Fixed/range conflict: ${key}`);
}
export function validateCatalog(catalog) {
  keysOnly(catalog, ['version','description','correlation','morphology_bundles','archetypes'], 'catalog');
  if (typeof catalog.description !== 'string') throw new Error('Catalog description must be a string.');
  keysOnly(catalog.correlation, ['shared_weight','local_weight'], 'correlation');
  if (!isObject(catalog.archetypes)) throw new Error('Archetypes must be an object.');
  if (!catalog || typeof catalog.version !== 'string' || !catalog.version || !Array.isArray(catalog.morphology_bundles) || !catalog.morphology_bundles.length) throw new Error('Invalid archetype catalog.');
  const weights = catalog.correlation;
  if (!weights || !Number.isFinite(weights.shared_weight) || !Number.isFinite(weights.local_weight) || weights.shared_weight <= 0 || weights.local_weight < 0 || Math.abs(weights.shared_weight + weights.local_weight - 1) > 1e-10) throw new Error('Correlation weights must sum to one with positive shared weight.');
  const ids = new Set();
  for (const bundle of catalog.morphology_bundles) {
    if (typeof bundle.id !== 'string' || !bundle.id || ids.has(bundle.id) || !Number.isFinite(bundle.weight) || bundle.weight <= 0) throw new Error('Invalid or duplicate morphology bundle.');
    ids.add(bundle.id); checkFields(bundle, true);
  }
  if (!catalog.archetypes || !Object.keys(catalog.archetypes).length) throw new Error('No archetypes configured.');
  for (const recipe of Object.values(catalog.archetypes)) {
    if (!isObject(recipe) || typeof recipe.label !== 'string' || typeof recipe.description !== 'string') throw new Error('Invalid archetype description.');
    if (!['appearance', 'presentation'].includes(recipe.layer)) throw new Error('Unsupported archetype layer.');
    checkFields(recipe, false);
  }
}
function randomFor(seed, key) {
  return parseInt(hash(JSON.stringify([SAMPLER_VERSION, seed, key])).slice(0, 13), 16) / 0x10000000000000;
}
function triangular(u, range) {
  const { min, mode, max } = range;
  if (min === max) return min;
  const split = (mode - min) / (max - min);
  return u < split ? min + Math.sqrt(u * (max - min) * (mode - min)) : max - Math.sqrt((1-u) * (max-min) * (max-mode));
}
export function sampleProfile({ archetypes, seed = randomBytes(16).toString('hex'), catalog = defaultCatalog, appearance } = {}) {
  validateCatalog(catalog);
  if (typeof seed !== 'string' || !seed.length) throw new Error('Seed must be a non-empty string.');
  if (!Array.isArray(archetypes) || !archetypes.length || archetypes.some(id => typeof id !== 'string')) throw new Error('Choose at least one archetype.');
  const selected = [...new Set(archetypes)].sort();
  if (selected.length !== archetypes.length) throw new Error('Duplicate archetypes are not allowed.');
  const layers = new Set();
  for (const id of selected) {
    if (!Object.hasOwn(catalog.archetypes, id)) throw new Error(`Unknown archetype: ${id}`);
    const layer = catalog.archetypes[id].layer;
    if (layers.has(layer)) throw new Error(`Conflicting ${layer} archetypes. Choose at most one per layer.`);
    layers.add(layer);
  }
  const configHash = hash(JSON.stringify(catalog));
  const total = catalog.morphology_bundles.reduce((sum, b) => sum + b.weight, 0);
  if (!Number.isFinite(total)) throw new Error('Invalid total morphology weight.');
  let roll = randomFor(seed, 'morphology-choice') * total;
  const bundle = catalog.morphology_bundles.find(b => (roll -= b.weight) < 0) ?? catalog.morphology_bundles.at(-1);
  const profile = { schema_version: 'face-v0.2', subject: { age_group: 'adult', gender_presentation: 'person' }, capture: { view: 'front', camera_height: 'eye_level', lens_equivalent: '85mm', camera_distance: 'head and shoulders portrait', lighting: 'soft neutral studio', background: 'plain neutral', image_softness: 0, beauty_filter_strength: 0 }, expression: { expression: 'relaxed neutral' } };
  const ranges = {};
  const assigned = new Set();
  for (const definition of [bundle, ...selected.map(id => catalog.archetypes[id])]) {
    for (const [key, value] of Object.entries(definition.fixed ?? {})) {
      if (key === 'subject.overall_impression') {
        profile.subject.overall_impression = [...(profile.subject.overall_impression ?? []), ...value];
      } else {
        if (assigned.has(key)) throw new Error(`Archetype control conflict: ${key}`);
        set(profile, key, value); assigned.add(key);
      }
    }
    for (const [key, range] of Object.entries(definition.ranges ?? {})) {
      if (assigned.has(key)) throw new Error(`Archetype control conflict: ${key}`);
      // Shared center-biased quantile produces correlated, bounded variation within each family.
      const shared = randomFor(seed, `group:${range.group}`);
      const local = randomFor(seed, `field:${key}`);
      const u = catalog.correlation.shared_weight * shared + catalog.correlation.local_weight * local;
      const value = triangular(u, range);
      set(profile, key, Math.min(range.max, Math.max(range.min, Math.round(value * 100) / 100)));
      assigned.add(key); ranges[key] = structuredClone(range);
    }
  }
  profile.metadata = { sampling: { sampler_version: SAMPLER_VERSION, catalog_version: catalog.version, catalog_sha256: configHash, compiler_version: COMPILER_VERSION, compiler_sha256: compilerHash, seed, archetypes: selected, morphology_bundle: bundle.id, resolved_ranges: ranges, compiler_options: { preset: 'profile', enhancers: true, ...(appearance === undefined ? {} : {appearance:structuredClone(appearance)}) }, ...(appearance === undefined ? {} : {appearance_resolution:resolveAppearance(appearance,{preset:'profile',enhancers:true,profile})}), limitations: 'Authored artistic ranges, not validated measurements. Seed reproduces parameters and prompt, not image identity. Villain direction is fictional acting, not moral character inferred from facial anatomy.' } };
  validateProfile(profile);
  const prompt = compileFacePrompt(profile, profile.metadata.sampling.compiler_options);
  return { profile, prompt, manifest: { ...profile.metadata.sampling, profile_sha256: hash(JSON.stringify(profile, null, 2) + '\n'), prompt_sha256: hash(prompt + '\n') } };
}
