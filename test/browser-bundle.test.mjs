import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import vm from 'node:vm';
import {spawnSync} from 'node:child_process';
import {sampleProfile} from '../src/sampling/sample.mjs';
import {createDefaultState,compileWorkbench} from '../src/workbench/state.mjs';
test('offline bundler uses shared core with exact Node sampler + manifest and body prompt parity',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'visage-bundle-'));
 try {
  for(const name of ['src','schemas','presets','scripts'])fs.cpSync(new URL(`../${name}`,import.meta.url),path.join(dir,name),{recursive:true});
  fs.mkdirSync(path.join(dir,'web'));
  fs.writeFileSync(path.join(dir,'web/index.html'),'<html><script type="module" src="./app.mjs"></script></html>');
  fs.writeFileSync(path.join(dir,'web/app.mjs'),`import { sampleProfile } from '../src/sampling/sample.mjs';\nimport { createDefaultState,compileWorkbench } from '../src/workbench/state.mjs';\nconst results=[];for(let i=0;i<20;i++)results.push(sampleProfile({seed:'browser-parity-'+i,archetypes:['beautiful','elegant']}));const state=createDefaultState();state.body={version:'body-v0.1',state:'selected',controls:{shoulder_span:70,hip_fullness:20}};state.capture='full_body';globalThis.result=JSON.stringify({results,prompt:compileWorkbench(state)});`);
  const build=spawnSync(process.execPath,['scripts/build-web.mjs'],{cwd:dir,encoding:'utf8'});assert.equal(build.status,0,build.stderr);
  const html=fs.readFileSync(path.join(dir,'dist/visage-workbench.html'),'utf8');assert.ok(!/\beval\s*\(|\bfetch\s*\(|<script[^>]+src=/.test(html));
  const context={TextEncoder,structuredClone};vm.runInNewContext(html.match(/<script>([\s\S]*)<\/script>/)[1],context,{timeout:10000});
  const actual=JSON.parse(context.result);const expected=Array.from({length:20},(_,i)=>sampleProfile({seed:'browser-parity-'+i,archetypes:['beautiful','elegant']}));assert.deepEqual(actual.results,expected);
  const state=createDefaultState();state.body={version:'body-v0.1',state:'selected',controls:{shoulder_span:70,hip_fullness:20}};state.capture='full_body';assert.equal(actual.prompt,compileWorkbench(state));
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
