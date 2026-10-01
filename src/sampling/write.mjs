import fs from 'node:fs';
import path from 'node:path';
import { confirmAction } from '../lib/confirm.mjs';

// Entire directory is the sample transaction. Existing unrelated files are never replaced.
export async function writeSample(destination, sample, { force = false, confirm = confirmAction } = {}) {
  const target = path.resolve(destination);
  const parent = path.dirname(target);
  const files = {
    'profile.json': JSON.stringify(sample.profile, null, 2) + '\n',
    'prompt.txt': sample.prompt + '\n',
    'manifest.json': JSON.stringify(sample.manifest, null, 2) + '\n',
    ...(sample.manifest.compiler_options.appearance ? {'appearance.json':JSON.stringify(sample.manifest.compiler_options.appearance,null,2)+'\n'} : {})
  };
  let previous = null;
  if (fs.existsSync(target)) {
    if (fs.lstatSync(target).isSymbolicLink() || !fs.statSync(target).isDirectory()) throw new Error('Sample output must be a real directory, not a file or symlink.');
    const names = fs.readdirSync(target);
    if (names.some(name => !Object.hasOwn(files, name))) throw new Error('Output directory contains unrelated files; choose a dedicated sample directory.');
    for (const name of names) if (!fs.lstatSync(path.join(target, name)).isFile()) throw new Error('Existing sample outputs must be regular files, not links or directories.');
    previous = names.map(name => [name, fs.readFileSync(path.join(target, name)).toString('base64')]);
    if (!force && !await confirm(`Sample directory already exists: ${target}\nReplace this sample?`, { flag: '--force' })) return false;
  }
  fs.mkdirSync(parent, { recursive: true });
  const staging = fs.mkdtempSync(path.join(parent, '.visage-sample-'));
  let backup;
  try {
    for (const [name, content] of Object.entries(files)) fs.writeFileSync(path.join(staging, name), content, { flag: 'wx' });
    if (previous !== null) {
      // Reject changes during confirmation rather than destroying newly arrived files.
      if (fs.lstatSync(target).isSymbolicLink() || JSON.stringify(fs.readdirSync(target)) !== JSON.stringify(previous.map(([name]) => name)) || previous.some(([name, content]) => !fs.lstatSync(path.join(target, name)).isFile() || fs.readFileSync(path.join(target, name)).toString('base64') !== content)) throw new Error('Output changed during confirmation; retry.');
      backup = `${staging}-previous`;
      fs.renameSync(target, backup);
    } else if (fs.existsSync(target)) throw new Error('Output appeared during sampling; retry.');
    try { fs.renameSync(staging, target); }
    catch (error) { if (backup) fs.renameSync(backup, target); throw error; }
    if (backup) fs.rmSync(backup, { recursive: true });
    return true;
  } finally { if (fs.existsSync(staging)) fs.rmSync(staging, { recursive: true }); }
}
