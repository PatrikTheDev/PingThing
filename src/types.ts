export interface PingResult {
  host: string;
  success: boolean;
  responseTime?: number;
  timestamp: Date;
  error?: string;
}

export interface TracerouteHop {
  hop: number;
  ip?: string;
  hostname?: string;
  responseTime?: number;
  timeout: boolean;
}

export interface TracerouteResult {
  host: string;
  hops: TracerouteHop[];
  timestamp: Date;
  success: boolean;
  error?: string;
}

export interface NetworkIncident {
  id?: number;
  host: string;
  pingResult: PingResult;
  tracerouteResult?: TracerouteResult;
  timestamp: Date;
  resolved: boolean;
}

export interface MonitorConfig {
  hosts: string[];
  interval: number;
  timeout: number;
  retries: number;
  apiPort: number;
  dbPath: string;
}

export interface CLIArgs {
  hosts?: string;
  interval?: number;
  timeout?: number;
  retries?: number;
  'api-port'?: number;
  'db-path'?: string;
  help?: boolean;
  version?: boolean;
}