import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {createDefaultState,validateWorkbench,randomizeWorkbench,randomizeWorkbenchDetailed,compileWorkbench,compileWorkbenchDetails,importWorkbench,exportWorkbench} from '../src/workbench/state.mjs';
import {createConstraints,PROFILE_PATHS,NUMERIC_PATHS,LOCK_PATHS,isLocked,setLocks,regionPaths,lockState,samplingStatus} from '../src/workbench/constraints.mjs';
import {sampleProfile,defaultCatalog} from '../src/sampling/sample.mjs';
import {resolveAppearance} from '../src/appearance/modules.mjs';

const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const at=(value,key)=>key.split('.').reduce((value,key)=>value?.[key],value);
function freeze(value) {if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;}
function populated() {
  const state=createDefaultState();
  state.profile=sampleProfile({archetypes:state.archetypes,seed:'constrained-source'}).profile;
  state.profile.subject.appearance='a fictional adult with author-defined regional appearance';
  state.profile.subject.gender_presentation='androgynous';
  state.profile.skin={tone:'deep umber with a warm undertone'};
  state.profile.face_geometry.face_shape='author-described elongated face';
  state.profile.capture={view:'three quarter',lighting:'soft violet rim light',background:'hand-painted backdrop',head_yaw:0};
  state.body={version:'body-v0.1',state:'selected',controls:{shoulder_span:50,pelvic_span:0}};
  return state;
}

test('constraint defaults are independent; v0.1 import migrates without inventing locks',()=>{
  const one=createDefaultState(),two=createDefaultState();
  assert.equal(one.version,'workbench-v0.2');assert.deepEqual(one.constraints,createConstraints());
  one.constraints.locks.length=0;assert.ok(two.constraints.locks.length>0);
  const legacy=structuredClone(two);legacy.version='workbench-v0.1';delete legacy.constraints;
  const migrated=importWorkbench(JSON.stringify(legacy));
  assert.equal(migrated.version,'workbench-v0.2');assert.deepEqual(migrated.constraints.locks,[]);
  for(const key of Object.keys(legacy).filter(k=>k!=='version'))assert.deepEqual(migrated[key],legacy[key]);
  assert.deepEqual(importWorkbench(exportWorkbench(two)),two);
  for(const extra of ['constraints','sampling'])assert.throws(()=>importWorkbench(JSON.stringify({...legacy,[extra]:{}})));
});

test('lock catalog covers numeric, categorical, free-text, body and appearance paths',()=>{
  for(const key of ['profile.skin.tone','profile.subject.appearance','profile.face_geometry.face_shape','profile.eyes.upper_eyelid','profile.capture.lighting','appearance.hair','appearance.makeup','appearance.apparentAge','appearance.expression','body.controls.shoulder_span','headEnabled','capture'])assert.ok(LOCK_PATHS.includes(key),key);
  assert.ok(PROFILE_PATHS.includes('profile.face_geometry.cheek_to_chin_contour'));
  assert.ok(NUMERIC_PATHS.includes('appearance.apparentAge.years'));
  const state=createDefaultState(),eyes=regionPaths('eyes');
  assert.equal(lockState(state,eyes),'none');setLocks(state,[eyes[0]],true);assert.equal(lockState(state,eyes),'mixed');
  setLocks(state,eyes,true);assert.equal(lockState(state,eyes),'all');setLocks(state,eyes,false);assert.equal(lockState(state,eyes),'none');
  setLocks(state,['profile'],true);setLocks(state,['profile.nose.bridge_width'],false);
  assert.equal(isLocked(state,'profile.nose.bridge_width'),false);
  for(const key of PROFILE_PATHS.filter(p=>p!=='profile.nose.bridge_width'))assert.equal(isLocked(state,key),true,key);
  validateWorkbench(state);
});

