# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 📚 Comprehensive Documentation Available

**Complete AI-optimized documentation** is available in `_cc/docs/`:

→ **Start Here**: [`_cc/docs/01-overview.md`](_cc/docs/01-overview.md) - Master reference with complete project context (2,300+ lines, 80% of what you need)

→ **Quick Navigation**: [`_cc/docs/13-ai-navigation.md`](_cc/docs/13-ai-navigation.md) - Entry points and call chains for fast code lookup

→ **Full Index**: [`_cc/docs/00-index.md`](_cc/docs/00-index.md) - Complete documentation map with recommended reading order

**All docs use strict `file:line` format for precise code references.**

## Project Overview

Mojaloop Payment Manager - Management API Service. This is a TypeScript/Node.js backend service that provides a management API for the Mojaloop Payment Manager UI. It integrates with:
- **MCM (Mojaloop Connection Manager)** client for certificate and endpoint management
- **Vault** for PKI operations and secrets management
- **Redis** for caching transfer data
- **Keycloak** for IAM/authentication
- **XState** for connection state machine orchestration

## Architecture

### Entry Point (`src/index.ts`)
The application bootstrap follows this sequence:
1. **AuthModel** initialization - handles OAuth2 token management with automatic refresh
2. **Vault** connection - manages PKI operations and secrets
3. **ConnectionStateMachine** (XState) - orchestrates connection lifecycle with MCM
4. **ControlServer** - internal control API for state machine events
5. **UIAPIServer** (optional, port 9000) - REST API for Payment Manager UI
6. **TestServer** (optional, port 9050) - test/debug endpoints
7. **MetricsServer** (optional, port 4003) - Prometheus metrics

### Key Components

#### Configuration (`src/config.ts`)
- Uses `env-var` library with custom converters for file content, YAML, JSON
- Supports two Vault auth methods: `K8S` (ServiceAccount token) or `APP_ROLE`
- Certificate Manager integration for K8s secret management
- All sensitive config fields are redacted via `getSanitizedConfig()`

#### State Machine Integration
- `ConnectionStateMachine` from `@pm4ml/mcm-client` manages DFSP connection lifecycle
- Events: `REQUEST_CONNECTOR_CONFIG`, `REQUEST_PEER_JWS`, `UPLOAD_PEER_JWS`
- Debug interface on port 8888 (when `STATE_MACHINE_INSPECT_ENABLED=true`)

#### UIAPIServer (`src/UIAPIServer/`)
- Koa-based REST API with OpenAPI 3.0 spec validation (`api.yaml`)
- Routes defined in `handlers.ts`, middleware in `middlewares.ts`
- OpenAPI UI served at root `/`, spec at `/openapi.json`
- Optional CORS support via `ENABLE_CORS` env var

#### Cache & Database (`src/lib/cacheDatabase/`)
- **Redis** caching layer for transfer state (via `@pm4ml/mcm-client`)
- **In-memory SQLite** (better-sqlite3) for transfer queries
- Automatic sync from Redis to SQLite every `CACHE_SYNC_INTERVAL_SECONDS` (default 30s)
- Handles both INBOUND and OUTBOUND transfer directions
- Transfer schema migration in `migrations/`

#### Models (`src/lib/model/`)
- `Transfer` - transfer data model
- `DFSP` - DFSP (Digital Financial Service Provider) model
- `MonetaryZone` - monetary zone configuration
- `CertManager` - Kubernetes certificate secret management

### Technology Stack
- **Runtime**: Node.js 20 (see `.nvmrc`)
- **Language**: TypeScript 5.7 with strict mode
- **Build**: tsup (esbuild wrapper)
- **Web Framework**: Koa with koa-oas3 for OpenAPI validation
- **Database**: better-sqlite3 (in-memory), Knex query builder
- **Cache**: Redis 4.x client
- **State Management**: XState 4.35
- **Testing**: Jest with ts-jest
- **Linting**: ESLint with TypeScript + Airbnb config

## SDK Scheme Adapter Integration

### ControlServer WebSocket Protocol

The Management API provides a **WebSocket control protocol** (default port 4005) for dynamic configuration management with SDK Scheme Adapter instances. This enables:

- **Hot configuration reload** without service restarts
- **Certificate rotation** with zero downtime
- **Endpoint updates** for switching Mojaloop hubs
- **Feature flag toggles** in real-time
- **Multi-tenant DFSP management**

**Key Message Types:**
- `CONFIGURATION.READ` - SDK requests current configuration
- `CONFIGURATION.NOTIFY` - Management API broadcasts configuration updates
- `RECONFIGURE` event - Triggers hot-reload in SDK Scheme Adapter

