FROM oven/bun:1-alpine

# Install network utilities
RUN apk add --no-cache iputils traceroute

# Create app directory
WORKDIR /app

# Copy package files
COPY package.json bun.lock ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source code
COPY src/ ./src/
COPY tsconfig.json ./

# Create data directory
RUN mkdir -p /app/data

# Set executable permissions
RUN chmod +x src/index.ts src/api.ts src/report.ts

# Expose API port
EXPOSE 3000

# Default command (can be overridden)
CMD ["bun", "start"]