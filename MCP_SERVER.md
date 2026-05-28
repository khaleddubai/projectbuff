# AEGIS — MCP Server Integration Guide

> **Version:** 1.1.1 · **Last Updated:** May 2026

The Model Context Protocol (MCP) server exposes AEGIS's full orchestration capabilities as standardized tools. Any MCP-compatible AI assistant (Claude Desktop, Cursor, VS Code, etc.) can invoke AEGIS missions, search project knowledge, analyze designs, and manage settings — all through a unified protocol.

---

## Table of Contents

1. [Quick Start](#1-quick-start)
2. [Transport Modes](#2-transport-modes)
3. [Tool Reference](#3-tool-reference)
4. [Integration Guides](#4-integration-guides)
5. [Security Considerations](#5-security-considerations)
6. [Troubleshooting](#6-troubleshooting)

---

## 1. Quick Start

### Prerequisites

- Node.js 22 LTS
- Redis 7+ (required for BullMQ mission queue)
- SQLite (default, zero-config) or PostgreSQL 15+ with pgvector extension
- OpenRouter API key (get one at [openrouter.ai/keys](https://openrouter.ai/keys))

### Installation

```bash
# Navigate to the API package
cd apps/api

# Install dependencies
npm install

# Copy and configure environment
cp .env.example .env
# Edit .env with your OPENROUTER_API_KEY
# Default database is SQLite (file-based, no setup needed)

# Push database schema
npx prisma db push
```

### Start the MCP Server

```bash
# stdio mode (for Claude Desktop, Cursor, etc.)
npm run mcp

# HTTP/SSE mode (for remote clients)
npm run mcp:sse
# → http://localhost:3002/health
```

### Test the Connection

```bash
# Health check (SSE mode)
curl http://localhost:3002/health

# Expected response:
# {"status":"ok","service":"aegis-mcp","transport":"sse","version":"1.1.0"}
```

---

## 2. Transport Modes

### 2.1 stdio Transport

The stdio transport communicates with the host process via standard input/output. This is the simplest mode and works with all MCP-compatible desktop applications.

**Command:** `npm run mcp`

**Usage with JSON-RPC:**
```bash
# Send a tool request via stdin
echo '{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "aegis_list_missions",
    "arguments": { "limit": 5 }
  }
}' | npx tsx src/mcp/entry.ts
```

### 2.2 SSE/HTTP Transport

The SSE transport exposes the MCP server over HTTP, supporting both SSE streaming (for events) and POST-based messaging (for tool calls). This is ideal for remote clients and web applications.

**Command:** `npm run mcp:sse`

**Endpoints:**

| Endpoint | Method | Description |
|---|---|---|
| `http://localhost:3002/health` | GET | Health check |
| `http://localhost:3002/sse` | GET | SSE connection (establishes session) |
| `http://localhost:3002/messages` | POST | Send tool requests |

**Configuration:**
```bash
# Environment variables for SSE mode
export MCP_PORT=3002                    # Port (default: 3002)
export MCP_CORS_ORIGINS=http://localhost:3000  # CORS origins (comma-separated)
```

---

## 3. Tool Reference

### 3.1 `aegis_create_mission`

Create a new AEGIS mission from a natural language idea. AEGIS will autonomously generate a complete, production-ready codebase through sequential agent execution.

**Input Schema:**

| Field | Type | Required | Description |
|---|---|---|---|
| `idea` | string | ✓ | The project description (3–10,000 chars) |

**Example:**
```json
{
  "idea": "Build a personal finance tracker with Next.js and Express. Users can add transactions, categorize spending, and view monthly reports."
}
```

**Response:**
```json
{
  "id": "a1b2c3d4-...",
  "status": "running",
  "idea": "Build a personal finance tracker..."
}
```

**Usage Note:** The mission runs asynchronously via BullMQ. Use `aegis_get_mission` with the returned `id` to track progress. Missions are scoped to the organization associated with the MCP session.

---

### 3.2 `aegis_list_missions`

List all AEGIS missions with optional filtering. Results are scoped to the current organization.

**Input Schema:**

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `status` | enum | — | — | Filter: `running`, `completed`, `failed` |
| `limit` | number | — | 20 | Max results (1–100) |

**Response:**
```json
{
  "missions": [
    {
      "id": "a1b2c3d4-...",
      "name": "finance-tracker",
      "status": "completed",
      "idea": "Build a personal finance tracker...",
      "createdAt": "2026-05-25T10:00:00.000Z"
    }
  ],
  "count": 1
}
```

---

### 3.3 `aegis_get_mission`

Get detailed information about a specific mission, including its status, logs, output file tree, and download artifact path.

**Input Schema:**

| Field | Type | Required | Description |
|---|---|---|---|
| `projectId` | string | ✓ | The mission's unique identifier |

**Response:**
```json
{
  "project": {
    "id": "a1b2c3d4-...",
    "name": "finance-tracker",
    "status": "completed",
    "idea": "Build a personal finance tracker...",
    "createdAt": "2026-05-25T10:00:00.000Z",
    "updatedAt": "2026-05-25T10:05:00.000Z"
  },
  "logs": [
    {
      "agent": "conductor",
      "message": "Analyzing mission...",
      "type": "info",
      "timestamp": "2026-05-25T10:00:01.000Z"
    }
  ],
  "artifact": {
    "path": "/path/to/output/finance-tracker.zip",
    "exists": true
  },
  "outputFiles": [
    "backend/",
    "backend/src/",
    "backend/src/server.ts",
    "frontend/",
    "frontend/app/page.tsx",
    "README.md"
  ]
}
```

---

### 3.4 `aegis_delete_mission`

Irreversibly delete a mission and all its associated files, database records, and search index entries.

**Input Schema:**

| Field | Type | Required | Description |
|---|---|---|---|
| `projectId` | string | ✓ | The mission's unique identifier |
| `confirm` | boolean | ✓ | Must be `true` to confirm deletion |

**Response (success):**
```json
{ "success": true, "deleted": "a1b2c3d4-..." }
```

---

### 3.5 `aegis_search`

Semantically search across all indexed mission documents using vector similarity (pgvector). Results are ranked by relevance score and scoped to the current organization.

**Input Schema:**

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `query` | string | ✓ | — | Natural language search query |
| `limit` | number | — | 10 | Max results (1–50) |
| `projectId` | string | — | — | Limit to specific project |
| `source` | enum | — | — | Filter by source: `idea`, `file`, `log` |
| `threshold` | number | — | 0 | Minimum similarity (0.0–1.0, higher = stricter) |

**Response:**
```json
{
  "query": "authentication",
  "count": 3,
  "results": [
    {
      "id": "chunk-uuid-...",
      "projectId": "a1b2c3d4-...",
      "source": "file",
      "filePath": "backend/src/auth.ts",
      "content": "File: backend/src/auth.ts\n```\nexport async function authenticate...\n```",
      "createdAt": "2026-05-25T10:00:00.000Z",
      "score": 0.92
    }
  ]
}
```

---

### 3.6 `aegis_analyze_design`

Analyze a design description or screenshot URL and extract structured design tokens (colors, typography, spacing, style, layout).

**Input Schema:**

| Field | Type | Required | Description |
|---|---|---|---|
| `description` | string | ✓ | Detailed design description (3–5000 chars) |
| `imageUrl` | string (URL) | — | Reference image/screenshot URL |

**Example:**
```json
{
  "description": "A modern SaaS dashboard with glassmorphism cards, dark theme with cyan accents, sharp corners, and a monospace aesthetic."
}
```

**Response:**
```json
{
  "tokens": {
    "primaryColor": "#06b6d4",
    "secondaryColor": "#8b5cf6",
    "backgroundColor": "#0f172a",
    "surfaceColor": "#1e293b",
    "textColor": "#f8fafc",
    "style": "glassmorphism",
    "layout": "sidebar + main"
  },
  "styleNotes": "Dark theme with cyan accent...",
  "componentSuggestions": ["HeroSection", "FeatureCard", "NavigationBar"]
}
```

---

### 3.7 `aegis_get_settings`

Retrieve all AEGIS configuration settings. Sensitive values (API keys) are automatically redacted — only the first and last 4 characters are shown. Settings are scoped to the current organization and encrypted at rest.

**Input Schema:** None (empty object)

**Response:**
```json
{
  "settings": {
    "LLM_PROVIDER": "openrouter",
    "OPENROUTER_API_KEY": "sk-o-r...abcd",
    "OPENROUTER_MODEL": "qwen/qwen3-coder-480b-a35b-instruct",
    "OPENROUTER_BASE_URL": "https://openrouter.ai/api/v1"
  },
  "count": 4
}
```

---

### 3.8 `aegis_update_settings`

Update one or more AEGIS configuration settings in bulk. Settings persist across server restarts, are encrypted with AES-256-GCM at rest, and are scoped to the current organization.

**Input Schema:**

| Field | Type | Required | Description |
|---|---|---|---|
| `settings` | object | ✓ | Key-value pairs of settings to update |

**Example:**
```json
{
  "settings": {
    "OPENROUTER_MODEL": "qwen/qwen3-coder-480b-a35b-instruct",
    "OPENROUTER_BASE_URL": "https://openrouter.ai/api/v1"
  }
}
```

**Response:**
```json
{
  "success": true,
  "updated": 2,
  "keys": ["OPENROUTER_MODEL", "OPENROUTER_BASE_URL"]
}
```

---

## 4. Integration Guides

### 4.1 Claude Desktop

1. Open Claude Desktop → Settings → Developer → MCP Servers
2. Add a new server with these details:

```json
{
  "mcpServers": {
    "aegis": {
      "command": "npx",
      "args": [
        "tsx",
        "/absolute/path/to/aegis/apps/api/src/mcp/entry.ts"
      ],
      "env": {
        "DATABASE_URL": "file:./aegis.db",
        "OPENROUTER_API_KEY": "sk-or-v1-..."
      }
    }
  }
}
```

3. Save and restart Claude Desktop
4. Look for the hammer icon → AEGIS tools should appear
5. Try asking Claude: "Create a new AEGIS mission to build a todo app"

### 4.2 Cursor

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
4. Cursor's AI can now invoke AEGIS tools inline

### 4.3 SSE Remote Client

For remote MCP clients that connect via HTTP/SSE (e.g., custom web apps, VS Code with remote configuration):

```json
{
  "mcpServers": {
    "aegis": {
      "url": "http://your-server:3002/sse"
    }
  }
}
```

### 4.4 Custom MCP Client (JavaScript)

```typescript
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const transport = new StdioClientTransport({
  command: 'npx',
  args: ['tsx', '/path/to/aegis/apps/api/src/mcp/entry.ts'],
});

const client = new Client({
  name: 'my-app',
  version: '1.0.0',
});

await client.connect(transport);

// List available tools
const tools = await client.listTools();
console.log(tools.tools.map(t => t.name));

// Create a mission
const result = await client.callTool({
  name: 'aegis_create_mission',
  arguments: { idea: 'Build a REST API with Express' },
});
console.log(result.content[0].text);
```

---

## 5. Security Considerations

### 5.1 Multi-Tenant Isolation

AEGIS operates on a multi-tenant architecture:
- All tools operate within the context of a single organization
- Missions, settings, API keys, and search indices are fully isolated between organizations
- API keys are SHA-256 hashed before storage — the raw key is never persisted
- Settings containing sensitive values are encrypted with AES-256-GCM at rest

### 5.2 API Key Redaction

The `aegis_get_settings` tool automatically redacts sensitive values:
- API keys show only the first 4 and last 4 characters
- Full values are never exposed through the MCP interface

### 5.3 Deletion Safeguards

The `aegis_delete_mission` tool requires explicit `confirm: true` to prevent accidental data loss.

### 5.4 Input Validation

All tool inputs are validated using Zod schemas before processing:
- String lengths, number ranges, and enum values are enforced
- Malformed requests return structured error responses with detailed validation messages

### 5.5 Rate Limiting

The SSE transport includes CORS protection. For production deployments, add:

```bash
export MCP_CORS_ORIGINS=https://your-allowed-domain.com
```

### 5.6 Production Authentication

For production MCP deployments, add a reverse proxy (e.g., Nginx, Caddy) in front of the SSE endpoint with:
- TLS termination (HTTPS)
- Basic auth or API key validation
- IP allowlisting

---

## 6. Troubleshooting

### Common Issues

| Symptom | Cause | Solution |
|---|---|---|
| `No API key configured` | Missing OpenRouter key | Set `OPENROUTER_API_KEY` in settings via `aegis_update_settings` or `.env` |
| `ECONNREFUSED` at /sse | Server not running | Start with `npm run mcp:sse` |
| Tools not appearing in Claude | Wrong path in config | Use absolute path to `entry.ts` |
| `Database error` on mission creation | DB not initialized | Run `npx prisma db push` in `apps/api` |
| Mission stuck on `running` | Redis not running or LLM rate limit | Start Redis (`brew services start redis`), check OpenRouter dashboard |
| `No active SSE session` | Connected to /messages before /sse | Connect to `/sse` first, then send messages to `/messages` |
| `UNAUTHORIZED` errors | Missing or invalid API key | Ensure `X-Api-Key` header is set or `AUTH_DISABLED=true` in dev |
| `Error: connect ECONNREFUSED 127.0.0.1:6379` | Redis not running | Start Redis: `redis-server` or `brew services start redis` |

### Logs

```bash
# MCP stdio logs
npm run mcp 2>&1 | grep "[AEGIS-MCP]"

# MCP SSE logs
npm run mcp:sse 2>&1 | grep "[AEGIS-MCP-SSE]"

# Application logs (with LOG_DIR set)
tail -f /path/to/logs/aegis.log
```

### Diagnostics

```bash
# Check Redis connectivity
redis-cli ping
# → PONG

# Check DB connectivity
curl http://localhost:3002/health

# Test tool listing (using MCP JSON-RPC directly)
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | npx tsx src/mcp/entry.ts

# Verify database
cd apps/api && npx prisma db push --dry-run
```

---

*MCP integration documentation maintained by AEGIS Tech Writer agent · Generated from codebase analysis*
