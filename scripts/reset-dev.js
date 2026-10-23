#!/usr/bin/env node
/**
 * MicroStream Development Environment Reset Script
 * Resets local database, runs migrations, restores synthetic seed data,
 * and resets running dev servers if active.
 */

import { execSync } from 'child_process';
import http from 'http';

console.log('=======================================================');
console.log('🔄 MicroStream Development Environment Reset');
console.log('=======================================================');

async function resetRunningBackend() {
  return new Promise((resolve) => {
    const req = http.request(
      'http://localhost:4000/api/stream/reset',
      { method: 'POST', timeout: 2000 },
      (res) => {
        if (res.statusCode === 200) {
          console.log('✓ Successfully reset running backend daemon state via /api/stream/reset');
        } else {
          console.log(`- Backend returned status ${res.statusCode} on reset.`);
        }
        resolve(true);
      }
    );
    req.on('error', () => {
      console.log('- Backend daemon not running on port 4000 (skipping live reset request)');
      resolve(false);
    });
    req.end();
  });
}

async function main() {
  try {
    // 1. Reset live backend if running
    await resetRunningBackend();

    // 2. Rebuild packages
    console.log('\n📦 Rebuilding packages (@microstream/shared, @microstream/backend, @microstream/frontend)...');
    execSync('npm run build', { stdio: 'inherit' });
    console.log('✓ Packages built successfully.');

    // 3. Re-seed database
    console.log('\n🌱 Reseeding database records...');
    const seedModule = await import('../backend/dist/db/seed.js');
    if (seedModule.seedDatabase) {
      await seedModule.seedDatabase();
      console.log('✓ Synthetic earnings and worker profiles seeded successfully.');
    }

    console.log('\n=======================================================');
    console.log('✅ MicroStream Development Reset Complete!');
    console.log('   Run "npm run dev" to start all services.');
    console.log('=======================================================');
  } catch (err) {
    console.error('❌ Reset failed:', err.message);
    process.exit(1);
  }
}

main();