test('locked zero, neutral, absent controls and exact free text survive rerolls without mutation',()=>{
  const state=populated();state.profile.eyes.eye_size=50;state.profile.eyes.eye_spacing=0;
  delete state.profile.nose;delete state.profile.eyebrows.brow_height;
  state.appearance.hair={state:'off'};state.appearance.makeup={state:'selected',preset:'makeup_bare',overrides:{palette:'author chosen terracotta'}};
  setLocks(state,['profile.eyes.eye_size','profile.eyes.eye_spacing','profile.eyebrows.brow_height','profile.nose','profile.capture','appearance.hair','appearance.expression','body.controls.pelvic_span'],true);
  const before=structuredClone(state);freeze(state);
  for(let i=0;i<12;i++){
    const next=randomizeWorkbench(state,'pins-'+i);
    assert.equal(next.profile.eyes.eye_size,50);assert.equal(next.profile.eyes.eye_spacing,0);
    assert.equal(Object.hasOwn(next.profile.eyebrows,'brow_height'),false);assert.equal(Object.hasOwn(next.profile,'nose'),false);
    assert.deepEqual(next.profile.capture,before.profile.capture);assert.equal(next.body.controls.pelvic_span,0);
    assert.deepEqual(next.appearance,before.appearance);assert.equal(Object.hasOwn(next.appearance,'expression'),false);
    for(const key of ['profile.subject.appearance','profile.subject.gender_presentation','profile.skin.tone','profile.face_geometry.face_shape'])assert.equal(at(next,key),at(before,key));
  }
  assert.deepEqual(state,before);
});

test('missing identity and appearance values remain absent under default and explicit locks',()=>{
  const state=createDefaultState();setLocks(state,['appearance.hair','appearance.makeup','appearance.expression','appearance.apparentAge'],true);
  const next=randomizeWorkbench(state,'missing-pins');
  assert.equal(Object.hasOwn(next.profile.subject,'appearance'),false);
  assert.equal(Object.hasOwn(next.profile.face_geometry,'face_shape'),false);
  assert.equal(next.profile.skin?.tone,undefined);assert.deepEqual(next.appearance,state.appearance);
});

test('all locked returns a real no-op including seed, prior provenance and absent fields',()=>{
  const state=populated();state.sampling={version:'workbench-sampler-v0.1',note:'previous result retained'};
  setLocks(state,LOCK_PATHS,true);const before=structuredClone(state);freeze(state);
  const result=randomizeWorkbenchDetailed(state,'unused-new-seed');
  assert.deepEqual(result.state,before);assert.notEqual(result.state,state);assert.equal(result.report.noOp,true);
  assert.deepEqual(result.report.changed,[]);assert.deepEqual(result.report.applied,[]);assert.ok(result.report.skipped.length>0);
  assert.deepEqual(state,before);
});

test('an eligible draw equal to the current value is also a no-op with no seed or history churn',()=>{
  const state=populated();state.constraints.includeBody=true;setLocks(state,LOCK_PATHS,true);setLocks(state,['body.controls.shoulder_span'],false);
  state.constraints.ranges['body.controls.shoulder_span']={min:50,max:50};const before=structuredClone(state);
  const result=randomizeWorkbenchDetailed(state,'same-value-seed');
  assert.equal(result.report.noOp,true);assert.deepEqual(result.report.applied,[]);assert.deepEqual(result.report.changed,[]);assert.deepEqual(result.state,before);assert.deepEqual(state,before);
});

test('unlocked author identity and category text is retained unless an explicit candidate pool changes it',()=>{
  const state=populated();state.constraints.locks=[];
  const first=randomizeWorkbench(state,'identity-kept');
  for(const key of ['profile.subject.appearance','profile.subject.gender_presentation','profile.skin.tone','profile.face_geometry.face_shape','profile.face_geometry.cheek_to_chin_contour'])assert.equal(at(first,key),at(state,key),key);
  state.constraints.choices={'profile.skin.tone':['exact candidate tone'],'profile.subject.gender_presentation':['feminine'],'profile.face_geometry.face_shape':['exact custom silhouette'],'profile.subject.appearance':['exact explicit appearance']};
  const next=randomizeWorkbench(state,'explicit-pool');
  for(const [key,values] of Object.entries(state.constraints.choices))assert.equal(at(next,key),values[0]);
});

