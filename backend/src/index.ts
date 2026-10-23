import { createApp } from './app.js';
import { config } from './config.js';

const { app } = createApp();

const server = app.listen(config.port, () => {
  console.log(`=======================================================`);
  console.log(`💧 MicroStream Backend Service Started`);
  console.log(`🚀 Port: ${config.port}`);
  console.log(`📡 Environment: ${config.nodeEnv}`);
  console.log(`🔗 Health Check: http://localhost:${config.port}/api/health`);
  console.log(`🪙 Currency Units: Integer paise (1 INR = 100 paise)`);
  console.log(`🛡️ Adapters: MOCK Mode (Safe Sandbox Simulation)`);
  console.log(`=======================================================`);
});

export default server;
