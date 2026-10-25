import { loadConfig } from './config.ts';
import { Daemon } from './server.ts';
import { logger } from './logger.ts';

const config = loadConfig();

process.on('unhandledRejection', (reason) => {
  logger.error(`unhandled rejection: ${String(reason)}`);
});

process.on('uncaughtException', (error) => {
  logger.error(`uncaught exception: ${error.message}`);
  process.exit(1);
});

const daemon = new Daemon(config);
daemon.listen();

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    logger.info(`received ${signal}, shutting down`);
    process.exit(0);
  });
}
