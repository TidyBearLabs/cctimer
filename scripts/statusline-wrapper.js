#!/usr/bin/env node
// Where: Claude Code statusline wrapper. What: save cctimer data, then run the user's original statusline. Why: avoid making users choose one command.

const { exec } = require('node:child_process');
const { readFileSync } = require('node:fs');
const { setupConfigPath, wrapperPath } = require('../src/paths');
const { saveFromInput } = require('../src/statusline-state');
const { getWrapperCommand, isCctimerWrapperCommand } = require('../src/statusline-setup');

function readStdin() {
  return new Promise((resolve) => {
    let input = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
      input += chunk;
    });
    process.stdin.on('end', () => resolve(input));
  });
}

function readOriginalCommand() {
  try {
    const config = JSON.parse(readFileSync(setupConfigPath, 'utf8'));
    return config.original_command || null;
  } catch {
    return null;
  }
}

function runOriginalCommand(command, input) {
  return new Promise((resolve) => {
    const child = exec(command, {
      env: {
        ...process.env,
        CCTIMER_WRAPPED_STATUSLINE: '1'
      },
      maxBuffer: 1024 * 1024,
      timeout: 5000
    }, (error, stdout) => {
      resolve(error ? null : stdout);
    });

    child.stdin.end(input);
  });
}

async function main() {
  const input = await readStdin();
  let fallbackLine = 'CC';

  try {
    fallbackLine = saveFromInput(input).line;
  } catch {
    // The original statusline can still run even if cctimer cannot parse early-session input.
  }

  const originalCommand = readOriginalCommand();
  const isRecursive = originalCommand === getWrapperCommand() ||
    originalCommand?.includes(wrapperPath) ||
    isCctimerWrapperCommand(originalCommand);

  if (originalCommand && !isRecursive) {
    const output = await runOriginalCommand(originalCommand, input);
    if (output && output.trim().length > 0) {
      process.stdout.write(output.endsWith('\n') ? output : `${output}\n`);
      return;
    }
  }

  console.log(fallbackLine);
}

main();
