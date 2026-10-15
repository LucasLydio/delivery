const baseUrl = (process.env.DEV_BASE_URL ?? 'http://localhost:8888').replace(/\/$/, '');

const health = await fetch(`${baseUrl}/api/health`);
if (health.status !== 200 || !health.headers.get('content-type')?.includes('application/json')) {
  throw new Error(`Health route failed through ${baseUrl}: HTTP ${health.status}`);
}

const login = await fetch(`${baseUrl}/api/auth/login`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: '{}',
});
const loginBody = await login.json().catch(() => null);
if (login.status !== 400 || loginBody?.error !== 'Invalid request') {
  throw new Error(`Login route did not reach Express through ${baseUrl}: HTTP ${login.status}`);
}

console.log(`Development API smoke test passed through ${baseUrl}.`);
