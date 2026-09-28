import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

export async function confirmAction(message, { yes = false } = {}) {
  if (yes) return true;

  if (!input.isTTY || !output.isTTY) {
    throw new Error('Interactive confirmation is required. Re-run with --yes to confirm non-interactively.');
  }

  const rl = readline.createInterface({ input, output });
  try {
    const answer = (await rl.question(`${message} [y/N] `)).trim().toLowerCase();
    return answer === 'y' || answer === 'yes';
  } finally {
    rl.close();
  }
}
