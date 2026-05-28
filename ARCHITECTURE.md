# AEGIS — System Architecture

> **Version:** 1.1.1 · **Last Updated:** May 2026

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Technology Stack](#2-technology-stack)
3. [System Topology (C4 Context)](#3-system-topology-c4-context)
4. [Module Architecture (C4 Containers)](#4-module-architecture-c4-containers)
5. [Data Flow](#5-data-flow)
6. [Database Schema](#6-database-schema)
7. [API Architecture](#7-api-architecture)
8. [Agent Execution Pipeline](#8-agent-execution-pipeline)
9. [MCP Server Architecture](#9-mcp-server-architecture)
10. [Security Architecture](#10-security-architecture)
11. [Deployment Architecture](#11-deployment-architecture)
12. [Scalability & Future Architecture](#12-scalability--future-architecture)

---

## 1. System Overview

AEGIS is an **autonomous, multi-agent AI software orchestration platform** that transforms natural language ideas into production-ready codebases. It operates as a self-organizing workforce of specialist AI agents, each grounded in industry best practices, with zero manual coding overhead.

### Core Principles

- **Deterministic Execution**: Phase-locked agent workflows ensure reproducible outputs
- **Self-Healing**: Auto-fix loop detects build errors and patches them autonomously (up to 3 attempts)
- **Semantic Memory**: pgvector-powered RAG search across all past projects
- **Multi-Tenant Isolation**: Organization-scoped data, API keys (SHA-256 hashed), and settings (AES-256-GCM encrypted)
- **Async Job Queue**: Redis-backed BullMQ queue for concurrent mission processing
- **Extensible**: MCP (Model Context Protocol) server for third-party AI integration
- **Security-First**: Pre-ZIP secret scanning, OWASP Top 10 mitigation, encrypted settings, path traversal protection

### System Capabilities

| Capability | Description |
|---|---|
| **Code Generation** | Full-stack apps from a single sentence |
| **Multi-File Output** | LLM agents can output multiple files in a single response with comment-style headers (`// path`, `# path`, `<!-- path -->`) |
| **Design Analysis** | AI-powered design token extraction from descriptions |
| **Semantic Search** | Vector similarity search across all project documents |
| **MCP Integration** | Expose all capabilities as tools for external AI assistants |
| **Auto-Repair** | Detect and fix build errors autonomously (up to 3 attempts) |
| **Security Auditing** | Pre-deployment secret scanning and OWASP compliance checks |
| **Multi-Tenant Auth** | Organization-scoped API keys with SHA-256 hashing and AES-256-GCM encrypted settings |

---

## 2. Technology Stack

### Core Runtime

| Component | Technology | Purpose |
|---|---|---|
| **Runtime** | Node.js 22 LTS | JavaScript runtime |
| **Language** | TypeScript 5.3+ (strict mode) | Type-safe development |
| **API Framework** | Express 4.18 + express-async-errors | HTTP server & async error handling |
| **Frontend** | Next.js 14 (App Router) + lucide-react | Dashboard UI with icons |
| **Styling** | Tailwind CSS 3 | Utility-first CSS |
| **Job Queue** | BullMQ + Redis 7 | Async mission queue with retries |
| **Database ORM** | Prisma 5.22 | SQLite / PostgreSQL abstraction |
| **Vector Search** | pgvector | Semantic embeddings (1536d) |
| **LLM SDK** | OpenAI SDK v4 | AI provider abstraction |
| **Real-time** | Server-Sent Events (SSE) | Live mission streaming + heartbeats |
| **Logging** | Pino + pino-http + pino-pretty | Structured JSON logging |
| **Validation** | Zod 3.22 | Runtime schema validation |
| **Encryption** | Node crypto (AES-256-GCM) | At-rest settings encryption |
| **Auth** | SHA-256 | API key hashing + multi-tenant scoping |
| **HTTP Security** | Helmet + express-rate-limit | Security headers + rate limiting |
| **Packaging** | Archiver | ZIP artifact creation |

### AI Providers

| Provider | Role | Default Model |
|---|---|---|
| **OpenRouter** (default) | LLM gateway | `qwen/qwen3-coder-480b-a35b-instruct` |
| **NVIDIA NIM** (alt) | LLM gateway | `qwen/qwen3-coder-480b-a35b-instruct` |
| **OpenAI Embeddings** | Vector generation | `text-embedding-3-small` (1536d, configurable) |

### Database

| Component | Technology | Purpose |
|---|---|---|
| **Primary (dev)** | SQLite via Prisma | All operational data — file-based, zero config |
| **Primary (prod)** | PostgreSQL 15+ | All operational data with pgvector |
| **Vector Extension** | pgvector (`CREATE EXTENSION vector`) | Semantic search embeddings (1536d) |
| **ORM** | Prisma 5.22 | Type-safe database access with auto-generated client |
| **Async Queue** | Redis 7 + BullMQ | Job queue for concurrent mission processing |

---

## 3. System Topology (C4 Context)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        USER (Browser / IDE)                             │
│                                                                         │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐              │
│  │ AEGIS Web   │  │ MCP Client   │  │ Claude Desktop   │              │
│  │ Dashboard   │  │ (Cursor, etc)│  │ / Cursor         │              │
│  └──────┬──────┘  └──────┬───────┘  └────────┬─────────┘              │
└─────────┼──────────────────┼──────────────────┼────────────────────────┘
          │ HTTP/SSE         │ MCP stdio/SSE    │ MCP stdio
          ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        AEGIS API SERVER (Express 3001)                 │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                        Middleware Stack                          │   │
│  │  Helmet → CORS → Pino HTTP → Metrics → JSON → Rate Limiter     │   │
│  │  → Auth (optional)                                              │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌──────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │
│  │ Missions     │  │ Settings    │  │ Preview     │  │ Search      │  │
│  │ /api/missions│  │ /api/settings│  │ /api/...    │  │ /api/search │  │
│  └──────┬───────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  │
│  ┌──────────────┐  ┌─────────────┐                                │  │
│  │ Design       │  │ MCP Server  │                                │  │
│  │ /api/design  │  │ /sse, /msg  │                                │  │
│  └──────┬───────┘  └──────┬──────┘                                │  │
│         │                 │                                        │  │
│         ▼                 ▼                                        ▼  │
│  ┌──────────────┐  ┌──────────────────────┐  ┌────────────────────┐  │
│  │ BullMQ Queue │  │ Mission Worker       │  │ LLM Provider      │  │
│  │ (Redis 7)    │  │ (concurrency: 3)     │  │ (OpenRouter /     │  │
│  │              │  │ Processes missions   │  │  NVIDIA)          │  │
│  └──────────────┘  │ asynchronously       │  └────────────────────┘  │
│                    └──────────────────────┘                          │
└───────────────────────────────────────────────────────────────────────┘
          │                                 
          ▼                                 
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────────┐
│ SQLite /         │  │ File System      │  │ Redis 7                  │
│ PostgreSQL       │  │ output/          │  │ (BullMQ queue backend)   │
│ (Prisma ORM)     │  │ output/*.zip     │  │                          │
│ (+ pgvector)     │  │ .data/           │  │                          │
└──────────────────┘  └──────────────────┘  └──────────────────────────┘
```

---

## 4. Module Architecture (C4 Containers)

### 4.1 API Server (`apps/api/src/index.ts`)

The Express entry point configures the middleware stack (in strict order), registers route modules, and starts the HTTP server.

**Middleware Order (priority matters):**

1. `Helmet` — Security headers (CSP, XSS, etc.)
2. `CORS` — Cross-origin resource sharing
3. `pino-http` — Structured HTTP request logging
4. `metricsMiddleware` — Request count, duration, error tracking
5. `express.json` — Body parsing with 10MB limit
6. `express-rate-limit` — 100 requests per 15 minutes
7. `authMiddleware` — Multi-tenant API key authentication

**Responsibilities:**
- Middleware chain configuration (security → logging → parsing → rate limiting → auth)
- Route registration for all API modules
- Health check endpoint (`GET /health`)
- Prometheus-compatible metrics (`GET /metrics`)
- Database initialization on startup
- BullMQ mission worker initialization
- Graceful error handling (404 handler + global error handler)
- Port cleanup on startup (kills any existing process on the port)

### 4.2 Orchestrator (`apps/api/src/orchestrator.ts`)

The core engine that manages the complete mission lifecycle — from idea ingestion to artifact generation. Runs inside a BullMQ worker for asynchronous processing.

**Public API:**

| Function | Description |
|---|---|
| `runMission(id, idea)` | Execute a complete mission pipeline (worker handler) |
| `getMissionOutputDir(id)` | Resolve filesystem path for mission output |
| `aegisEvents` | EventEmitter for SSE broadcasts |

**Internal Functions:**

| Function | Description |
|---|---|
| `getLLMConfig()` | Resolve LLM settings from DB/env |
| `chatWithRetry()` | LLM call with exponential backoff retry |
| `logEvent()` | Persist event to DB + broadcast via SSE |
| `fixPrismaSchema()` | Auto-patch Prisma schema (relation names) |

**Mission Lifecycle:**

```
BullMQ Queue → Mission Worker (concurrency: 3)
  │
  └─ runMission()
       │
       ├─ Phase 0: Conductor (Battle Plan Generation)
       │   └─ chatWithRetry(CONDUCTOR_PROMPT, idea) → JSON plan
       │
       ├─ For each phase in plan:
       │   ├─ Dispatch agent (architect, backend, frontend, devops, qa, techwriter)
       │   ├─ chatWithRetry(AGENT_PROMPT, phase context) → FILE blocks
       │   ├─ parseAndWriteFiles() → output/{projectId}/
       │   │   ├─ Supports <FILE>...</FILE> AFP blocks
       │   │   └─ Supports multi-file blocks with //, #, <!-- --> headers
       │   └─ Auto-retry if zero files (max 2 retries)
       │
       ├─ Auto-Fix Loop (max 3 attempts):
       │   ├─ checkBuild() → detect errors
       │   ├─ formatBuildErrors() → LLM-readable summary
       │   ├─ chatWithRetry(FIXER_PROMPT, errors + file contents)
       │   └─ parseAndWriteFiles() → apply fixes
       │
       ├─ Security Audit:
       │   ├─ Walk output directory
       │   ├─ Scan for secrets (passwords, API keys, eval())
       │   └─ Generate SECURITY_AUDIT.md
       │
       ├─ Artifact Packaging:
       │   └─ zipDirectory() → output/{project}.zip
       │
       └─ Post-Mission:
           ├─ Update DB status → completed
           └─ indexProject() → RAG indexing (async)
```

**Retry Logic:**
```
429 (Rate Limit) → 30s delay → retry (up to 3)
502/503/ECONNRESET/ETIMEDOUT → exponential backoff (3s * 2^i)
Other errors → immediate fail
```

### 4.3 Database Layer (`apps/api/src/db.ts`)

Prisma ORM wrapper with auto-initialization, organization creation, and default setting seeding.

**Functions:**

| Function | Description |
|---|---|
| `initDatabase()` | Connect + verify + ensure default org + seed settings |
| `shutdownDatabase()` | Graceful disconnect |

**Key Behaviors:**
- On first startup: creates a `Default Organization`, generates an admin API key (logged once to console), and seeds default LLM settings from environment variables
- The generated API key follows the format: `aegis_<48-hex-chars>`
- Sensitive settings are encrypted with AES-256-GCM before storage
- All subsequent operations are scoped to an organization via `req.organizationId`
- Uses SQLite by default (`aegis.db`); configurable to PostgreSQL via `DATABASE_URL`

### 4.4 File Writer (`apps/api/src/utils/fileWriter.ts`)

Parses AEGIS File Protocol (AFP) output from LLM agents and writes files to disk.

**Key Functions:**

| Function | Description |
|---|---|
| `parseAndWriteFiles(response, outDir)` | Parse AFP blocks → write files, supports multi-file splitting |
| `parseBattlePlan(raw)` | Parse JSON battle plan from Conductor |
| `splitMultiFileBlock(content)` | Split content containing `//`, `#`, or `<!-- -->` file headers into separate files |
| `writeFile(filesystemPath, content)` | Validate path, strip fences, mkdir, and write a single file |

**AFP Format:**
```
<FILE path="src/app/page.tsx">
// file contents
</FILE>
```

**Multi-File Block Format (within a single `<FILE>` block):**
```
// frontend/index.html
<!DOCTYPE html>
<html>...

// frontend/style.css
body { ... }

# backend/config.py
import os

<!-- docs/README.md -->
# Project Title
```

The file writer detects ≥2 file-header lines within a single block and splits them into separate files. Headers support:
- `// path/to/file` (JavaScript/CSS-style comments)
- `# path/to/file` (Python/shell-style comments)  
- `<!-- path/to/file -->` (HTML-style comments)

Each file gets individual path validation, code fence stripping, directory creation, and write operations.

### 4.5 Build Service (`apps/api/src/services/buildService.ts`)

Detects project type, installs dependencies, runs builds, and parses errors.

**Functions:**

| Function | Description |
|---|---|
| `detectProjectType(outDir)` | Next.js, Express, Vite, generic-node, unknown |
| `installDependencies(outDir)` | npm install with 3 fallback strategies |
| `checkBuild(outDir)` | Run build + parse errors |
| `formatBuildErrors(result)` | LLM-readable error summary |

**Error Parsing:** Supports 3 formats:
- TypeScript: `file.ts(line,col): error TS2345: Message`
- ESLint/Next.js: `Error: file.ts:line:col: Message`
- Module not found: `Cannot find module 'x'`

### 4.6 Indexing Service (`apps/api/src/services/indexer.ts`)

Chunks project content and generates embeddings for semantic search.

**Functions:**

| Function | Description |
|---|---|
| `indexProject(projectId)` | Full indexing pipeline |
| `indexProjectIdea(projectId)` | Index project name + description |
| `indexProjectOutput(projectId)` | Index source files (code, configs, docs) |
| `indexProjectLogs(projectId)` | Index agent conversation logs |

**Chunking Strategy:**
- Chunk size: 2000 chars (3000 for logs)
- Overlap: 200 chars (300 for logs)
- Natural boundary detection (newlines, sentence ends)
- Batch embedding: 20 chunks per API call with 200ms delay between batches

### 4.7 Design Parser (`apps/api/src/services/designParser.ts`)

AI-powered design token extraction and component generation.

**Functions:**

| Function | Description |
|---|---|
| `buildDesignPrompt(description, imageUrl?)` | Build LLM prompt for design analysis |
| `buildComponentPrompt(name, spec, tokens, cssVars)` | Build LLM prompt for component generation |
| `tokensToTailwindConfig(tokens)` | Convert tokens to Tailwind config |
| `tokensToCSSVariables(tokens)` | Convert tokens to CSS custom properties |

### 4.8 Embedding Service (`apps/api/src/services/embedding.ts`)

Generates vector embeddings using OpenAI-compatible APIs.

**Technical Details:**
- Model: `openai/text-embedding-3-small` (configurable)
- Dimensions: 1536 (configurable via `EMBEDDING_DIMENSIONS`)
- Max chars per input: 32,000
- Batch processing: 20 items/batch with 200ms delay
- Graceful degradation: Returns zero vectors on failure

---

## 5. Data Flow

### 5.1 Mission Flow

```
User Input (idea)
    │
    ▼
Dashboard (page.tsx)
    │ POST /api/missions { idea }
    ▼
Express → missions router
    │
    ├─ Generate UUID → Create project (status: running) → DB
    │
    └─ BullMQ → Queue job
        │
        └─ Mission Worker → runMission(id, idea) [async]
            │
            ├─ Conductor LLM → JSON battle plan
            │
            ├─ Phase Loop (sequential):
            │   ├─ Agent LLM call → AFP response
            │   ├─ parseAndWriteFiles → output/{id}/
            │   │   ├─ <FILE path="..."> block → single file
            │   │   └─ // headers within block → split into multiple files
            │   └─ Post-process (Prisma fix, etc.)
            │
            ├─ Auto-Fix Loop:
            │   ├─ checkBuild() → errors
            │   ├─ Fixer LLM call → patches
            │   └─ Re-check (max 3x)
            │
            ├─ Security Audit → SECURITY_AUDIT.md
            │
            ├─ ZIP Generation → output/{name}.zip
            │
            └─ DB Update → status: completed → SSE broadcast
                │
                └─ indexProject() [async] → vector DB
```

### 5.2 SSE Event Flow

```
Dashboard subscribes: GET /api/missions/:id/stream
    │
    ▼
SSE connection established
    │
    ▼
Orchestrator emits events via aegisEvents
    │
    ▼
mission route → res.write(`data: ${JSON.stringify(event)}\n\n`)
    │
    ▼
Dashboard EventSource → React state updates
    │
    ├─ Mission status panel
    ├─ Agent roster (idle/active/done)
    ├─ Real-time log entries
    └─ File tree updates
```

### 5.3 MCP Tool Flow

```
External AI Assistant (Claude, Cursor)
    │ MCP stdio/SSE protocol
    ▼
MCP Server (McpServer)
    │
    ├─ aegis_create_mission → runMission() → return { id, status }
    ├─ aegis_list_missions → prisma.project.findMany()
    ├─ aegis_get_mission → project + logs + file tree
    ├─ aegis_delete_mission → rm -rf + DB delete
    ├─ aegis_search → pgvector semantic search
    ├─ aegis_analyze_design → LLM design analysis
    ├─ aegis_get_settings → settings (keys redacted)
    └─ aegis_update_settings → settings upsert
```

---

## 6. Database Schema

### 6.1 Entity Relationship Diagram

```
┌───────────────────────────────────┐
│          Organization              │
├───────────────────────────────────┤
│ id                  UUID     (PK) │
│ name                String        │
│ created_at          DateTime      │
│ updated_at          DateTime      │
└────────┬──────────────────────────┘
         │ 1
         │
         ├─────────────────────┬──────────────────┬──────────────────┐
         │ *                   │ *                │ *                │ *
┌────────▼──────────────┐  ┌──▼───────────────┐  ┌──▼────────────┐  ┌──▼─────────────┐
│       Project        │  │     ApiKey        │  │    Setting    │  │ DocumentChunk  │
├──────────────────────┤  ├───────────────────┤  ├───────────────┤  ├────────────────┤
│ id          UUID (PK)│  │ id      UUID (PK) │  │ organizationId│  │ id    UUID(PK) │
│ name        String   │  │ keyHash String (UQ)│  │ key    String │  │ projectId  UU  │
│ idea        Text     │  │ keyPrefix String   │  │ value  String │  │ organizationId │
│ status      String   │  │ name    String     │  └───────────────┘  │ source String  │
│ outputPath  String?  │  │ lastUsedAt DateTime?│                    │ filePath String?│
│ organizationId  (FK) │  │ expiresAt DateTime?│                    │ content Text   │
│ created_at DateTime  │  │ createdAt DateTime │                    │ embedding vec  │
│ updated_at DateTime  │  └───────────────────┘                    └────────────────┘
└──────────┬───────────┘
           │ 1
           │ *
┌──────────▼───────────┐
│     ProjectLog        │
├──────────────────────┤
│ id          Int (PK)  │
│ projectId  UUID (FK) │
│ agent      String    │
│ message    Text      │
│ type       String    │
│ createdAt  DateTime  │
└──────────────────────┘
```

### 6.2 SQL Definition (Key Tables)

```sql
-- Organizations / tenants
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- API keys (SHA-256 hashed) for multi-tenant auth
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_prefix TEXT NOT NULL,              -- First 8 chars (UI identification)
  key_hash TEXT NOT NULL UNIQUE,         -- SHA-256 of the full key
  name TEXT NOT NULL DEFAULT 'default',
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Core project/mission table (org-scoped)
CREATE TABLE projects (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL DEFAULT 'pending',
  idea TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
  output_path TEXT,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Agent activity log
CREATE TABLE project_logs (
  id SERIAL PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  agent TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info' CHECK (type IN ('info', 'file', 'error')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Per-organization settings (encrypted at rest via AES-256-GCM)
CREATE TABLE settings (
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  PRIMARY KEY (organization_id, key)
);

-- Document chunks for pgvector semantic search (org-scoped)
CREATE TABLE document_chunks (
  id UUID PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  source TEXT NOT NULL, -- 'idea' | 'file' | 'log'
  file_path TEXT,
  content TEXT NOT NULL,
  embedding vector(1536)  -- pgvector extension required
);
```

### 6.3 Indexes

| Table | Index | Type | Purpose |
|---|---|---|---|
| `api_keys` | `key_hash` | UNIQUE B-tree | Fast API key lookup at auth time |
| `api_keys` | `organization_id` | B-tree | List keys by organization |
| `projects` | `organization_id` | B-tree | Org-scoped project listing |
| `project_logs` | `project_id` | B-tree | Fast log retrieval by mission |
| `project_logs` | `created_at` | B-tree | Chronological log ordering |
| `document_chunks` | `project_id` | B-tree | Chunk lookup by mission |
| `document_chunks` | `organization_id` | B-tree | Org-scoped search queries |
| `document_chunks` | `source` | B-tree | Filter by source type |
| `document_chunks` | `embedding` | IVFFlat | Approximate nearest neighbor search |

---

## 7. API Architecture

### 7.1 REST Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Health check (DB + uptime) — public |
| `GET` | `/metrics` | Prometheus-compatible metrics (if enabled) |
| `GET` | `/api/stats` | Dashboard aggregation statistics (org-scoped) |
| `POST` | `/api/missions` | Create new mission from natural language idea |
| `GET` | `/api/missions` | List all missions (org-scoped, newest first) |
| `GET` | `/api/missions/:id` | Get mission details + log history |
| `GET` | `/api/missions/:id/stream` | SSE log stream (real-time) |
| `GET` | `/api/missions/:id/download` | Download ZIP artifact |
| `GET` | `/api/missions/:id/files` | Get output file tree |
| `GET` | `/api/missions/:id/content?path=` | Get file content |
| `GET` | `/api/missions/:id/security` | Get security audit report |
| `POST` | `/api/missions/:id/preview` | Start live preview server |
| `DELETE` | `/api/missions/:id/preview` | Stop live preview server |
| `GET` | `/api/auth/keys` | List API keys (org-scoped) |
| `POST` | `/api/auth/keys` | Create new API key (shown once) |
| `DELETE` | `/api/auth/keys/:id` | Revoke (delete) an API key |
| `GET` | `/api/settings` | Get all settings (sensitive values redacted) |
| `POST` | `/api/settings/bulk` | Update settings in bulk (encrypted at rest) |
| `GET` | `/api/search?q=` | Semantic vector search (org-scoped) |
| `GET` | `/api/search/stats` | Search index statistics |
| `POST` | `/api/design/analyze` | Analyze design description → design tokens |
| `POST` | `/api/design/generate` | Generate React component from tokens |
| `GET` | `/api/design/tokens` | Get default design tokens |

### 7.2 MCP Tools

| Tool | Description |
|---|---|
| `aegis_create_mission` | Create new mission from idea |
| `aegis_list_missions` | List missions with filters |
| `aegis_get_mission` | Get mission details + logs + files |
| `aegis_delete_mission` | Delete mission + files (requires confirm) |
| `aegis_search` | Semantic vector search |
| `aegis_analyze_design` | Extract design tokens |
| `aegis_get_settings` | View config (keys redacted) |
| `aegis_update_settings` | Update config in bulk |

---

## 8. Agent Execution Pipeline

### 8.1 Agent Roster

| Agent | Role | Domain | Deliverables |
|---|---|---|---|
| **Conductor** | Engineering Manager | Orchestrator | JSON battle plans, phase dispatch |
| **Architect** | Principal Architect | Schema, Contracts | prisma/schema.prisma, docs/architecture.md |
| **Backend** | Backend Engineer | API Layer | Express routes, services, Zod schemas |
| **Frontend** | Frontend Engineer | UI Layer | Next.js pages, React components, Tailwind CSS |
| **DevOps** | DevOps/SRE | Infrastructure | Dockerfile, docker-compose.yml, CI config |
| **QA** | QA Engineer | Testing | Vitest tests, Playwright config, fixtures |
| **Security** | Security Engineer | Auditing | Secret scanning, OWASP audit reports |
| **Tech Writer** | Technical Writer | Documentation | README.md, API docs, runbooks |
| **Fixer** | Debug Engineer | Error Resolution | Build error patches (auto-fix loop) |

### 8.2 Phase Sequencing

```
Phase 1: Architect (Schema Design)
    ↓ dependency: null
Phase 2: Backend (API Implementation)
    ↓ dependency: phase-001
Phase 3: Frontend (UI Implementation)
    ↓ dependency: phase-002
Phase 4: DevOps (Containerization)
    ↓ dependency: phase-003
Phase 5: QA (Testing)
    ↓ dependency: phase-004
Phase 6: Tech Writer (Documentation)
    ↓ dependency: phase-005
         │
         ▼
   Auto-Fix Loop (max 3 attempts)
    ↓
   Security Audit
    ↓
   ZIP Generation
```

---

## 9. MCP Server Architecture

The Model Context Protocol (MCP) server exposes AEGIS capabilities as standardized tools that any MCP-compatible AI assistant can call.

### 9.1 Transport Options

| Transport | Command | Port | Use Case |
|---|---|---|---|
| **stdio** | `npm run mcp` | — | Claude Desktop, local CLI tools |
| **SSE/HTTP** | `npm run mcp:sse` | 3002 | Remote clients, Cursor, web apps |

### 9.2 Architecture

```
┌────────────────────────────────────────────────────────┐
│                    MCP Server                           │
│                    (McpServer)                          │
│                                                         │
│  ┌─────────────┐  ┌─────────────┐  ┌───────────────┐  │
│  │ Tool Router  │  │ Schema      │  │ Handler Pool  │  │
│  │ (dispatch)  │  │ (Zod)       │  │ (8 handlers)  │  │
│  └──────┬──────┘  └──────┬──────┘  └───────┬───────┘  │
│         │                │                  │           │
│         ▼                ▼                  ▼           │
│  ┌─────────────────────────────────────────────────┐   │
│  │              Transport Layer                     │   │
│  │  StdioServerTransport  |  SSEServerTransport    │   │
│  │  (stdin/stdout)        |  (HTTP/SSE)            │   │
│  └─────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────┘
         │                    │
         ▼                    ▼
   Claude Desktop       Remote Clients
   Cursor CLI           Web Apps
```

### 9.3 Integration Configuration

**Claude Desktop (`claude_desktop_config.json`):**
```json
{
  "mcpServers": {
    "aegis": {
      "command": "npx",
      "args": ["tsx", "/path/to/aegis/apps/api/src/mcp/entry.ts"],
      "env": {
        "DATABASE_URL": "postgresql://...",
        "OPENROUTER_API_KEY": "sk-or-v1-..."
      }
    }
  }
}
```

**SSE Client:**
```json
{
  "mcpServers": {
    "aegis": {
      "url": "http://localhost:3002/sse"
    }
  }
}
```

---

## 10. Security Architecture

### 10.1 Defense Layers

```
Layer 1:  Helmet (HTTP Security Headers — CSP, XSS, etc.)
Layer 2:  CORS (Origin Restrictions)
Layer 3:  Rate Limiting (100 req/15min window)
Layer 4:  Multi-Tenant Authentication (SHA-256 API keys, org-scoped)
Layer 5:  Input Validation (Zod schemas on all POST/PUT endpoints)
Layer 6:  Path Traversal Protection (file reads bounded to output dir)
Layer 7:  Secret Scanning (Pre-ZIP — passwords, API keys, eval())
Layer 8:  File Size Limits (1MB read, 10MB upload body)
Layer 9:  Settings Encryption (AES-256-GCM at rest)
Layer 10: LLM Safety (No malware/exploit generation prompts)
```

### 10.2 Multi-Tenant Authentication

Authentication is handled by the `authMiddleware` (see `apps/api/src/middleware/auth.ts`):

**Authentication Flow:**
1. Client sends API key via `X-Api-Key` header or `Authorization: Bearer <key>`
2. Middleware hashes the key with SHA-256
3. Looks up the hash in the `api_keys` table
4. Resolves the associated Organization (tenant)
5. Attaches `req.organizationId` for downstream row-level scoping
6. Updates `lastUsedAt` timestamp (fire-and-forget)

**Key Features:**
- API keys are **SHA-256 hashed** before storage — the raw key is never persisted
- Key format: `aegis_<48-hex-chars>` (256-bit random)
- Optional `expiresAt` date for time-limited keys
- Multiple keys per organization (named: `admin`, `ci`, `dev`, etc.)
- First 8 chars stored as `keyPrefix` for UI identification
- Development bypass: `AUTH_DISABLED=true` in env

### 10.3 Settings Encryption

Settings containing sensitive values (API keys, secrets) are encrypted with **AES-256-GCM** before being stored in the database.

**Encryption Flow:**
1. On write: `encrypt(plaintext) → base64(iv) + '.' + base64(authTag) + '.' + base64(ciphertext)`
2. On read: `decrypt(stored) → plaintext`
3. Non-sensitive values stored as plaintext
4. API responses redact sensitive values: `sk-or-v1-...abcd` format

**Sensitive keys tracked:**
- `OPENROUTER_API_KEY`
- `NVIDIA_API_KEY`
- `OPENAI_API_KEY`
- `MASTER_API_KEY`

### 10.4 Metrics & Observability

The metrics middleware (see `apps/api/src/middleware/metrics.ts`) tracks:

| Metric | Type | Description |
|---|---|---|
| `aegis_uptime_seconds` | gauge | Server uptime |
| `aegis_active_requests` | gauge | Currently in-flight requests |
| `aegis_requests_total` | counter | Total requests processed |
| `aegis_requests_duration_seconds` | histogram | Duration buckets (5ms to 5s+) |
| `aegis_errors_total` | counter | Errors by status family (4xx, 5xx) |
| `aegis_route_requests_total` | counter | Request count by route path |

### 10.5 Secret Scanning

The security audit phase scans all generated files for:
- Hardcoded passwords (`password = "..."`)
- API keys (`api_key = "..."`)
- `eval()` usage
- Writes findings to `SECURITY_AUDIT.md`

### 10.6 OWASP Top 10 Mitigations

| OWASP Category | AEGIS Mitigation |
|---|---|
| Injection (A01) | Parameterized queries, Zod validation |
| Broken Auth (A02) | Optional MASTER_API_KEY + rate limiting |
| Sensitive Data (A03) | No hardcoded secrets, encrypted DB fields |
| XXE (A04) | No XML parsing |
| Broken Access (A05) | Optional auth middleware |
| Misconfiguration (A06) | Secure defaults, Helmet headers |
| XSS (A07) | CSP headers, sanitized HTML |
| Insecure Deserialization (A08) | JSON-only parsing |
| Known Vulnerabilities (A09) | npm audit in CI |
| Insufficient Logging (A10) | Structured Pino logging |

---

## 11. Deployment Architecture

### 11.1 Development

```bash
# Required: Redis 7+ (for BullMQ queue)
brew install redis && brew services start redis

# Terminal 1: API Server
cd apps/api && npm install && npm run dev
# → http://localhost:3001/health

# Terminal 2: Web Dashboard
cd apps/web && npm install && npm run dev
# → http://localhost:3000

# Terminal 3: MCP Server (optional)
cd apps/api && npm run mcp
# → stdio transport (for Claude Desktop)
```

### 11.2 Production (Docker)

```
┌─────────────────────────────────────────────────────────┐
│                    Docker Host                            │
│                                                          │
│  ┌─────────────────┐  ┌─────────────────┐               │
│  │  aegis-api      │  │  aegis-web      │               │
│  │  Port 3001      │  │  Port 3000      │               │
│  │  Node 22        │  │  Node 22        │               │
│  │  Express        │  │  Next.js        │               │
│  └────────┬────────┘  └────────┬────────┘               │
│           │                    │                          │
│           ▼                    ▼                          │
│  ┌─────────────────────────────────┐                    │
│  │  PostgreSQL 15 + pgvector       │                    │
│  │  Volume: aegis_data             │                    │
│  └─────────────────────────────────┘                    │
│                                                          │
│  Volumes:                                                │
│  - aegis_data: PostgreSQL data                           │
│  - aegis_output: Generated mission artifacts             │
└─────────────────────────────────────────────────────────┘
```

### 11.3 Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | | `file:./aegis.db` (SQLite) | Database connection string. Use `postgresql://user:pass@host:5432/aegis` for PostgreSQL |
| `OPENROUTER_API_KEY` | ✓ | — | LLM provider API key |
| `REDIS_URL` | | `redis://localhost:6379` | Redis connection for BullMQ queue |
| `PORT` | | `3001` | API server port |
| `MCP_PORT` | | `3002` | MCP SSE server port |
| `OPENROUTER_MODEL` | | `qwen/qwen3-coder-480b-a35b-instruct` | LLM model name |
| `OPENROUTER_BASE_URL` | | `https://openrouter.ai/api/v1` | LLM API base URL |
| `LLM_PROVIDER` | | `openrouter` | Active LLM provider (`openrouter` or `nvidia`) |
| `NVIDIA_MODEL` | | `qwen/qwen3-coder-480b-a35b-instruct` | NVIDIA LLM model |
| `MASTER_API_KEY` | | — | Optional master auth key |
| `AUTH_DISABLED` | | `false` | Bypass auth in development |
| `CORS_ORIGINS` | | `http://localhost:3000` | Allowed CORS origins |
| `CORS_ALLOW_ALL` | | `true` (dev) | Allow all origins |
| `LOG_LEVEL` | | `info` | Logging verbosity |
| `LOG_DIR` | | — | Write logs to file (e.g., `./logs`) |
| `ENCRYPTION_KEY` | | auto-generated | AES-256-GCM settings encryption key |
| `EMBEDDING_MODEL` | | `openai/text-embedding-3-small` | Embedding model |
| `EMBEDDING_DIMENSIONS` | | `1536` | Vector dimension |
| `ENABLE_METRICS` | | `true` | Expose `/metrics` endpoint |
| `RATE_LIMIT_WINDOW_MS` | | `900000` (15 min) | Rate limit window |
| `RATE_LIMIT_MAX` | | `100` | Max requests per window |
| `APP_VERSION` | | `1.1.0` | Application version |

---

## 12. Scalability & Future Architecture

### Current Architecture (Single Node)

- **Processes**: Single Node.js process with BullMQ worker for async mission processing
- **Database**: SQLite (dev) or PostgreSQL (prod)
- **Queue**: Redis-backed BullMQ for mission jobs
- **Events**: In-memory EventEmitter (SSE broadcast)
- **Storage**: Local filesystem

### Future Scaling Path

| Component | Current | Future |
|---|---|---|
| **Events** | EventEmitter | Redis Pub/Sub |
| **Storage** | Local FS | S3-compatible |
| **Agents** | In-process LLM calls | Docker containers per agent |
| **Orchestration** | BullMQ worker | Kubernetes/knative |
| **Database** | SQLite / single PG | Read replicas + connection pooling |
| **Frontend** | Monolith | BFF + micro-frontends |
| **Auth** | Optional key | OAuth 2.0 with multi-tenant |

---

*Architecture documentation maintained by AEGIS Tech Writer agent · Generated from codebase analysis*
