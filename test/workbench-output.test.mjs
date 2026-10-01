import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultState } from '../src/workbench/state.mjs';
import { compileFacePrompt } from '../src/compiler/gpt-image-2.5.mjs';
import { appearanceCatalog } from '../src/appearance/modules.mjs';
import { BODY_AXES } from '../src/body/body.mjs';
import { OUTPUT_MODULES, createOutputSettings, validateOutput, compileOutput } from '../src/workbench/output.mjs';
import { catalogChinese } from '../src/workbench/catalog.zh.mjs';
import { FACE_AXES_ZH, BODY_AXES_ZH, describeFaceValueChinese } from '../src/workbench/geometry.zh.mjs';
const options=(overrides={})=>createOutputSettings({mode:'selected',modules:['hair'],...overrides});
function populated() {
 const state=createDefaultState();
 state.profile.subject={age_group:'adult',gender_presentation:'IDENTITY_RAW',appearance:'APPEARANCE_RAW',overall_impression:['IMPRESSION_RAW']};
 state.profile.face_geometry={face_length:0,face_width:100,face_shape:'FACE_SHAPE_RAW',cheek_to_chin_contour:'angular_taper'};
 state.profile.eyes={eye_size:100,upper_eyelid:'EYELID_RAW'};
 state.profile.skin={tone:'SKIN_TONE_RAW',texture:'SKIN_TEXTURE_RAW',freckle_visibility:100};
 state.profile.hair={color:'HAIR_COLOR_RAW',volume:100};
 state.profile.makeup={intensity:70,lip_color:'LIP_COLOR_RAW'};
 state.profile.expression={expression:'EXPRESSION_RAW',eye_openness:0};
 state.appearance.apparentAge={state:'selected',years:81};
 state.body={version:'body-v0.1',state:'selected',controls:{shoulder_span:100,leg_length:0}};
 state.capture='full_body';
 return state;
}
const legacy=state=>{const p=structuredClone(state.profile);if(!state.headEnabled)for(const section of ['face_geometry','soft_tissue','eyes','eyebrows','nose','mouth'])delete p[section];return compileFacePrompt(p,{preset:'profile',enhancers:true,appearance:state.appearance,body:state.body,capture:state.capture});};

test('full English stays byte-for-byte legacy for head/body, enhancements, disabled head and custom overrides',()=>{
 for(const headEnabled of [true,false])for(const capture of ['head','full_body'])for(const active of [false,true]){
  const state=populated();Object.assign(state,{headEnabled,capture});
  if(active){state.appearance.hair={state:'selected',preset:'blunt_bob',overrides:{color:'  ink_black  ',accessories:['a_b',' c ']}};state.appearance.makeup={state:'selected',preset:Object.keys(appearanceCatalog.makeup)[1]};}
  for(const context of ['none','default','random','clay'])assert.equal(compileOutput(state,createOutputSettings({context})).prompt,legacy(state));
 }
});

test('Chinese default prompt translates owned template, numeric geometry and capture instead of relabeling English',()=>{
 const result=compileOutput(createDefaultState(),createOutputSettings({language:'zh'}));
 assert.match(result.prompt,/创作一幅写实肖像/);assert.match(result.prompt,/脸长：适中/);assert.match(result.prompt,/眼睛大小：中等/);assert.match(result.prompt,/头肩肖像/);assert.doesNotMatch(result.prompt,/[a-z]/i);
});

test('every owned catalog geometry and accessory has a real Chinese translation; all 85 presets compile in both languages',()=>{
 let presets=0,values=0;
 for(const module of ['hair','makeup'])for(const entry of Object.values(appearanceCatalog[module])) {
  presets++;const state=createDefaultState();state.appearance[module]={state:'selected',preset:entry.id};
  const en=compileOutput(state,options({modules:[module]})).prompt;
  const zh=compileOutput(state,options({modules:[module],language:'zh'})).prompt;
  assert.ok(en.length&&zh.length);assert.notEqual(en,zh);
  for(const [field,value] of Object.entries({...entry.geometry,...(entry.accessories?{accessories:entry.accessories}:{})}))for(const phrase of [value].flat()){
   values++;const translated=catalogChinese(phrase,module,field);assert.match(translated,/[\p{Script=Han}]/u);assert.notEqual(translated,phrase);if(phrase!=='unspecified')assert.ok(zh.includes(translated),`${entry.id}: ${field} ${translated}`);
  }
 }
 assert.equal(presets,85);assert.ok(values>500);
});

