import { $ } from 'bun';
import { consola } from 'consola';
import type { TracerouteResult, TracerouteHop } from './types.js';

export async function traceroute(host: string, timeout = 5000): Promise<TracerouteResult> {
  const timestamp = new Date();
  const timeoutSeconds = Math.floor(timeout / 1000);
  
  try {
    const output = await $`traceroute -w ${timeoutSeconds} ${host}`.text();
    const hops = parseTracerouteOutput(output);
    consola.info(`Traceroute to ${host} completed with ${hops.length} hops`);
    
    return {
      host,
      hops,
      timestamp,
      success: true
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    consola.warn(`Traceroute to ${host} failed: ${errorMessage}`);
    
    return {
      host,
      hops: [],
      timestamp,
      success: false,
      error: errorMessage
    };
  }
}

function parseTracerouteOutput(output: string): TracerouteHop[] {
  const lines = output.split('\n').slice(1);
  const hops: TracerouteHop[] = [];
  
  for (const line of lines) {
    if (!line.trim()) continue;
    
    const hopMatch = line.match(/^\s*(\d+)\s+(.+)$/);
    if (!hopMatch || !hopMatch[1] || !hopMatch[2]) continue;
    
    const hopNumber = Number.parseInt(hopMatch[1], 10);
    const hopData = hopMatch[2];
    
    if (hopData.includes('* * *')) {
      hops.push({
        hop: hopNumber,
        timeout: true
      });
      continue;
    }
    
    const ipMatch = hopData.match(/(\d+\.\d+\.\d+\.\d+)/);
    const hostnameMatch = hopData.match(/([a-zA-Z][a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
    const timeMatch = hopData.match(/(\d+(?:\.\d+)?)\s*ms/);
    
    hops.push({
      hop: hopNumber,
      ip: ipMatch?.[1],
      hostname: hostnameMatch?.[1],
      responseTime: timeMatch?.[1] ? Number.parseFloat(timeMatch[1]) : undefined,
      timeout: false
    });
  }
  
  return hops;
}