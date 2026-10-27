import { app } from './app';

const host = '127.0.0.1';
const port = Number.parseInt(process.env['DEV_API_PORT'] ?? '3000', 10);

const server = app.listen(port, host, () => {
  console.log(`Local API ready: http://${host}:${port}`);
});

function shutdown(): void {
  server.close((error) => {
    if (error) {
      console.error('Failed to stop local API', error);
    }
    process.exit(error ? 1 : 0);
  });
}

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
