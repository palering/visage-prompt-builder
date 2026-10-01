#!/usr/bin/env node
import fs from 'node:fs';
import { sampleProfile, defaultCatalog, validateCatalog } from './sampling/sample.mjs';
import { writeSample } from './sampling/write.mjs';

const help = `Visage Prompt Builder - sample fictional adult character directions

Usage: npm run sample -- --archetype beautiful,elegant [--seed demo] [--out-dir samples/demo]
       npm run sample -- --list

Options:
  --archetype <ids>   One appearance and/or one presentation, comma-separated
  --seed <text>       Reproducible parameter seed; omitted seed is generated and saved
  --out-dir <dir>     Write profile.json, prompt.txt, manifest.json as one sample
  --catalog <file>    Use an authored catalog (validated before output)
  --appearance <file> Apply optional explicit appearance modules to this sample
  --force            Replace an existing dedicated sample directory
  --list             Show archetypes and shared morphology families
  --help             Show this help

Without --out-dir, print a JSON bundle with profile, prompt and manifest.
Recompile: npm run build -- samples/demo/profile.json --preset profile --enhancers
Ranges are artistic hypotheses. Seeds reproduce JSON/prompt, not image identity.`;

async function main() {
  const options = {};
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (['--help','--list','--force'].includes(arg)) { options[arg.slice(2)] = true; continue; }
    if (!['--archetype','--seed','--out-dir','--catalog','--appearance'].includes(arg)) throw new Error(`Unknown option: ${arg}`);
    if (options[arg] !== undefined) throw new Error(`Duplicate option: ${arg}`);
    if (args[i+1] === undefined || args[i+1].startsWith('--')) throw new Error(`${arg} requires a value.`);
    options[arg] = args[++i];
  }
  if (options.help) { console.log(help); return; }
  const catalog = options['--catalog'] ? JSON.parse(fs.readFileSync(options['--catalog'], 'utf8')) : defaultCatalog;
  validateCatalog(catalog);
  if (options.list) {
    for (const [id, recipe] of Object.entries(catalog.archetypes)) console.log(`${id} [${recipe.layer}] ${recipe.label}\n  ${recipe.description}`);
    console.log(`Shared morphology families: ${catalog.morphology_bundles.map(b => b.id).join(', ')}`);
    return;
  }
  if (!options['--archetype']) throw new Error('Choose --archetype or --list. Use --help for examples.');
  if (options.force && !options['--out-dir']) throw new Error('--force requires --out-dir.');
  const sample = sampleProfile({ archetypes: options['--archetype'].split(',').map(s => s.trim()), seed: options['--seed'], catalog, appearance:options['--appearance']?JSON.parse(fs.readFileSync(options['--appearance'],'utf8')):undefined });
  if (!options['--out-dir']) { console.log(JSON.stringify(sample, null, 2)); return; }
  const written = await writeSample(options['--out-dir'], sample, { force: options.force });
  console.log(written ? `Sample written to ${options['--out-dir']} (seed: ${sample.manifest.seed})` : 'Sample cancelled.');
}
main().catch(error => { console.error(`Sample failed: ${error.message}`); process.exitCode = 1; });
