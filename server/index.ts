import { createApp } from './app';

const port = Number(process.env.API_PORT ?? 5174);
const databaseUrl = process.env.DATABASE_URL ?? 'postgresql:///think_training_mvp';
const adminEmail = process.env.ADMIN_EMAIL;
const adminPassword = process.env.ADMIN_PASSWORD;

if (!adminEmail || !adminPassword) {
  throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD are required to start the API.');
}

const handle = await createApp({
  databaseUrl,
  seed: {
    adminEmail,
    adminPassword,
  },
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://127.0.0.1:5173',
  sessionTtlHours: Number(process.env.SESSION_TTL_HOURS ?? 12),
});

const server = handle.app.listen(port, '127.0.0.1', () => {
  console.log(`Think Together API listening on http://127.0.0.1:${port}`);
});

function shutdown() {
  server.close(async () => {
    await handle.close();
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
