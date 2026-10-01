import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { batchProfiles, iterateProfile, profileDiff, digest, artifactFiles, writeImmutable, loadProfile } from '../src/iteration/variants.mjs';
import { compileFacePrompt } from '../src/compiler/gpt-image-2.5.mjs';
import { sampleProfile } from '../src/sampling/sample.mjs';
const legacyCatalog = JSON.parse(fs.readFileSync(new URL('../presets/archetypes.v0.1.json', import.meta.url), 'utf8'));
const sample = () => batchProfiles({archetypes:['beautiful','elegant'],seed:'synthetic-demo',count:4});
const tmp = t => {const p=fs.mkdtempSync(path.join(os.tmpdir(),'visage-versions-'));t.after(()=>fs.rmSync(p,{recursive:true,force:true}));return p;};
const cli = (...args) => spawnSync(process.execPath,['src/variants.mjs',...args],{encoding:'utf8'});

test('batch deterministic count/index seeds, prefixes stable, and standalone prompts',()=>{
  const a=sample(), b=sample();assert.deepEqual(a,b);assert.equal(a.candidates.length,4);
  assert.equal(new Set(a.candidates.map(c=>c.manifest.seed)).size,4);
  assert.deepEqual(batchProfiles({archetypes:['elegant','beautiful'],seed:'synthetic-demo',count:3}).candidates,a.candidates.slice(0,3));
  for(const [i,c] of a.candidates.entries()){assert.equal(c.manifest.candidate_index,i);assert.equal(compileFacePrompt(c.profile,c.manifest.compiler_options),c.prompt);}
});
test('batch validates bounds and seeds without coercion',()=>{
  for(const count of [0,17,1.2,'3',true,NaN,Infinity]) assert.throws(()=>batchProfiles({archetypes:['elegant'],count}));
  for(const seed of ['',42,'a'.repeat(1025)]) assert.throws(()=>batchProfiles({archetypes:['elegant'],seed}));
});
test('reroll eyes preserves face, nose, lips, demographics, metadata and exact missing fields',()=>{
  const {profile,manifest}=sample().candidates[1];profile.nose={tip_size:23};profile.subject.appearance='explicit fictional appearance';
  delete profile.eyebrows; // An intentionally sparse standalone import must stay sparse.
  const before=structuredClone(profile);
  const result=iterateProfile({profile,manifest:undefined,regions:['eyes'],seed:'eyes-2'});
  assert.deepEqual(profile,before);
  const a=structuredClone(before),b=structuredClone(result.profile);delete a.eyes;delete b.eyes;assert.deepEqual(b,a);
  assert.equal(Object.hasOwn(result.profile,'eyebrows'),false);
  assert.deepEqual(result.source,before);assert.equal(result.manifest.parent_profile_sha256,digest(before));
  assert.deepEqual(result,iterateProfile({profile,regions:['eyes'],seed:'eyes-2'}));
  assert.equal(result.prompt,compileFacePrompt(result.profile,result.manifest.compiler_options));
});
test('whole authored groups remain bounded and monotone; split groups fail',()=>{
  const {profile,manifest}=sample().candidates[0];
  for(let i=0;i<60;i++) {
    const r=iterateProfile({profile,manifest,regions:['outline','cheeks','eyes','lips','expression'],seed:`s${i}`});
    for(const [key,range] of Object.entries(r.manifest.resolved_ranges)){const [s,k]=key.split('.');assert.ok(r.profile[s][k]>=range.min && r.profile[s][k]<=range.max);}
  }
  profile.metadata.sampling.resolved_ranges['mouth.upper_lip_fullness'].group='eye';
  assert.throws(()=>iterateProfile({profile,regions:['eyes']}),/Partial correlation group/);
});
test('manual edits work independently and outside reroll mask, retain explicit zeros',()=>{
  const {profile,manifest}=sample().candidates[0];
  const result=iterateProfile({profile,manifest,regions:['eyes'],seed:'demo',edits:[{path:'eyebrows.brow_arch',value:0},{path:'nose.tip_size',value:44}]});
  assert.equal(result.profile.eyebrows.brow_arch,0);assert.equal(result.profile.nose.tip_size,44);
  assert.deepEqual(result.profile.mouth,profile.mouth);assert.equal(result.manifest.operation,'reroll-and-edit');
  assert.deepEqual(result.manifest.manual_edits,[{path:'eyebrows.brow_arch',value:0},{path:'nose.tip_size',value:44}]);
});
test('unsupported empty duplicate regions and conflicting edits fail',()=>{
  const {profile}=sample().candidates[0];
  for(const regions of [['styling'],['nope'],['eyes','eyes']]) assert.throws(()=>iterateProfile({profile,regions}));
  assert.throws(()=>iterateProfile({profile}));
  assert.throws(()=>iterateProfile({profile,regions:['eyes'],edits:[{path:'eyes.eye_size',value:50}]}),/conflict/);
  assert.throws(()=>iterateProfile({profile,edits:[{path:'nose.tip_size',value:50},{path:'nose.tip_size',value:51}]}),/Duplicate/);
});
test('unknown, malicious, parent, coercion and out-of-bounds paths cannot change profile',()=>{
  const profile={schema_version:'face-v0.2'};
  for(const p of ['eyes','eyes.nope','metadata.x','baseline_id.x','source.x','eyes.eye_size.x','__proto__.polluted','eyes.__proto__','constructor.prototype','schema_version.x']) assert.throws(()=>iterateProfile({profile,edits:[{path:p,value:50}]}),p);
  for(const value of [true,null,'50',NaN,Infinity,-1,101,{},[]]) assert.throws(()=>iterateProfile({profile,edits:[{path:'eyes.eye_size',value}]}));
  assert.equal({}.polluted,undefined);assert.deepEqual(profile,{schema_version:'face-v0.2'});
});
test('v0.1 sparse input retains version and metadata including null; no automatic migration/defaults',()=>{
  const profile={schema_version:'face-v0.1',metadata:null,eyes:{eye_size:0}};
  const result=iterateProfile({profile,edits:[{path:'eyes.eye_size',value:50}],seed:'one'});
  assert.deepEqual(result.profile,{...profile,eyes:{eye_size:50}});assert.deepEqual(result.manifest.compiler_options,{preset:'none',enhancers:false});
  assert.throws(()=>iterateProfile({profile,edits:[{path:'soft_tissue.lateral_cheek_fullness',value:50}]}),/Unknown control/);
  assert.throws(()=>iterateProfile({profile,regions:['eyes']}),/no resolved ranges/);
});
test('inherited capture/enhancer options include false/none; invalid combinations reject',()=>{
  const {profile}=sample().candidates[0];
  for(const opts of [{preset:'none',enhancers:false},{preset:'profile',enhancers:true},{preset:'calibration',enhancers:false}]) {
    const r=iterateProfile({profile,compilerOptions:opts,edits:[{path:'nose.tip_size',value:40}]});assert.deepEqual(r.manifest.compiler_options,opts);assert.equal(r.prompt,compileFacePrompt(r.profile,opts));
  }
  for(const opts of [{preset:'calibration',enhancers:true},{preset:'none',enhancers:'false'},{preset:'invalid',enhancers:false},{preset:'none',enhancers:false,unknown:1}]) assert.throws(()=>iterateProfile({profile,compilerOptions:opts,edits:[{path:'nose.tip_size',value:40}]}));
});
test('diff distinguishes missing and null and records unchanged text honestly',()=>{
  assert.deepEqual(profileDiff({metadata:null},{}),[{path:'metadata',before_present:true,before:null,after_present:false}]);
  const profile={schema_version:'face-v0.2',soft_tissue:{cheek_fullness:10,lateral_cheek_fullness:40}};
  const r=iterateProfile({profile,edits:[{path:'soft_tissue.cheek_fullness',value:90}]});assert.equal(r.manifest.prompt_changed,false);assert.match(r.diff,/10 -> 90/);
});
test('version sidecars round-trip, older version branches, all writes immutable',t=>{
  const dir=tmp(t),c=sample().candidates[0],p=path.join(dir,'v1');writeImmutable(p,artifactFiles(c));
  const a=loadProfile(path.join(p,'profile.json'));assert.deepEqual(a.profile,c.profile);
  const r=iterateProfile({...a,regions:['eyes'],seed:'next'});writeImmutable(path.join(dir,'v2'),artifactFiles(r));
  assert.equal(r.manifest.parent_revision_id,c.manifest.revision_id);
  const r2=iterateProfile({...loadProfile(path.join(dir,'v2','profile.json')),edits:[{path:'eyebrows.brow_arch',value:60}]});assert.equal(r2.manifest.parent_revision_id,r.manifest.revision_id);assert.deepEqual(r2.source,r.profile);
  assert.deepEqual(loadProfile(path.join(p,'profile.json')).profile,c.profile);
  assert.throws(()=>writeImmutable(p,artifactFiles(r)),/EEXIST/);assert.deepEqual(loadProfile(path.join(p,'profile.json')).profile,c.profile);
  const empty=path.join(dir,'empty');fs.mkdirSync(empty);assert.throws(()=>writeImmutable(empty,{}));
  fs.symlinkSync(p,path.join(dir,'link'));assert.throws(()=>writeImmutable(path.join(dir,'link'),artifactFiles(r)));
  fs.writeFileSync(path.join(p,'profile.json'),JSON.stringify({...c.profile,eyes:{eye_size:100}}));assert.throws(()=>loadProfile(path.join(p,'profile.json')),/differs from its manifest/);
});
test('v0.4 sampled sidecar interoperates without source modification',t=>{
  const dir=tmp(t),c=sampleProfile({archetypes:['elegant'],seed:'old',catalog:legacyCatalog});writeImmutable(path.join(dir,'v04'),artifactFiles(c));
  const r=iterateProfile({...loadProfile(path.join(dir,'v04','profile.json')),regions:['eyes'],seed:'new'});assert.deepEqual(r.profile.metadata,c.profile.metadata);
});
test('CLI batch select iterate compare and failures are usable',t=>{
  const dir=tmp(t),batch=path.join(dir,'batch'),v2=path.join(dir,'v2');
  let r=cli('batch','--archetype','beautiful,elegant','--count','3','--seed','review','--out-dir',batch);assert.equal(r.status,0,r.stderr);
  const before=path.join(batch,'candidate-002','profile.json'),after=path.join(v2,'profile.json');
  r=cli('iterate','--input',before,'--regions','eyes','--set','eyebrows.brow_arch=60','--seed','v2','--out-dir',v2);assert.equal(r.status,0,r.stderr);
  r=cli('compare','--before',before,'--after',after);assert.equal(r.status,0,r.stderr);assert.match(r.stdout,/eyes/);assert.match(r.stdout,/eyebrows/);
  for(const args of [['batch','--archetype','elegant','--count','2e0'],['iterate','--input',before,'--set','nose.tip_size=null'],['iterate','--input',before,'--regions','styling'],['iterate','--input',before,'--set','nose.tip_size=40','--preset','none'],['compare','--before',before,'--after',after,'--out-dir',dir]]) {r=cli(...args);assert.notEqual(r.status,0);assert.equal(r.stdout,'');}
  r=cli('iterate','--input',before,'--set','nose.tip_size=40','--out-dir',v2);assert.notEqual(r.status,0);assert.deepEqual(loadProfile(after).profile.eyebrows,{...loadProfile(before).profile.eyebrows,brow_arch:60});
});