test('selected morphology preset and numeric intersections bound every applied draw',()=>{
  const state=createDefaultState();state.constraints.morphologyBundles=['soft-oval'];
  state.constraints.ranges={'profile.face_geometry.face_length':{min:42.125,max:47.375},'profile.nose.tip_rotation':{min:45,max:49},'profile.eyes.eye_spacing':{min:12.125,max:12.125}};
  for(let i=0;i<30;i++){
    const next=randomizeWorkbench(state,'bounded-'+i);assert.equal(next.sampling.morphologyBundle,'soft-oval');
    for(const [key,bounds] of Object.entries(state.constraints.ranges))assert.ok(at(next,key)>=bounds.min&&at(next,key)<=bounds.max,key);
    for(const [key,range] of Object.entries(next.sampling.resolvedRanges))assert.ok(at(next,key)>=range.min&&at(next,key)<=range.max,key);
    assert.equal(next.profile.eyes.eye_spacing,12.125);
  }
});

test('pinning a correlated sibling skips its whole group and reports only actually applied ranges',()=>{
  const state=populated();state.profile.nose.bridge_width=50;delete state.profile.nose.alar_width;
  setLocks(state,['profile.nose.bridge_width'],true);const result=randomizeWorkbenchDetailed(state,'group-pin');
  assert.equal(result.state.profile.nose.bridge_width,50);assert.equal(Object.hasOwn(result.state.profile.nose,'alar_width'),false);
  const skip=result.report.skipped.find(s=>s.group==='nose_width');assert.ok(skip);
  assert.deepEqual([...skip.paths].sort(),['profile.nose.alar_width','profile.nose.bridge_width']);assert.deepEqual(skip.blockedPaths,['profile.nose.bridge_width']);
  for(const key of skip.paths){assert.ok(!result.report.applied.includes(key));assert.equal(Object.hasOwn(result.state.sampling.resolvedRanges,key),false);}
  assert.ok(result.report.applied.includes('profile.nose.nose_length'));
  setLocks(state,['profile.nose.bridge_width'],false);const unpinned=randomizeWorkbenchDetailed(state,'group-pin');
  for(const key of skip.paths)assert.ok(unpinned.report.applied.includes(key));
});

test('locked range and candidate conflicts reject rerolls without silently repairing source state',()=>{
  const numeric=createDefaultState();setLocks(numeric,['profile.eyes.eye_size'],true);numeric.constraints.ranges['profile.eyes.eye_size']={min:20,max:30};
  const choice=populated();choice.constraints.choices['profile.skin.tone']=['different tone'];
  for(const state of [numeric,choice]){
    validateWorkbench(state);const before=structuredClone(state);freeze(state);
    assert.throws(()=>randomizeWorkbench(state,'conflict'),/固定值/);assert.deepEqual(state,before);
  }
  const disjoint=createDefaultState();disjoint.constraints.morphologyBundles=['soft-oval'];disjoint.constraints.ranges['profile.nose.bridge_width']={min:0,max:10};
  const before=structuredClone(disjoint);assert.throws(()=>randomizeWorkbench(disjoint,'disjoint'),/无交集/);assert.deepEqual(disjoint,before);
});

test('locked exceptions inside custom bounds are not rejected merely for being outside authored ranges',()=>{
  const state=populated();state.profile.nose.bridge_width=10;setLocks(state,['profile.nose.bridge_width'],true);
  state.constraints.ranges['profile.nose.bridge_width']={min:0,max:20};const before=structuredClone(state);
  const result=randomizeWorkbenchDetailed(state,'authored-exception');
  assert.equal(result.state.profile.nose.bridge_width,10);assert.equal(result.state.profile.nose.alar_width,state.profile.nose.alar_width);
  assert.ok(result.report.skipped.some(s=>s.group==='nose_width'));assert.equal(result.state.sampling.resolvedRanges['profile.nose.bridge_width'],undefined);assert.deepEqual(state,before);
});

