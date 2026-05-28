# AEGIS — Autonomous AI Software Orchestration Platform

> **From one sentence to a running codebase.** AEGIS is an autonomous AI software house that transforms natural language ideas into production-ready applications through multi-agent coordination, semantic memory (RAG), self-healing build pipelines, and multi-tenant security.

<div align="center">

[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node](https://img.shields.io/badge/Node-22.0-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![SQLite](https://img.shields.io/badge/SQLite-3-003B57?logo=sqlite&logoColor=white)](https://www.sqlite.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-7-FF4438?logo=redis&logoColor=white)](https://redis.io/)
[![Next.js](https://img.shields.io/badge/Next.js-14-000000?logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![Express](https://img.shields.io/badge/Express-4.18-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![Prisma](https://img.shields.io/badge/Prisma-5.22-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io/)
[![BullMQ](https://img.shields.io/badge/Queue-BullMQ-FF6B35)](https://bullmq.io/)
[![MCP](https://img.shields.io/badge/MCP-1.29-7C3AED)](https://modelcontextprotocol.io/)
[![pgvector](https://img.shields.io/badge/Vector-pgvector-336791?logo=postgresql)](https://github.com/pgvector/pgvector)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

</div>

---

## Features

### 🤖 Multi-Agent Orchestration

Nine specialist AI agents working in sequence: **Conductor** (battle plans) → **Architect** (schemas) → **Backend** → **Frontend** → **DevOps** → **QA** → **Security** → **Tech Writer**, with a **Fixer** agent for auto-repair. Each agent is a specialized LLM with domain-specific system prompts, executing phases in a deterministic, phase-locked pipeline.

### 🔄 Self-Healing Builds

An auto-fix loop detects build errors, parses them (TypeScript, ESLint, module not found), invokes the Fixer agent with error context, and patches files — up to 3 attempts per build. Dependency installation uses multiple fallback strategies for resilience.

### 🧠 Semantic Memory (RAG)

pgvector-powered semantic search across all past projects. Every mission's ideas, source files, and agent logs are automatically chunked (with natural boundary detection), embedded (1536d), and indexed for vector similarity retrieval. Search by meaning, not just keywords.

### 🏢 Multi-Tenant Architecture

Organization-scoped isolation for projects, API keys, and settings. Each organization has its own API keys (SHA-256 hashed, never stored in plaintext), settings (AES-256-GCM encrypted at rest), and data — fully isolated from other tenants. Key format: `aegis_<48-hex-chars>`.

### 🎨 Design-to-Code

Describe a design or provide a screenshot URL, and AEGIS extracts structured design tokens (colors, typography, spacing, style), then generates matching React components with proper Tailwind CSS. Supports 15+ design token types including dark mode detection.

### 🔌 MCP Server (Model Context Protocol)

Expose all AEGIS capabilities as 8 MCP tools for external AI assistants. Compatible with Claude Desktop, Cursor, VS Code, and any MCP-compatible client. Supports both stdio and SSE/HTTP transports for local and remote access.

### 📊 Real-Time Dashboard

Next.js 14 dashboard with live SSE streaming, agent roster status orbs, expandable file tree, code viewer, live preview server, and security audit results. Responsive sidebar with collapsible navigation and keyboard shortcuts (⌘K for command palette).

### 🔒 Security-First

- **Multi-layer auth**: API key authentication with SHA-256 hashing, optional `MASTER_API_KEY`, or development bypass (`AUTH_DISABLED=true`)
- **Pre-ZIP secret scanning**: Passwords, API keys, `eval()` detection
- **OWASP Top 10 mitigation**: Helmet headers, rate limiting, input validation (Zod)
- **Encrypted settings**: AES-256-GCM encryption for sensitive configuration at rest
- **Path traversal protection**: All file reads validated against directory boundaries

---

## Table of Contents

- [Quick Start](#quick-start)
- [Architecture Overview](#architecture-overview)
- [Project Structure](#project-structure)
- [API at a Glance](#api-at-a-glance)
- [MCP Integration](#mcp-integration)
- [Technology Stack](#technology-stack)
- [Configuration Reference](#configuration-reference)
- [Testing](#testing)
- [Docker Deployment](#docker-deployment)
- [License](#license)

---

## Quick Start

### Prerequisites

| Requirement | Version | Purpose |
|---|---|---|
| **Node.js** | ≥ 20.0.0 (22 LTS recommended) | Runtime |
| **npm** | ≥ 10.0.0 | Package management |
| **PostgreSQL** | 15+ with [pgvector](https://github.com/pgvector/pgvector) | Database + vector embeddings |
| **Redis** | 7+ | Job queue (BullMQ) |
| **OpenRouter API key** | Free at [openrouter.ai/keys](https://openrouter.ai/keys) | LLM provider |

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/aegis
cd aegis

# Install API dependencies
cd apps/api && npm install

# Install web dashboard dependencies
cd ../web && npm install

# Configure environment
cp apps/api/.env.example apps/api/.env
# Edit apps/api/.env to set:
#   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/aegis
#   OPENROUTER_API_KEY=sk-or-v1-...

# Initialize the database (creates tables + pgvector extension)
cd apps/api && npm run db:push
```

### Running

```bash
# Terminal 1: API Server
cd apps/api && npm run dev
# → http://localhost:3001/health

# Terminal 2: Web Dashboard
cd apps/web && npm run dev
# → http://localhost:3000

# Terminal 3: MCP Server (optional — stdio mode)
cd apps/api && npm run mcp
# → For Claude Desktop / Cursor integration
```

### Create Your First Mission

1. Open **http://localhost:3000** in your browser
2. Navigate to the **Missions** tab (🚀)
3. Type a project idea, e.g.:
   > *"Build a personal finance tracker with Next.js and Express. Users can add transactions, categorize spending, and view monthly reports."*
4. Click **Initiate Build**
5. Watch agents stream live logs in real time
6. Once complete, **Download ZIP** or click **Live Preview**

> **Note:** The first startup creates a default organization and prints an admin API key to the server console. Save this key — it's shown only once. For development, you can set `AUTH_DISABLED=true` to skip authentication.

---

## Architecture Overview

```
User (Browser/IDE)
    │
    ├── HTTP ──▶ AEGIS API (Express :3001)
    │                ├── REST Routes (/api/missions, /api/search, /api/design)
    │                ├── SSE Stream (/api/missions/:id/stream)
    │                ├── Prometheus Metrics (/metrics)
    │                └── MCP SSE (/sse, /messages :3002)
    │
    ├── MCP stdio ──▶ MCP Server
    │                     ├── aegis_create_mission
    │                     ├── aegis_list_missions
    │                     ├── aegis_get_mission
    │                     └── ... 5 more tools
    │
    ▼
Orchestrator
    ├── BullMQ Queue (Redis) ──▶ Mission Worker (concurrency: 3)
    ├── Conductor → Battle Plan (JSON)
    ├── Agent Pipeline (sequential)
    │   ├── Architect → Schema + Architecture
    │   ├── Backend → Express + Prisma + Zod
    │   ├── Frontend → Next.js + Tailwind
    │   ├── DevOps → Docker + CI/CD
    │   ├── QA → Vitest Tests
    │   └── Tech Writer → Documentation
    ├── Auto-Fix Loop (max 3 attempts)
    ├── Security Audit
    └── ZIP Artifact + RAG Indexing
```

For detailed architecture, see [ARCHITECTURE.md](./ARCHITECTURE.md).

---

## Documentation

| Document | Description |
|---|---|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | C4-style system architecture, data flow, module interfaces, security model |
| [API.md](./API.md) | Full REST API reference (20+ endpoints, schemas, error codes, rate limiting) |
| [MCP_SERVER.md](./MCP_SERVER.md) | MCP server integration guide (Claude Desktop, Cursor, custom clients) |
| [USER_MANUAL.md](./USER_MANUAL.md) | Comprehensive user guide covering installation, configuration, daily usage, and troubleshooting |
| [CHANGELOG.md](./CHANGELOG.md) | Version history and feature tracking |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | Contribution guidelines and development setup |

---

## Project Structure

```
aegis/
├── apps/
│   ├── api/                            # Express backend (core logic)
│   │   ├── src/
│   │   │   ├── agents/prompts.ts       # LLM system prompts (9 agents)
│   │   │   ├── mcp/                    # MCP server (index.ts, entry.ts, sse.ts)
│   │   │   ├── routes/                 # Express route handlers
│   │   │   │   ├── missions.ts         # Mission CRUD + SSE + file tree
│   │   │   │   ├── auth.ts             # API key management (CRUD + SHA-256)
│   │   │   │   ├── settings.ts         # Org-scoped settings (AES-256-GCM encrypted)
│   │   │   │   ├── design.ts           # Design analysis + component generation
│   │   │   │   ├── search.ts           # Semantic search + stats
│   │   │   │   ├── preview.ts          # Live preview server management
│   │   │   │   └── stats.ts            # Dashboard aggregation endpoint
│   │   │   ├── services/               # Business logic
│   │   │   │   ├── buildService.ts     # Build detection, dep install, error parsing
│   │   │   │   ├── designParser.ts     # Design token extraction + component gen
│   │   │   │   ├── embedding.ts        # OpenAI-compatible vector embeddings
│   │   │   │   ├── indexer.ts          # RAG indexing pipeline (chunk + embed)
│   │   │   │   ├── cryptoService.ts    # AES-256-GCM encryption
│   │   │   │   ├── previewService.ts   # Preview server orchestration
│   │   │   │   ├── portService.ts      # Free port allocation
│   │   │   │   └── fileService.ts      # Directory tree utilities
│   │   │   ├── middleware/
│   │   │   │   ├── auth.ts             # Multi-tenant auth (SHA-256 keys)
│   │   │   │   ├── validation.ts       # Zod schema validation
│   │   │   │   ├── errorHandler.ts     # Global error handling
│   │   │   │   └── metrics.ts          # Prometheus-compatible metrics
│   │   │   ├── utils/
│   │   │   │   ├── fileWriter.ts       # AFP file parser + multi-file block splitting
│   │   │   │   ├── zipper.ts           # ZIP archive creation
│   │   │   │   ├── logger.ts           # Pino structured logging
│   │   │   │   └── paths.ts            # Project root + output path resolution
│   │   │   ├── config/index.ts         # Centralized environment config
│   │   │   ├── orchestrator.ts         # Mission lifecycle engine (BullMQ worker)
│   │   │   ├── db.ts                   # Prisma client + initialization
│   │   │   └── index.ts                # Express server entry (middleware + routes)
│   │   └── prisma/
│   │       └── schema.prisma           # Database schema (5 models: Organization, Project,
│   │                                    #   ProjectLog, ApiKey, Setting, DocumentChunk)
│   └── web/                            # Next.js 14 dashboard
│       ├── app/
│       │   ├── page.tsx                # Main dashboard (collapsible sidebar)
│       │   ├── layout.tsx              # Root layout + metadata
│       │   └── globals.css             # Tailwind base + custom design system
│       ├── components/
│       │   ├── Overview.tsx            # Dashboard overview & stats
│       │   ├── Missions.tsx            # Mission creation + monitoring
│       │   ├── ApiKeys.tsx             # API key management UI
│       │   ├── Search.tsx              # Semantic search interface
│       │   ├── SettingsModal.tsx        # Settings configuration modal
│       │   ├── CommandPalette.tsx      # ⌘K command palette
│       │   └── ui/                     # Reusable UI primitives (10+ components)
│       ├── hooks/
│       │   ├── useStats.ts             # Stats data fetching
│       │   ├── useMissions.ts          # Missions data fetching
│       │   ├── useApiKeys.ts           # API keys data fetching
│       │   ├── useSearch.ts            # Search data fetching
│       │   └── useKeyboard.ts          # Keyboard shortcut hook
│       └── lib/
│           ├── api-client.ts           # Typed API client with error handling
│           ├── utils.ts                # Utility functions (formatting, helpers)
│           └── types.ts                # Shared TypeScript types
├── output/                             # Generated mission artifacts
├── scripts/
│   └── docker-entrypoint.sh            # Docker container startup
├── Dockerfile                          # Multi-stage Docker build
├── docker-compose.yml                  # Full-stack Docker orchestration
└── *.md                                # Documentation (7 files)
```

---

## API at a Glance

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Health check (public) |
| `GET` | `/metrics` | Prometheus metrics (if enabled) |
| `GET` | `/api/stats` | Dashboard aggregation stats |
| `POST` | `/api/missions` | Create a new mission |
| `GET` | `/api/missions` | List all missions |
| `GET` | `/api/missions/:id` | Get mission details + logs |
| `GET` | `/api/missions/:id/stream` | SSE real-time log stream |
| `GET` | `/api/missions/:id/download` | Download ZIP artifact |
| `GET` | `/api/missions/:id/files` | Get output file tree |
| `GET` | `/api/missions/:id/content?path=` | Get file content |
| `GET` | `/api/missions/:id/security` | Get security audit |
| `POST` | `/api/missions/:id/preview` | Start live preview server |
| `DELETE` | `/api/missions/:id/preview` | Stop live preview server |
| `GET` | `/api/auth/keys` | List API keys (org-scoped) |
| `POST` | `/api/auth/keys` | Create API key (shown once) |
| `DELETE` | `/api/auth/keys/:id` | Revoke API key |
| `GET` | `/api/settings` | Get encrypted settings (redacted) |
| `POST` | `/api/settings/bulk` | Update settings in bulk |
| `GET` | `/api/search?q=` | Semantic vector search |
| `GET` | `/api/search/stats` | Search index statistics |
| `POST` | `/api/design/analyze` | Analyze design description |
| `POST` | `/api/design/generate` | Generate React component |
| `GET` | `/api/design/tokens` | Get default design tokens |

See [API.md](API.md) for full documentation with request/response schemas and error codes.

---

## MCP Integration

AEGIS exposes **8 MCP tools** for external AI assistants (Claude Desktop, Cursor, VS Code):

| Tool | Description |
|---|---|
| `aegis_create_mission` | Create mission from natural language idea |
| `aegis_list_missions` | List missions with optional status filter |
| `aegis_get_mission` | Get mission details + logs + file tree |
| `aegis_delete_mission` | Delete mission (requires `confirm: true`) |
| `aegis_search` | Semantic vector search across all projects |
| `aegis_analyze_design` | Extract design tokens from description |
| `aegis_get_settings` | View configuration (sensitive values redacted) |
| `aegis_update_settings` | Update configuration in bulk |

**Claude Desktop config:**
```json
{
  "mcpServers": {
    "aegis": {
      "command": "npx",
      "args": ["tsx", "/absolute/path/to/aegis/apps/api/src/mcp/entry.ts"],
      "env": {
        "DATABASE_URL": "postgresql://...",
        "OPENROUTER_API_KEY": "sk-or-v1-..."
      }
    }
  }
}
```

See [MCP_SERVER.md](MCP_SERVER.md) for detailed integration guides.

---

## Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Runtime** | Node.js 22 LTS | Server-side JavaScript runtime |
| **Language** | TypeScript 5.3+ (strict mode) | Type-safe development |
| **API Framework** | Express 4.18 + express-async-errors | HTTP server & async error handling |
| **Job Queue** | BullMQ + Redis 7 | Async mission queue with retries |
| **Frontend** | Next.js 14 (App Router) + lucide-react | Dashboard UI with icons |
| **Styling** | Tailwind CSS 3.4 | Utility-first CSS framework |
| **Database ORM** | Prisma 5.22 | Type-safe database access |
| **Vector Search** | pgvector (1536d) | Semantic embeddings |
| **LLM Gateway** | OpenAI SDK v4 + OpenRouter | AI provider abstraction (default) |
| **Validation** | Zod 3.22 | Runtime schema validation |
| **Logging** | Pino + pino-pretty + pino-http | Structured JSON logging |
| **MCP** | @modelcontextprotocol/sdk 1.29 | AI tool protocol (stdio + SSE) |
| **Security** | Helmet + express-rate-limit + Node crypto | HTTP headers, rate limiting, AES-256-GCM |
| **Metrics** | Prometheus-compatible | Request duration, error rates, active requests |
| **Packaging** | Archiver | ZIP artifact creation |
| **Testing** | Vitest | Unit and integration tests |

---

## Configuration Reference

### Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | ✓ | — | PostgreSQL connection string |
| `OPENROUTER_API_KEY` | ✓ | — | LLM provider API key |
| `PORT` | | `3001` | API server port |
| `MCP_PORT` | | `3002` | MCP SSE server port |
| `OPENROUTER_MODEL` | | `qwen/qwen3-coder-480b-a35b-instruct` | LLM model for code generation |
| `OPENROUTER_BASE_URL` | | `https://openrouter.ai/api/v1` | LLM API base URL |
| `MASTER_API_KEY` | | — | Optional master auth key |
| `AUTH_DISABLED` | | `false` | Bypass auth in development |
| `CORS_ORIGINS` | | `http://localhost:3000` | Allowed CORS origins |
| `CORS_ALLOW_ALL` | | `true` (dev) | Allow all origins |
| `LOG_LEVEL` | | `info` | Logging verbosity |
| `LOG_DIR` | | — | Write logs to file (e.g., `./logs`) |
| `ENCRYPTION_KEY` | | auto-generated | 32-char AES-256-GCM key for settings encryption |
| `EMBEDDING_MODEL` | | `openai/text-embedding-3-small` | Embedding model |
| `EMBEDDING_DIMENSIONS` | | `1536` | Vector dimension |
| `RATE_LIMIT_WINDOW_MS` | | `900000` (15 min) | Rate limit window |
| `RATE_LIMIT_MAX` | | `100` | Max requests per window |
| `ENABLE_METRICS` | | `true` | Expose `/metrics` endpoint |
| `APP_VERSION` | | `1.1.0` | Application version |

### In-App Settings (Runtime Configurable)

These can be changed live from the Dashboard Settings panel or via API without restart:

| Setting | Default | Description |
|---|---|---|
| `OPENROUTER_API_KEY` | — | LLM provider API key |
| `OPENROUTER_MODEL` | `qwen/qwen3-coder-480b-a35b-instruct` | LLM model for code generation |
| `OPENROUTER_BASE_URL` | `https://openrouter.ai/api/v1` | LLM API base URL |
| `EMBEDDING_MODEL` | `openai/text-embedding-3-small` | Embedding model |

Settings are encrypted with AES-256-GCM at rest and sensitive values are redacted in API responses.

---

## Testing

```bash
cd apps/api

# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# TypeScript type check
npm run typecheck

# Lint
npm run lint

# Check formatting
npm run format:check
```

---

## Docker Deployment

```bash
# Build and start all services
docker compose up -d --build

# Check health
docker compose ps
curl http://localhost:3001/health
curl http://localhost:3000/

# View logs
docker compose logs -f api
docker compose logs -f web

# Stop
docker compose down
```

The Docker setup includes:
- **API service** (Express on port 3001) with health check
- **Web service** (Next.js on port 3000) with health check
- Persistent volumes for PostgreSQL data and output artifacts
- Bridge network for inter-service communication
- Automatic restart policy

---

## License

MIT License — see [LICENSE](LICENSE) for details.

---

<div align="center">
Built with <strong>AEGIS</strong> · From idea to running code in minutes<br>
<sub>© 2026 AEGIS · MIT License</sub>
</div>
