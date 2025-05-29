import { prompt } from 'enquirer';
import { spawn, spawnSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const scriptsDir = path.join(__dirname, '../src/scripts');

async function main() {
  // List all .ts scripts in src/scripts
  const scripts = fs.readdirSync(scriptsDir)
    .filter(f => f.endsWith('.ts'));

  if (scripts.length === 0) {
    console.log('No scripts found in src/scripts.');
    process.exit(1);
  }

  // Select a script
  const { script } = await prompt({
    type: 'select',
    name: 'script',
    message: 'Select a script to run',
    choices: scripts,
  }) as { script: string };

  // Show --help output for the selected script
  const scriptPath = path.join(scriptsDir, script);
  const helpResult = spawnSync('npx', ['ts-node', scriptPath, '--help'], { encoding: 'utf-8' });
  if (helpResult.stdout) {
    console.log('\n--- Script Help ---');
    console.log(helpResult.stdout);
    console.log('-------------------\n');
  }
  if (helpResult.stderr) {
    console.error(helpResult.stderr);
  }

  // Ask for parameters (optional, as key-value pairs)
  const { params } = await prompt({
    type: 'input',
    name: 'params',
    message: 'Enter parameters as key=value pairs (comma separated), or leave blank:',
  }) as { params: string };

  // Parse parameters
  let args: string[] = [];
  if (params && params.trim()) {
    args = params.split(',').map((pair: string) => pair.trim()).filter(Boolean);
  }

  // Run the script with ts-node
  const child = spawn('npx', ['ts-node', scriptPath, ...args], { stdio: 'inherit' });

  child.on('exit', code => {
    process.exit(code ?? 0);
  });
}

main().catch(err => {
  console.error(err);
  process.exit(1);
}); 