test('appearance candidate pools choose only declared presets, inherit or off; locks preserve selected overrides',()=>{
  const state=createDefaultState();state.constraints.choices={'appearance.hair':['blunt_bob'],'appearance.expression':['off'],'appearance.makeup':['inherit']};
  const next=randomizeWorkbench(state,'preset-pool');
  assert.deepEqual(next.appearance.hair,{state:'selected',preset:'blunt_bob'});assert.deepEqual(next.appearance.expression,{state:'off'});assert.equal(Object.hasOwn(next.appearance,'makeup'),false);
  assert.equal(next.sampling.appearanceResolution.modules.hair.preset,'blunt_bob');
  const pinned=createDefaultState();pinned.appearance.hair={state:'selected',preset:'blunt_bob',overrides:{color:'author-defined blue',accessories:[]}};
  setLocks(pinned,['appearance.hair'],true);pinned.constraints.choices['appearance.hair']=['blunt_bob','pixie'];
  assert.deepEqual(randomizeWorkbench(pinned,'locked-preset').appearance.hair,pinned.appearance.hair);
  setLocks(pinned,['appearance.hair'],false);const before=structuredClone(pinned);
  assert.throws(()=>randomizeWorkbench(pinned,'override-conflict'),/自定义覆盖/);assert.deepEqual(pinned,before);
});

test('selected, off and inherited modules and their legacy backing text are preserved',()=>{
  const state=populated();state.appearance.hair={state:'selected',preset:'blunt_bob',overrides:{color:'bespoke copper'}};state.appearance.makeup={state:'off'};
  setLocks(state,['appearance.expression'],true);
  const next=randomizeWorkbench(state,'module-state');assert.deepEqual(next.appearance,state.appearance);
  for(const section of ['hair','makeup','expression'])assert.deepEqual(next.profile[section],state.profile[section]);
});

test('body reroll is opt-in, and its explicit scope survives export/import',()=>{
  const state=populated();assert.equal(state.constraints.includeBody,false);
  state.constraints.ranges['body.controls.shoulder_span']={min:20,max:30};
  const defaultResult=randomizeWorkbench(state,'default-head-only');assert.deepEqual(defaultResult.body,state.body);
  assert.ok(!defaultResult.sampling.applied.some(p=>p.startsWith('body.')));
  state.constraints.includeBody=true;const restored=importWorkbench(exportWorkbench(state));assert.equal(restored.constraints.includeBody,true);
  const included=randomizeWorkbench(restored,'include-body');assert.ok(included.body.controls.shoulder_span>=20&&included.body.controls.shoulder_span<=30);
  assert.ok(included.sampling.applied.includes('body.controls.shoulder_span'));assert.deepEqual(state.body,{version:'body-v0.1',state:'selected',controls:{shoulder_span:50,pelvic_span:0}});
});

test('body rerolls only active declared axes; off body and disabled head retain exact values',()=>{
  const state=populated();state.constraints.includeBody=true;state.headEnabled=false;state.constraints.ranges['body.controls.shoulder_span']={min:25,max:30};
  setLocks(state,['body.controls.pelvic_span'],true);const next=randomizeWorkbench(state,'body-active');
  assert.deepEqual(Object.keys(next.body.controls).sort(),Object.keys(state.body.controls).sort());
  assert.ok(next.body.controls.shoulder_span>=25&&next.body.controls.shoulder_span<=30);assert.equal(next.body.controls.pelvic_span,0);
  for(const section of ['face_geometry','soft_tissue','eyes','eyebrows','nose','mouth'])assert.deepEqual(next.profile[section],state.profile[section]);
  const off=structuredClone(state);off.body.state='off';assert.deepEqual(randomizeWorkbench(off,'body-off').body,off.body);
});

