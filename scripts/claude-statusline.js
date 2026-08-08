#!/usr/bin/env node
// Where: Claude Code statusline command. What: persist rate-limit data. Why: let the menu bar app show the reset countdown.

const { saveFromInput } = require('../src/statusline-state');

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

async function main() {
  const input = await readStdin();

  try {
    const result = saveFromInput(input);
    console.log(result.line);
  } catch {
    console.log('CC');
  }
}

main();
