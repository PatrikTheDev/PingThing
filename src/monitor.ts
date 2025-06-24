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
    consola.success('Starting network monitoring...');
    consola.info(`Monitoring hosts: ${this.config.hosts.join(', ')}`);
    consola.info(`Check interval: ${this.config.interval} seconds`);
    consola.info(`Ping timeout: ${this.config.timeout}ms`);
    consola.info(`Max retries: ${this.config.retries}`);

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
    consola.info(`Performing network check at ${new Date().toISOString()}`);
    
    const checkPromises = this.config.hosts.map(host => this.checkHost(host));
    await Promise.allSettled(checkPromises);
    
    const stats = this.database.getStatistics();
    consola.info(`Check completed. Total incidents: ${stats.totalIncidents}, Unresolved: ${stats.unresolvedIncidents}`);
  }

  private async checkHost(host: string): Promise<void> {
    try {
      const pingResult = await pingWithRetries(
        host,
        this.config.retries,
        this.config.timeout
      );

      if (pingResult.success) {
        consola.success(`✓ ${host} is reachable (${pingResult.responseTime?.toFixed(2)}ms)`);
        await this.resolveExistingIncidents(host);
        return;
      }

      consola.warn(`✗ ${host} is unreachable: ${pingResult.error}`);
      
      const tracerouteResult = await traceroute(host, this.config.timeout);
      
      const incident: Omit<NetworkIncident, 'id'> = {
        host,
        timestamp: new Date(),
        resolved: false,
        pingResult,
        tracerouteResult
      };

      await this.database.saveIncident(incident);
      
      consola.error(`Network incident recorded for ${host}`);
      if (tracerouteResult.success && tracerouteResult.hops.length > 0) {
        const lastReachableHop = tracerouteResult.hops
          .filter(hop => !hop.timeout && hop.ip)
          .pop();
        
        if (lastReachableHop) {
          consola.info(`Last reachable hop: ${lastReachableHop.ip} (hop ${lastReachableHop.hop})`);
        }
      }
    } catch (error) {
      consola.error(`Error checking host ${host}:`, error);
    }
  }

  private async resolveExistingIncidents(host: string): Promise<void> {
    const unresolvedIncidents = this.database.getIncidentsByHost(host, 10)
      .filter(incident => !incident.resolved);

    for (const incident of unresolvedIncidents) {
      if (incident.id) {
        const success = this.database.markIncidentResolved(incident.id);
        if (success) {
          consola.success(`Resolved incident ${incident.id} for ${host}`);
        }
      }
    }
  }
}