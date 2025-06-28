#!/usr/bin/env bun
import { consola } from 'consola';
import { parseArgs, createConfig } from './cli.js';
import { IncidentDatabase } from './database.js';

function formatDuration(start: Date, end: Date): string {
  const diffMs = end.getTime() - start.getTime();
  const minutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  return `${minutes}m`;
}

function formatTimestamp(date: Date): string {
  return date.toLocaleString();
}

async function generateReport(): Promise<void> {
  const args = parseArgs();
  const config = createConfig(args);
  const database = new IncidentDatabase(config.dbPath);

  try {
    consola.info('📊 PingThing Network Incident Report');
    consola.info('=====================================\n');

    const stats = await database.getStatistics();
    consola.info('📈 Statistics:');
    consola.info(`   Total Incidents: ${stats.totalIncidents}`);
    consola.info(`   Unresolved: ${stats.unresolvedIncidents}`);
    consola.info(`   Hosts Affected: ${stats.hostsAffected}\n`);

    const unresolvedIncidents = await database.getUnresolvedIncidents();
    if (unresolvedIncidents.length > 0) {
      consola.warn('🚨 Unresolved Incidents:');
      consola.warn('-----------------------');
      
      for (const incident of unresolvedIncidents) {
        const duration = formatDuration(incident.timestamp, new Date());
        consola.warn(`   Host: ${incident.host}`);
        consola.warn(`   Since: ${formatTimestamp(incident.timestamp)} (${duration} ago)`);
        consola.warn(`   Ping Error: ${incident.pingResult.error || 'Unknown'}`);
        
        if (incident.tracerouteResult?.success && incident.tracerouteResult.hops.length > 0) {
          const lastHop = incident.tracerouteResult.hops
            .filter(hop => !hop.timeout && hop.ip)
            .pop();
          if (lastHop) {
            consola.warn(`   Last Reachable: ${lastHop.ip} (hop ${lastHop.hop})`);
          }
        }
        consola.warn('');
      }
    } else {
      consola.success('✅ No unresolved incidents');
    }

    const recentIncidents = await database.getRecentIncidents(10);
    if (recentIncidents.length > 0) {
      consola.info('📋 Recent Incidents (Last 10):');
      consola.info('------------------------------');
      
      for (const incident of recentIncidents) {
        const status = incident.resolved ? '✅ Resolved' : '🚨 Active';
        const responseTime = incident.pingResult.responseTime 
          ? `${incident.pingResult.responseTime.toFixed(2)}ms`
          : 'N/A';
        
        consola.info(`   ${status} | ${incident.host} | ${formatTimestamp(incident.timestamp)}`);
        if (!incident.pingResult.success) {
          consola.info(`     Error: ${incident.pingResult.error || 'Unknown'}`);
        }
        if (incident.pingResult.success) {
          consola.info(`     Response Time: ${responseTime}`);
        }
      }
    }

    const hostsData = await database.getRecentIncidents(1000);
    const hostStats = new Map<string, { total: number; unresolved: number }>();
    
    for (const incident of hostsData) {
      const stats = hostStats.get(incident.host) || { total: 0, unresolved: 0 };
      stats.total++;
      if (!incident.resolved) stats.unresolved++;
      hostStats.set(incident.host, stats);
    }

    if (hostStats.size > 0) {
      consola.info('\n🖥️  Host Summary:');
      consola.info('----------------');
      
      for (const [host, stats] of hostStats.entries()) {
        const status = stats.unresolved > 0 ? '🚨' : '✅';
        consola.info(`   ${status} ${host}: ${stats.total} incidents (${stats.unresolved} unresolved)`);
      }
    }

  } catch (error) {
    consola.error('Failed to generate report:', error);
    process.exit(1);
  } finally {
    database.close();
  }
}

if (import.meta.main) {
  generateReport();
}