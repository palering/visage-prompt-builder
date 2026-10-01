#!/usr/bin/env node
import fs from 'node:fs';
import { batchProfiles, iterateProfile, loadProfile, profileDiff, diffText, artifactFiles, writeImmutable, REGIONS } from './iteration/variants.mjs';
const help = `Visage versioned candidate workflow

npm run batch -- --archetype beautiful,elegant --count 4 --seed demo --out-dir drafts/batch-1
npm run iterate -- --input drafts/batch-1/candidate-002/profile.json --regions eyes --set eyebrows.brow_arch=60 --seed eyes-2 --out-dir drafts/v2
npm run compare -- --before drafts/batch-1/candidate-002/profile.json --after drafts/v2/profile.json

batch: --archetype ids [--count 1..16 (default 4)] [--catalog file]
iterate: --input file [--regions ${Object.keys(REGIONS).join(',')}] [--set section.control=JSON ...]
batch / iterate: --appearance file applies or replaces the complete module configuration.
Shared: --seed text --out-dir NEW-directory; omit out-dir for JSON stdout.
iterate optionally overrides BOTH compiler options: --preset none|profile|calibration --enhancers true|false.
Saved compiler options are inherited; standalone JSON defaults to none / false.
No overwrite/force. Select any older profile to return to or branch from it.
Rerolls require saved configured ranges and complete correlation groups.
Default catalog has no brow/nose/styling ranges; use explicit --set instead.
Parameters/prompts only: no image API or image-identity guarantee.`;
function parse(args) {
  const out={ edits:[] };
  for(let i=0;i<args.length;i++) {
    const key=args[i];
    if(key==='--help'){out.help=true;continue;}
    if(!['--archetype','--count','--catalog','--seed','--out-dir','--input','--regions','--set','--preset','--enhancers','--before','--after','--appearance'].includes(key)) throw new Error(`Unknown option: ${key}`);
    if(i+1===args.length || args[i+1].startsWith('--')) throw new Error(`${key} requires a value.`);
    const value=args[++i];
    if(key==='--set') {
      const split=value.indexOf('='); if(split<1) throw new Error('--set requires section.control=JSON.');
      let parsed; try {parsed=JSON.parse(value.slice(split+1));} catch {throw new Error(`Invalid JSON value for ${value.slice(0,split)}.`);}
      out.edits.push({path:value.slice(0,split),value:parsed});
    } else {if(Object.hasOwn(out,key)) throw new Error(`Duplicate option: ${key}`);out[key]=value;}
  }
  return out;
}
function main() {
  const [command,...args]=process.argv.slice(2), o=parse(args);
  if(o.help || command==='--help'){console.log(help);return;}
  const allowed={batch:['--archetype','--count','--catalog','--seed','--out-dir','--appearance'],iterate:['--input','--regions','--seed','--out-dir','--preset','--enhancers','--appearance'],compare:['--before','--after']}[command];
  if(!allowed) throw new Error('Choose batch, iterate, or compare. Use --help.');
  for(const key of Object.keys(o)) if(key.startsWith('--') && !allowed.includes(key)) throw new Error(`${command} does not accept ${key}.`);
  if(command!=='iterate' && o.edits.length) throw new Error(`${command} does not accept --set.`);
  let result,files;
  if(command==='batch') {
    if(!o['--archetype']) throw new Error('batch requires --archetype.');
    if(o['--count']!==undefined && !/^[1-9]\d*$/.test(o['--count'])) throw new Error('Count must be an integer from 1 to 16.');
    result=batchProfiles({archetypes:o['--archetype'].split(','),count:o['--count']===undefined?4:Number(o['--count']),seed:o['--seed'],appearance:o['--appearance']?JSON.parse(fs.readFileSync(o['--appearance'],'utf8')):undefined,catalog:o['--catalog']?JSON.parse(fs.readFileSync(o['--catalog'],'utf8')):undefined});
    files={'manifest.json':JSON.stringify(result.manifest,null,2)+'\n'};
    result.candidates.forEach((candidate,i)=>{for(const [name,value] of Object.entries(artifactFiles(candidate))) files[`${result.manifest.candidates[i].directory}/${name}`]=value;});
  } else if(command==='iterate') {
    if(!o['--input']) throw new Error('iterate requires --input.');
    let compilerOptions;
    if(o['--preset']!==undefined || o['--enhancers']!==undefined) {
      if(o['--preset']===undefined || !['true','false'].includes(o['--enhancers'])) throw new Error('Supply --preset and --enhancers true|false together.');
      compilerOptions={preset:o['--preset'],enhancers:o['--enhancers']==='true'};
    }
    result=iterateProfile({...loadProfile(o['--input']),regions:o['--regions']?o['--regions'].split(','):[],edits:o.edits,seed:o['--seed'],compilerOptions,appearance:o['--appearance']?JSON.parse(fs.readFileSync(o['--appearance'],'utf8')):undefined});
    files=artifactFiles(result);
  } else {
    if(!o['--before'] || !o['--after']) throw new Error('compare requires --before and --after.');
    const before=loadProfile(o['--before']),after=loadProfile(o['--after']);
    console.log(diffText(profileDiff(before.profile,after.profile)));
    const opts=x=>x.manifest?.compiler_options??x.profile.metadata?.sampling?.compiler_options??{preset:'none',enhancers:false};
    const optionDiff=profileDiff(opts(before),opts(after));
    if(optionDiff.length) console.log('Compiler option changes:\n'+diffText(optionDiff));
    return;
  }
  if(!o['--out-dir']) {console.log(JSON.stringify(result,null,2));return;}
  writeImmutable(o['--out-dir'],files);
  console.log(`Saved ${command} to ${o['--out-dir']}`);
  if(result.diff!==undefined) console.log(result.diff);
}
try {main();} catch(error) {console.error(`Variants failed: ${error.message}`);process.exitCode=1;}
