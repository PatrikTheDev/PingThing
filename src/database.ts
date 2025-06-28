import { Database as BunDatabase } from "bun:sqlite";
import { Kysely } from "kysely";
import { BunSqliteDialect } from "kysely-bun-sqlite";
import { consola } from "consola";
import type { NetworkIncident, PingResult, TracerouteResult } from "./types.js";
import type { Database, NewIncident, Incident } from "./database-schema.js";

export class IncidentDatabase {
	private db: Kysely<Database>;
	private bunDb: BunDatabase;

	constructor(dbPath: string) {
		this.bunDb = new BunDatabase(dbPath, { create: true });
		this.db = new Kysely<Database>({
			dialect: new BunSqliteDialect({
				database: this.bunDb,
			}),
		});
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
			this.bunDb.exec(createIncidentsTable);
			consola.success("Database initialized successfully");
		} catch (error) {
			consola.error("Failed to initialize database:", error);
			throw error;
		}
	}

	async saveIncident(incident: Omit<NetworkIncident, "id">): Promise<number> {
		const newIncident: NewIncident = {
			host: incident.host,
			timestamp: incident.timestamp.toISOString(),
			resolved: incident.resolved,
			ping_success: incident.pingResult.success,
			ping_response_time: incident.pingResult.responseTime || null,
			ping_error: incident.pingResult.error || null,
			traceroute_success: incident.tracerouteResult?.success || null,
			traceroute_error: incident.tracerouteResult?.error || null,
			traceroute_hops: incident.tracerouteResult
				? JSON.stringify(incident.tracerouteResult.hops)
				: null,
		};

		try {
			const result = await this.db
				.insertInto("incidents")
				.values(newIncident)
				.returning("id")
				.executeTakeFirstOrThrow();

			consola.info(`Saved incident ${result.id} for host ${incident.host}`);
			return result.id;
		} catch (error) {
			consola.error("Failed to save incident:", error);
			throw error;
		}
	}

	async getRecentIncidents(limit = 50): Promise<NetworkIncident[]> {
		try {
			const rows = await this.db
				.selectFrom("incidents")
				.selectAll()
				.orderBy("timestamp", "desc")
				.limit(limit)
				.execute();

			return rows.map((row) => this.mapRowToIncident(row));
		} catch (error) {
			consola.error("Failed to fetch recent incidents:", error);
			return [];
		}
	}

	async getIncidentsByHost(
		host: string,
		limit = 20,
	): Promise<NetworkIncident[]> {
		try {
			const rows = await this.db
				.selectFrom("incidents")
				.selectAll()
				.where("host", "=", host)
				.orderBy("timestamp", "desc")
				.limit(limit)
				.execute();

			return rows.map((row) => this.mapRowToIncident(row));
		} catch (error) {
			consola.error(`Failed to fetch incidents for host ${host}:`, error);
			return [];
		}
	}

	async getUnresolvedIncidents(): Promise<NetworkIncident[]> {
		try {
			const rows = await this.db
				.selectFrom("incidents")
				.selectAll()
				.where("resolved", "=", false)
				.orderBy("timestamp", "desc")
				.execute();

			return rows.map((row) => this.mapRowToIncident(row));
		} catch (error) {
			consola.error("Failed to fetch unresolved incidents:", error);
			return [];
		}
	}

	async markIncidentResolved(id: number): Promise<boolean> {
		try {
			const result = await this.db
				.updateTable("incidents")
				.set({ resolved: true })
				.where("id", "=", id)
				.execute();

			const success = result[0]?.numUpdatedRows
				? result[0].numUpdatedRows > 0
				: false;
			if (success) {
				consola.info(`Marked incident ${id} as resolved`);
			}
			return success;
		} catch (error) {
			consola.error(`Failed to mark incident ${id} as resolved:`, error);
			return false;
		}
	}

	async getLatestIncident(): Promise<NetworkIncident | null> {
		try {
			const row = await this.db
				.selectFrom("incidents")
				.selectAll()
				.orderBy("timestamp", "desc")
				.limit(1)
				.executeTakeFirst();

			return row ? this.mapRowToIncident(row) : null;
		} catch (error) {
			consola.error("Failed to fetch latest incident:", error);
			return null;
		}
	}

	async clearAllIncidents(): Promise<boolean> {
		try {
			const result = await this.db.deleteFrom("incidents").execute();

			const deletedCount = result[0]?.numDeletedRows || 0;
			consola.info(`Cleared ${deletedCount} incidents from database`);
			return true;
		} catch (error) {
			consola.error("Failed to clear incidents:", error);
			return false;
		}
	}

	async getStatistics(): Promise<{
		totalIncidents: number;
		unresolvedIncidents: number;
		hostsAffected: number;
	}> {
		try {
			const [total, unresolved, hosts] = await Promise.all([
				this.db
					.selectFrom("incidents")
					.select((eb) => eb.fn.count("id").as("count"))
					.executeTakeFirst(),
				this.db
					.selectFrom("incidents")
					.select((eb) => eb.fn.count("id").as("count"))
					.where("resolved", "=", false)
					.executeTakeFirst(),
				this.db
					.selectFrom("incidents")
					.select((eb) => eb.fn.count("host").distinct().as("count"))
					.executeTakeFirst(),
			]);

			return {
				totalIncidents: Number(total?.count || 0),
				unresolvedIncidents: Number(unresolved?.count || 0),
				hostsAffected: Number(hosts?.count || 0),
			};
		} catch (error) {
			consola.error("Failed to fetch statistics:", error);
			return { totalIncidents: 0, unresolvedIncidents: 0, hostsAffected: 0 };
		}
	}

	private mapRowToIncident(row: Incident): NetworkIncident {
		const pingResult: PingResult = {
			host: row.host,
			success: Boolean(row.ping_success),
			responseTime: row.ping_response_time || undefined,
			timestamp: new Date(row.timestamp),
			error: row.ping_error || undefined,
		};

		let tracerouteResult: TracerouteResult | undefined;
		if (row.traceroute_success !== null) {
			tracerouteResult = {
				host: row.host,
				success: Boolean(row.traceroute_success),
				timestamp: new Date(row.timestamp),
				hops: row.traceroute_hops ? JSON.parse(row.traceroute_hops) : [],
				error: row.traceroute_error || undefined,
			};
		}

		return {
			id: row.id,
			host: row.host,
			timestamp: new Date(row.timestamp),
			resolved: Boolean(row.resolved),
			pingResult,
			tracerouteResult,
		};
	}

	close(): void {
		this.bunDb.close();
	}
}