test('all face axes and body axes compile all bins in Chinese without losing individual geometry meaning',()=>{
 for(const [section,axes] of Object.entries(FACE_AXES_ZH))for(const axis of Object.keys(axes))for(const value of [0,14,15,29,30,42,43,47,48,52,53,57,58,70,71,85,86,100]){
  const state=createDefaultState();state.profile[section]={[axis]:value};const module=['hair','expression'].includes(section)?section:'face';
  assert.ok(compileOutput(state,options({modules:[module],language:'zh'})).prompt.includes(describeFaceValueChinese(section,axis,value)));
 }
 assert.deepEqual(Object.keys(BODY_AXES_ZH).sort(),Object.keys(BODY_AXES).sort());
 for(const id of Object.keys(BODY_AXES))for(const value of [0,33,34,66,67,100]){
  const state=createDefaultState();state.body={version:'body-v0.1',state:'selected',controls:{[id]:value}};state.capture='full_body';
  assert.ok(compileOutput(state,options({modules:['body'],language:'zh'})).prompt.includes(BODY_AXES_ZH[id][value<34?0:value>66?2:1]));
 }
 assert.throws(()=>describeFaceValueChinese('eyes','eye_size',NaN));
});

test('hair-only never leaks stored identity, skin, face, age, makeup, expression, body, capture or fixed endings',()=>{
 const state=populated();state.appearance.hair={state:'selected',preset:'blunt_bob',overrides:{color:'CHOSEN_HAIR_COLOR'}};
 for(const language of ['en','zh']){
  const prompt=compileOutput(state,options({language})).prompt;assert.match(prompt,/CHOSEN_HAIR_COLOR/);
  for(const marker of ['IDENTITY_RAW','APPEARANCE_RAW','IMPRESSION_RAW','FACE_SHAPE_RAW','EYELID_RAW','SKIN_TONE_RAW','SKIN_TEXTURE_RAW','LIP_COLOR_RAW','EXPRESSION_RAW','81','Full-body','Head-and-shoulders','Prioritize','Natural proportions','clothing','肤色','写实肖像','优先保留'])assert.ok(!prompt.includes(marker),marker);
 }
});

test('each scoped domain emits only its own source clauses; combination order is canonical',()=>{
 const state=populated();
 const markers={identity:['IDENTITY_RAW','APPEARANCE_RAW','IMPRESSION_RAW'],face:['FACE_SHAPE_RAW','EYELID_RAW','SKIN_TONE_RAW','SKIN_TEXTURE_RAW'],hair:['HAIR_COLOR_RAW'],makeup:['LIP_COLOR_RAW'],expression:['EXPRESSION_RAW'],age:['81'],body:['broad shoulder frame']};
 for(const [module,expected] of Object.entries(markers)){
  const prompt=compileOutput(state,options({modules:[module]})).prompt;
  for(const marker of expected)assert.ok(prompt.includes(marker),`${module} ${marker}`);
  for(const [other,excluded] of Object.entries(markers))if(other!==module)for(const marker of excluded)assert.ok(!prompt.includes(marker),`${module} leaked ${marker}`);
 }
 assert.equal(compileOutput(state,options({modules:['face','hair']})).prompt,compileOutput(state,options({modules:['hair','face']})).prompt);
});

