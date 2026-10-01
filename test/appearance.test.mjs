import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { APPEARANCE_VERSION, appearanceCatalog, resolveAppearance, validateAppearance, validateAppearanceCatalog } from '../src/appearance/modules.mjs';
import { compileFacePrompt } from '../src/compiler/gpt-image-2.5.mjs';
import { sampleProfile } from '../src/sampling/sample.mjs';
import { batchProfiles, iterateProfile, artifactFiles, writeImmutable, loadProfile } from '../src/iteration/variants.mjs';
const off = {version:APPEARANCE_VERSION,hair:{state:'off'},makeup:{state:'off'},expression:{state:'off'}};
const profile={schema_version:'face-v0.2',subject:{age_group:'adult'},face_geometry:{face_width:42},hair:{color:'legacy_red'},makeup:{intensity:80,lip_color:'legacy_blue'},expression:{expression:'legacy_angry'}};
const selected = () => ({version:APPEARANCE_VERSION,hair:{state:'selected',preset:Object.keys(appearanceCatalog.hair)[0]},makeup:{state:'selected',preset:Object.keys(appearanceCatalog.makeup)[0]}});
test('appearance absent is exactly legacy compatible; off suppresses only owned blocks',()=>{
  assert.equal(compileFacePrompt(profile,{preset:'none',enhancers:true}),compileFacePrompt(profile,{preset:'none',enhancers:true,appearance:{version:APPEARANCE_VERSION}}));
  const p=compileFacePrompt(profile,{preset:'none',enhancers:true,appearance:off});
  assert.doesNotMatch(p,/legacy/);assert.match(p,/facial width/);
  assert.doesNotThrow(()=>compileFacePrompt(profile,{appearance:off}));
});
test('selected replaces legacy once; works without enhancers; no profile mutation',()=>{
  const before=structuredClone(profile), appearance=selected();
  const p=compileFacePrompt(profile,{preset:'none',enhancers:true,appearance});
  assert.doesNotMatch(p,/legacy red|legacy blue/);assert.match(p,/legacy angry/);
  assert.equal(p.split('Hair styling:').length,2);assert.equal(p.split('Makeup application:').length,2);
  assert.match(compileFacePrompt(profile,{preset:'none',appearance}),/Hair styling:/);
  assert.deepEqual(profile,before);
});
test('appearance rejects unknown shape, versions, presets, inactive data and malformed overrides',()=>{
  for(const x of [null,[],{}, {version:'bad'}, {version:APPEARANCE_VERSION,unknown:{}}, {version:APPEARANCE_VERSION,expression:{state:'selected',preset:['frown']}}, {...off,hair:{state:'inherit'}}, {...off,hair:{state:'off',preset:'a'}}, {...off,hair:{state:'selected',preset:'constructor'}}, {...selected(),hair:{...selected().hair,overrides:{foo:'a'}}}, {...selected(),hair:{...selected().hair,overrides:{accessories:'pearl'}}}, {...selected(),makeup:{...selected().makeup,overrides:{coverage:3}}}]) assert.throws(()=>validateAppearance(x));
});
test('each module selected is incompatible with calibration; no silent fallback',()=>{
  for(const appearance of [selected(),{version:APPEARANCE_VERSION,expression:{state:'selected',preset:'slight_smile'}},{version:APPEARANCE_VERSION,apparentAge:{state:'selected',years:45}}]) assert.throws(()=>compileFacePrompt(profile,{appearance}),/conflict/);
});
test('adult apparent age replaces legacy age, validates bounds and does not edit anatomy',()=>{
  const p={...profile,subject:{age_group:'young_adult'}};
  for(const years of [18,45,90]) {
    const appearance={version:APPEARANCE_VERSION,apparentAge:{state:'selected',years}};
    const prompt=compileFacePrompt(p,{preset:'none',appearance});assert.match(prompt,new RegExp(`approximately ${years} years old`));assert.doesNotMatch(prompt,/young adult/);
    assert.match(resolveAppearance(appearance).warnings.join(' '),/soft tissue/);
  }
  for(const years of [17,91,18.5,'40',null]) assert.throws(()=>validateAppearance({version:APPEARANCE_VERSION,apparentAge:{state:'selected',years}}));
  assert.equal(p.subject.age_group,'young_adult');
});
test('expression replaces legacy and reports moving geometry; age alone preserves other modules',()=>{
  const appearance={version:APPEARANCE_VERSION,expression:{state:'selected',preset:'broad_smile'}};
  const p=compileFacePrompt(profile,{preset:'none',enhancers:true,appearance});assert.doesNotMatch(p,/legacy angry/);assert.match(p,/legacy red/);assert.match(p,/raised cheeks/);
  assert.match(resolveAppearance(appearance).warnings.join(' '),/pixel-level/);
});
test('overrides take precedence only in selected module and report loss of preset guarantees',()=>{
  const appearance=selected();appearance.hair.overrides={part:'deep left part',accessories:[]};
  const r=resolveAppearance(appearance);assert.equal(r.modules.hair.resolved.part,'deep left part');assert.deepEqual(r.modules.hair.resolved.accessories,[]);assert.match(r.warnings.join(' '),/compatibility/);
  assert.equal(r.catalog_sha256.length,64);
});
test('all curated entries compile with source coverage and report visual impacts',()=>{
  for(const module of ['hair','makeup']) {
    assert.ok(Object.keys(appearanceCatalog[module]).length>=3);
    for(const [id,entry] of Object.entries(appearanceCatalog[module])) {
      assert.ok(entry.sourceIds.length>0 || entry.evidenceStatus==='generic_geometry',id);for(const source of entry.sourceIds) assert.ok(appearanceCatalog.sources[source],`${id}: ${source}`);
      const r=resolveAppearance({version:APPEARANCE_VERSION,[module]:{state:'selected',preset:id}});assert.ok(r.paragraphs[0].length>30);assert.ok(r.modules[module].impact);
    }
  }
});
test('sampling and batch module application preserve morphology random draws',()=>{
  const a=sampleProfile({archetypes:['beautiful'],seed:'module-lock'}),b=sampleProfile({archetypes:['beautiful'],seed:'module-lock',appearance:selected()});
  for(const region of ['face_geometry','soft_tissue','eyes','eyebrows','nose','mouth']) assert.deepEqual(a.profile[region],b.profile[region]);
  assert.deepEqual(b.manifest.compiler_options.appearance,selected());assert.equal(b.prompt,compileFacePrompt(b.profile,b.manifest.compiler_options));
  const batch=batchProfiles({archetypes:['beautiful'],seed:'module-lock',count:2,appearance:selected()});for(const c of batch.candidates) assert.deepEqual(c.manifest.compiler_options.appearance,selected());
});
test('module-only iteration is versioned without touching any profile fields; inherited for subsequent face edits',()=>{
  const a=sampleProfile({archetypes:['beautiful'],seed:'module-iteration'});
  const b=iterateProfile({...a,appearance:selected(),seed:'v2'});assert.deepEqual(a.profile,b.profile);assert.equal(b.manifest.diff.length,0);assert.ok(b.manifest.appearance_diff.length);assert.match(b.diff,/Appearance config/);assert.ok(b.manifest.prompt_changed);
  const c=iterateProfile({...b,edits:[{path:'eyes.eye_size',value:31}],seed:'v3'});assert.deepEqual(c.manifest.compiler_options.appearance,selected());assert.deepEqual(c.manifest.source_compiler_options.appearance,selected());
  assert.throws(()=>iterateProfile({...c,compilerOptions:{preset:'calibration',enhancers:false},edits:[{path:'eyes.eye_size',value:30}]}),/conflict/);
});
test('saved module revision round trips; config tampering fails manifest integrity',t=>{
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'visage-modules-'));t.after(()=>fs.rmSync(tmp,{recursive:true,force:true}));
  const a=iterateProfile({profile,appearance:selected(),seed:'saved'});writeImmutable(path.join(tmp,'v1'),artifactFiles(a));const read=loadProfile(path.join(tmp,'v1/profile.json'));assert.deepEqual(read.manifest.compiler_options.appearance,selected());assert.ok(fs.existsSync(path.join(tmp,'v1/appearance.json')));
  const manifest=JSON.parse(fs.readFileSync(path.join(tmp,'v1/manifest.json'),'utf8'));manifest.compiler_options.appearance=off;fs.writeFileSync(path.join(tmp,'v1/manifest.json'),JSON.stringify(manifest));assert.throws(()=>loadProfile(path.join(tmp,'v1/profile.json')),/integrity/);
});
test('CLI build/sample/batch/iterate support explicit appearance JSON',t=>{
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'visage-cli-modules-'));t.after(()=>fs.rmSync(tmp,{recursive:true,force:true}));
  const file=path.join(tmp,'appearance.json');fs.writeFileSync(file,JSON.stringify(selected()));
  const run=(script,args)=>{const p=spawnSync(process.execPath,[script,...args],{encoding:'utf8'});assert.equal(p.status,0,p.stderr);return p.stdout;};
  assert.match(run('src/cli.mjs',['baselines/example_synthetic_face_001.json','--preset','none','--appearance',file]),/Hair styling:/);
  const s=JSON.parse(run('src/sample.mjs',['--archetype','beautiful','--seed','x','--appearance',file]));assert.deepEqual(s.manifest.compiler_options.appearance,selected());
  run('src/variants.mjs',['batch','--archetype','beautiful','--count','1','--seed','x','--appearance',file,'--out-dir',path.join(tmp,'batch')]);
  const revised=JSON.parse(run('src/variants.mjs',['iterate','--input',path.join(tmp,'batch/candidate-001/profile.json'),'--appearance',file]));assert.deepEqual(revised.manifest.compiler_options.appearance,selected());
});

