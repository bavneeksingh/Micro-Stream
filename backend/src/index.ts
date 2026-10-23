import { createApp } from './app.js';
import { config } from './config.js';
import { db } from './db/db.js';

const { app } = createApp();

async function start() {
  await db.init();

  const server = app.listen(config.port, () => {
    console.log(`=======================================================`);
    console.log(`💧 MicroStream Backend Service Started`);
    console.log(`🚀 Port: ${config.port}`);
    console.log(`📡 Environment: ${config.nodeEnv}`);
    console.log(`💾 Database: ${db.isInMemory ? 'pg-mem (In-Memory PostgreSQL Engine)' : 'PostgreSQL Native'}`);
    console.log(`🔗 Health Check: http://localhost:${config.port}/api/health`);
    console.log(`🪙 Currency Units: Integer paise (1 INR = 100 paise)`);
    console.log(`🛡️ Adapters: MOCK Mode (Safe Sandbox Simulation)`);
    console.log(`=======================================================`);
  });

  return server;
}

const serverPromise = start();
export default serverPromise;

