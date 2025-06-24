import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';

export const env = createEnv({
  server: {
    PINGTHING_HOSTS: z.string().optional(),
    PINGTHING_INTERVAL: z.coerce.number().min(10).max(3600).optional(),
    PINGTHING_TIMEOUT: z.coerce.number().min(1000).max(30000).optional(),
    PINGTHING_RETRIES: z.coerce.number().min(1).max(10).optional(),
    PINGTHING_API_PORT: z.coerce.number().min(1024).max(65535).optional(),
    PINGTHING_DB_PATH: z.string().optional(),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});

export function getEnvDefaults() {
  return {
    hosts: env.PINGTHING_HOSTS,
    interval: env.PINGTHING_INTERVAL,
    timeout: env.PINGTHING_TIMEOUT,
    retries: env.PINGTHING_RETRIES,
    apiPort: env.PINGTHING_API_PORT,
    dbPath: env.PINGTHING_DB_PATH,
  };
}