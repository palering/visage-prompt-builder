#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { compileFacePrompt } from './compiler/gpt-image-2.5.mjs';

const args = process.argv.slice(2);

if (!args.length || args.includes('--help') || args.includes('-h')) {
  console.log(`Visage Prompt Builder

Usage:
  node src/cli.mjs <face-profile.json> [--preset calibration|profile|none] [--out <file>]

Examples:
  node src/cli.mjs baselines/example_synthetic_face_001.json
  node src/cli.mjs baselines/example_synthetic_face_001.json --preset none
  node src/cli.mjs baselines/example_synthetic_face_001.json --out prompt.txt`);
  process.exit(0);
}

const inputPath = args[0];
const getArg = (name, fallback = null) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const preset = getArg('--preset', 'calibration');
const outPath = getArg('--out');
const allowedPresets = new Set(['calibration', 'profile', 'none']);

if (!allowedPresets.has(preset)) {
  throw new Error(`Unknown preset: ${preset}. Expected calibration, profile, or none.`);
}

const profile = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
const prompt = compileFacePrompt(profile, { preset });

if (outPath) {
  const resolved = path.resolve(outPath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, `${prompt}\n`, 'utf8');
  console.log(`Prompt written to ${resolved}`);
} else {
  console.log(prompt);
}