test('explicit apparent-age bounds apply only to selected adult module and respect module lock',()=>{
  const state=createDefaultState();state.appearance.apparentAge={state:'selected',years:50};state.constraints.ranges['appearance.apparentAge.years']={min:31,max:33};
  const next=randomizeWorkbench(state,'adult-age');assert.ok(Number.isInteger(next.appearance.apparentAge.years));assert.ok(next.appearance.apparentAge.years>=31&&next.appearance.apparentAge.years<=33);
  state.appearance.apparentAge={state:'off'};assert.deepEqual(randomizeWorkbench(state,'age-off').appearance.apparentAge,{state:'off'});
  delete state.appearance.apparentAge;assert.equal(Object.hasOwn(randomizeWorkbench(state,'age-absent').appearance,'apparentAge'),false);
});

test('constrained provenance describes the actual result without rewriting original sampler history',()=>{
  const state=populated(),before=structuredClone(state);freeze(state);
  const first=randomizeWorkbenchDetailed(state,'audit-seed'),second=randomizeWorkbenchDetailed(state,'audit-seed');assert.deepEqual(first,second);
  const next=first.state,record=next.sampling;
  assert.deepEqual(next.profile.metadata,before.profile.metadata);assert.deepEqual(state,before);
  assert.equal(record.version,'workbench-sampler-v0.1');assert.equal(record.seed,'audit-seed');assert.deepEqual(record.constraints,before.constraints);
  assert.equal(record.profileSha256,hash(next.profile));assert.equal(record.parentProfileSha256,hash(before.profile));assert.equal(record.sourceSamplingSha256,hash(before.profile.metadata.sampling));assert.equal(record.catalogSha256,hash(defaultCatalog));
  assert.deepEqual(record.appearanceResolution,resolveAppearance(next.appearance,{preset:'profile',enhancers:true,profile:next.profile}));
  assert.deepEqual([...first.report.applied].sort(),record.applied);assert.deepEqual([...first.report.changed].sort(),record.changed);
  for(const key of first.report.changed)assert.notDeepEqual(at(next,key),at(before,key));
  assert.deepEqual(importWorkbench(exportWorkbench(next)),next);assert.equal(compileWorkbench(next),compileWorkbench(second.state));
});

test('unknown, unsafe, malformed or coercible constraint inputs are rejected atomically',()=>{
  const mutations=[
    c=>c.extra=true,c=>c.includeBody='true',c=>c.version='future',c=>c.locks=['profile.__proto__'],c=>c.locks=['profile.eyes.eye_size','profile.eyes.eye_size'],c=>c.locks='profile',
    c=>c.ranges={'profile.eyes.eye_size':{min:'20',max:60}},c=>c.ranges={'profile.eyes.eye_size':{min:NaN,max:60}},c=>c.ranges={'profile.eyes.eye_size':{min:61,max:60}},c=>c.ranges={'profile.eyes.eye_size':{min:0,max:101}},c=>c.ranges={'profile.eyes.eye_size':{min:0,max:10,mode:5}},c=>c.ranges={'profile.skin.tone':{min:0,max:100}},c=>c.ranges={'appearance.apparentAge.years':{min:18.5,max:40}},
    c=>c.choices={'profile.skin.tone':[]},c=>c.choices={'profile.skin.tone':['x','x']},c=>c.choices={'profile.skin.tone':[50]},c=>c.choices={'appearance.hair':['unknown-preset']},c=>c.choices={'profile.subject.age_group':['child']},
    c=>c.morphologyBundles=[],c=>c.morphologyBundles=['unknown'],c=>c.morphologyBundles=['soft-oval','soft-oval']
  ];
  for(const mutate of mutations){const state=createDefaultState();mutate(state.constraints);const before=structuredClone(state);assert.throws(()=>validateWorkbench(state));assert.throws(()=>randomizeWorkbench(state,'bad'));assert.deepEqual(state,before);}
  const valid=createDefaultState();for(const seed of ['', ' ',2001,'x'.repeat(201)]){assert.throws(()=>randomizeWorkbench(valid,seed));}
  assert.deepEqual(valid,createDefaultState());
});

