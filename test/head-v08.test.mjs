import test from 'node:test';
import assert from 'node:assert/strict';
import { compileFacePrompt } from '../src/compiler/gpt-image-2.5.mjs';
import { resolveAppearance } from '../src/appearance/modules.mjs';
import { sampleProfile } from '../src/sampling/sample.mjs';
const seed='d2bcba6f43069a8cb777fcc7a984669e';
const version='appearance-v0.1';
const choices={hair:{state:'selected',preset:'low_ponytail'},makeup:{state:'selected',preset:'bare'},expression:{state:'selected',preset:'slight_smile'}};
// Use a real catalog preset while keeping legacy markers unique.
import { appearanceCatalog } from '../src/appearance/modules.mjs';
choices.makeup.preset=Object.keys(appearanceCatalog.makeup)[0];
test('all 27 omitted/off/selected combinations isolate hair, makeup and expression layers',()=>{
  const p={schema_version:'face-v0.2',subject:{overall_impression:['legacy_impression']},hair:{color:'legacy_hair'},makeup:{intensity:25,base:'legacy_makeup'},expression:{expression:'legacy_expression'},skin:{texture:'legacy_skin'},nose:{bridge_height:50}};
  for(const h of ['omitted','off','selected']) for(const m of ['omitted','off','selected']) for(const e of ['omitted','off','selected']) {
    const config={version}; const states={hair:h,makeup:m,expression:e};
    for(const [key,state] of Object.entries(states)) if(state!=='omitted') config[key]=state==='off'?{state}:choices[key];
    const text=compileFacePrompt(p,{preset:'none',enhancers:true,appearance:config});
    for(const [key,state] of Object.entries(states)) assert.equal(text.includes(`legacy ${key}`),state==='omitted',JSON.stringify(states));
    assert.match(text,/legacy skin/);assert.match(text,/legacy impression/);assert.match(text,/nasal bridge height/);
    assert.equal(text.includes('Hair styling:'),h==='selected');assert.equal(text.includes('Makeup application:'),m==='selected');assert.equal(text.includes('gently raised mouth corners'),e==='selected');
  }
});
test('reported seed inherits minimal makeup and poised expression with hair only',()=>{
  const sample=sampleProfile({archetypes:['beautiful','elegant'],seed,appearance:{version,hair:choices.hair}});
  assert.match(sample.prompt,/Minimal makeup/);assert.match(sample.prompt,/calm poised subtle closed mouth smile/);
  assert.doesNotMatch(sample.prompt,/unspecified|slightly softly|moderately softly|open eye openness/i);
  const off=compileFacePrompt(sample.profile,{preset:'profile',enhancers:true,appearance:{version,hair:choices.hair,makeup:{state:'off'},expression:{state:'off'}}});
  assert.doesNotMatch(off,/Minimal makeup|calm poised/);
});
test('prompt omits only full unspecified sentinel and keeps meaningful none plus provenance',()=>{
  const config={version,hair:choices.hair};const resolved=resolveAppearance(config);
  assert.equal(resolved.modules.hair.resolved.cut,'unspecified');assert.doesNotMatch(resolved.paragraphs[0],/cut: unspecified/);assert.match(resolved.paragraphs[0],/fringe: none/);
  const override=resolveAppearance({version,hair:{...choices.hair,overrides:{cut:'unspecified layered detail',accessories:[]}}});
  assert.match(override.paragraphs[0],/cut: unspecified layered detail/);assert.match(override.paragraphs[0],/accessories: none/);
});
test('neutral controls stay explicit; sparse inputs gain no absent anatomy',()=>{
  for(const value of [48,50,52]) {
    const text=compileFacePrompt({schema_version:'face-v0.2',eyebrows:{brow_arch:value},nose:{tip_rotation:value},eyes:{eye_size:value}},{preset:'none'});
    assert.match(text,/gently curved brow shape/i);assert.match(text,/neutral nasal tip rotation/i);assert.match(text,/medium eye size/i);
    assert.doesNotMatch(text,/bridge width|brow density|facial width|hair|makeup/);
  }
});
test('selected module with only unspecified geometry has no empty clause but still replaces legacy',()=>{
  const preset='makeup_bare';
  const appearance={version,makeup:{state:'selected',preset,overrides:Object.fromEntries(Object.keys(appearanceCatalog.makeup[preset].geometry).map(k=>[k,'unspecified']))}};
  const r=resolveAppearance(appearance);assert.deepEqual(r.paragraphs,[]);assert.equal(r.modules.makeup.state,'selected');
  const prompt=compileFacePrompt({schema_version:'face-v0.2',makeup:{intensity:80}},{preset:'none',enhancers:true,appearance});
  assert.doesNotMatch(prompt,/Makeup application:|Strong makeup/);
});
test('sample and iteration record the same complete compiler identity',async()=>{
  const {iterateProfile}=await import('../src/iteration/variants.mjs');
  const sample=sampleProfile({archetypes:['beautiful','elegant'],seed});
  const iteration=iterateProfile({...sample,edits:[{path:'eyes.eye_size',value:50}],seed:'identity'});
  assert.equal(sample.manifest.compiler_version,'gpt-image-2.5-v0.3');
  assert.equal(iteration.manifest.compiler_version,sample.manifest.compiler_version);
  assert.equal(iteration.manifest.compiler_sha256,sample.manifest.compiler_sha256);
});
