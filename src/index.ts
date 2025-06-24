#!/usr/bin/env bun
import { consola } from 'consola';
import { parseArgs, createConfig, showHelp, showVersion } from './cli.js';
import { NetworkMonitor } from './monitor.js';

async function main(): Promise<void> {
  const args = parseArgs();

  if (args.help) {
    showHelp();
    process.exit(0);
  }

  if (args.version) {
    showVersion();
    process.exit(0);
  }

  const config = createConfig(args);
  const monitor = new NetworkMonitor(config);

  consola.info('PingThing - Network Reliability Testing Tool');
  consola.info('Press Ctrl+C to stop monitoring');
  
  await monitor.start();
}

if (import.meta.main) {
  main().catch((error) => {
    consola.error('Application error:', error);
    process.exit(1);
  });
}