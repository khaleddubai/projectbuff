# Changelog

> All notable changes to AEGIS are documented in this file.
> The format is based on [Keep a Changelog](https://keepachangelog.com/), and this project adheres to [Semantic Versioning](https://semver.org/).

---

## [1.1.1] — 2026-05-27

### 🚀 Multi-File Block Splitting

**Added:**
- `FILE_HEADER_RE` regex to detect comment-style file headers (`// path`, `# path`, `<!-- path -->`)
- `splitMultiFileBlock()` in `fileWriter.ts` — scans LLM output lines for file-header patterns and splits content at header boundaries when ≥2 headers are detected
- `writeFile()` helper extracting common write logic (path validation, code fence stripping, mkdir, write)
- 7 new unit tests covering all multi-file block formats and edge cases (22 total tests, all passing)

**Fixed:**
- LLM agent outputting multiple files inside a single `<FILE>` block using comment-style headers now correctly splits into separate files instead of writing everything as one blob

### ⚙️ Provider Defaults

**Changed:**
- Default `LLM_PROVIDER` changed from `nvidia` to `openrouter`
- Default `NVIDIA_MODEL` changed from `nvidia/nemotron-4-340b-instruct` to `qwen/qwen3-coder-480b-a35b-instruct`
- `getProvider()` fallback in `llmConfig.ts` returns `openrouter` instead of `nvidia`
- Seed defaults in `auth.ts` updated to match new provider defaults

### 📚 Documentation Overhaul

**Updated:**
- `README.md` — Complete rewrite with accurate tech stack (SQLite, Redis), updated badges, new architecture diagram, proper quickstart, and comprehensive configuration reference
- `ARCHITECTURE.md` — Updated for SQLite default, Redis queue, BullMQ worker, multi-file block feature, corrected provider defaults
- `API.md` — Updated default model references, response examples, and settings documentation
- `MCP_SERVER.md` — Updated prerequisites (SQLite, Redis), transport configuration, and troubleshooting
- `USER_MANUAL.md` — Comprehensive rewrite with correct installation steps (Redis required, SQLite default), updated settings, new troubleshooting section for dashboard issues
- `CONTRIBUTING.md` — Updated dev setup (Redis required), testing guidelines, and architecture references
- `CHANGELOG.md` — Deduplicated version history, added v1.1.1 entry

---

## [1.1.0] — 2026-05-26

### 🏢 Multi-Tenant Architecture

**Added:**
- `Organization` model with UUID-based tenant isolation
- `ApiKey` model with SHA-256 hashing — raw keys never persisted
- API key format: `aegis_<48-hex-chars>` (256-bit random)
- `authMiddleware` — Multi-tenant auth via `X-Api-Key` or `Authorization: Bearer` headers
- Auto-generated admin API key on first startup (printed once to console)
- Key management endpoints: `GET/POST /api/auth/keys`, `DELETE /api/auth/keys/:id`
- Optional key expiration (`expiresAt`) and descriptive key names
- `keyPrefix` field for UI identification (first 8 chars)
- `AUTH_DISABLED=true` dev bypass option

### 🔒 Settings Encryption

**Added:**
- `cryptoService.ts` — AES-256-GCM encryption/decryption for at-rest sensitive data
- Encrypted storage for API keys and secrets in the `settings` table
- Automatic key redaction in API responses (first + last 4 chars only)
- `ENCRYPTION_KEY` environment variable (auto-generated if not provided)
- Sensitive keys tracked: `OPENROUTER_API_KEY`, `NVIDIA_API_KEY`, `OPENAI_API_KEY`, `MASTER_API_KEY`

### 📊 Monitoring & Observability

**Added:**
- `metricsMiddleware` — Prometheus-compatible metrics endpoint
- `GET /metrics` — Exposes uptime, request count, duration histogram, error count, active requests
- `ENABLE_METRICS` environment variable (default: `true`)
- `GET /api/stats` — Dashboard aggregation endpoint with mission statistics
- `GET /api/search/stats` — Search index statistics (total chunks, by source)

### 🔧 Infrastructure & DX

**Added:**
- Helmet security headers middleware
- express-rate-limit with configurable window/max
- Pino structured logging with pino-http HTTP request logging
- `LOG_LEVEL` and `LOG_DIR` environment variables
- `CORS_ALLOW_ALL` environment variable for development
- `express-async-errors` for automatic async error handling
- Zod validation schemas on all POST endpoints
- `POST /api/settings/bulk` endpoint for batch settings updates
- Prisma schema migration commands in package.json
- Vitest configuration with test scripts
- ESLint + Prettier linting and formatting configuration
- TypeScript strict mode in tsconfig.json

**Changed:**
- Migrated from SQLite (better-sqlite3) to Prisma ORM (supports both SQLite and PostgreSQL)

---

## [1.0.0] — 2026-05-25

### 🚀 Initial Release

AEGIS is an autonomous AI software orchestration platform that transforms natural language ideas into production-ready codebases. This initial release includes the complete multi-agent pipeline, semantic memory, auto-fix loop, design analysis, and MCP integration.

### 🎯 Phase 4: Intelligence Layer

#### 4.1 Prisma ORM Migration (`v0.0.4`)

**Added:**
- Prisma ORM integration with SQLite and PostgreSQL support
- `prisma/schema.prisma` with Project, ProjectLog, Setting, and DocumentChunk models
- pgvector extension support for vector embeddings
- Database initialization with automatic setting seeding
- Centralized configuration module (`src/config/index.ts`)
- Health check with database connectivity verification
- Middleware stack: Helmet, CORS, rate limiting, authentication, metrics

**Changed:**
- Replaced direct `better-sqlite3` usage with Prisma ORM across all modules
- Updated all SQL queries to Prisma query syntax

#### 4.2 RAG Implementation (`v0.0.5`)

**Added:**
- `src/services/embedding.ts` — OpenAI-compatible embedding generation (1536d via `text-embedding-3-small`)
- `src/services/indexer.ts` — Full indexing pipeline: ideas, output files, and agent logs
- `src/routes/search.ts` — `GET /api/search?q=` endpoint with pgvector cosine distance
- Smart text chunking with natural boundary detection and overlap
- Batch embedding processing (20 items/batch, 200ms delay between batches)
- Auto-indexing on mission completion (non-blocking)

#### 4.3 Auto-Fix Loop (`v0.0.6`)

**Added:**
- `src/services/buildService.ts` — Build detection and error analysis service
- `FIXER_PROMPT` in `src/agents/prompts.ts` — Specialized debug engineer agent
- Auto-fix loop in orchestrator: runs after all phase files are generated
- 3 error parsing formats: TypeScript, ESLint/Next.js, module not found
- Dependency installation with 3 fallback strategies

#### 4.4 Design-to-Code (`v0.0.7`)

**Added:**
- `src/services/designParser.ts` — AI-powered design token extraction and component generation
- `src/routes/design.ts` — `POST /api/design/analyze`, `POST /api/design/generate`, `GET /api/design/tokens`
- `DESIGN_ANALYSIS_SYSTEM` and `COMPONENT_GENERATOR_SYSTEM` prompts
- Design token interface: colors, typography, spacing, layout, style
- `tokensToTailwindConfig()` and `tokensToCSSVariables()` utility converters
- `DEFAULT_TOKENS` fallback palette

### 🌐 Phase 5: Ecosystem

#### 5.1 MCP Server (`v0.0.8`)

**Added:**
- `src/mcp/index.ts` — MCP server with 7 tools using `McpServer` class
- `src/mcp/entry.ts` — Standalone CLI entry point with stdio transport
- Tools: `aegis_list_missions`, `aegis_get_mission`, `aegis_delete_mission`, `aegis_search`, `aegis_analyze_design`, `aegis_get_settings`, `aegis_update_settings`
- `npm run mcp` script

#### 5.2 MCP Enhancements (`v0.0.9`)

**Added:**
- `aegis_create_mission` tool — Create missions from natural language via MCP
- `src/mcp/sse.ts` — HTTP/SSE transport entry point (port 3002)
- `npm run mcp:sse` script for remote MCP access

### 🏗️ Foundation (v0.0.3 and earlier)

The foundation phases established the core AEGIS platform:

- Express API scaffold with TypeScript, CORS, JSON body parsing
- SQLite integration via better-sqlite3
- LLM client wrapper with OpenRouter/NVIDIA support
- Conductor prompt + JSON battle plan parser
- 7 specialist agents: Architect, Backend, Frontend, DevOps, QA, Security, Tech Writer
- Aegis File Protocol (AFP) for code generation
- Sequential agent dispatch with phase locking
- Auto-retry logic (2 attempts on zero-file delivery)
- Rate-limit resilience (429, 502, 503, ECONNRESET)
- ZIP artifact generation via archiver
- Next.js dashboard with SSE real-time streaming
- Agent roster with live status orbs
- Output explorer with file tree and viewer
- Live preview server with auto-npm-install
- Settings panel with runtime mutable configuration
- Security audit with secret scanning

---

## Version History

| Version | Date | Highlights |
|---|---|---|
| `1.1.1` | 2026-05-27 | Multi-file block splitting, provider defaults fix, documentation overhaul |
| `1.1.0` | 2026-05-26 | Multi-tenant auth, settings encryption, metrics, Prisma ORM |
| `1.0.0` | 2026-05-25 | Initial release — all 5 phases complete |
| `0.0.9` | 2026-05-25 | MCP create_mission + SSE transport |
| `0.0.8` | 2026-05-25 | MCP server with 7 tools |
| `0.0.7` | 2026-05-25 | Design-to-code analysis |
| `0.0.6` | 2026-05-25 | Auto-fix loop |
| `0.0.5` | 2026-05-25 | RAG + pgvector search |
| `0.0.4` | 2026-05-25 | Prisma ORM migration |
| `0.0.3` | 2026-05-25 | Foundation — agents, dashboard, orchestrator |

---

*Changelog maintained by AEGIS Tech Writer agent*
