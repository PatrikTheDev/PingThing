import { $ } from 'bun';
import { consola } from 'consola';
import type { PingResult } from './types.js';

export async function ping(host: string, timeout = 5000): Promise<PingResult> {
  const startTime = Date.now();
  const timestamp = new Date();
  const timeoutSeconds = Math.floor(timeout / 1000);
  
  try {
    const output = await $`ping -c 1 -W ${timeoutSeconds} ${host}`.text();
    const responseTime = Date.now() - startTime;
    const timeMatch = output.match(/time=([0-9.]+)\s*ms/);
    const actualTime = timeMatch ? Number.parseFloat(timeMatch[1]) : responseTime;

    consola.success(`Ping to ${host}: ${actualTime.toFixed(2)}ms`);
    
    return {
      host,
      success: true,
      responseTime: actualTime,
      timestamp
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    consola.warn(`Ping to ${host} failed: ${errorMessage}`);
    
    return {
      host,
      success: false,
      timestamp,
      error: errorMessage
    };
  }
}

export async function pingWithRetries(
  host: string, 
  retries = 3, 
  timeout = 5000
): Promise<PingResult> {
  let lastResult: PingResult;
  
  for (let i = 0; i <= retries; i++) {
    lastResult = await ping(host, timeout);
    
    if (lastResult.success) {
      return lastResult;
    }
    
    if (i < retries) {
      consola.info(`Retrying ping to ${host} (${i + 1}/${retries})`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  return lastResult!;
}