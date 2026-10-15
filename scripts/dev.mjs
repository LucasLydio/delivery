import { spawn } from 'node:child_process';

const commands = [
  {
    name: 'backend',
    args: ['--env-file=.env', '--import', 'tsx', 'backend/dev.ts'],
  },
  {
    name: 'frontend',
    args: ['node_modules/@angular/cli/bin/ng.js', 'serve', '--proxy-config', 'proxy.conf.json'],
  },
];

let stopping = false;

const children = commands.map(({ name, args }) => {
  const child = spawn(process.execPath, args, { stdio: 'inherit' });
  child.once('exit', code => {
    if (stopping) return;
    if (code !== 0) console.error(`${name} development process stopped with exit code ${code ?? 'unknown'}.`);
    stop(code ?? 1);
  });
  return child;
});

function stop(exitCode = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (!child.killed) child.kill('SIGTERM');
  }
  process.exitCode = exitCode;
}

process.once('SIGINT', () => stop());
process.once('SIGTERM', () => stop());
