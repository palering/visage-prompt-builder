import test from 'node:test';
import assert from 'node:assert/strict';
import {createDefaultState,randomizeWorkbenchDetailed,exportWorkbench,importWorkbench} from '../src/workbench/state.mjs';
import {setLocks,pathValue,pathInRerollScope,samplingStatus} from '../src/workbench/constraints.mjs';
import {SUBJECT_PRESETS,subjectPresetValue} from '../src/workbench/subject-presets.mjs';

function source() {
 const s=createDefaultState();s.body={version:'body-v0.1',state:'selected',controls:{shoulder_span:81,pelvic_span:0}};s.capture='full_body';
 s.appearance.hair={state:'selected',preset:'pixie'};s.appearance.makeup={state:'off'};s.appearance.expression={state:'off'};s.appearance.apparentAge={state:'selected',years:26};
 s.constraints.choices['appearance.hair']=['blunt_bob'];s.constraints.ranges['appearance.apparentAge.years']={min:35,max:35};
 s.constraints.ranges['body.controls.shoulder_span']={min:20,max:30};
 s.profile.subject.appearance='  EXACT 自定义_外貌  ';s.profile.skin={tone:'my exact  skin_label'};
 return s;
}
for(const scope of ['head','appearance','body'])test(`${scope} reroll cannot change any other tab's parameters`,()=>{
 const s=source(),before=structuredClone(s);const result=randomizeWorkbenchDetailed(s,`scoped-${scope}`,{scope});
 assert.equal(result.report.noOp,false);assert.equal(result.state.sampling.scope,scope);assert.equal(samplingStatus(result.state),'current');
 for(const path of result.report.applied) assert(path==='profile.schema_version'||pathInRerollScope(path,scope),path);
 if(scope!=='head'){for(const key of ['subject','skin','face_geometry','soft_tissue','eyes','eyebrows','nose','mouth'])assert.deepEqual(result.state.profile[key],s.profile[key]);}
 if(scope!=='appearance'){assert.deepEqual(result.state.appearance,s.appearance);for(const key of ['hair','makeup','expression'])assert.deepEqual(result.state.profile[key],s.profile[key]);}
 if(scope!=='body')assert.deepEqual(result.state.body,s.body);
 assert.equal(result.state.capture,s.capture);assert.equal(result.state.headEnabled,s.headEnabled);assert.deepEqual(result.state.constraints,s.constraints);assert.deepEqual(s,before);
 assert.deepEqual(randomizeWorkbenchDetailed(s,`scoped-${scope}`,{scope}),result);
});
test('global includes enabled body axes while legacy keeps its persisted opt-in contract',()=>{
 const s=source(),global=randomizeWorkbenchDetailed(s,'one',{scope:'global'}),legacy=randomizeWorkbenchDetailed(s,'one');
 assert.equal(s.constraints.includeBody,false);assert(global.state.body.controls.shoulder_span>=20&&global.state.body.controls.shoulder_span<=30);
 assert.deepEqual(legacy.state.body,s.body);assert.equal(global.state.constraints.includeBody,false);assert.equal(global.state.appearance.hair.preset,'blunt_bob');
 assert.deepEqual(importWorkbench(exportWorkbench(global.state)),global.state);
});
test('global and body scopes never enable body or add an unselected body axis',()=>{
 for(const scope of ['global','body']){const s=source(),active=randomizeWorkbenchDetailed(s,'two',{scope}).state;
 assert.deepEqual(Object.keys(active.body.controls),Object.keys(s.body.controls));
 s.body.state='off';const result=randomizeWorkbenchDetailed(s,'off',{scope});assert.deepEqual(result.state.body,s.body);if(scope==='body')assert.deepEqual(result.state,s);}
});
test('scoped conflicts apply only to the requested tab; global conflicts remain atomic',()=>{
 const s=source();setLocks(s,['profile.eyes.eye_size'],true);s.constraints.ranges['profile.eyes.eye_size']={min:0,max:1};
 const before=structuredClone(s);assert.throws(()=>randomizeWorkbenchDetailed(s,'bad',{scope:'head'}),/固定值/);assert.throws(()=>randomizeWorkbenchDetailed(s,'bad',{scope:'global'}),/固定值/);
 assert.equal(randomizeWorkbenchDetailed(s,'okay',{scope:'body'}).report.noOp,false);assert.equal(randomizeWorkbenchDetailed(s,'okay',{scope:'appearance'}).report.noOp,false);assert.deepEqual(s,before);
});
test('tab reroll preserves exact text and locks, zero locks and disabled head values',()=>{
 const s=source();setLocks(s,['body.controls.pelvic_span'],true);const body=randomizeWorkbenchDetailed(s,'fixed',{scope:'body'}).state;assert.equal(body.body.controls.pelvic_span,0);
 const head=randomizeWorkbenchDetailed(s,'fixed',{scope:'head'}).state;assert.equal(head.profile.subject.appearance,s.profile.subject.appearance);assert.equal(head.profile.skin.tone,s.profile.skin.tone);
 s.headEnabled=false;assert.deepEqual(randomizeWorkbenchDetailed(s,'disabled',{scope:'head'}).state,s);
});
test('all fixed scoped reroll is a true no-op; invalid scope cannot mutate state',()=>{
 const s=createDefaultState();s.constraints.locks=['profile','appearance','body','headEnabled','capture'];
 for(const scope of ['head','appearance','body','global']){const result=randomizeWorkbenchDetailed(s,'all-fixed',{scope});assert(result.report.noOp);assert.deepEqual(result.state,s);}
 const before=structuredClone(s);assert.throws(()=>randomizeWorkbenchDetailed(s,'bad',{scope:'face'}),/重抽范围/);assert.deepEqual(s,before);
});
test('subject preset shortcuts preserve custom and absence without inferring anatomy',()=>{
 for(const [id,definition] of Object.entries(SUBJECT_PRESETS)){
   assert.equal(subjectPresetValue(id,''),'');assert.equal(subjectPresetValue(id,' custom_自由文字 '),'__custom__');
   for(const [value,label] of definition.choices){assert(label);assert.equal(subjectPresetValue(id,value),value);}
 }
 const s=source(),before=structuredClone(s);for(const [id,{path,choices}] of Object.entries(SUBJECT_PRESETS))assert(path&&choices.length>1,id);
 assert.deepEqual(s,before);assert.equal(pathValue(s,'profile.subject.appearance'),'  EXACT 自定义_外貌  ');
});
