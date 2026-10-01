#!/usr/bin/env node
import { appearanceCatalog } from './appearance/modules.mjs';
const args=process.argv.slice(2);
try {
  if (args.length===0 || args.includes('--help')) {
    console.log('Appearance catalog: npm run appearance -- --list [--module hair|makeup]\nUse exact preset IDs or listed aliases in an appearance-v0.1 JSON file. Omitted modules inherit legacy enhancer behavior; state off suppresses that legacy block.');
  } else {
    if (args[0]!=='--list' || ![1,3].includes(args.length) || (args.length===3 && (args[1]!=='--module' || !['hair','makeup'].includes(args[2])))) throw new Error('Use --list [--module hair|makeup].');
    for (const module of args.length===3?[args[2]]:['hair','makeup']) {
      for(const [id,e]of Object.entries(appearanceCatalog[module])) console.log(`${module}.${id}: ${e.label} [${e.category}; ${e.evidenceStatus}]${e.aliases?.length ? ` aliases: ${e.aliases.join(", ")}` : ""}`);
    }
  }
} catch(e){console.error(`Appearance failed: ${e.message}`);process.exitCode=1;}
