import fs from 'node:fs';
import { createHash } from 'node:crypto';
export const APPEARANCE_VERSION = 'appearance-v0.1';
function deepFreeze(x) { if (x && typeof x === 'object') { Object.values(x).forEach(deepFreeze); Object.freeze(x); } return x; }
export const appearanceCatalog = deepFreeze(JSON.parse(fs.readFileSync(new URL('../../presets/appearance.v0.1.json', import.meta.url), 'utf8')));
const object = x => x !== null && typeof x === 'object' && !Array.isArray(x) && [Object.prototype,null].includes(Object.getPrototypeOf(x));
const hash = x => createHash('sha256').update(JSON.stringify(x)).digest('hex');
const fields = {
  hair: ['color','length','cut','fringe','part','texture','volume','arrangement','front','sides','back','accessories'],
  makeup: ['coverage','finish','browRendering','eyelinerGeometry','lashes','shadowPlacement','blushPlacement','contour','highlight','lipBoundary','lipFinish','palette','ornament']
};
const expressions = {
  relaxed_neutral: 'Relaxed neutral expression, resting brows, naturally open eyes and relaxed closed lips',
  slight_smile: 'A slight closed-mouth smile, gently raised mouth corners and subtle cheek lift',
  broad_smile: 'A broad smile with parted lips, raised cheeks and naturally narrowed eye apertures',
  frown: 'A posed frown, drawn-together lowered brows and mildly tense lips',
  surprise: 'A posed surprised expression, raised brows, widened eye apertures and slightly parted lips'
};
function keys(x, allowed, path) {
  if (!object(x)) throw new Error(`${path} must be an object.`);
  for (const k of Object.keys(x)) if (!allowed.includes(k)) throw new Error(`Unknown ${path} field: ${k}.`);
}
function geometry(x, module, path) {
  keys(x, fields[module], path);
  for (const [k,v] of Object.entries(x)) {
    if (k === 'accessories') {
      if (!Array.isArray(v) || v.length > 8 || v.some(s=>typeof s!=='string' || !s.trim() || s.length>200)) throw new Error(`${path}.${k} must be an array of short non-empty strings.`);
    } else if (typeof v !== 'string' || !v.trim() || v.length > 400) throw new Error(`${path}.${k} must be a non-empty string of at most 400 characters.`);
  }
}
export function resolvePresetId(module, requested, catalog=appearanceCatalog) {
  if (typeof requested !== 'string' || !object(catalog[module])) throw new Error(`Unknown ${module} preset: ${requested}.`);
  if (Object.hasOwn(catalog[module], requested)) return requested;
  const matches=Object.entries(catalog[module]).filter(([,entry]) => entry.aliases?.includes(requested));
  if (matches.length !== 1) throw new Error(`Unknown or ambiguous ${module} preset: ${requested}.`);
  return matches[0][0];
}
export function validateAppearance(config) {
  keys(config, ['version','hair','makeup','apparentAge','expression'], 'appearance');
  if (config.version !== APPEARANCE_VERSION) throw new Error(`Expected appearance version ${APPEARANCE_VERSION}.`);
  for (const module of ['hair','makeup','apparentAge','expression']) {
    if (!Object.hasOwn(config,module)) continue;
    const value=config[module];
    keys(value, ['state', ...(module==='apparentAge'?['years']:['preset', ...(module==='expression'?[]:['overrides'])])], `appearance.${module}`);
    if (!['off','selected'].includes(value.state)) throw new Error(`appearance.${module}.state must be off or selected.`);
    if (value.state === 'off') {
      if (Object.keys(value).length !== 1) throw new Error(`Off ${module} must contain only state; inactive data is not silently ignored.`);
      continue;
    }
    if (module === 'apparentAge') {
      if (!Number.isInteger(value.years) || value.years<18 || value.years>90) throw new Error('Apparent age must be an integer adult age from 18 to 90.');
    } else if (module === 'expression') {
      if (typeof value.preset !== 'string' || !Object.hasOwn(expressions,value.preset)) throw new Error(`Unknown expression preset: ${value.preset}.`);
    } else {
      resolvePresetId(module, value.preset);
      if (value.overrides !== undefined) geometry(value.overrides,module,`appearance.${module}.overrides`);
    }
  }
  return config;
}
export function resolveAppearance(config, {preset='none', enhancers=false, profile={}}={}) {
  if (config === undefined) return { paragraphs:[], modules:{}, warnings:[], config:null, catalog_sha256:null };
  validateAppearance(config);
  const active=Object.entries(config).filter(([k,v])=>k!=='version' && v.state==='selected');
  if (preset === 'calibration' && active.length) throw new Error('Selected appearance modules conflict with calibration. Choose profile or none, or turn the modules off.');
  const result={config:structuredClone(config),catalog_version:appearanceCatalog.version,catalog_sha256:hash(appearanceCatalog),paragraphs:[],modules:{},warnings:[]};
  for (const module of ['hair','makeup','apparentAge','expression']) {
    if (!Object.hasOwn(config,module)) continue;
    const value=config[module]; if (!value) continue;
    if (value.state==='off') {result.modules[module]={state:'off',impact:'Suppresses the corresponding legacy appearance clause only; does not remove model priors.'};continue;}
    if (module==='apparentAge') {
      result.modules[module]={state:'selected',years:value.years,impact:'Age cues can change perceived soft tissue, skin texture and facial proportions; baseline parameters are unchanged. This is an approximate appearance target, not an exact age guarantee.'};
      result.warnings.push(result.modules[module].impact);
    } else if (module==='expression') {
      result.paragraphs.push(`${expressions[value.preset]}.`);
      result.modules[module]={state:'selected',preset:value.preset,impact:'Muscle action changes visible brow height, eye aperture, cheek lift and mouth shape; neutral feature values are not a pixel-level lock.'};
      result.warnings.push(result.modules[module].impact);
    } else {
      const canonical=resolvePresetId(module,value.preset);
      const entry=appearanceCatalog[module][canonical];
      geometry(entry.geometry,module,`catalog.${module}.${value.preset}.geometry`);
      const resolved={...entry.geometry,...(entry.accessories?{accessories:entry.accessories}:{}),...structuredClone(value.overrides??{})};
      // Unspecified is absent direction, while explicit none is a meaningful constraint.
      // Preserve the complete resolved geometry in provenance; clean prompt text only.
      const parts=Object.entries(resolved).filter(([,v]) => typeof v !== 'string' || v.trim().toLowerCase() !== 'unspecified').map(([k,v])=>`${k.replace(/[A-Z]/g,c=>' '+c.toLowerCase())}: ${Array.isArray(v)?(v.length?v.join(', '):'none'):v.replaceAll('_',' ')}`);
      if (parts.length) result.paragraphs.push(`${module==='hair'?'Hair styling':'Makeup application'}: ${parts.join('; ')}.`);
      result.modules[module]={state:'selected',preset:canonical,requestedPreset:value.preset,referenceIds:entry.referenceIds??[],family:entry.family??null,variantOf:entry.variantOf??null,label:entry.label,resolved,sourceIds:entry.sourceIds??[],evidenceStatus:entry.evidenceStatus,context:{historical:entry.historicalContext??null,trend:entry.trendContext??null,cultural:entry.culturalContext??null,recipe:entry.context??null},occlusion:value.overrides && Object.keys(value.overrides).length ? null : entry.occlusion??null,occlusionStatus:value.overrides && Object.keys(value.overrides).length ? 'requires_reassessment_after_overrides' : 'authored_qualitative_estimate',requirements:{...entry.requirements,...entry.requires},materialModes:entry.materialModes??null,identityNote:entry.identityNote??null,geometryIs:entry.geometryIs??null,authorship:entry.authorship??null,conflicts:entry.conflicts??[],sources:(entry.sourceIds??[]).map(id=>({id,...appearanceCatalog.sources[id]})),impact:module==='hair'?'Hair silhouette and occlusion change the apparent forehead, temples, cheeks and jaw.':'Cosmetic edges, highlights and shadows change perceived brows, eyes, nose, cheeks and lip boundaries.',warnings:[...(entry.perceptualWarnings??[])]};
      result.warnings.push(result.modules[module].impact,...result.modules[module].warnings);
      if (value.overrides && Object.keys(value.overrides).length) result.warnings.push(`${module} overrides are authored free-text geometry. Historical accuracy, physical compatibility and preset occlusion metadata are not guaranteed after overrides.`);
    }
  }
  if (active.length && enhancers && profile.subject?.overall_impression?.length) result.warnings.push('Legacy overall impression remains active and can bias appearance; use enhancers false for isolated module comparisons.');
  if (active.length && preset==='profile') result.warnings.push('Profile capture is free text: check lighting, view and styling words manually for semantic conflicts.');
  result.warnings=[...new Set(result.warnings)];
  return structuredClone(result);
}

