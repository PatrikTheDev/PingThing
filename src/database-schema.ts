import type { ColumnType, Generated, Insertable, Selectable, Updateable } from 'kysely';

export interface Database {
  incidents: IncidentsTable;
}

export interface IncidentsTable {
  id: Generated<number>;
  host: string;
  timestamp: string;
  resolved: boolean;
  ping_success: boolean;
  ping_response_time: number | null;
  ping_error: string | null;
  traceroute_success: boolean | null;
  traceroute_error: string | null;
  traceroute_hops: string | null;
  created_at: ColumnType<string, string | undefined, never>;
}

export type Incident = Selectable<IncidentsTable>;
export type NewIncident = Insertable<IncidentsTable>;
export type IncidentUpdate = Updateable<IncidentsTable>;