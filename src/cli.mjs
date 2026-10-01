#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { compileFacePrompt } from './compiler/gpt-image-2.5.mjs';
import { confirmAction } from './lib/confirm.mjs';

const args = process.argv.slice(2);
const allowedPresets = new Set(['calibration', 'profile', 'none']);

function printHelp() {
  console.log(`Visage Prompt Builder - build one prompt

Usage:
  npm run build -- <face-profile.json> [options]

Options:
  --preset <name>   calibration | profile | none (default: calibration)
  --enhancers      Include optional profile styling (requires profile or none preset)
  --appearance <file> Optional appearance-v0.1 module JSON (requires profile or none for selections)
  --body <file>     Optional body-v0.1 JSON (adult profiles only)
  --capture <name>  head | full_body (otherwise preserve legacy capture)
  --out <file>      Write the prompt to a file instead of stdout
  --force           Overwrite an existing --out file without confirmation
  -h, --help        Show this help

Examples:
  npm run build -- baselines/example_synthetic_face_001.json
  npm run build -- baselines/example_synthetic_face_001.json --preset none
  npm run build -- baselines/example_synthetic_face_001.json --out prompt.txt
  npm run build -- baselines/example_synthetic_face_001.json --out prompt.txt --force`);
}

function parseArgs(argv) {
  const result = {
    input: null,
    preset: 'calibration',
    out: null,
    force: false,
    enhancers: false,
    help: false
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === '-h' || arg === '--help') {
      result.help = true;
      continue;
    }

    if (arg === '--enhancers') {
      result.enhancers = true;
      continue;
    }

    if (arg === '--force') {
      result.force = true;
      continue;
    }

    if (arg === '--preset' || arg === '--out' || arg === '--appearance' || arg === '--body' || arg === '--capture') {
      const value = argv[i + 1];
      if (!value || value.startsWith('--')) {
        throw new Error(`${arg} requires a value.`);
      }
      i += 1;
      if (arg === '--preset') result.preset = value;
      if (arg === '--out') result.out = value;
      if (arg === '--appearance') result.appearance = value;
      if (arg === '--body') result.body = value;
      if (arg === '--capture') result.capture = value;
      continue;
    }

    if (arg.startsWith('-')) {
      throw new Error(`Unknown option: ${arg}`);
    }

    if (result.input) {
      throw new Error(`Unexpected positional argument: ${arg}`);
    }
    result.input = arg;
  }

  return result;
}

async function main() {
  const options = parseArgs(args);

  if (options.help || !options.input) {
    printHelp();
    process.exitCode = options.help ? 0 : 1;
    return;
  }

  if (!allowedPresets.has(options.preset)) {
    throw new Error(`Unknown preset: ${options.preset}. Expected calibration, profile, or none.`);
  }

  const inputPath = path.resolve(options.input);
  const profile = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  const prompt = compileFacePrompt(profile, { preset: options.preset, enhancers: options.enhancers, ...(options.appearance ? {appearance:JSON.parse(fs.readFileSync(options.appearance,'utf8'))} : {}), ...(options.body ? {body:JSON.parse(fs.readFileSync(options.body,'utf8'))} : {}), ...(options.capture ? {capture:options.capture} : {}) });

  if (!options.out) {
    process.stdout.write(`${prompt}\n`);
    return;
  }

  const outPath = path.resolve(options.out);
  if (fs.existsSync(outPath) && !options.force) {
    const confirmed = await confirmAction(`Output file already exists: ${outPath}\nOverwrite it?`, { flag: '--force' });
    if (!confirmed) {
      console.log('Build cancelled.');
      return;
    }
  }

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${prompt}\n`, 'utf8');
  console.log(`Prompt written to ${outPath}`);
}

main().catch((error) => {
  console.error(`Build failed: ${error.message}`);
  process.exitCode = 1;
});
