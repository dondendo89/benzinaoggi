// Setup for tests
process.env.DATABASE_URL = 'file:./dev-test.db';
// Ensure test DB exists by cloning schema from dev.db if present
try {
  const fs = require('node:fs');
  if (!fs.existsSync('dev-test.db') && fs.existsSync('dev.db')) {
    fs.copyFileSync('dev.db', 'dev-test.db');
  }
} catch {}

// Ensure schema is applied to test DB
try {
  const cp = require('node:child_process');
  cp.execSync('npx prisma db push --skip-generate', {
    stdio: 'ignore',
    env: { ...process.env, DATABASE_URL: 'file:./dev-test.db' },
  });
} catch {}


