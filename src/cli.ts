import arg from "arg";
import { consola } from "consola";
import { getEnvDefaults } from "./env.js";
import type { CLIArgs, MonitorConfig } from "./types.js";

export function parseArgs(): CLIArgs {
	try {
		const args = arg({
			"--hosts": String,
			"--interval": Number,
			"--timeout": Number,
			"--retries": Number,
			"--api-port": Number,
			"--db-path": String,
			"--help": Boolean,
			"--version": Boolean,

			"-h": "--help",
			"-v": "--version",
			"-i": "--interval",
			"-t": "--timeout",
			"-r": "--retries",
			"-p": "--api-port",
			"-d": "--db-path",
		});

		return {
			hosts: args["--hosts"],
			interval: args["--interval"],
			timeout: args["--timeout"],
			retries: args["--retries"],
			"api-port": args["--api-port"],
			"db-path": args["--db-path"],
			help: args["--help"],
			version: args["--version"],
		};
	} catch (error) {
		consola.error("Invalid arguments:", error);
		showHelp();
		process.exit(1);
	}
}

export function createConfig(args: CLIArgs): MonitorConfig {
	const envDefaults = getEnvDefaults();
	const defaultHosts = ["8.8.8.8", "google.com", "github.com"];

	const hostsInput = args.hosts || envDefaults.hosts;
	const hosts = hostsInput
		? hostsInput.split(",").map((h) => h.trim())
		: defaultHosts;

	return {
		hosts,
		interval: args.interval || envDefaults.interval || 60,
		timeout: args.timeout || envDefaults.timeout || 5000,
		retries: args.retries || envDefaults.retries || 3,
		apiPort: args["api-port"] || envDefaults.apiPort || 3000,
		dbPath: args["db-path"] || envDefaults.dbPath || "./pingthing.db",
	};
}

export function showHelp(): void {
	console.log(`
PingThing - Network Reliability Testing Tool

Usage:
  bun start [options]

Options:
  --hosts, -h <hosts>         Comma-separated list of hosts to monitor (default: 8.8.8.8,google.com,github.com)
  --interval, -i <seconds>    Ping interval in seconds (default: 60)
  --timeout, -t <ms>          Ping timeout in milliseconds (default: 5000)
  --retries, -r <count>       Number of ping retries (default: 3)
  --api-port, -p <port>       API server port (default: 3000)
  --db-path, -d <path>        SQLite database path (default: ./pingthing.db)
  --help                      Show this help message
  --version, -v               Show version information

Environment Variables:
  PINGTHING_HOSTS             Comma-separated list of hosts to monitor
  PINGTHING_INTERVAL          Ping interval in seconds (5-3600)
  PINGTHING_TIMEOUT           Ping timeout in milliseconds (1000-30000)
  PINGTHING_RETRIES           Number of ping retries (1-10)
  PINGTHING_API_PORT          API server port (1024-65535)
  PINGTHING_DB_PATH           SQLite database path

Commands:
  bun start                   Start network monitoring
  bun run api                 Start API server only
  bun run report              Show incident report

Examples:
  bun start --hosts google.com,github.com --interval 30
  bun start --timeout 3000 --retries 5
  bun run api --api-port 8080
  
  # Using environment variables
  PINGTHING_HOSTS=google.com,github.com PINGTHING_INTERVAL=30 bun start
`);
}

export function showVersion(): void {
	console.log("PingThing v1.0.0");
}
