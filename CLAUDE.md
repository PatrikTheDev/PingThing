---
description: Use Bun instead of Node.js, npm, pnpm, or vite.
globs: "*.ts, *.tsx, *.html, *.css, *.js, *.jsx, package.json"
alwaysApply: false
---

Default to using Bun instead of Node.js.

- Use `bun <file>` instead of `node <file>` or `ts-node <file>`
- Use `bun test` instead of `jest` or `vitest`
- Use `bun build <file.html|file.ts|file.css>` instead of `webpack` or `esbuild`
- Use `bun install` instead of `npm install` or `yarn install` or `pnpm install`
- Use `bun run <script>` instead of `npm run <script>` or `yarn run <script>` or `pnpm run <script>`
- Bun automatically loads .env, so don't use dotenv.
- Don't install specific package versions, always install the latest version. Prefer installing using the `bun add` command over adding it to package.json manually

## APIs

- `Bun.serve()` supports WebSockets, HTTPS, and routes. Don't use `express`.
- `bun:sqlite` for SQLite. Don't use `better-sqlite3`.
- `Bun.redis` for Redis. Don't use `ioredis`.
- `Bun.sql` for Postgres. Don't use `pg` or `postgres.js`.
- `WebSocket` is built-in. Don't use `ws`.
- Prefer `Bun.file` over `node:fs`'s readFile/writeFile
- Bun.$`ls` instead of execa.

## Testing

Use `bun test` to run tests.

```ts#index.test.ts
import { test, expect } from "bun:test";

test("hello world", () => {
  expect(1).toBe(1);
});
```

## Frontend

Use HTML imports with `Bun.serve()`. Don't use `vite`. HTML imports fully support React, CSS, Tailwind.

Server:

```ts#index.ts
import index from "./index.html"

Bun.serve({
  routes: {
    "/": index,
    "/api/users/:id": {
      GET: (req) => {
        return new Response(JSON.stringify({ id: req.params.id }));
      },
    },
  },
  // optional websocket support
  websocket: {
    open: (ws) => {
      ws.send("Hello, world!");
    },
    message: (ws, message) => {
      ws.send(message);
    },
    close: (ws) => {
      // handle close
    }
  },
  development: {
    hmr: true,
    console: true,
  }
})
```

HTML files can import .tsx, .jsx or .js files directly and Bun's bundler will transpile & bundle automatically. `<link>` tags can point to stylesheets and Bun's CSS bundler will bundle.

```html#index.html
<html>
  <body>
    <h1>Hello, world!</h1>
    <script type="module" src="./frontend.tsx"></script>
  </body>
</html>
```

With the following `frontend.tsx`:

```tsx#frontend.tsx
import React from "react";

// import .css files directly and it works
import './index.css';

import { createRoot } from "react-dom/client";

const root = createRoot(document.body);

export default function Frontend() {
  return <h1>Hello, world!</h1>;
}

root.render(<Frontend />);
```

Then, run index.ts

```sh
bun --hot ./index.ts
```

For more information, read the Bun API docs in `node_modules/bun-types/docs/**.md`.

# PingThing - Network Reliability Testing Tool

## Project Description

PingThing is a network reliability testing application built with Bun and TypeScript. It monitors network connectivity by periodically pinging configured services and performing diagnostic traceroutes when failures occur. All network incidents are logged and stored for analysis.

## Architecture

- **CLI Interface**: Command-line interface using the `arg` package for configuration
- **Network Monitoring**: Periodic ping tests to configured endpoints
- **Diagnostic Tools**: Automated traceroute when ping failures are detected
- **Data Persistence**: SQLite database using `bun:sqlite` for incident storage
- **Logging**: Structured logging with the `consola` package
- **API**: Fastify-based REST API for accessing incident data
- **Multi-platform**: Docker Compose deployment for Raspberry Pi, Linux, and macOS

## Build Plan

1. **Core Infrastructure**
   - Set up TypeScript project with Bun
   - Configure CLI argument parsing
   - Initialize SQLite database for incident storage
   - Set up structured logging

2. **Network Testing**
   - Implement ping functionality for multiple endpoints
   - Add traceroute diagnostics for failed pings
   - Create periodic monitoring scheduler
   - Store all findings in database

3. **API & Deployment**
   - Build Fastify API for incident data access
   - Create Docker Compose configuration
   - Add cross-platform deployment support

## Usage

```bash
# Start monitoring with default configuration
bun start

# Monitor specific hosts with custom interval
bun start --hosts google.com,github.com --interval 30

# Start API server
bun run api

# View incident history
bun run report
```