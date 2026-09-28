#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileFacePrompt } from './compiler/gpt-image-2.5.mjs';
import { confirmAction } from './lib/confirm.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const configPath = path.join(projectRoot, 'presets', 'rebuild_targets.json');
const args = process.argv.slice(2);

function printHelp() {
  console.log(`Visage Prompt Builder - rebuild generated prompt snapshots

Usage:
  npm run rebuild -- --all [options]
  npm run rebuild -- --block <name> [options]
  npm run rebuild -- --dir <output-subdir> [options]
  npm run rebuild -- --target <name> [options]

Selectors (choose exactly one):
  --all              Rebuild every configured target
  --block <name>     Rebuild one named block from presets/rebuild_targets.json
  --dir <subdir>     Rebuild targets under an output-relative subdirectory
  --target <name>    Rebuild one exact target

Safety options:
  --dry-run          Print the rebuild plan without writing or deleting files
  --yes              Skip the interactive confirmation
  -h, --help         Show this help

Examples:
  npm run rebuild -- --all
  npm run rebuild -- --all --yes
  npm run rebuild -- --block gpt-image-2.5
  npm run rebuild -- --dir gpt-image-2.5
  npm run rebuild -- --target example-synthetic-face-001.calibration
  npm run rebuild -- --all --dry-run`);
}

function parseArgs(argv) {
  const result = {
    selector: null,
    value: null,
    yes: false,
    dryRun: false,
    help: false
  };

  const selectorNames = new Set(['--all', '--block', '--dir', '--target']);

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === '-h' || arg === '--help') {
      result.help = true;
      continue;
    }
    if (arg === '--yes') {
      result.yes = true;
      continue;
    }
    if (arg === '--dry-run') {
      result.dryRun = true;
      continue;
    }
    if (selectorNames.has(arg)) {
      if (result.selector) {
        throw new Error(`Choose exactly one selector. Already using ${result.selector}.`);
      }
      result.selector = arg;
      if (arg !== '--all') {
        const value = argv[i + 1];
        if (!value || value.startsWith('--')) {
          throw new Error(`${arg} requires a value.`);
        }
        result.value = value;
        i += 1;
      }
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return result;
}

function isWithin(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function readConfig() {
  return JSON.parse(fs.readFileSync(configPath, 'utf8'));
}

function flattenTargets(config) {
  const outputRoot = path.resolve(projectRoot, config.output_root || 'output');
  const targets = [];

  for (const [blockName, block] of Object.entries(config.blocks || {})) {
    if (!block.output_dir) {
      throw new Error(`Block ${blockName} must define a non-empty output_dir.`);
    }

    const blockDir = path.resolve(outputRoot, block.output_dir);
    if (!isWithin(outputRoot, blockDir) || blockDir === outputRoot) {
      throw new Error(`Unsafe output_dir for block ${blockName}: ${block.output_dir}`);
    }

    for (const target of block.targets || []) {
      const inputPath = path.resolve(projectRoot, target.input);
      const outputPath = path.resolve(blockDir, target.output);

      if (!isWithin(projectRoot, inputPath)) {
        throw new Error(`Unsafe input path for target ${target.name}: ${target.input}`);
      }
      if (!isWithin(blockDir, outputPath)) {
        throw new Error(`Unsafe output path for target ${target.name}: ${target.output}`);
      }

      targets.push({
        ...target,
        block: blockName,
        blockDir,
        inputPath,
        outputPath,
        outputRelative: path.relative(outputRoot, outputPath)
      });
    }
  }

  const names = new Set();
  for (const target of targets) {
    if (!target.name) throw new Error('Every rebuild target must have a name.');
    if (names.has(target.name)) throw new Error(`Duplicate rebuild target name: ${target.name}`);
    names.add(target.name);
  }

  return { outputRoot, targets };
}

function selectTargets(options, outputRoot, targets) {
  if (options.selector === '--all') return targets;

  if (options.selector === '--block') {
    const selected = targets.filter((target) => target.block === options.value);
    if (!selected.length) throw new Error(`Unknown or empty block: ${options.value}`);
    return selected;
  }

  if (options.selector === '--target') {
    const selected = targets.filter((target) => target.name === options.value);
    if (!selected.length) throw new Error(`Unknown target: ${options.value}`);
    return selected;
  }

  if (options.selector === '--dir') {
    const requestedDir = path.resolve(outputRoot, options.value);
    if (!isWithin(outputRoot, requestedDir) || requestedDir === outputRoot) {
      throw new Error(`--dir must be a safe subdirectory inside output/: ${options.value}`);
    }
    const selected = targets.filter((target) => isWithin(requestedDir, target.outputPath));
    if (!selected.length) throw new Error(`No rebuild targets found under output/${options.value}`);
    return selected;
  }

  throw new Error('Choose one selector: --all, --block, --dir, or --target.');
}

function cleanupScopes(options, outputRoot, selected) {
  if (options.selector === '--target') return [];

  if (options.selector === '--dir') {
    return [path.resolve(outputRoot, options.value)];
  }

  return [...new Set(selected.map((target) => target.blockDir))];
}

function compileTarget(target) {
  const profile = JSON.parse(fs.readFileSync(target.inputPath, 'utf8'));

  if (target.compiler === 'gpt-image-2.5') {
    return compileFacePrompt(profile, { preset: target.preset || 'calibration' });
  }

  throw new Error(`Unsupported compiler for target ${target.name}: ${target.compiler}`);
}

function showPlan(options, outputRoot, selected, cleanups) {
  console.log('Rebuild plan');
  console.log(`  selector: ${options.selector}${options.value ? ` ${options.value}` : ''}`);
  console.log(`  output root: ${path.relative(projectRoot, outputRoot) || '.'}`);
  console.log(`  targets: ${selected.length}`);

  if (cleanups.length) {
    console.log('  clean:');
    for (const cleanup of cleanups) {
      console.log(`    - ${path.relative(projectRoot, cleanup)}`);
    }
  } else {
    console.log('  clean: target file only (no directory removal)');
  }

  console.log('  generate:');
  for (const target of selected) {
    console.log(`    - ${target.name} -> ${path.relative(projectRoot, target.outputPath)}`);
  }
}

async function main() {
  const options = parseArgs(args);

  if (options.help) {
    printHelp();
    return;
  }
  if (!options.selector) {
    printHelp();
    process.exitCode = 1;
    return;
  }

  const config = readConfig();
  const { outputRoot, targets } = flattenTargets(config);
  const selected = selectTargets(options, outputRoot, targets);
  const cleanups = cleanupScopes(options, outputRoot, selected);

  showPlan(options, outputRoot, selected, cleanups);

  if (options.dryRun) {
    console.log('Dry run only. No files changed.');
    return;
  }

  const confirmed = await confirmAction(`Proceed with rebuilding ${selected.length} target(s)?`, { yes: options.yes });
  if (!confirmed) {
    console.log('Rebuild cancelled.');
    return;
  }

  for (const cleanup of cleanups) {
    fs.rmSync(cleanup, { recursive: true, force: true });
  }

  for (const target of selected) {
    const prompt = compileTarget(target);
    fs.mkdirSync(path.dirname(target.outputPath), { recursive: true });
    fs.writeFileSync(target.outputPath, `${prompt}\n`, 'utf8');
    console.log(`Built ${path.relative(projectRoot, target.outputPath)}`);
  }

  console.log(`Rebuild complete: ${selected.length} target(s).`);
}

main().catch((error) => {
  console.error(`Rebuild failed: ${error.message}`);
  process.exitCode = 1;
});
