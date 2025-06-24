# PingThing - Network Reliability Testing Tool

A network monitoring application built with Bun and TypeScript that periodically pings services and performs diagnostic traceroutes when failures occur.

## Features

- **Network Monitoring**: Periodic ping tests to configured endpoints
- **Diagnostic Tools**: Automated traceroute when ping failures are detected
- **Data Persistence**: SQLite database for incident storage and history
- **REST API**: Fastify-based API for accessing incident data
- **CLI Interface**: Comprehensive command-line interface with environment variable support
- **Multi-platform**: Docker Compose deployment for Raspberry Pi, Linux, and macOS

## Quick Start

### Local Development

```bash
# Install dependencies
bun install

# Start monitoring with default configuration
bun start

# Start API server
bun run api

# View incident history
bun run report
```

### Docker Deployment

```bash
# Build and start services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

## Configuration

### Command Line Options

```bash
bun start --hosts google.com,github.com --interval 30 --timeout 3000
```

### Environment Variables

Copy `.env.local.example` to `.env.local` and customize:

```bash
PINGTHING_HOSTS=8.8.8.8,google.com,github.com
PINGTHING_INTERVAL=60
PINGTHING_TIMEOUT=5000
PINGTHING_RETRIES=3
PINGTHING_API_PORT=3000
PINGTHING_DB_PATH=./pingthing.db
```

## API Endpoints

- `GET /health` - Health check
- `GET /incidents` - Get recent incidents (supports `?limit=50&host=example.com`)
- `GET /incidents/unresolved` - Get unresolved incidents
- `PATCH /incidents/:id/resolve` - Mark incident as resolved
- `GET /statistics` - Get incident statistics
- `GET /hosts` - Get monitored hosts

## Development

This project uses [Bun](https://bun.sh) as the JavaScript runtime and package manager.

```bash
# Development mode with auto-reload
bun run dev

# Run tests
bun test

# Build for production
bun run build
```