test('unsafe nested import keys and unsupported state versions never reach active state',()=>{
  const state=createDefaultState(),before=exportWorkbench(state);
  for(const text of ['{"version":"workbench-v0.2","constraints":{"__proto__":{}}}',before.replace('"locks": [','"constructor": {}, "locks": ['),before.replace('"ranges": {}','"ranges": {"prototype": {}}'),before.replace('workbench-v0.2','workbench-v0.99')])assert.throws(()=>importWorkbench(text));
  assert.equal(exportWorkbench(state),before);assert.equal({}.polluted,undefined);
});

test('accepted legacy face schema migrates only when new regional fields are applied; all-locked is unchanged',()=>{
  const state=createDefaultState();state.profile.schema_version='face-v0.1';const before=structuredClone(state);validateWorkbench(state);
  const next=randomizeWorkbench(state,'legacy-face-schema');validateWorkbench(next);
  assert.equal(next.profile.schema_version,'face-v0.2');assert.equal(typeof next.profile.soft_tissue.upper_medial_cheek_fullness,'number');assert.ok(next.sampling.applied.includes('profile.schema_version'));assert.ok(next.sampling.changed.includes('profile.schema_version'));assert.deepEqual(state,before);
  setLocks(state,LOCK_PATHS,true);const pinnedBefore=structuredClone(state),pinned=randomizeWorkbenchDetailed(state,'legacy-pinned');assert.deepEqual(pinned.state,pinnedBefore);assert.equal(pinned.report.noOp,true);
});

