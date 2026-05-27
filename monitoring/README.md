# COVENANT Monitoring

<p align="center">
  <img src="https://img.shields.io/badge/Status-Active-10b981" alt="Status">
  <img src="https://img.shields.io/badge/Base-Sepolia%20L2-0052FF" alt="Base">
  <img src="https://img.shields.io/badge/License-MIT-yellow" alt="License">
</p>

<p align="center">
  <strong>Real-time monitoring for the COVENANT Protocol</strong>
</p>

<p align="center">
  <em>Event indexing, subgraph health, metrics, alerts, and live dashboard</em>
</p>

---

## Overview

The COVENANT Monitoring service provides real-time observability for the COVENANT protocol on Base Sepolia. It indexes on-chain events, monitors subgraph health, collects metrics, fires alerts, and serves a terminal-based live dashboard.

## Components

| Component | Description |
|-----------|-------------|
| `event-listener.ts` | Real-time blockchain event indexing with viem |
| `subgraph-health.ts` | The Graph subgraph health checks |
| `metrics-collector.ts` | Protocol metrics aggregation |
| `alerts.ts` | Threshold-based alerting |
| `dashboard.ts` | Terminal UI dashboard (blessed) |
| `verification-listener.ts` | Verification event monitoring |

## Installation

```bash
npm install
```

## Usage

```bash
# Start event listener
npm run events

# Check subgraph health
npm run health

# Collect metrics
npm run metrics

# View alerts
npm run alerts

# Launch live dashboard
npm run dashboard
```

## Docker

### Build and run with Docker

```bash
# Build image
docker build -t covenant-monitoring .

# Run container
docker run --env-file .env covenant-monitoring
```

### Docker Compose

```bash
# Start monitoring stack
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

### docker-compose.yml

The compose file includes:
- **monitoring** -- Event listener + metrics collector + dashboard
- Environment variable passthrough from `.env`
- Restart policy: `unless-stopped`
- Health check via subgraph endpoint

## Configuration

Create `.env`:

```bash
# Required
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
PRIVATE_KEY=0x...

# Optional
ALERT_WEBHOOK_URL=https://hooks.slack.com/...
METRICS_INTERVAL_SEC=60
SUBGRAPH_URL=https://api.studio.thegraph.com/query/1753884/local/v0.0.1

# Verification monitoring
VERIFICATION_POLL_INTERVAL=30
```

## Environment

```
Node.js v18+
Docker (optional)
```

## License

MIT