test('new compiler preserves every custom string verbatim including whitespace, underscores, catalog-like literals and punctuation',()=>{
 const state=populated(),custom='  Mixed_case 蓝色\n  custom: value; <tag>  ';
 state.profile.subject.appearance=custom;state.profile.subject.gender_presentation=custom;state.profile.subject.overall_impression=[custom];state.profile.skin.tone=custom;state.profile.face_geometry.face_shape=custom;state.profile.eyes.upper_eyelid=custom;
 state.profile.hair.color=custom;state.profile.makeup.lip_color=custom;state.profile.expression.expression=custom;
 for(const language of ['en','zh'])for(const module of ['identity','face','hair','makeup','expression']) {
  const result=compileOutput(state,options({language,modules:[module]}));assert.ok(result.prompt.includes(custom),module);assert.ok(result.warnings.some(w=>w.includes('不会自动翻译')));
 }
 assert.ok(compileOutput(state,createOutputSettings({language:'zh'})).prompt.includes(custom));
 state.appearance.hair={state:'selected',preset:'blunt_bob',overrides:{color:custom,texture:'straight',front:'unspecified',accessories:[custom,'center part']}};
 const result=compileOutput(state,options({language:'zh'}));for(const value of [custom,'straight','unspecified','center part'])assert.ok(result.prompt.includes(value));
 assert.match(result.prompt,/剪裁：等长钝线轮廓/);
});

test('numeric regional cheek controls suppress only legacy global cheek value in both languages',()=>{
 const state=createDefaultState();state.profile.soft_tissue={cheek_fullness:0,upper_medial_cheek_fullness:100,lateral_cheek_fullness:50};
 for(const language of ['en','zh']){
  const prompt=compileOutput(state,options({modules:['face'],language})).prompt;
  assert.doesNotMatch(prompt,/extremely lean cheek volume|面颊体积：极为清瘦/);assert.match(prompt,language==='en'?/upper-medial cheek volume/:/上内侧面颊体积/);
 }
});

test('off, inheritance, headEnabled and capture states never get silently enabled',()=>{
 const state=populated();state.appearance.hair={state:'off'};state.appearance.makeup={state:'off'};state.appearance.expression={state:'off'};state.appearance.apparentAge={state:'off'};
 for(const module of ['hair','makeup','expression','age'])assert.equal(compileOutput(state,options({modules:[module]})).prompt,'');
 state.capture='head';const result=compileOutput(state,options({modules:['body']}));assert.equal(result.prompt,'');assert.ok(result.warnings.some(w=>w.includes('头肩构图不输出体型')));
 state.body.state='off';state.capture='full_body';assert.equal(compileOutput(state,options({modules:['body']})).prompt,'');
 state.headEnabled=false;assert.doesNotMatch(compileOutput(state,options({modules:['face']})).prompt,/FACE_SHAPE_RAW|EYELID_RAW/);assert.match(compileOutput(state,options({modules:['face']})).prompt,/SKIN_TONE_RAW/);
});

test('scope-aware appearance warnings do not leak warnings from omitted modules',()=>{
 const state=populated();state.appearance.hair={state:'selected',preset:'blunt_bob'};state.appearance.expression={state:'selected',preset:'surprise'};
 const hair=compileOutput(state,options());assert.ok(hair.warnings.some(w=>w.includes('Hair silhouette')));assert.ok(!hair.warnings.some(w=>w.includes('Age cues')||w.includes('Muscle action')));
 const zh=compileOutput(state,options({language:'zh'}));assert.ok(zh.warnings.some(w=>w.includes('发型轮廓与遮挡')));
});

test('none context omits complements, default context uses generic descriptors not stored omitted values',()=>{
 const state=populated();state.constraints.locks=[];
 const none=compileOutput(state,options());assert.deepEqual(none.context.modules,[]);assert.doesNotMatch(none.prompt,/complementary|context/);
 const result=compileOutput(state,options({context:'default',language:'zh'}));assert.match(result.prompt,/中性默认补全/);assert.match(result.prompt,/不指定/);assert.ok(!result.context.modules.includes('hair'));
 for(const value of ['IDENTITY_RAW','SKIN_TONE_RAW','FACE_SHAPE_RAW','EXPRESSION_RAW','81'])assert.ok(!result.prompt.includes(value));
});