test('sample-origin compiler option tampering is rejected rather than replayed',()=>{
  const a=sampleProfile({archetypes:['elegant'],seed:'review',appearance:{version:APPEARANCE_VERSION,apparentAge:{state:'selected',years:25}}});
  const manifest=structuredClone(a.manifest);manifest.compiler_options.appearance.apparentAge.years=90;
  assert.throws(()=>iterateProfile({profile:a.profile,manifest,edits:[{path:'eyes.eye_size',value:50}]}),/provenance/);
});

test('catalog rejects unknown data; resolved metadata cannot mutate catalog',()=>{
  const malformed=structuredClone(appearanceCatalog);malformed.hair.blunt_bob.geometry.typo='broken';assert.throws(()=>validateAppearanceCatalog(malformed),/Unknown/);
  const unknownSource=structuredClone(appearanceCatalog);unknownSource.hair.blunt_bob.sourceIds=['missing'];assert.throws(()=>validateAppearanceCatalog(unknownSource),/source/);
  const appearance={version:APPEARANCE_VERSION,hair:{state:'selected',preset:'liangbatou_reference'}};
  const r=resolveAppearance(appearance);assert.match(r.paragraphs[0],/bianfang/);r.modules.hair.resolved.accessories.push('mutated');r.modules.hair.sources[0].url='changed';assert.doesNotMatch(resolveAppearance(appearance).paragraphs[0],/mutated/);assert.notEqual(resolveAppearance(appearance).modules.hair.sources[0].url,'changed');
  const altered=resolveAppearance({...appearance,hair:{...appearance.hair,overrides:{part:'side part'}}});assert.equal(altered.modules.hair.occlusion,null);assert.match(altered.modules.hair.occlusionStatus,/reassessment/);
});
test('calibration owns capture constraints even when legacy appearance blocks are off',()=>{
  const p=compileFacePrompt(profile,{appearance:off});assert.match(p,/minimal makeup/);assert.match(p,/relaxed neutral expression/);
});
test('compare CLI exposes module-only option changes',t=>{
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'visage-compare-modules-'));t.after(()=>fs.rmSync(tmp,{recursive:true,force:true}));
  const a=iterateProfile({profile,appearance:off,seed:'a'});const b=iterateProfile({...a,appearance:selected(),seed:'b'});
  for(const [name,value]of [['a',a],['b',b]])writeImmutable(path.join(tmp,name),artifactFiles(value));
  const p=spawnSync(process.execPath,['src/variants.mjs','compare','--before',path.join(tmp,'a/profile.json'),'--after',path.join(tmp,'b/profile.json')],{encoding:'utf8'});assert.equal(p.status,0,p.stderr);assert.match(p.stdout,/Compiler option changes/);assert.match(p.stdout,/appearance.hair/);
});

