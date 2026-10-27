import { spawn } from 'node:child_process';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const mode = process.argv[2] ?? 'api';
if (mode !== 'api' && mode !== 'full') {
  throw new Error('Netlify development mode must be "api" or "full".');
}

// Netlify Dev reads redirect files from the production publish directory even when a custom
// framework server is configured. A previous production build would therefore apply the SPA
// fallback to Angular's virtual assets and /api routes. The build recreates this generated file.
const productionRedirectPath = resolve('dist/delivery/browser/_redirects');
const productionRedirect = existsSync(productionRedirectPath)
  ? readFileSync(productionRedirectPath)
  : null;
rmSync(productionRedirectPath, { force: true });

const args = ['node_modules/netlify-cli/bin/run.js', 'dev', '--no-open'];
if (mode === 'api') args.push('--functions', 'netlify/functions-local');

const netlify = spawn(process.execPath, args, { stdio: 'inherit' });
netlify.once('exit', (code) => {
  if (productionRedirect) writeFileSync(productionRedirectPath, productionRedirect);
  process.exitCode = code ?? 1;
});

function stop() {
  if (!netlify.killed) netlify.kill('SIGTERM');
}

process.once('SIGINT', stop);
process.once('SIGTERM', stop);
