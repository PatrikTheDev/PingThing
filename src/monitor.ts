import { consola } from 'consola';
import { IncidentDatabase } from './database.js';
import { pingWithRetries } from './ping.js';
import { traceroute } from './traceroute.js';
import type { MonitorConfig, NetworkIncident } from './types.js';

export class NetworkMonitor {
  private database: IncidentDatabase;
  private config: MonitorConfig;
  private intervalId: Timer | null = null;
  private running = false;

  constructor(config: MonitorConfig) {
    this.config = config;
    this.database = new IncidentDatabase(config.dbPath);
  }

  async start(): Promise<void> {
    if (this.running) {
      consola.warn('Monitor is already running');
      return;
    }

    this.running = true;
    
    consola.box({
      title: '🚀 PingThing Network Monitor',
      message: [
        `📍 Hosts: ${this.config.hosts.join(', ')}`,
        `⏱️  Interval: ${this.config.interval}s`,
        `⏰ Timeout: ${this.config.timeout}ms`,
        `🔄 Retries: ${this.config.retries}`,
        `💾 Database: ${this.config.dbPath}`
      ].join('\n')
    });

    await this.performCheck();

    this.intervalId = setInterval(async () => {
      await this.performCheck();
    }, this.config.interval * 1000);

    process.on('SIGINT', () => this.stop());
    process.on('SIGTERM', () => this.stop());
  }

  stop(): void {
    if (!this.running) {
      return;
    }

    consola.info('Stopping network monitoring...');
    this.running = false;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.database.close();
    consola.success('Network monitoring stopped');
    process.exit(0);
  }

  private async performCheck(): Promise<void> {
    const timestamp = new Date().toISOString();
    const checkId = Math.random().toString(36).substring(2, 8);
    
    consola.box({
      title: `🔍 Network Check #${checkId}`,
      message: `Started at ${timestamp}\nHosts: ${this.config.hosts.join(', ')}`
    });
    
    const results: Array<{ host: string; success: boolean; responseTime?: number; error?: string }> = [];
    
    const checkPromises = this.config.hosts.map(async (host) => {
      const result = await this.checkHost(host);
      results.push(result);
      return result;
    });
    
    await Promise.allSettled(checkPromises);
    
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    const avgResponseTime = results
      .filter(r => r.success && r.responseTime)
      .reduce((sum, r) => sum + (r.responseTime || 0), 0) / Math.max(successful, 1);
    
    const stats = await this.database.getStatistics();
    
    consola.box({
      title: `📊 Check #${checkId} Summary`,
      message: [
        `✅ Successful: ${successful}/${this.config.hosts.length}`,
        `❌ Failed: ${failed}/${this.config.hosts.length}`,
        successful > 0 ? `⚡ Avg Response: ${avgResponseTime.toFixed(2)}ms` : '',
        `📈 Total Incidents: ${stats.totalIncidents}`,
        `🔴 Unresolved: ${stats.unresolvedIncidents}`
      ].filter(Boolean).join('\n')
    });
    
    consola.info(''); // Add spacing
  }

  private async checkHost(host: string): Promise<{ host: string; success: boolean; responseTime?: number; error?: string }> {
    try {
      const pingResult = await pingWithRetries(
        host,
        this.config.retries,
        this.config.timeout
      );

      if (pingResult.success) {
        consola.success(`  ✅ ${host.padEnd(20)} ${pingResult.responseTime?.toFixed(2).padStart(6)}ms`);
        await this.resolveExistingIncidents(host);
        return {
          host,
          success: true,
          responseTime: pingResult.responseTime
        };
      }

      consola.warn(`  ❌ ${host.padEnd(20)} FAILED - ${pingResult.error}`);
      
      const tracerouteResult = await traceroute(host, this.config.timeout);
      
      const incident: Omit<NetworkIncident, 'id'> = {
        host,
        timestamp: new Date(),
        resolved: false,
        pingResult,
        tracerouteResult
      };

      await this.database.saveIncident(incident);
      
      consola.error(`  🚨 Incident recorded for ${host}`);
      if (tracerouteResult.success && tracerouteResult.hops.length > 0) {
        const lastReachableHop = tracerouteResult.hops
          .filter(hop => !hop.timeout && hop.ip)
          .pop();
        
        if (lastReachableHop) {
          consola.info(`  🔄 Last reachable: ${lastReachableHop.ip} (hop ${lastReachableHop.hop})`);
        }
      }
      
      return {
        host,
        success: false,
        error: pingResult.error
      };
    } catch (error) {
      consola.error(`  💥 Error checking ${host}:`, error);
      return {
        host,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async resolveExistingIncidents(host: string): Promise<void> {
    const unresolvedIncidents = (await this.database.getIncidentsByHost(host, 10))
      .filter(incident => !incident.resolved);

    for (const incident of unresolvedIncidents) {
      if (incident.id) {
        const success = await this.database.markIncidentResolved(incident.id);
        if (success) {
          consola.success(`  ✅ Resolved incident #${incident.id} for ${host}`);
        }
      }
    }
  }
}