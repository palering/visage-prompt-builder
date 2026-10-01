import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomBytes } from 'node:crypto';
import { resolveAppearance } from '../appearance/modules.mjs';
import { sampleProfile } from '../sampling/sample.mjs';
import { validateProfile } from '../compiler/validate.mjs';
import { compileFacePrompt, COMPILER_VERSION } from '../compiler/gpt-image-2.5.mjs';

export const VERSION = 'variants-v0.1';
export const MAX_COUNT = 16;
export const REGIONS = Object.freeze({ outline: ['face_geometry'], cheeks: ['soft_tissue'], eyes: ['eyes'], brows: ['eyebrows'], nose: ['nose'], lips: ['mouth'], styling: ['makeup','hair'], expression: ['expression'] });
const object = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const canonical = x => JSON.stringify(sort(x));
function sort(x) { return Array.isArray(x) ? x.map(sort) : object(x) ? Object.fromEntries(Object.keys(x).sort().map(k => [k, sort(x[k])])) : x; }
export const digest = x => createHash('sha256').update(canonical(x)).digest('hex');
const hashText = x => createHash('sha256').update(x).digest('hex');
const seedValue = seed => { if (typeof seed !== 'string' || !seed.length || seed.length > 1024) throw new Error('Seed must contain 1–1024 characters.'); return seed; };
const format = x => JSON.stringify(x, null, 2) + '\n';
const compilerHash = hashText(['../compiler/gpt-image-2.5.mjs','../compiler/validate.mjs','../../schemas/face_schema_v0.1.json','../../schemas/face_schema_v0.2.json','../appearance/modules.mjs','../../presets/appearance.v0.1.json','../body/body.mjs'].map(p => fs.readFileSync(new URL(p, import.meta.url), 'utf8')).join('\n'));
function checkPath(profile, key, value) {
  if (typeof key !== 'string' || !/^[a-z][a-z_]*\.[a-z][a-z_]*$/.test(key)) throw new Error(`Invalid control path: ${key}`);
  const [section, field] = key.split('.');
  if (!['subject','face_geometry','soft_tissue','eyes','eyebrows','nose','mouth','skin','makeup','hair','expression','capture'].includes(section) || ['constructor','prototype','__proto__'].includes(field)) throw new Error(`Unsupported control path: ${key}`);
  validateProfile({ schema_version: profile.schema_version, [section]: { [field]: value } });
}
function assign(profile, key, value) { const [section, field] = key.split('.'); profile[section] ??= {}; profile[section][field] = structuredClone(value); }
function optionsFor(profile, manifest, override) {
  const opts = override ?? manifest?.compiler_options ?? profile.metadata?.sampling?.compiler_options ?? { preset: 'none', enhancers: false };
  if (!object(opts) || Object.keys(opts).some(k => !['preset','enhancers','appearance'].includes(k)) || typeof opts.enhancers !== 'boolean' || !['none','profile','calibration'].includes(opts.preset)) throw new Error('Invalid compiler_options; expected preset and boolean enhancers.');
  compileFacePrompt(profile, opts);
  return structuredClone(opts);
}
function verifyManifest(profile, manifest) {
  if (manifest === undefined) return;
  if (!object(manifest)) throw new Error('Malformed manifest.');
  if (manifest.version === VERSION) {
    const { revision_id, ...content } = manifest;
    if (typeof revision_id !== 'string' || revision_id !== digest(content)) throw new Error('Manifest revision integrity check failed.');
    if (manifest.profile_sha256 !== digest(profile)) throw new Error('Profile differs from its manifest.');
  } else if (manifest.sampler_version === 'sampler-v0.1') {
    if (manifest.profile_sha256 !== hashText(format(profile))) throw new Error('Profile differs from its manifest.');
    const saved=profile.metadata?.sampling;
    if (!object(saved) || Object.entries(saved).some(([key,value])=>canonical(manifest[key]) !== canonical(value))) throw new Error('Sampling manifest provenance differs from the hashed profile metadata.');
  } else throw new Error('Unsupported manifest; import an intentionally edited profile as standalone renamed JSON.');
}
export function profileDiff(before, after) {
  const changes = [];
  function visit(a, b, key, hasA, hasB) {
    if (hasA && hasB && canonical(a) === canonical(b)) return;
    if (hasA && hasB && object(a) && object(b)) {
      for (const child of [...new Set([...Object.keys(a),...Object.keys(b)])].sort()) visit(a[child], b[child], key ? `${key}.${child}` : child, Object.hasOwn(a,child), Object.hasOwn(b,child));
    } else changes.push({ path: key, before_present: hasA, ...(hasA ? { before: a } : {}), after_present: hasB, ...(hasB ? { after: b } : {}) });
  }
  visit(before, after, '', true, true); return changes;
}
export function diffText(changes) { return changes.length ? changes.map(c => `${c.path}: ${c.before_present ? canonical(c.before) : '(absent)'} -> ${c.after_present ? canonical(c.after) : '(absent)'}`).join('\n') : 'No parameter changes.'; }
function finish(profile, compilerOptions, provenance) {
  validateProfile(profile);
  const prompt = compileFacePrompt(profile, compilerOptions);
  const manifest = { version: VERSION, ...provenance, compiler_options: compilerOptions, ...(compilerOptions.appearance === undefined ? {} : {appearance_resolution:resolveAppearance(compilerOptions.appearance,{...compilerOptions,profile})}), compiler_version: COMPILER_VERSION, compiler_sha256: compilerHash, algorithm_sha256: hashText(fs.readFileSync(new URL('./variants.mjs', import.meta.url),'utf8')), profile_sha256: digest(profile), prompt_sha256: hashText(prompt+'\n'), limitations: 'Parameters and prompts only; no image generation or identity guarantee. Authored range/group bounds are not validated anatomy. Different seeds can produce identical parameters or prompt text.' };
  manifest.revision_id = digest(manifest);
  return { profile, prompt, manifest };
}
export function batchProfiles({ archetypes, count = 4, seed = randomBytes(16).toString('hex'), catalog, appearance } = {}) {
  seedValue(seed);
  if (!Number.isInteger(count) || count < 1 || count > MAX_COUNT) throw new Error(`Count must be an integer from 1 to ${MAX_COUNT}.`);
  const candidates = Array.from({ length: count }, (_, index) => {
    const derived = digest([VERSION, 'batch', seed, index]);
    const sampled = sampleProfile({ archetypes, seed: derived, catalog, appearance });
    return finish(sampled.profile, sampled.manifest.compiler_options, { operation: 'sample', batch_seed: seed, candidate_index: index, seed: derived, sampling: sampled.manifest });
  });
  return { candidates, manifest: { version: VERSION, seed, count, candidate_index_base: 0, unique_profiles: new Set(candidates.map(c=>digest(Object.fromEntries(Object.entries(c.profile).filter(([k])=>k!=='metadata'))))).size, unique_prompts: new Set(candidates.map(c=>c.prompt)).size, candidates: candidates.map((c,i)=>({ directory: `candidate-${String(i+1).padStart(3,'0')}`, revision_id: c.manifest.revision_id, seed: c.manifest.seed })) } };
}
function checkedRanges(profile, ranges) {
  if (!object(ranges)) throw new Error('Selected profile has no resolved ranges. Use a saved sampled profile; unsupported controls can be edited with --set.');
  for (const [key, range] of Object.entries(ranges)) {
    if (!object(range) || Object.keys(range).some(k=>!['min','mode','max','group'].includes(k)) || !['min','mode','max'].every(k=>typeof range[k]==='number' && Number.isFinite(range[k])) || range.min < 0 || range.max > 100 || range.min > range.mode || range.mode > range.max || typeof range.group !== 'string' || !range.group) throw new Error(`Invalid resolved range: ${key}`);
    checkPath(profile,key,range.min); checkPath(profile,key,range.max);
  }
  return ranges;
}
function quantile(seed, key) { return parseInt(digest([VERSION,seed,key]).slice(0,13),16) / 0x10000000000000; }
function triangular(u, {min,mode,max}) { if (min===max) return min; return u < (mode-min)/(max-min) ? min+Math.sqrt(u*(max-min)*(mode-min)) : max-Math.sqrt((1-u)*(max-min)*(max-mode)); }
export function iterateProfile({ profile: source, manifest: parent, regions = [], edits = [], seed = randomBytes(16).toString('hex'), compilerOptions, appearance } = {}) {
  validateProfile(source); verifyManifest(source,parent); seedValue(seed);
  if (!Array.isArray(regions) || new Set(regions).size !== regions.length || regions.some(r=>!Object.hasOwn(REGIONS,r))) throw new Error(`Unknown or duplicate region. Choose: ${Object.keys(REGIONS).join(', ')}.`);
  if (!Array.isArray(edits) || edits.some(e=>!object(e) || Object.keys(e).sort().join(',') !== 'path,value')) throw new Error('Edits must be {path, value} objects.');
  if (!regions.length && !edits.length && appearance === undefined) throw new Error('Choose --regions and/or --set; selecting an old profile directly restores its saved state.');
  const profile = structuredClone(source);
  const inherited = optionsFor(source,parent);
  const opts = optionsFor(source,parent,{...inherited,...(compilerOptions??{}),...(appearance === undefined ? {} : {appearance:structuredClone(appearance)})});
  const ranges = regions.length ? checkedRanges(source, source.metadata?.sampling?.resolved_ranges) : {};
  const selected = [];
  for (const region of regions) {
    const keys = Object.keys(ranges).filter(k=>REGIONS[region].includes(k.split('.')[0]));
    if (!keys.length) throw new Error(`Region ${region} has no configured ranges; use explicit --set control=JSON edits instead. No fields were changed.`);
    selected.push(...keys);
  }
  const selectedSet = new Set(selected);
  for (const key of selected) {
    const omitted = Object.keys(ranges).filter(k=>ranges[k].group===ranges[key].group && !selectedSet.has(k));
    if (omitted.length) throw new Error(`Partial correlation group ${ranges[key].group} is unsupported; also select regions covering: ${omitted.join(', ')}. Locked fields were not changed.`);
  }
  const seen = new Set();
  for (const edit of edits) {
    checkPath(source, edit.path, edit.value);
    if (seen.has(edit.path) || selectedSet.has(edit.path)) throw new Error(`Duplicate or reroll/edit conflict: ${edit.path}`);
    seen.add(edit.path);
  }
  // One quantile per authored group keeps selected correlated controls moving together.
  // Full-group selection is required; no locked sibling is repaired or default-filled.
  for (const key of selected.sort()) {
    const range = ranges[key];
    assign(profile,key,Math.min(range.max,Math.max(range.min,Math.round(triangular(quantile(seed,`group:${range.group}`),range)*100)/100)));
  }
  for (const edit of edits) assign(profile,edit.path,edit.value);
  const changes = profileDiff(source,profile);
  const moduleChanges = profileDiff(inherited.appearance??null,opts.appearance??null);
  const result = finish(profile,opts,{ operation: regions.length ? (edits.length ? 'reroll-and-edit' : 'reroll') : 'edit', seed, parent_revision_id: parent?.revision_id ?? null, parent_profile_sha256: digest(source), source_compiler_options: optionsFor(source,parent), regions: [...regions], rerolled_paths: selected, manual_edits: structuredClone(edits), resolved_ranges: Object.fromEntries(selected.map(k=>[k,ranges[k]])), diff: changes, appearance_diff:moduleChanges, prompt_changed: compileFacePrompt(source, optionsFor(source,parent)) !== compileFacePrompt(profile,opts) });
  return { ...result, source: structuredClone(source), diff: diffText(changes)+(moduleChanges.length ? '\nAppearance config changes:\n'+diffText(moduleChanges) : '') };
}
export function loadProfile(filename) {
  const resolved = path.resolve(filename);
  const data = JSON.parse(fs.readFileSync(resolved,'utf8'));
  if (object(data) && Object.hasOwn(data,'profile')) { validateProfile(data.profile); verifyManifest(data.profile,data.manifest); return {profile:data.profile,manifest:data.manifest}; }
  validateProfile(data);
  let manifest;
  const sidecar = path.join(path.dirname(resolved),'manifest.json');
  if (path.basename(resolved)==='profile.json' && fs.existsSync(sidecar)) {
    manifest = JSON.parse(fs.readFileSync(sidecar,'utf8'));
    verifyManifest(data,manifest);
  }
  return { profile:data, manifest };
}
export function artifactFiles(artifact) {
  return { 'profile.json':format(artifact.profile), 'prompt.txt':artifact.prompt+'\n', 'manifest.json':format(artifact.manifest), ...(artifact.manifest.compiler_options.appearance ? {'appearance.json':format(artifact.manifest.compiler_options.appearance)} : {}), ...(artifact.source ? {'source-profile.json':format(artifact.source),'diff.txt':artifact.diff+'\n'} : {}) };
}
// New directories only, with exclusive file creation. Never replace even empty history.
export function writeImmutable(destination, files) {
  const target = path.resolve(destination);
  for (let ancestor = path.dirname(target); ; ancestor = path.dirname(ancestor)) {
    if (fs.existsSync(ancestor)) {
      if (fs.lstatSync(ancestor).isSymbolicLink()) throw new Error('Output ancestors must not be symlinks.');
      if (fs.existsSync(path.join(ancestor,'manifest.json'))) throw new Error('Choose an output outside an existing artifact directory; history is immutable.');
    }
    if (ancestor === path.dirname(ancestor)) break;
  }
  fs.mkdirSync(path.dirname(target),{recursive:true});
  fs.mkdirSync(target); // Atomic reservation; existing files/directories/symlinks fail.
  try {
    for (const [relative,content] of Object.entries(files)) {
      if (path.isAbsolute(relative) || relative.split(/[\\/]/).some(s=>['..','.',''].includes(s))) throw new Error('Unsafe artifact path.');
      const file = path.join(target,relative); fs.mkdirSync(path.dirname(file),{recursive:true}); fs.writeFileSync(file,content,{flag:'wx'});
    }
  } catch(error) { // Keep partial outputs for inspection; never delete potentially concurrent files.
    throw new Error(`Output incomplete at ${target}; choose a new directory after inspecting it. ${error.message}`);
  }
}