test('seeded random complements are reproducible, independent of language, never mutate state and exclude any locked omitted domain',()=>{
 const state=populated();state.constraints.locks=['profile.skin.tone','profile.subject.appearance','appearance.expression','body.controls.leg_length'];
 const before=structuredClone(state),settings=options({context:'random',contextSeed:'frozen-seed'});
 const first=compileOutput(state,settings);assert.deepEqual(compileOutput(state,settings),first);assert.deepEqual(state,before);
 assert.deepEqual(first.context.excludedLockedModules,['identity','face','expression','body']);assert.deepEqual(first.context.modules,['makeup','age']);assert.equal(first.context.seed,'frozen-seed');
 const chinese=compileOutput(state,{...settings,language:'zh'});assert.deepEqual(chinese.context.modules,first.context.modules);assert.deepEqual(chinese.context.excludedLockedModules,first.context.excludedLockedModules);
 assert.deepEqual(settings,options({context:'random',contextSeed:'frozen-seed'}));
 const variants=new Set();state.constraints.locks=[];for(let i=0;i<20;i++)variants.add(compileOutput(state,options({context:'random',contextSeed:'seed-'+i})).prompt);assert.ok(variants.size>1);
 const changed=structuredClone(state);changed.profile.skin.tone='ANOTHER_SKIN';changed.profile.face_geometry.face_length=82;changed.appearance.apparentAge.years=23;
 assert.equal(compileOutput(changed,settings).prompt,compileOutput(state,settings).prompt);
});

test('ancestor and descendant locks conservatively exclude complete omitted domains from random context',()=>{
 const state=populated();state.constraints.locks=['profile','appearance','body','capture','headEnabled'];
 const output=compileOutput(state,options({context:'random'}));assert.deepEqual(output.context.modules,[]);assert.equal(output.prompt,compileOutput(state,options()).prompt);assert.ok(output.warnings.some(w=>w.includes('不参与补全')));
});

test('white-clay context treats only unselected domains and preserves chosen colors/geometry verbatim',()=>{
 const state=populated();state.appearance.hair={state:'selected',preset:'blunt_bob',overrides:{color:'vivid_RED custom',texture:'silky_CUSTOM'}};
 const before=structuredClone(state);
 for(const language of ['en','zh']){
  const result=compileOutput(state,options({context:'clay',language}));assert.match(result.prompt,/vivid_RED custom/);assert.match(result.prompt,/silky_CUSTOM/);assert.ok(!result.context.modules.includes('hair'));
  assert.match(result.prompt,language==='en'?/only for unselected modules/:/仅用于未选模块/);assert.match(result.prompt,language==='en'?/never apply the white-clay material to them/:/白色黏土材质不得覆盖它们/);
  for(const marker of ['IDENTITY_RAW','SKIN_TONE_RAW','FACE_SHAPE_RAW','81'])assert.ok(!result.prompt.includes(marker));
 }
 assert.deepEqual(state,before);
 const face=compileOutput(state,options({context:'clay',modules:['face','hair']}));assert.ok(!face.context.modules.includes('face'));assert.ok(!face.context.modules.includes('hair'));
});

test('full mode and all-selected mode do not inject duplicate complement paragraphs; empty selection remains explicitly empty',()=>{
 const state=createDefaultState();
 for(const language of ['en','zh'])for(const context of ['default','random','clay']) {
  const result=compileOutput(state,createOutputSettings({language,context}));assert.equal(result.prompt,compileOutput(state,createOutputSettings({language})).prompt);assert.deepEqual(result.context.modules,[]);
  const all=compileOutput(state,options({language,context,modules:Object.keys(OUTPUT_MODULES)}));assert.deepEqual(all.context.modules,[]);
  const empty=compileOutput(state,options({language,context,modules:[]}));assert.equal(empty.prompt,'');assert.ok(empty.warnings.some(w=>w.includes('未选择输出模块')));
 }
});

test('strict settings validation rejects invalid values and custom keys; adult-only source remains enforced',()=>{
 for(const overrides of [{extra:true},{version:'future'},{language:'de'},{mode:'hair'},{modules:['unknown']},{modules:['hair','hair']},{modules:null},{context:'future'},{contextSeed:''},{contextSeed:'x'.repeat(201)}])assert.throws(()=>createOutputSettings(overrides));
 assert.throws(()=>validateOutput({language:'zh'}));assert.throws(()=>createOutputSettings(null));
 const source=createDefaultState();source.profile.subject.age_group='child';assert.throws(()=>compileOutput(source,options()),/成年/);
 const settings=createOutputSettings();assert.deepEqual(validateOutput(settings),settings);const independent=createOutputSettings();independent.modules.pop();assert.equal(settings.modules.length,7);
});
