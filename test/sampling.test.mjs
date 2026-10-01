import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { sampleProfile, defaultCatalog, validateCatalog } from '../src/sampling/sample.mjs';
import { writeSample } from '../src/sampling/write.mjs';
import { compileFacePrompt } from '../src/compiler/gpt-image-2.5.mjs';
import { validateProfile } from '../src/compiler/validate.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sample = (seed = 'demo', archetypes = ['beautiful','elegant']) => sampleProfile({ seed, archetypes });
const temp = t => { const dir = fs.mkdtempSync(path.join(os.tmpdir(),'visage-sample-test-')); t.after(() => fs.rmSync(dir,{recursive:true,force:true})); return dir; };
const morphology = p => Object.fromEntries(['face_geometry','soft_tissue','eyes','eyebrows','nose','mouth'].map(k => [k,p[k]]));

test('samples are deterministic and archetype order is canonical', () => {
  assert.deepEqual(sample(), sample());
  assert.deepEqual(sample(), sample('demo',['elegant','beautiful']));
  assert.equal(sample('0').manifest.seed, '0');
  assert.notDeepEqual(sample('1').profile, sample('2').profile);
});
test('generated seed is saved and replayable', () => {
  const generated = sampleProfile({ archetypes:['elegant'] });
  assert.match(generated.manifest.seed,/^[0-9a-f]{32}$/);
  assert.deepEqual(generated, sample(generated.manifest.seed,['elegant']));
});
test('all directions preserve same-seed morphology and are adult-only', () => {
  for (const id of Object.keys(defaultCatalog.archetypes)) {
    const result = sample('0',[id]);
    assert.deepEqual(morphology(result.profile), morphology(sample('0').profile));
    assert.equal(result.profile.subject.age_group,'adult');
    assert.equal(result.profile.subject.gender_presentation,'person');
    assert.equal(result.profile.subject.appearance,undefined);
    assert.equal(result.profile.skin?.tone,undefined);
  }
});
test('100 seeds across every recipe stay within authored bounds and compile valid v0.2', () => {
  const families = new Set(), prompts = new Set();
  for (let i=0;i<100;i++) for (const id of Object.keys(defaultCatalog.archetypes)) {
    const result=sample(String(i),[id]); validateProfile(result.profile);
    for (const [key,range] of Object.entries(result.manifest.resolved_ranges)) {
      const [section,field]=key.split('.');
      assert.ok(result.profile[section][field]>=range.min && result.profile[section][field]<=range.max,key);
    }
    families.add(result.manifest.morphology_bundle);
    prompts.add(compileFacePrompt(result.profile));
  }
  assert.equal(families.size,3); assert.ok(prompts.size>10);
});
test('shared quantiles correlate paired morphology controls', () => {
  const pairs=Array.from({length:100},(_,i)=>{const p=sample(String(i)).profile;return [p.mouth.upper_lip_fullness,p.mouth.lower_lip_fullness];});
  const means=[0,1].map(j=>pairs.reduce((a,p)=>a+p[j],0)/pairs.length);
  const cov=pairs.reduce((a,p)=>a+(p[0]-means[0])*(p[1]-means[1]),0);
  const variance=[0,1].map(j=>pairs.reduce((a,p)=>a+(p[j]-means[j])**2,0));
  assert.ok(cov/Math.sqrt(variance[0]*variance[1])>0.75);
});
test('saved profiles recompile identically and keep calibration semantics', () => {
  const result=sample(); const profile=JSON.parse(JSON.stringify(result.profile));
  assert.equal(compileFacePrompt(profile, result.manifest.compiler_options),result.prompt);
  assert.equal(compileFacePrompt(profile).includes('poised'),false);
  assert.throws(()=>compileFacePrompt(profile,{preset:'calibration',enhancers:true}),/conflict/);
  assert.match(result.manifest.catalog_sha256,/^[a-f0-9]{64}$/);
  assert.match(result.manifest.compiler_sha256,/^[a-f0-9]{64}$/);
});
test('unknown, duplicate and conflicting archetypes fail', () => {
  for (const ids of [[],['nope'],['elegant','sinister'],['beautiful','beautiful'],['__proto__']]) assert.throws(()=>sample('0',ids));
  assert.throws(()=>sample(''),/Seed/);
});
test('invalid range or unsupported sampling field cannot be ignored', () => {
  for (const mutate of [
    c=>c.morphology_bundles[0].ranges['eyes.eye_length'].mode=101,
    c=>c.morphology_bundles[0].ranges['eyes.eye_length'].min=NaN,
    c=>c.morphology_bundles[0].ranges['eyes.typo']={min:1,mode:2,max:3,group:'x'},
    c=>c.morphology_bundles[0].ranges['eyes.upper_eyelid']={min:1,mode:2,max:3,group:'x'},
    c=>c.archetypes.sensual.fixed['subject.age_group']='child',
    c=>c.archetypes.sinister.fixed['skin.tone']='dark',
    c=>c.archetypes.sinister.fixed['nose.bridge_height']=80,
    c=>c.archetypes.beautiful.fixed['eyebrows.brow_arch']=80,
    c=>c.correlation.shared_weight=0,
    c=>c.morphology_bundles[0].fixed['__proto__.polluted']=true,
  ]) { const c=structuredClone(defaultCatalog); mutate(c); assert.throws(()=>validateCatalog(c)); }
});
test('cross-layer contradictory controls fail instead of silent override', () => {
  const catalog=structuredClone(defaultCatalog);
  catalog.archetypes.beautiful.fixed['expression.expression']='smiling';
  assert.throws(()=>sampleProfile({seed:'x',archetypes:['beautiful','sinister'],catalog}),/control conflict/);
});
test('catalog mutations change fingerprint', () => {
  const catalog=structuredClone(defaultCatalog);catalog.description+=' revised';
  assert.notEqual(sample().manifest.catalog_sha256,sampleProfile({seed:'demo',archetypes:['beautiful','elegant'],catalog}).manifest.catalog_sha256);
});
test('sample output transaction writes all artifacts; cancellation preserves all', async t => {
  const dir=path.join(temp(t),'sample'); const original=sample();
  assert.equal(await writeSample(dir,original),true);
  const before=fs.readdirSync(dir).map(name=>[name,fs.readFileSync(path.join(dir,name),'utf8')]);
  assert.equal(await writeSample(dir,sample('other'),{confirm:async()=>false}),false);
  assert.deepEqual(fs.readdirSync(dir).map(name=>[name,fs.readFileSync(path.join(dir,name),'utf8')]),before);
  assert.equal(await writeSample(dir,sample('other'),{force:true}),true);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir,'profile.json'))),sample('other').profile);
});
test('unrelated files and symbolic outputs are protected even with force', async t => {
  const dir=temp(t); const dedicated=path.join(dir,'dedicated');fs.mkdirSync(dedicated);
  fs.writeFileSync(path.join(dedicated,'keep.txt'),'keep');
  await assert.rejects(writeSample(dedicated,sample(),{force:true}),/unrelated/);
  const link=path.join(dir,'link');fs.symlinkSync(dedicated,link);
  await assert.rejects(writeSample(link,sample(),{force:true}),/symlink/);
  fs.unlinkSync(path.join(dedicated,'keep.txt'));fs.symlinkSync(path.join(dir,'elsewhere'),path.join(dedicated,'prompt.txt'));
  await assert.rejects(writeSample(dedicated,sample(),{force:true}),/regular files/);
});
test('output changed during confirmation is preserved', async t => {
  const dir=path.join(temp(t),'sample');await writeSample(dir,sample());
  await assert.rejects(writeSample(dir,sample('new'),{confirm:async()=>{fs.writeFileSync(path.join(dir,'prompt.txt'),'new arrival');return true;}}),/changed/);
  assert.equal(fs.readFileSync(path.join(dir,'prompt.txt'),'utf8'),'new arrival');
});
test('CLI stdout, manifest, list and round trip work', t => {
  const run=args=>spawnSync(process.execPath,['src/sample.mjs',...args],{cwd:root,encoding:'utf8'});
  assert.equal(run(['--list']).status,0);
  const stdout=run(['--archetype','elegant,beautiful','--seed','0']);assert.equal(stdout.status,0,stdout.stderr);
  assert.deepEqual(JSON.parse(stdout.stdout),sample('0'));
  const dir=path.join(temp(t),'sample');const args=['--archetype','sinister','--seed','0','--out-dir',dir];
  assert.equal(run(args).status,0);
  assert.equal(run(args).status,1);
  assert.equal(run([...args,'--force']).status,0);
  const compiled=spawnSync(process.execPath,['src/cli.mjs',path.join(dir,'profile.json'),'--preset','profile','--enhancers'],{cwd:root,encoding:'utf8'});
  assert.equal(compiled.status,0,compiled.stderr);
  assert.equal(compiled.stdout,fs.readFileSync(path.join(dir,'prompt.txt'),'utf8'));
});
test('invalid CLI cannot overwrite output even with force', t => {
  const dir=temp(t);const sentinel=path.join(dir,'prompt.txt');fs.writeFileSync(sentinel,'keep');
  for(const args of [['--archetype','unknown'],['--archetype','elegant,sinister'],['--archetype','beautiful','--seed',''],['--archetype','beautiful','--preset','calibration']]) {
    const result=spawnSync(process.execPath,['src/sample.mjs',...args,'--out-dir',dir,'--force'],{cwd:root,encoding:'utf8'});
    assert.equal(result.status,1);assert.equal(fs.readFileSync(sentinel,'utf8'),'keep');
  }
});

test('catalog typos and malformed nested objects fail loudly', () => {
  for (const mutate of [
    c=>{c.morphology_bundles[0].range=c.morphology_bundles[0].ranges;delete c.morphology_bundles[0].ranges;},
    c=>c.morphology_bundles[0].fixed=null,
    c=>c.morphology_bundles[0].ranges['eyes.eye_length'].maximum=80,
    c=>c.archetypes.elegant.fix={},
    c=>c.correlation.shared_weigth=0.5,
    c=>c.archetypes=[],
  ]) {const c=structuredClone(defaultCatalog);mutate(c);assert.throws(()=>validateCatalog(c));}
});
