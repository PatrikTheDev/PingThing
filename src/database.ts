import { Database } from 'bun:sqlite';
import { consola } from 'consola';
import type { NetworkIncident, PingResult, TracerouteResult } from './types.js';

export class IncidentDatabase {
  private db: Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath, { create: true });
    this.initializeSchema();
  }

  private initializeSchema(): void {
    const createIncidentsTable = `
      CREATE TABLE IF NOT EXISTS incidents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        host TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        resolved BOOLEAN DEFAULT FALSE,
        ping_success BOOLEAN NOT NULL,
        ping_response_time REAL,
        ping_error TEXT,
        traceroute_success BOOLEAN,
        traceroute_error TEXT,
        traceroute_hops TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;

    try {
      this.db.exec(createIncidentsTable);
      consola.success('Database initialized successfully');
    } catch (error) {
      consola.error('Failed to initialize database:', error);
      throw error;
    }
  }

  async saveIncident(incident: Omit<NetworkIncident, 'id'>): Promise<number> {
    const query = `
      INSERT INTO incidents (
        host, timestamp, resolved, ping_success, ping_response_time, ping_error,
        traceroute_success, traceroute_error, traceroute_hops
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
      incident.host,
      incident.timestamp.toISOString(),
      incident.resolved,
      incident.pingResult.success,
      incident.pingResult.responseTime || null,
      incident.pingResult.error || null,
      incident.tracerouteResult?.success || null,
      incident.tracerouteResult?.error || null,
      incident.tracerouteResult ? JSON.stringify(incident.tracerouteResult.hops) : null
    ];

    try {
      const result = this.db.prepare(query).run(...values);
      consola.info(`Saved incident ${result.lastInsertRowid} for host ${incident.host}`);
      return result.lastInsertRowid as number;
    } catch (error) {
      consola.error('Failed to save incident:', error);
      throw error;
    }
  }

  getRecentIncidents(limit = 50): NetworkIncident[] {
    const query = `
      SELECT * FROM incidents 
      ORDER BY timestamp DESC 
      LIMIT ?
    `;

    try {
      const rows = this.db.prepare(query).all(limit) as any[];
      return rows.map(row => this.mapRowToIncident(row));
    } catch (error) {
      consola.error('Failed to fetch recent incidents:', error);
      return [];
    }
  }

  getIncidentsByHost(host: string, limit = 20): NetworkIncident[] {
    const query = `
      SELECT * FROM incidents 
      WHERE host = ? 
      ORDER BY timestamp DESC 
      LIMIT ?
    `;

    try {
      const rows = this.db.prepare(query).all(host, limit) as any[];
      return rows.map(row => this.mapRowToIncident(row));
    } catch (error) {
      consola.error(`Failed to fetch incidents for host ${host}:`, error);
      return [];
    }
  }

  getUnresolvedIncidents(): NetworkIncident[] {
    const query = `
      SELECT * FROM incidents 
      WHERE resolved = FALSE 
      ORDER BY timestamp DESC
    `;

    try {
      const rows = this.db.prepare(query).all() as any[];
      return rows.map(row => this.mapRowToIncident(row));
    } catch (error) {
      consola.error('Failed to fetch unresolved incidents:', error);
      return [];
    }
  }

  markIncidentResolved(id: number): boolean {
    const query = `UPDATE incidents SET resolved = TRUE WHERE id = ?`;

    try {
      const result = this.db.prepare(query).run(id);
      const success = result.changes > 0;
      if (success) {
        consola.info(`Marked incident ${id} as resolved`);
      }
      return success;
    } catch (error) {
      consola.error(`Failed to mark incident ${id} as resolved:`, error);
      return false;
    }
  }

  getLatestIncident(): NetworkIncident | null {
    const query = `
      SELECT * FROM incidents 
      ORDER BY timestamp DESC 
      LIMIT 1
    `;

    try {
      const row = this.db.prepare(query).get() as any;
      return row ? this.mapRowToIncident(row) : null;
    } catch (error) {
      consola.error('Failed to fetch latest incident:', error);
      return null;
    }
  }

  clearAllIncidents(): boolean {
    const query = `DELETE FROM incidents`;

    try {
      const result = this.db.prepare(query).run();
      consola.info(`Cleared ${result.changes} incidents from database`);
      return true;
    } catch (error) {
      consola.error('Failed to clear incidents:', error);
      return false;
    }
  }

  getStatistics(): { totalIncidents: number; unresolvedIncidents: number; hostsAffected: number } {
    try {
      const totalQuery = `SELECT COUNT(*) as count FROM incidents`;
      const unresolvedQuery = `SELECT COUNT(*) as count FROM incidents WHERE resolved = FALSE`;
      const hostsQuery = `SELECT COUNT(DISTINCT host) as count FROM incidents`;

      const total = this.db.prepare(totalQuery).get() as { count: number };
      const unresolved = this.db.prepare(unresolvedQuery).get() as { count: number };
      const hosts = this.db.prepare(hostsQuery).get() as { count: number };

      return {
        totalIncidents: total.count,
        unresolvedIncidents: unresolved.count,
        hostsAffected: hosts.count
      };
    } catch (error) {
      consola.error('Failed to fetch statistics:', error);
      return { totalIncidents: 0, unresolvedIncidents: 0, hostsAffected: 0 };
    }
  }

  private mapRowToIncident(row: any): NetworkIncident {
    const pingResult: PingResult = {
      host: row.host,
      success: Boolean(row.ping_success),
      responseTime: row.ping_response_time || undefined,
      timestamp: new Date(row.timestamp),
      error: row.ping_error || undefined
    };

    let tracerouteResult: TracerouteResult | undefined;
    if (row.traceroute_success !== null) {
      tracerouteResult = {
        host: row.host,
        success: Boolean(row.traceroute_success),
        timestamp: new Date(row.timestamp),
        hops: row.traceroute_hops ? JSON.parse(row.traceroute_hops) : [],
        error: row.traceroute_error || undefined
      };
    }

    return {
      id: row.id,
      host: row.host,
      timestamp: new Date(row.timestamp),
      resolved: Boolean(row.resolved),
      pingResult,
      tracerouteResult
    };
  }

  close(): void {
    this.db.close();
  }
}