test('offline browser shares exact constrained state, report, provenance and prompt with Node',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'visage-constraints-bundle-'));
  try{
    for(const name of ['src','schemas','presets','scripts'])fs.cpSync(new URL(`../${name}`,import.meta.url),path.join(dir,name),{recursive:true});
    fs.mkdirSync(path.join(dir,'web'));fs.writeFileSync(path.join(dir,'web/index.html'),'<html><script type="module" src="./app.mjs"></script></html>');
    const fixture=populated();fixture.constraints.includeBody=true;fixture.constraints.locks.push('profile.nose.bridge_width');fixture.constraints.morphologyBundles=['soft-oval'];fixture.constraints.ranges['body.controls.shoulder_span']={min:40,max:60};fixture.constraints.choices['appearance.hair']=['blunt_bob','off'];
    fs.writeFileSync(path.join(dir,'web/app.mjs'),`import { randomizeWorkbenchDetailed,compileWorkbench } from '../src/workbench/state.mjs';\nconst state=${JSON.stringify(fixture)};const results=[];for(let i=0;i<8;i++){const result=randomizeWorkbenchDetailed(state,'constraint-browser-'+i);results.push({...result,prompt:compileWorkbench(result.state)});}globalThis.result=JSON.stringify(results);`);
    const build=spawnSync(process.execPath,['scripts/build-web.mjs'],{cwd:dir,encoding:'utf8'});assert.equal(build.status,0,build.stderr);
    const html=fs.readFileSync(path.join(dir,'dist/visage-workbench.html'),'utf8');assert.ok(!/\beval\s*\(|\bfetch\s*\(|<script[^>]+src=/.test(html));
    // Clone inside the VM realm, as browsers do; a host structuredClone would create foreign prototypes.
    const context={TextEncoder};vm.runInNewContext('globalThis.structuredClone=x=>JSON.parse(JSON.stringify(x));'+html.match(/<script>([\s\S]*)<\/script>/)[1],context,{timeout:10000});
    const expected=Array.from({length:8},(_,i)=>{const result=randomizeWorkbenchDetailed(fixture,'constraint-browser-'+i);return {...result,prompt:compileWorkbench(result.state)};});
    assert.deepEqual(JSON.parse(context.result),expected);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});


test('disabled head suppresses explicit face-shape candidate choices without inventing absent values',()=>{
  for(const shape of [undefined,'my exact authored silhouette']){
    const state=createDefaultState();state.headEnabled=false;
    if(shape!==undefined)state.profile.face_geometry.face_shape=shape;
    setLocks(state,['profile.face_geometry.face_shape'],false);
    state.constraints.choices['profile.face_geometry.face_shape']=['candidate replacement'];
    const before=structuredClone(state);freeze(state);
    const result=randomizeWorkbenchDetailed(state,'disabled-face-shape');
    assert.deepEqual(result.state.profile.face_geometry,before.profile.face_geometry);
    assert.equal(Object.hasOwn(result.state.profile.face_geometry,'face_shape'),shape!==undefined);
    assert.ok(!result.report.applied.includes('profile.face_geometry.face_shape'));assert.deepEqual(state,before);
  }
});

test('locked skin warning covers active inherited legacy makeup and disappears for explicit makeup off',()=>{
  const state=populated();state.profile.makeup={intensity:25,base:'warm tinted foundation'};
  delete state.appearance.makeup;const before=structuredClone(state);
  const inherited=compileWorkbenchDetails(state);assert.ok(inherited.warnings.some(w=>w.includes('肤色固定')));assert.deepEqual(state,before);
  state.appearance.makeup={state:'off'};assert.ok(!compileWorkbenchDetails(state).warnings.some(w=>w.includes('肤色固定')));
  state.appearance.makeup={state:'selected',preset:'makeup_bare'};assert.ok(compileWorkbenchDetails(state).warnings.some(w=>w.includes('肤色固定')));
  setLocks(state,['profile.skin.tone'],false);assert.ok(!compileWorkbenchDetails(state).warnings.some(w=>w.includes('肤色固定')));
  const sparse=createDefaultState();assert.ok(!compileWorkbenchDetails(sparse).warnings.some(w=>w.includes('肤色固定')));
});

test('sampling status detects subsequent edits and exports honest historical provenance without mutation',()=>{
  assert.equal(samplingStatus(createDefaultState()),'none');
  const sampled=randomizeWorkbench(populated(),'provenance-current');
  assert.equal(samplingStatus(sampled),'current');assert.equal(sampled.sampling.status,'current');
  assert.match(sampled.sampling.configurationSha256,/^[0-9a-f]{64}$/);
  assert.equal(sampled.sampling.configurationSha256,hash({profile:sampled.profile,appearance:sampled.appearance,body:sampled.body,capture:sampled.capture,headEnabled:sampled.headEnabled,archetypes:sampled.archetypes,constraints:sampled.constraints,seed:sampled.seed}));
  assert.ok(!compileWorkbenchDetails(sampled).warnings.some(w=>w.includes('历史记录')));
  assert.equal(JSON.parse(exportWorkbench(sampled)).sampling.status,'current');
  const edits=[
    state=>state.profile.eyes.eye_size=0,
    state=>state.appearance.expression={state:'off'},
    state=>state.constraints.includeBody=true,
    state=>state.body.controls.shoulder_span=0,
    state=>state.capture='full_body',
    state=>state.headEnabled=false,
    state=>state.archetypes=['beautiful'],
    state=>state.seed='manually-replaced-seed'
  ];
  for(const edit of edits){
    const state=structuredClone(sampled);edit(state);const before=structuredClone(state),record=structuredClone(state.sampling);freeze(state);
    assert.equal(samplingStatus(state),'historical');
    const details=compileWorkbenchDetails(state);assert.ok(details.warnings.some(w=>w.includes('历史记录')));assert.equal(details.prompt,compileWorkbench(state));
    const exported=JSON.parse(exportWorkbench(state));assert.equal(exported.sampling.status,'historical');
    assert.deepEqual(exported.sampling,{...record,status:'historical'});assert.equal(samplingStatus(importWorkbench(JSON.stringify(exported))),'historical');
    assert.deepEqual(state,before);assert.deepEqual(state.sampling,record);assert.equal(state.sampling.status,'current');
  }
  const edited=structuredClone(sampled);edited.profile.eyes.eye_size=0;
  const rerolled=randomizeWorkbench(edited,'fresh-after-manual-edit');assert.equal(samplingStatus(rerolled),'current');assert.equal(rerolled.sampling.status,'current');
});
