# AEGIS — User Manual

> **Version:** 1.1.1 · **Last Updated:** May 2026
>
> *From one sentence to a running codebase — your autonomous AI software house.*

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Installation & Setup](#2-installation--setup)
3. [Quick Start: Your First Mission](#3-quick-start-your-first-mission)
4. [Dashboard Walkthrough](#4-dashboard-walkthrough)
5. [Managing API Keys](#5-managing-api-keys)
6. [Configuring Settings](#6-configuring-settings)
7. [Understanding Missions](#7-understanding-missions)
8. [Using Semantic Search](#8-using-semantic-search)
9. [Design Analysis & Component Generation](#9-design-analysis--component-generation)
10. [Live Preview](#10-live-preview)
11. [MCP Integration (Advanced)](#11-mcp-integration-advanced)
12. [Docker Deployment](#12-docker-deployment)
13. [Troubleshooting](#13-troubleshooting)
14. [Best Practices](#14-best-practices)
15. [FAQ](#15-faq)

---

## 1. Introduction

### What is AEGIS?

AEGIS is an **autonomous AI software orchestration platform** that transforms natural language ideas into production-ready codebases. Think of it as your personal AI software house — you describe what you want to build, and AEGIS handles the rest through a coordinated team of specialist AI agents.

### How It Works

1. **You describe your idea** — a sentence or paragraph about the application you want to build
2. **AEGIS plans the build** — the Conductor agent analyzes your idea and creates a battle plan
3. **Specialist agents execute** — Architect, Backend, Frontend, DevOps, QA, and Tech Writer agents work in sequence to build your application
4. **Multi-file output** — agents can generate multiple files in a single response, automatically split into proper file structures
5. **Auto-repair** — if the build has errors, the Fixer agent detects and patches them automatically
6. **Security audit** — all generated files are scanned for secrets and vulnerabilities
7. **You download or preview** — your application is packaged as a ZIP or launched as a live preview

### Key Capabilities

| Capability | What It Does |
|---|---|
| **Code Generation** | Build full-stack applications from a single sentence |
| **Multi-File Splitting** | LLM agents can output multiple files with comment-style headers (`// path`, `# path`, `<!-- path -->`) — automatically split into individual files |
| **Self-Healing Builds** | Automatically detects and fixes build errors (up to 3 attempts) |
| **Semantic Search** | Search across all past projects using natural language |
| **Design Analysis** | Extract design tokens (colors, fonts, spacing) from descriptions |
| **Live Preview** | Launch generated apps with auto-installed dependencies |
| **MCP Integration** | Expose all capabilities to Claude Desktop, Cursor, or any MCP client |
| **Multi-Tenant Security** | Organization-scoped isolation with encrypted API keys and settings |

### Who Is This For?

- **Developers** who want to rapidly prototype applications
- **Product managers** who need to validate ideas with working software
- **Founders** who want to build MVPs without a full engineering team
- **Designers** who want to see their designs come to life as React components
- **Anyone** who wants to go from idea to code in minutes

---

## 2. Installation & Setup

### System Requirements

| Requirement | Minimum | Recommended |
|---|---|---|
| Operating System | macOS, Linux, or Windows (WSL2) | macOS 14+ or Ubuntu 22.04+ |
| Node.js | 20.0.0 | 22 LTS |
| npm | 10.0.0 | 10.x+ |
| Redis | 7 | 7+ |
| RAM | 4 GB | 8 GB+ |
| Disk Space | 500 MB | 2 GB+ (for generated projects) |

### Step 1: Clone the Repository

```bash
git clone https://github.com/yourusername/aegis
cd aegis
```

### Step 2: Install Redis

Redis is required for the BullMQ job queue that processes missions asynchronously.

```bash
# macOS (Homebrew)
brew install redis
brew services start redis

# Ubuntu/Debian
sudo apt install redis-server
sudo systemctl start redis

# Verify
redis-cli ping
# → PONG
```

### Step 3: Install Dependencies

```bash
# Install API dependencies
cd apps/api
npm install

# Install web dashboard dependencies
cd ../web
npm install

# Return to project root
cd ../..
```

### Step 4: Configure Environment

```bash
# Copy the example environment file
cp apps/api/.env.example apps/api/.env
```

Edit `apps/api/.env` with your configuration. At minimum, you need:

```env
# OpenRouter API key (get one at https://openrouter.ai/keys)
OPENROUTER_API_KEY=sk-or-v1-your-key-here

# Redis connection (default works for local install)
REDIS_URL=redis://localhost:6379

# Disable authentication for local development (optional)
AUTH_DISABLED=true
```

> **Note:** The database defaults to **SQLite** (`aegis.db`) — no additional setup required. For production, you can configure PostgreSQL via `DATABASE_URL`.

### Step 5: Initialize the Database

```bash
cd apps/api

# Generate Prisma client and push schema
npx prisma generate
npx prisma db push
```

This creates the `aegis.db` SQLite file with all necessary tables (organizations, projects, API keys, settings, document chunks).

### Step 6: Start the Services

Open three terminal windows:

```bash
# Terminal 1: API Server
cd apps/api
npm run dev
# → http://localhost:3001

# Terminal 2: Web Dashboard
cd apps/web
npm run dev
# → http://localhost:3000

# Terminal 3: MCP Server (optional)
cd apps/api
npm run mcp
# → For Claude Desktop / Cursor integration
```

### Step 7: Verify Installation

Open your browser to **http://localhost:3001/health**. You should see:

```json
{
  "status": "ok",
  "version": "1.1.0",
  "timestamp": "2026-05-25T10:00:00.000Z",
  "uptime": 42,
  "uptimeHuman": "42s",
  "checks": {
    "database": "healthy"
  }
}
```

Then open **http://localhost:3000** to see the AEGIS dashboard.

### Configuration Reference

| Variable | Required | Default | Description |
|---|---|---|---|
| `OPENROUTER_API_KEY` | ✓ | — | LLM provider API key from [OpenRouter](https://openrouter.ai/keys) |
| `DATABASE_URL` | | `file:./aegis.db` (SQLite) | Database connection. PostgreSQL: `postgresql://user:pass@localhost:5432/aegis` |
| `REDIS_URL` | | `redis://localhost:6379` | Redis connection for BullMQ job queue |
| `PORT` | | `3001` | API server port |
| `MCP_PORT` | | `3002` | MCP SSE server port |
| `LLM_PROVIDER` | | `openrouter` | Active provider (`openrouter` or `nvidia`) |
| `OPENROUTER_MODEL` | | `qwen/qwen3-coder-480b-a35b-instruct` | LLM model for code generation |
| `OPENROUTER_BASE_URL` | | `https://openrouter.ai/api/v1` | LLM API base URL |
| `NVIDIA_MODEL` | | `qwen/qwen3-coder-480b-a35b-instruct` | NVIDIA LLM model |
| `MASTER_API_KEY` | | — | Optional master authentication key |
| `AUTH_DISABLED` | | `false` | Set to `true` to skip API key authentication in development |
| `CORS_ORIGINS` | | `http://localhost:3000` | Comma-separated list of allowed CORS origins |
| `CORS_ALLOW_ALL` | | `true` (dev) | Allow all CORS origins (for development) |
| `LOG_LEVEL` | | `info` | Logging verbosity: `trace`, `debug`, `info`, `warn`, `error`, `fatal` |
| `LOG_DIR` | | — | Directory to write log files (e.g., `./logs`) |
| `ENCRYPTION_KEY` | | auto-generated | 32-character key for AES-256-GCM settings encryption |
| `EMBEDDING_MODEL` | | `openai/text-embedding-3-small` | Model for generating text embeddings |
| `EMBEDDING_DIMENSIONS` | | `1536` | Vector dimension for embeddings |
| `ENABLE_METRICS` | | `true` | Enable Prometheus-compatible `/metrics` endpoint |
| `APP_VERSION` | | `1.1.0` | Application version string |

---

## 3. Quick Start: Your First Mission

Let's build your first application with AEGIS.

### Step 1: Open the Dashboard

Navigate to **http://localhost:3000** in your browser.

### Step 2: Go to Missions

Click the **Missions** tab in the sidebar (🚀 icon).

### Step 3: Describe Your Idea

In the command center text area, type a project idea. For example:

> *"Build a personal finance tracker with Next.js and Express. Users can add transactions, categorize spending into categories like Food, Transport, and Entertainment, and view monthly spending reports with charts."*

### Step 4: Initiate the Build

Click the **Initiate Build** button. The mission is queued via BullMQ and processed by a worker.

### Step 5: Watch the Magic

You'll see real-time logs streaming as each agent works:

1. **Conductor** — Analyzes your idea and creates a battle plan
2. **Architect** — Designs the database schema and API contracts
3. **Backend** — Implements Express routes, services, and validation
4. **Frontend** — Builds Next.js pages and React components
5. **DevOps** — Generates Docker and CI/CD configuration
6. **QA** — Writes tests
7. **Tech Writer** — Creates documentation
8. **Fixer** (if needed) — Patches any build errors
9. **Security Auditor** — Scans for secrets

The agent roster on the dashboard shows which agent is currently active, with real-time status indicators.

### Step 6: Download or Preview

Once the mission completes:

- **Download ZIP** — Click the download button to get a ZIP archive of your complete application
- **Live Preview** — Click the preview button to launch the generated app in a new browser tab (dependencies are installed automatically)

### Step 7: Explore the Output

Use the file tree viewer to explore the generated code. Click any file to view its contents.

---

## 4. Dashboard Walkthrough

The AEGIS dashboard is organized into four main tabs, accessible from the sidebar:

### Overview Tab (📊)

The Overview tab provides a high-level summary of your AEGIS instance:

- **Mission Statistics** — Total missions, completed, failed, and currently running
- **Success Rate** — Percentage of missions that completed successfully
- **Recent Missions** — A list of the most recent missions with their status
- **Total Files Generated** — Aggregate count of files created across all missions

### Missions Tab (🚀)

The Missions tab is the command center:

- **Command Center** — Text area to enter your project idea and initiate builds
- **Mission Logs** — Real-time streaming logs showing agent activity, file creations, and errors
- **Live Indicator** — Shows when a mission is actively running
- **Agent Status** — Each agent's progress (idle → active → done)

**Mission Controls:**
- **Initiate Build** — Start a new mission
- **Download ZIP** — Download the completed project artifact
- **Live Preview** — Launch the generated app in preview mode

### API Keys Tab (🔑)

The API Keys tab lets you manage authentication:

- **List Keys** — View all API keys for your organization (shows prefix, name, last used, expiration)
- **Create Key** — Generate a new API key with an optional name and expiration date
- **Revoke Key** — Delete an API key to revoke access
- **Copy on Creation** — The full key is shown only once when created; save it immediately

### Search Tab (🔍)

The Search tab provides semantic vector search:

- **Search Input** — Type a natural language query (e.g., "authentication middleware")
- **Advanced Filters** — Filter by project, source type (`idea`, `file`, `log`), or minimum similarity threshold
- **Results** — Ranked by relevance score (0.0–1.0) with source context and project information
- **Search Stats** — Shows total indexed chunks, projects indexed, and breakdown by source

### Settings Modal (⚙️)

Click the gear icon in the sidebar to open settings:

- **LLM Provider Settings** — Configure OpenRouter API key, model selection, and base URL
- **NVIDIA Settings** — Switch provider and configure NVIDIA model (default: `qwen/qwen3-coder-480b-a35b-instruct`)
- **Runtime Updates** — Changes take effect immediately without server restart
- **Secure Storage** — API keys are encrypted at rest with AES-256-GCM

---

## 5. Managing API Keys

### Understanding API Keys

AEGIS uses API keys for multi-tenant authentication. Each key:
- Is scoped to a single **Organization**
- Is **SHA-256 hashed** before storage — the raw key is never persisted
- Follows the format: `aegis_<48-hex-chars>`
- Can have an optional **name** (e.g., "admin", "ci", "dev")
- Can have an optional **expiration date**

### Creating an API Key

**From the Dashboard:**
1. Click the **API Keys** tab (🔑)
2. Click **Create API Key**
3. (Optional) Enter a name and expiration date
4. Click **Create**
5. **Copy the key immediately** — it is shown only once

**From the API:**
```bash
curl -X POST http://localhost:3001/api/auth/keys \
  -H "X-Api-Key: aegis_..." \
  -H "Content-Type: application/json" \
  -d '{"name": "ci-key", "expiresAt": "2027-01-01T00:00:00.000Z"}'
```

### Using an API Key

Send the key in one of two ways:

```bash
# Option 1: X-Api-Key header
curl -H "X-Api-Key: aegis_ab12cd34ef56..." http://localhost:3001/api/stats

# Option 2: Bearer token
curl -H "Authorization: Bearer aegis_ab12cd34ef56..." http://localhost:3001/api/stats
```

### Revoking an API Key

**From the Dashboard:**
1. Go to the **API Keys** tab
2. Find the key you want to revoke
3. Click the **Revoke** button

**From the API:**
```bash
curl -X DELETE http://localhost:3001/api/auth/keys/<key-id> \
  -H "X-Api-Key: aegis_..."
```

### First-Time Setup

On the very first startup, AEGIS automatically:
1. Creates a **Default Organization**
2. Generates an **admin API key** (printed once to the server console)
3. Seeds default LLM settings from environment variables

Look for this message in the API server logs:

```
[AEGIS] Generated admin API key: aegis_ab12cd34ef56...
[AEGIS] ⚠️  Store this key securely — it will not be shown again.
```

---

## 6. Configuring Settings

### In-App Settings

Settings can be configured at runtime through the dashboard settings modal (⚙️) or the API. Changes take effect immediately — no server restart required.

| Setting | Description | Default |
|---|---|---|
| `LLM_PROVIDER` | Active LLM provider | `openrouter` |
| `OPENROUTER_API_KEY` | OpenRouter API key | — |
| `OPENROUTER_MODEL` | OpenRouter LLM model | `qwen/qwen3-coder-480b-a35b-instruct` |
| `OPENROUTER_BASE_URL` | OpenRouter API base URL | `https://openrouter.ai/api/v1` |
| `NVIDIA_API_KEY` | NVIDIA NIM API key | — |
| `NVIDIA_MODEL` | NVIDIA LLM model | `qwen/qwen3-coder-480b-a35b-instruct` |
| `EMBEDDING_MODEL` | Model for text embeddings | `openai/text-embedding-3-small` |

### How Settings Are Stored

- Settings are **organization-scoped** — each organization has its own isolated settings
- Sensitive values (API keys) are **encrypted at rest** using AES-256-GCM
- Encrypted values are stored as: `base64(iv).base64(authTag).base64(ciphertext)`
- API responses **redact** sensitive values — only the first and last 4 characters are shown

### Changing Settings via API

```bash
# View current settings
curl -H "X-Api-Key: aegis_..." http://localhost:3001/api/settings

# Update settings in bulk
curl -X POST http://localhost:3001/api/settings/bulk \
  -H "X-Api-Key: aegis_..." \
  -H "Content-Type: application/json" \
  -d '{
    "OPENROUTER_MODEL": "qwen/qwen3-coder-480b-a35b-instruct",
    "OPENROUTER_BASE_URL": "https://openrouter.ai/api/v1"
  }'
```

### Model Recommendations

| Model | Best For | Notes |
|---|---|---|
| `qwen/qwen3-coder-480b-a35b-instruct` | Code generation (default) | Excellent for coding tasks |
| `anthropic/claude-3.5-sonnet` | Complex code generation | High quality, good reasoning |
| `openai/gpt-4o` | General purpose | Balanced quality and speed |
| `google/gemini-2.0-flash-001` | Fast iterations | Lower cost, good for simple projects |

### Switching to NVIDIA

1. Go to Settings (⚙️) in the dashboard
2. Set `LLM_PROVIDER` to `nvidia`
3. Enter your `NVIDIA_API_KEY`
4. The model defaults to `qwen/qwen3-coder-480b-a35b-instruct`

---

## 7. Understanding Missions

### Mission Lifecycle

A mission goes through these phases:

```
QUEUED → RUNNING → COMPLETED (or FAILED)
```

During the `RUNNING` phase, the following pipeline executes:

```
Phase 0: Conductor (Battle Plan)
    ↓
Phase 1: Architect (Schema Design)
    ↓
Phase 2: Backend (API Implementation)
    ↓
Phase 3: Frontend (UI Implementation)
    ↓
Phase 4: DevOps (Containerization)
    ↓
Phase 5: QA (Testing)
    ↓
Phase 6: Tech Writer (Documentation)
    ↓
Auto-Fix Loop (up to 3 attempts, if errors)
    ↓
Security Audit
    ↓
ZIP Generation + RAG Indexing
```

### Agent Roles

| Agent | Role | What They Generate |
|---|---|---|
| **Conductor** | Engineering Manager | JSON battle plan with phase breakdown |
| **Architect** | Solution Architect | Database schema, API contracts, architecture docs |
| **Backend** | Backend Engineer | Express routes, Prisma models, Zod schemas, services |
| **Frontend** | Frontend Engineer | Next.js pages, React components, Tailwind styles |
| **DevOps** | DevOps/SRE | Dockerfile, docker-compose.yml, CI workflow |
| **QA** | QA Engineer | Vitest tests, Playwright config, test fixtures |
| **Security** | Security Engineer | Secret scanning, security audit report |
| **Tech Writer** | Technical Writer | README, API docs, deployment guide |
| **Fixer** | Debug Engineer | Patches for build errors (auto-fix loop) |

### Viewing Mission Details

**From the Dashboard:**
- Click on a mission in the Missions list to view its logs, file tree, and security audit
- Use the file viewer to inspect generated code
- Download the ZIP or launch a live preview

**From the API:**
```bash
# Get mission details with logs
curl -H "X-Api-Key: aegis_..." http://localhost:3001/api/missions/<mission-id>

# Stream live logs (SSE)
curl -N -H "X-Api-Key: aegis_..." http://localhost:3001/api/missions/<mission-id>/stream

# Get file tree
curl -H "X-Api-Key: aegis_..." http://localhost:3001/api/missions/<mission-id>/files

# View a file
curl -H "X-Api-Key: aegis_..." "http://localhost:3001/api/missions/<mission-id>/content?path=backend/src/server.ts"

# Get security audit
curl -H "X-Api-Key: aegis_..." http://localhost:3001/api/missions/<mission-id>/security
```

### Mission Status Meanings

| Status | Meaning |
|---|---|
| `running` | Mission is actively being built by agents |
| `completed` | All phases completed successfully, ZIP available |
| `failed` | Mission encountered an unrecoverable error |

---

## 8. Using Semantic Search

### What Is Semantic Search?

Semantic search uses vector embeddings to find documents based on meaning, not just keyword matching. For example, searching for "user login" will find documents about "authentication" and "sign-in" even if those exact words don't appear.

### How Indexing Works

After each mission completes:
1. All source files are **chunked** into segments (2000 chars with 200-char overlap)
2. Agent logs are chunked separately (3000 chars with 300-char overlap)
3. Each chunk is converted to a **vector embedding** (1536 dimensions)
4. Embeddings are stored in the database with pgvector for fast similarity search
5. Indexing runs **asynchronously** and does not block mission completion

### Searching

**From the Dashboard:**
1. Click the **Search** tab (🔍)
2. Type your query (e.g., "how does authentication work")
3. Optionally filter by project, source type, or similarity threshold
4. Browse ranked results with relevance scores

**From the API:**
```bash
# Basic search
curl -H "X-Api-Key: aegis_..." "http://localhost:3001/api/search?q=user+authentication"

# With filters
curl -H "X-Api-Key: aegis_..." \
  "http://localhost:3001/api/search?q=database+schema&limit=5&source=file&threshold=0.7"

# Get search index stats
curl -H "X-Api-Key: aegis_..." http://localhost:3001/api/search/stats
```

### Search Filters

| Filter | Purpose | Example |
|---|---|---|
| `q` | Search query (required) | `q=authentication+middleware` |
| `limit` | Max results (1–50, default 10) | `limit=20` |
| `projectId` | Limit to a specific project | `projectId=a1b2c3d4-...` |
| `source` | Filter by source type | `source=file` |
| `threshold` | Minimum similarity (0.0–1.0) | `threshold=0.8` |

### Understanding Scores

Results are ranked by **cosine similarity** (0.0–1.0):
- **0.9–1.0** — Nearly identical meaning
- **0.7–0.9** — Highly relevant
- **0.5–0.7** — Moderately relevant
- **0.0–0.5** — Weakly relevant

---

## 9. Design Analysis & Component Generation

### Analyzing a Design

AEGIS can analyze design descriptions and extract structured design tokens:

1. Go to the **Design** section (available via the API or MCP)
2. Describe your design (e.g., "A modern dark-mode dashboard with cyan accents and glassmorphism")
3. Optionally provide a reference image URL
4. AEGIS returns structured design tokens including:
   - Color palette (primary, secondary, background, surface, text, etc.)
   - Typography (font family, heading font, base font size)
   - Spacing and borders (border radius, spacing unit)
   - Style classification (minimal, glassmorphism, neomorphic, etc.)
   - Layout description

### Generating Components

Once you have design tokens, you can generate React components:

1. Specify a component name (e.g., "StatsCard")
2. Describe the component's functionality and appearance
3. Provide the design tokens from the analysis step
4. AEGIS returns a complete React component with proper Tailwind CSS classes

---

## 10. Live Preview

### Starting a Preview

After a mission completes, you can launch a live preview:

**From the Dashboard:**
- Click **Live Preview** on a completed mission

**From the API:**
```bash
curl -X POST -H "X-Api-Key: aegis_..." \
  http://localhost:3001/api/missions/<mission-id>/preview
```

### What Happens

1. AEGIS detects the project type (Next.js, Express, Vite, etc.)
2. Installs dependencies automatically
3. Starts the application on an available port (starting at 4001)
4. Opens the preview URL in your browser

### Stopping a Preview

```bash
curl -X DELETE -H "X-Api-Key: aegis_..." \
  http://localhost:3001/api/missions/<mission-id>/preview
```

---

## 11. MCP Integration (Advanced)

### What Is MCP?

The Model Context Protocol (MCP) allows external AI assistants (Claude Desktop, Cursor, VS Code) to invoke AEGIS capabilities as standardized tools. This means you can ask Claude to create an AEGIS mission, search your project knowledge, or analyze a design — all from within your AI assistant.

### Available Tools

| Tool | Description |
|---|---|
| `aegis_create_mission` | Create a new mission from a natural language idea |
| `aegis_list_missions` | List all missions with optional status filter |
| `aegis_get_mission` | Get detailed mission information |
| `aegis_delete_mission` | Delete a mission and all associated files |
| `aegis_search` | Search across all project knowledge using semantic search |
| `aegis_analyze_design` | Extract design tokens from a description |
| `aegis_get_settings` | View current configuration |
| `aegis_update_settings` | Update configuration in bulk |

### Setting Up with Claude Desktop

1. Open Claude Desktop → Settings → Developer → MCP Servers
2. Add a new server:

```json
{
  "mcpServers": {
    "aegis": {
      "command": "npx",
      "args": ["tsx", "/absolute/path/to/aegis/apps/api/src/mcp/entry.ts"],
      "env": {
        "DATABASE_URL": "file:./aegis.db",
        "OPENROUTER_API_KEY": "sk-or-v1-..."
      }
    }
  }
}
```

3. Restart Claude Desktop
4. Look for the hammer icon — AEGIS tools should appear
5. Try: "Create a new AEGIS mission to build a REST API"

### Setting Up with Cursor

1. Open Cursor → Settings → MCP
2. Add a new MCP server:

```json
{
  "name": "aegis",
  "type": "command",
  "command": "npx tsx /absolute/path/to/aegis/apps/api/src/mcp/entry.ts"
}
```

3. Save and enable the server

---

## 12. Docker Deployment

### Prerequisites

- Docker and Docker Compose installed on your system

### Quick Start

```bash
# Build and start all services
docker compose up -d --build

# Check health
docker compose ps
curl http://localhost:3001/health
curl http://localhost:3000/
```

### Services

| Service | Port | Description |
|---|---|---|
| `aegis-api` | 3001 | Express API server |
| `aegis-web` | 3000 | Next.js dashboard |

### Management Commands

```bash
# View logs
docker compose logs -f api
docker compose logs -f web

# Restart a service
docker compose restart api

# Stop all services
docker compose down

# Remove volumes (⚠️ deletes all data)
docker compose down -v
```

---

## 13. Troubleshooting

### Common Issues

#### API Server Won't Start

| Symptom | Likely Cause | Solution |
|---|---|---|
| `EADDRINUSE` | Port already in use | Kill the existing process or change `PORT` in `.env` |
| `ECONNREFUSED 127.0.0.1:6379` | Redis not running | Start Redis: `brew services start redis` or `redis-server` |
| `Cannot find module` | Dependencies not installed | Run `npm install` in `apps/api` |
| `relation "organizations" does not exist` | Database not initialized | Run `npx prisma db push` in `apps/api` |

#### Dashboard Shows Black & White / No Styling

The CSS file may not have been generated yet. Restart the web dev server:

```bash
kill -9 $(lsof -ti:3000)
cd apps/web && npm run dev
```

#### Dashboard Shows "Loading..." or Connection Errors

1. Check that the API server is running: `curl http://localhost:3001/health`
2. Check the browser console for `ERR_CONNECTION_REFUSED` on `:3001`
3. Restart the API server if needed: restart `npm run dev` in `apps/api`
4. Verify `CORS_ORIGINS` in `.env` includes `http://localhost:3000`

#### Mission Stuck on "Running"

1. Check that Redis is running: `redis-cli ping`
2. Check the server logs for LLM API errors
3. Verify your OpenRouter API key has credits
4. Check OpenRouter dashboard for rate limit status
5. The auto-retry mechanism should handle most temporary failures

#### API Authentication Errors

| Error | Cause | Solution |
|---|---|---|
| `UNAUTHORIZED` | Missing API key | Add `X-Api-Key` header or set `AUTH_DISABLED=true` |
| `UNAUTHORIZED` | Invalid API key | The key has been revoked or is incorrect |
| `UNAUTHORIZED` | Expired key | The key's `expiresAt` date has passed |

---

## 14. Best Practices

### Writing Good Mission Ideas

**Do:**
- Be specific about the tech stack (e.g., "Build a todo app with Next.js 14 and Express")
- Mention key features explicitly
- Describe the data model if relevant

**Don't:**
- Use vague descriptions like "Build something cool"
- Request multiple unrelated applications in one mission
- Include sensitive information in the idea text

**Good Example:**
> "Build a personal finance tracker with Next.js and Express. Users can add transactions, categorize spending into categories like Food, Transport, and Entertainment, and view monthly spending reports with charts. Use SQLite for the database and include user authentication."

### Performance Tips

- Start with simple, focused missions to validate your approach
- Use more powerful models (Claude 3.5 Sonnet, Qwen 3 Coder) for complex projects
- Use faster models (Gemini 2.0 Flash) for rapid prototyping
- Stop preview servers when not in use to free system resources
- Indexing runs in the background — it does not affect mission performance

### Security Practices

- Always use authentication in production environments
- Store the `ENCRYPTION_KEY` securely — it's used to encrypt settings at rest
- Regularly review API key usage and revoke unused keys
- Monitor the `/metrics` endpoint for unusual activity
- Keep AEGIS and its dependencies updated

---

## 15. FAQ

**Q: How long does a mission take?**

A: Simple applications can complete in 1–3 minutes. Complex projects with multiple features may take 5–10 minutes. Build time depends on the LLM provider's response speed and the complexity of your idea.

**Q: Can I customize the generated code?**

A: Yes! After a mission completes, you can download the ZIP and modify the code like any other project. The live preview feature lets you test changes interactively.

**Q: What if the generated app has errors?**

A: The auto-fix loop attempts to fix errors automatically (up to 3 attempts). If it still fails, try breaking your idea into smaller, more specific missions.

**Q: Can I use a different LLM provider?**

A: Yes. AEGIS uses OpenRouter by default, which provides access to many models. You can switch to NVIDIA NIM from the Settings panel. The default NVIDIA model is `qwen/qwen3-coder-480b-a35b-instruct`.

**Q: Do I need PostgreSQL?**

A: No! AEGIS uses SQLite by default — zero configuration required. PostgreSQL with pgvector is optional and recommended for production deployments where you need semantic search across large collections.

**Q: Do I need Redis?**

A: Yes. Redis is required for the BullMQ job queue that processes missions asynchronously. Install it with `brew install redis` (macOS) or `sudo apt install redis-server` (Linux).

**Q: How do I reset everything?**

```bash
# Stop services and delete all data
docker compose down -v

# Or manually reset the SQLite database
rm apps/api/aegis.db

# Or reset PostgreSQL
psql aegis -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
```

**Q: How do I update AEGIS?**

```bash
git pull origin main
cd apps/api && npm install
cd ../web && npm install
npx prisma db push  # Update database schema if changed
```

---

*User manual maintained by AEGIS Tech Writer agent · Generated from codebase analysis*
