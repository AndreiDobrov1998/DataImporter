import { prompt } from 'enquirer';
import { spawn, spawnSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const scriptsDir = path.join(__dirname, '../src/scripts');
let currentChild: ReturnType<typeof spawn> | null = null;
let isExiting = false;

// Handle process termination
function cleanup() {
  if (isExiting) return;
  isExiting = true;
  
  if (currentChild) {
    currentChild.kill('SIGINT');
  }
  
  console.log('\nExiting...');
  process.exit(0);
}

// Handle various termination signals
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('SIGHUP', cleanup);

// Handle stdin errors
process.stdin.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EPIPE') {
    cleanup();
  }
});

async function main() {
  try {
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
      onCancel: () => {
        cleanup();
        return false;
      }
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
      onCancel: () => {
        cleanup();
        return false;
      }
    }) as { params: string };

    // Parse parameters
    let args: string[] = [];
    if (params && params.trim()) {
      args = params.split(',').map((pair: string) => pair.trim()).filter(Boolean);
    }

    // Run the script with ts-node
    currentChild = spawn('npx', ['ts-node', scriptPath, ...args], { stdio: 'inherit' });

    currentChild.on('exit', code => {
      currentChild = null;
      process.exit(code ?? 0);
    });
  } catch (err) {
    if (err instanceof Error && err.message.includes('readline was closed')) {
      cleanup();
    }
    throw err;
  }
}

// Ensure we clean up on uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  cleanup();
});

main().catch(err => {
  console.error(err);
  process.exit(1);
}); 