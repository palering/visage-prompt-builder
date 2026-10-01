import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {BODY_AXES,validateBody,describeBodyValue} from '../src/body/body.mjs';
import {compileFacePrompt} from '../src/compiler/gpt-image-2.5.mjs';
import {createDefaultState,compileWorkbench,validateWorkbench,importWorkbench,exportWorkbench,randomizeWorkbench} from '../src/workbench/state.mjs';
import {sha256} from '../src/workbench/browser-crypto.mjs';
const profile={schema_version:'face-v0.2',subject:{age_group:'adult'},face_geometry:{face_width:50},capture:{camera_distance:'head and shoulders portrait'}};
const body=(controls={},state='selected')=>({version:'body-v0.1',state,controls});
test('body off preserves every legacy preset byte for byte',()=>{
 for(const preset of ['calibration','profile','none'])for(const enhancers of [false,true]){if(preset==='calibration'&&enhancers)continue;const options={preset,enhancers};assert.equal(compileFacePrompt(profile,options),compileFacePrompt(profile,{...options,body:body({shoulder_span:70},'off')}));}
});
test('17 axes independently preserve bounded low/moderate/high distinctions',()=>{
 assert.equal(Object.keys(BODY_AXES).length,17);
 for(const [id,axis] of Object.entries(BODY_AXES))for(const [value,phrase] of [[0,axis.low],[33,axis.low],[34,axis.mid],[50,axis.mid],[66,axis.mid],[67,axis.high],[100,axis.high]]){
 assert.equal(describeBodyValue(id,value),phrase);const prompt=compileFacePrompt(profile,{body:body({[id]:value})});assert.ok(prompt.includes(phrase));assert.ok(prompt.includes('Full-body view'));assert.ok(!prompt.includes('head-and-shoulders'));}
});
test('body values reject invalid and unknown input regardless of state',()=>{
 for(const state of ['selected','off'])for(const controls of [{unknown:50},{shoulder_span:-1},{shoulder_span:101},{shoulder_span:NaN},{shoulder_span:Infinity},{shoulder_span:'50'},JSON.parse('{"__proto__":50}')])assert.throws(()=>validateBody(body(controls,state)));
 for(const bad of [null,[],{version:'body-v0.2',state:'off',controls:{}},{...body(),extra:1}])assert.throws(()=>validateBody(bad));
});
test('selected body adult-only and head crop suppresses body clauses',()=>{
 for(const age_group of ['child','teen','young_adult',undefined])assert.throws(()=>compileFacePrompt({...profile,subject:{age_group}},{body:body()}));
 const prompt=compileFacePrompt(profile,{body:body({shoulder_span:100}),capture:'head'});assert.ok(!prompt.includes('broad shoulder frame'));assert.ok(prompt.includes('Head-and-shoulders portrait'));assert.throws(()=>compileFacePrompt(profile,{capture:'invalid'}));
});
test('empty body controls do not invent moderate anatomy; full capture replaces legacy profile capture',()=>{
 const p=compileFacePrompt(profile,{preset:'profile',body:body(),capture:'full_body'});assert.ok(!p.includes('body proportions and visible contours'));assert.ok(!p.includes('head and shoulders'));assert.ok(p.includes('opaque everyday clothing'));
});
test('workbench defaults/reset are deterministic and imported data survives roundtrip',()=>{
 const state=createDefaultState();assert.deepEqual(importWorkbench(exportWorkbench(state)),state);assert.equal(state.body.state,'off');assert.equal(state.capture,'head');assert.ok(compileWorkbench(state).includes('Head-and-shoulders'));
 state.body=body({shoulder_span:78,breast_volume:40});state.capture='full_body';state.appearance.hair={state:'selected',preset:'blunt_bob'};assert.deepEqual(importWorkbench(exportWorkbench(state)),state);assert.ok(compileWorkbench(state).includes('Hair styling'));assert.deepEqual(createDefaultState(),createDefaultState());
});
test('workbench malformed/oversized/prototype/unknown/underage import is rejected without mutation',()=>{
 const original=createDefaultState(),snapshot=exportWorkbench(original);
 for(const input of ['{', 'x'.repeat(1000001), '{"__proto__":{}}', '{"constructor":{}}', JSON.stringify({...original,extra:1}),JSON.stringify({...original,capture:'wide'}),JSON.stringify({...original,archetypes:['bogus']}),JSON.stringify({...original,profile:{...original.profile,subject:{age_group:'child'}}})])assert.throws(()=>importWorkbench(input));
 assert.equal(exportWorkbench(original),snapshot);
});
test('head toggles and reroll preserve body, modules and capture; seed reproduces original sampler',()=>{
 const state=createDefaultState();state.body=body({pelvic_span:32,gluteal_volume:90});state.capture='full_body';state.headEnabled=false;state.appearance.expression={state:'selected',preset:'slight_smile'};
 assert.ok(!compileWorkbench(state).includes('facial width'));
 const first=randomizeWorkbench(state,'test-seed'),second=randomizeWorkbench(state,'test-seed');assert.deepEqual(first,second);assert.deepEqual(first.body,state.body);assert.deepEqual(first.appearance,state.appearance);assert.equal(first.capture,'full_body');assert.equal(first.headEnabled,false);assert.throws(()=>randomizeWorkbench(state,''));
});
test('browser SHA-256 matches Node on standard vectors, unicode, full catalogs and chunk edges',()=>{
 for(const str of ['', 'abc', '你好，头部🧑', ...[55,56,63,64,65,1000].map(n=>'a'.repeat(n)), readFileSync(new URL('../presets/appearance.v0.1.json',import.meta.url),'utf8')]) assert.equal(sha256(str),createHash('sha256').update(str).digest('hex'));
});
test('CLI body and capture parse independently from appearance',async()=>{
 const {spawnSync}=await import('node:child_process');const {mkdtempSync,writeFileSync,rmSync}=await import('node:fs');const {tmpdir}=await import('node:os');const {join}=await import('node:path');const dir=mkdtempSync(join(tmpdir(),'body-cli-'));
 try{writeFileSync(join(dir,'profile.json'),JSON.stringify(profile));writeFileSync(join(dir,'body.json'),JSON.stringify(body({shoulder_span:90})));
 for(const args of [['--capture','full_body'],['--body',join(dir,'body.json')],['--body',join(dir,'body.json'),'--capture','full_body','--appearance','examples/appearance/hair-only.json','--preset','profile']]){
 const result=spawnSync(process.execPath,['src/cli.mjs',join(dir,'profile.json'),...args],{encoding:'utf8'});assert.equal(result.status,0,result.stderr);assert.match(result.stdout,/Full-body view/);
 }}finally{rmSync(dir,{recursive:true,force:true});}
});
test('explicit full-body capture requires adult even with omitted or off body',()=>{
 for(const b of [undefined,body({},'off')])for(const age_group of ['child','teen'])assert.throws(()=>compileFacePrompt({...profile,subject:{age_group}},{capture:'full_body',body:b}),/adult/);
});
test('face slider description is compiled from the shared adjective function',async()=>{
 const {describeFaceValue}=await import('../src/compiler/gpt-image-2.5.mjs');
 for(const value of [0,14,29,42,47,50,57,70,85,100]){const clause=describeFaceValue('face_geometry','face_width',value);assert.ok(compileFacePrompt({schema_version:'face-v0.2',face_geometry:{face_width:value}},{preset:'none'}).toLowerCase().includes(clause.toLowerCase()));}
 assert.throws(()=>describeFaceValue('body','oops',50));assert.throws(()=>describeFaceValue('eyes','eye_size',101));
 assert.throws(()=>importWorkbench('中'.repeat(400000)),/1 MB/);
});
test('workbench details surfaces actual appearance and body warnings',async()=>{
 const {compileWorkbenchDetails}=await import('../src/workbench/state.mjs');const state=createDefaultState();state.appearance.apparentAge={state:'selected',years:70};state.body=body({waist_taper:70});
 const result=compileWorkbenchDetails(state);assert.equal(result.prompt,compileWorkbench(state));assert.ok(result.warnings.some(x=>x.includes('Age cues')));assert.ok(result.warnings.some(x=>x.includes('三档')));assert.ok(result.warnings.some(x=>x.includes('头肩')));
});