test('v0.7 exact aliases resolve to canonical structural prompts without identity leakage',()=>{
  const config=preset=>({version:APPEARANCE_VERSION,hair:{state:'selected',preset}});
  for(const alias of ['公主切','姬发式','hime_cut']) {
    const r=resolveAppearance(config(alias));assert.equal(r.modules.hair.preset,'hime_geometry');assert.equal(r.modules.hair.requestedPreset,alias);
    assert.equal(compileFacePrompt(profile,{preset:'none',appearance:config(alias)}),compileFacePrompt(profile,{preset:'none',appearance:config('hime_geometry')}));
  }
  for(const typo of ['公主切 ','Hime_cut','twin_drill','双环望仙髻','飞天髻','ming-diji-curl']) assert.throws(()=>resolveAppearance(config(typo)),/Unknown/);
  for(const id of ['twin_drills','double_bun_tails','side_loop_tails','braided_low_updo','wuman_reference','open_double_loop_reference']) {
    const r=resolveAppearance(config(id));assert.ok(r.modules.hair.sources.length);assert.ok(r.modules.hair.referenceIds.length);
    assert.doesNotMatch(r.paragraphs.join(' '),/鹿目圆|美少女|Sailor|Violet|唐|朝代|museum|Madoka/i);
  }
});
test('v0.7 catalog aliases reject ambiguity, canonical collisions, malformed values and invalid variants',()=>{
  for(const aliases of [['blunt_bob'],['公主切'],['same','same'],[' spaced '],[42],'alias']) {
    const c=structuredClone(appearanceCatalog);c.hair.pixie.aliases=aliases;assert.throws(()=>validateAppearanceCatalog(c),/alias/i);
  }
  for(const variantOf of ['missing','pixie',42]) {const c=structuredClone(appearanceCatalog);c.hair.pixie.variantOf=variantOf;assert.throws(()=>validateAppearanceCatalog(c),/variant/i);}
  const c=structuredClone(appearanceCatalog);c.hair.pixie.alias=['typo'];assert.throws(()=>validateAppearanceCatalog(c),/Unknown/);
});
test('v0.7 source catalog references all resolve and contains no local private image paths',()=>{
  const catalog=JSON.parse(fs.readFileSync(new URL('../presets/hair-references.v0.7.json',import.meta.url),'utf8'));
  assert.equal(catalog.entries.length,42);const refs=new Map(catalog.entries.map(e=>[e.id,e]));
  for(const e of Object.values(appearanceCatalog.hair)) for(const id of e.referenceIds??[]) assert.ok(refs.has(id));
  for(const e of catalog.entries) for(const image of e.images) {assert.equal(image.path,undefined);assert.match(image.url,/^https:\/\//);assert.ok(image.rights);}
  for(const id of ['ming-diji-curl','ming-diji-horn']) {assert.equal(refs.get(id).status,'accessory_reference');assert.ok(!Object.values(appearanceCatalog.hair).some(e=>e.referenceIds?.includes(id)));}
});
test('v0.7 saved demos retain their historical hashes; current compiler preserves geometry and capture',()=>{
  const dir=new URL('../examples/hair-v0.7/',import.meta.url);const base=JSON.parse(fs.readFileSync(new URL('base-profile.json',dir),'utf8'));
  for(const name of ['anime-twin-drills','historical-double-loops']) {
    const m=JSON.parse(fs.readFileSync(new URL(name+'.manifest.json',dir),'utf8'));
    const actual=compileFacePrompt(base,m.compiler_options)+'\n';const saved=fs.readFileSync(new URL(name+'.prompt.txt',dir),'utf8'); assert.equal(createHash('sha256').update(saved).digest('hex'),m.prompt_sha256);
    assert.equal(actual.split('Hair styling:')[1],saved.split('Hair styling:')[1]);
    assert.match(actual,/entire head and complete hairstyle visible/);assert.match(actual,/adult, approximately 25 years old/);assert.match(actual,/East Asian/);assert.match(actual,/beautiful, elegant/);
    assert.throws(()=>compileFacePrompt(base,{...m.compiler_options,preset:'calibration'}),/conflict/);
  }
});
test('appearance refuses inherited config, module and geometry properties including calibration bypass',()=>{
  const inherited=Object.assign(Object.create({hair:{state:'selected',preset:'公主切'}}),{version:APPEARANCE_VERSION});
  const inheritedVersion=Object.create({version:APPEARANCE_VERSION});
  const inheritedState={version:APPEARANCE_VERSION,hair:Object.assign(Object.create({state:'selected'}),{preset:'公主切'})};
  const inheritedPreset={version:APPEARANCE_VERSION,hair:Object.assign(Object.create({preset:'公主切'}),{state:'selected'})};
  const inheritedGeometry={version:APPEARANCE_VERSION,hair:{state:'selected',preset:'公主切',overrides:Object.create({color:'red'})}};
  for(const x of [inherited,inheritedVersion,inheritedState,inheritedPreset,inheritedGeometry]) {
    assert.throws(()=>validateAppearance(x),/object/);assert.throws(()=>resolveAppearance(x,{preset:'calibration'}));
  }
});