**Flow:**
1. SDK Scheme Adapter connects via WebSocket on startup
2. Sends `CONFIGURATION.READ` request
3. Management API's ControlServer receives message → triggers state machine event `REQUEST_CONNECTOR_CONFIG`
4. ConnectionStateMachine transitions to `propagatingConnectorConfig` state
5. State machine broadcasts `CONFIGURATION.NOTIFY` with full config (TLS certs, JWS keys, endpoints)
6. SDK receives configuration and starts serving
7. Future config changes trigger `UPDATE_CONNECTOR_CONFIG` event → broadcast to all connected clients
8. SDK hot-reloads changed components (TLS context, endpoints, OIDC client) without restart

**Heartbeat:** Server pings clients every 30s; clients must respond within 32s or reconnect.

**Detailed Documentation:** See [`docs/_cc/mgmt-api-sdk-adapter-config-interaction.md`](docs/_cc/mgmt-api-sdk-adapter-config-interaction.md) for:
- Complete message protocol specification with JSON examples
- State machine flow diagrams
- Sequence diagrams for startup and runtime updates
- Message format comparison with SDK Scheme Adapter documentation
- Security considerations and testing recommendations

## Configuration

### Required Environment Variables
See `.env.example` for full list. Critical ones:
- `DFSP_ID` - Digital FSP identifier
- `MCM_SERVER_ENDPOINT` - Connection Manager API endpoint
- `HUB_IAM_PROVIDER_URL` - Keycloak URL for OAuth
- `VAULT_ENDPOINT` - HashiCorp Vault endpoint
- `VAULT_AUTH_METHOD` - K8S or APP_ROLE
- `VAULT_PKI_SERVER_ROLE` / `VAULT_PKI_CLIENT_ROLE` - PKI roles
- `AUTH_CLIENT_ID` / `AUTH_CLIENT_SECRET` - OAuth credentials (if `AUTH_ENABLED=true`)

### Local Development Setup
1. Copy `.env.example` to `.env` and adjust values
2. Run `npm run backend:start` to start dependencies
3. Wait for services (Vault setup may take ~20s)
4. Run `npm run start:dev`

Access points:
- Management API: http://localhost:9000
- Test API: http://localhost:9050
- State Machine Inspector: http://localhost:8888
- Keycloak: http://localhost:8080
- Prometheus: http://localhost:9090
- Grafana: http://localhost:33000

## Development Commands

### Core Development
```bash
npm run start:dev              # Run development server with hot reload
npm run build                  # Compile TypeScript to dist/
npm start                      # Run compiled code from dist/
```

### Testing
```bash
npm test                       # Run all tests (alias for test:unit)
npm run test:unit              # Run unit tests with Jest
npm run test:int               # Run integration tests
npm run test:coverage          # Generate coverage report
npm run test:coverage-check    # Check coverage meets thresholds (80%)
```

### Linting & Code Quality
```bash
npm run lint                   # Check code with ESLint
npm run lint:fix               # Auto-fix linting issues
```

### Backend Services
```bash
npm run backend:start          # Start docker-compose services (Redis, Vault, Keycloak, MySQL, MCM API)
npm run backend:stop           # Stop and remove volumes
npm run backend:restart        # Restart all services
```

### Dependencies & Security
```bash
npm run dep:check              # Check for dependency updates
npm run dep:update             # Update dependencies
npm run audit:check            # Run audit with audit-ci
npm run audit:fix              # Run npm audit fix
```

## Testing Strategy

- **Unit tests**: `test/unit/` - mocked dependencies, fast
- **Integration tests**: `test/integration/` - currently placeholder
- Coverage thresholds enforced at 80% (statements/functions/branches/lines)
- Path alias `@app/*` maps to `src/*` in both source and tests

## TypeScript Configuration

- Target: ES2020
- Module: CommonJS
- Strict mode enabled (except `noImplicitAny: false`)
- Path alias: `@app/*` → `src/*`
- Type roots: `./node_modules/@types`, `./types`

## Build Output

- Source: `src/` → Compiled: `dist/`
- YAML and JSON files copied via `copyfiles` post-build
- Source maps generated for debugging

## Docker

- `Dockerfile` for containerized deployment
- Multi-service `docker-compose.yaml` includes full local stack
- Metrics stack: Prometheus + Grafana pre-configured

## Release Management

- `standard-version` for semantic versioning
- `npm run release` - create versioned release with changelog
- `npm run snapshot` - create snapshot pre-release

## Important Notes

- The cache sync mechanism is acknowledged as a temporary solution (see comments in `cacheDatabase/index.ts:119-122`)
- Transfer data flows: Redis (source of truth) → SQLite (query interface) → UI API
- XState inspector is useful for debugging state machine transitions
- Token refresh happens automatically via `AuthModel` when enabled