test('fractional authored endpoints remain bounded after rounding',()=>{
  const profile={schema_version:'face-v0.2',eyes:{eye_size:0.001},metadata:{sampling:{resolved_ranges:{'eyes.eye_size':{min:0.001,mode:0.001,max:0.001,group:'eyes'}}}}};
  assert.equal(iterateProfile({profile,regions:['eyes']}).profile.eyes.eye_size,0.001);
});
test('immutable writer refuses ancestor symlinks and nesting inside saved history',t=>{
  const dir=tmp(t),real=path.join(dir,'real');fs.mkdirSync(real);fs.symlinkSync(real,path.join(dir,'link'));
  assert.throws(()=>writeImmutable(path.join(dir,'link','v1'),{'x':'x'}),/symlinks/);
  writeImmutable(path.join(real,'v1'),artifactFiles(sample().candidates[0]));
  assert.throws(()=>writeImmutable(path.join(real,'v1','child'),{'x':'x'}),/history is immutable/);
});

test('bundle and sidecar provenance cannot retain stale revision ids after tampering',t=>{
  const dir=tmp(t),candidate=sample().candidates[0],file=path.join(dir,'bundle.json');
  const bad=structuredClone(candidate);bad.profile.eyes.eye_size=99;fs.writeFileSync(file,JSON.stringify(bad));assert.throws(()=>loadProfile(file),/differs from its manifest/);
  assert.throws(()=>iterateProfile({profile:bad.profile,manifest:bad.manifest,edits:[{path:'nose.tip_size',value:40}]}),/differs from its manifest/);
  const out=path.join(dir,'v1');writeImmutable(out,artifactFiles(candidate));const manifest=structuredClone(candidate.manifest);manifest.compiler_options={preset:'none',enhancers:false};fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(manifest));assert.throws(()=>loadProfile(path.join(out,'profile.json')),/integrity/);
  for(const manifest of [null,{},'bad',{version:'unknown'}]) assert.throws(()=>iterateProfile({profile:candidate.profile,manifest,edits:[{path:'nose.tip_size',value:40}]}),/manifest/i);
});