export function validateAppearanceCatalog(catalog) {
  keys(catalog,['version','researchedAt','scope','hair','makeup','sources'],'appearance catalog');
  if (catalog.version !== 'appearance-catalog-v0.1' || !object(catalog.sources)) throw new Error('Invalid appearance catalog version or sources.');
  for (const module of ['hair','makeup']) {
    if (!object(catalog[module]) || !Object.keys(catalog[module]).length) throw new Error(`No ${module} catalog entries.`);
    const usedAliases=new Set();
    for (const [id,entry] of Object.entries(catalog[module])) {
      keys(entry,['id','label','category','geometry','sourceIds','evidenceStatus','perceptualWarnings','context','promptEn','occlusion','requirements','conflicts','materialModes','requires','authorship','historicalContext','trendContext','culturalContext','identityNote','geometryIs','accessories','aliases','referenceIds','family','variantOf'],`catalog.${module}.${id}`);
      if (entry.id!==id || typeof entry.label!=='string' || !entry.label.trim() || typeof entry.evidenceStatus!=='string') throw new Error(`Invalid catalog entry: ${id}.`);
      if (entry.aliases !== undefined && (!Array.isArray(entry.aliases) || entry.aliases.some(a=>typeof a!=='string' || !a.trim() || a!==a.trim() || a.length>100))) throw new Error(`Invalid aliases: ${id}.`);
      for (const alias of entry.aliases??[]) {
        if (Object.hasOwn(catalog[module],alias) || usedAliases.has(alias)) throw new Error(`Conflicting alias: ${alias}.`);
        usedAliases.add(alias);
      }
      if (entry.referenceIds!==undefined && (!Array.isArray(entry.referenceIds) || entry.referenceIds.some(x=>typeof x!=='string'||!x))) throw new Error(`Invalid reference IDs: ${id}.`);
      if (entry.family!==undefined && (typeof entry.family!=='string'||!entry.family)) throw new Error(`Invalid family: ${id}.`);
      if (entry.variantOf!==undefined && (typeof entry.variantOf!=='string'||entry.variantOf===id||!Object.hasOwn(catalog[module],entry.variantOf))) throw new Error(`Invalid variant parent: ${id}.`);
      geometry(entry.geometry,module,`catalog.${module}.${id}.geometry`);
      if (!Array.isArray(entry.sourceIds) || entry.sourceIds.some(source=>typeof source!=='string' || !Object.hasOwn(catalog.sources,source))) throw new Error(`Unknown source for catalog entry: ${id}.`);
      if (entry.accessories!==undefined) geometry({accessories:entry.accessories},module,`catalog.${module}.${id}`);
    }
  }
  return catalog;
}
validateAppearanceCatalog(appearanceCatalog);
