# AEGIS — API Reference

> **Version:** 1.1.1 · **Last Updated:** May 2026

---

## Table of Contents

1. [REST API](#1-rest-api)
   - [Health](#11-health)
   - [Stats](#12-stats)
   - [Missions](#13-missions)
   - [Auth / API Keys](#14-auth--api-keys)
   - [Settings](#15-settings)
   - [Preview](#16-preview)
   - [Search](#17-search)
   - [Design](#18-design)
2. [MCP Tools](#2-mcp-tools)
3. [SSE Events](#3-sse-events)
4. [Error Codes](#4-error-codes)
5. [Rate Limiting](#5-rate-limiting)

---

## 1. REST API

**Base URL:** `http://localhost:3001` (configurable via `PORT` env var)

### Authentication

Most endpoints require an API key sent via one of the following methods:

| Method | Header | Example |
|---|---|---|
| Header | `X-Api-Key` | `X-Api-Key: aegis_<48-hex-chars>` |
| Bearer token | `Authorization` | `Authorization: Bearer aegis_<48-hex-chars>` |

The `/health` and `/metrics` endpoints are public and do not require authentication.

To disable authentication in development, set `AUTH_DISABLED=true` in your environment.

---

### 1.1 Health

#### `GET /health`

Check API server health including database connectivity and uptime. Public endpoint (no auth required).

**Response (200):**
```json
{
  "status": "ok",
  "version": "1.1.0",
  "timestamp": "2026-05-25T10:00:00.000Z",
  "uptime": 3600,
  "uptimeHuman": "1h 0s",
  "checks": {
    "database": "healthy"
  }
}
```

**Response (503 — degraded):**
```json
{
  "status": "degraded",
  "version": "1.1.0",
  "checks": {
    "database": "unhealthy: connection refused"
  }
}
```

#### `GET /metrics`

Prometheus-compatible metrics endpoint. Only available when `ENABLE_METRICS=true` (default). Public endpoint.

**Available Metrics:**

| Metric | Type | Description |
|---|---|---|
| `aegis_uptime_seconds` | gauge | Server uptime in seconds |
| `aegis_active_requests` | gauge | Currently in-flight requests |
| `aegis_requests_total` | counter | Total requests processed |
| `aegis_requests_duration_seconds` | histogram | Duration buckets (5ms to 5s+) |
| `aegis_errors_total` | counter | Errors by status family (4xx, 5xx) |
| `aegis_route_requests_total` | counter | Request count by route path |

---

### 1.2 Stats

#### `GET /api/stats`

Aggregate dashboard statistics scoped to the authenticated organization.

**Response (200):**
```json
{
  "totalMissions": 42,
  "completedMissions": 35,
  "failedMissions": 3,
  "runningMissions": 4,
  "totalFiles": 847,
  "recentMissions": [
    {
      "id": "a1b2c3d4-...",
      "name": "todo-app",
      "status": "completed",
      "idea": "Build a todo app...",
      "createdAt": "2026-05-25T10:00:00.000Z"
    }
  ]
}
```

---

### 1.3 Missions

#### `POST /api/missions`

Create a new mission. The mission is queued via BullMQ and runs asynchronously — use the returned `id` to track progress via SSE streaming or polling.

**Request Body:**
```json
{
  "idea": "Build a todo app with Next.js and Express"
}
```

**Validation:**
- `idea` must be 3–10,000 characters
- Returns `VALIDATION_ERROR` (400) if validation fails

**Response (200):**
```json
{
  "id": "a1b2c3d4-...",
  "status": "running"
}
```

---

#### `GET /api/missions`

List all missions for the authenticated organization, ordered by creation date (newest first).

**Response (200):**
```json
[
  {
    "id": "a1b2c3d4-...",
    "name": "todo-app",
    "idea": "Build a todo app...",
    "status": "completed",
    "outputPath": "/path/to/output/todo-app.zip",
    "createdAt": "2026-05-25T10:00:00.000Z",
    "updatedAt": "2026-05-25T10:05:00.000Z"
  }
]
```

---

#### `GET /api/missions/:id`

Get mission details with full log history.

**Response (200):**
```json
{
  "project": {
    "id": "a1b2c3d4-...",
    "name": "todo-app",
    "status": "completed",
    "idea": "Build a todo app..."
  },
  "logs": [
    {
      "id": 1,
      "projectId": "a1b2c3d4-...",
      "agent": "conductor",
      "message": "Analyzing mission...",
      "type": "info",
      "createdAt": "2026-05-25T10:00:01.000Z"
    }
  ]
}
```

**Response (404):**
```json
{ "error": "Mission not found", "code": "NOT_FOUND" }
```

---

#### `GET /api/missions/:id/stream`

SSE (Server-Sent Events) stream for real-time mission logs. Keeps the connection alive with heartbeats every 15 seconds.

**Response:** SSE text/event-stream

```text
event: connected
data: {"status":"connected"}

data: {"projectId":"a1b2c3d4-...","agent":"conductor","message":"Analyzing mission...","type":"info","timestamp":"2026-05-25T10:00:01.000Z"}

: heartbeat
```

**SSE Event Fields:**

| Field | Type | Description |
|---|---|---|
| `projectId` | string | Mission ID |
| `agent` | string | Agent name (conductor, architect, backend, frontend, devops, qa, security, techwriter, fixer) |
| `message` | string | Log message |
| `type` | enum | `info`, `file`, `error` |
| `timestamp` | string | ISO 8601 timestamp |

**Stream Events:**

| Event | Trigger |
|---|---|
| `connected` | SSE connection established |
| Log event | Any agent action (type: `info`, `file`, or `error`) |
| Heartbeat | Every 15 seconds (comment line) |

---

#### `GET /api/missions/:id/download`

Download the completed mission ZIP artifact.

**Response:** Binary file download (`Content-Type: application/octet-stream`)

**Error Codes:** `NOT_READY` (400 — build not yet complete), `NOT_FOUND` (404 — mission not found)

---

#### `GET /api/missions/:id/files`

Get the file tree of generated output.

**Response (200):**
```json
{
  "tree": [
    { "name": "backend", "type": "directory", "children": [...] },
    { "name": "frontend", "type": "directory", "children": [...] },
    { "name": "README.md", "type": "file" }
  ]
}
```

---

#### `GET /api/missions/:id/content?path=backend/src/server.ts`

Get the contents of a specific file from the mission output directory.

**Query Parameters:**

| Parameter | Required | Description |
|---|---|---|
| `path` | ✓ | Relative path within the mission output directory |

**Response (200):**
```json
{
  "content": "import express from 'express';\n...",
  "path": "backend/src/server.ts"
}
```

**Error Codes:** `INVALID_PATH` (400 — path traversal detected), `NOT_FOUND` (404 — file not found), `FILE_TOO_LARGE` (400 — file exceeds 1MB limit)

---

#### `GET /api/missions/:id/security`

Get the security audit report for a completed mission.

**Response (200) — clean:**
```json
{
  "clean": true,
  "findings": []
}
```

**Response (200) — with findings:**
```json
{
  "clean": false,
  "findings": [
    "[SECRET] Hardcoded password found in config.ts",
    "[SECRET] Potential API key detected in .env.example"
  ]
}
```

---

### 1.4 Auth / API Keys

API key management endpoints for multi-tenant authentication. Keys are SHA-256 hashed before storage — the raw key is never persisted. Key format: `aegis_<48-hex-chars>`.

#### `GET /api/auth/keys`

List all API keys for the authenticated organization.

**Response (200):**
```json
[
  {
    "id": "key-uuid-...",
    "keyPrefix": "aegis_ab12",
    "name": "admin",
    "lastUsedAt": "2026-05-25T10:00:00.000Z",
    "expiresAt": null,
    "createdAt": "2026-05-25T09:00:00.000Z"
  }
]
```

**Notes:**
- Only the first 8 characters (`keyPrefix`) are exposed for identification
- The full key is never stored and cannot be retrieved after creation

---

#### `POST /api/auth/keys`

Create a new API key. The full key is shown **once** in the response — save it immediately.

**Request Body:**
```json
{
  "name": "ci-key",
  "expiresAt": "2027-01-01T00:00:00.000Z"
}
```

| Field | Required | Type | Description |
|---|---|---|---|
| `name` | — | string | Human-readable label (default: `"default"`) |
| `expiresAt` | — | string (ISO 8601) | Optional expiration date |

**Response (200):**
```json
{
  "id": "key-uuid-...",
  "key": "aegis_ab12cd34ef56...78",
  "name": "ci-key",
  "createdAt": "2026-05-25T10:00:00.000Z",
  "expiresAt": "2027-01-01T00:00:00.000Z"
}
```

> ⚠️ **Important:** The full `key` value is only returned in this response. If lost, you must revoke the key and create a new one.

---

#### `DELETE /api/auth/keys/:id`

Revoke (delete) an API key by its ID.

**Response (200):**
```json
{ "success": true }
```

**Response (404):**
```json
{ "error": "API key not found", "code": "NOT_FOUND" }
```

---

### 1.5 Settings

Settings are organization-scoped and values containing sensitive data (API keys) are encrypted at rest using AES-256-GCM.

#### `GET /api/settings`

Get all settings for the authenticated organization. API keys and other sensitive values are partially redacted.

**Response (200):**
```json
{
  "LLM_PROVIDER": "openrouter",
  "OPENROUTER_API_KEY": "sk-or-v1-...abcd",
  "OPENROUTER_MODEL": "qwen/qwen3-coder-480b-a35b-instruct",
  "OPENROUTER_BASE_URL": "https://openrouter.ai/api/v1",
  "EMBEDDING_MODEL": "openai/text-embedding-3-small"
}
```

**Redaction Rules:**
- Keys matching `*API_KEY*` or `*SECRET*` patterns are truncated to show only the first and last 4 characters
- Non-sensitive values are returned in full

---

#### `POST /api/settings/bulk`

Update one or more settings in bulk. Values are validated and encrypted before storage.

**Request Body:**
```json
{
  "OPENROUTER_MODEL": "qwen/qwen3-coder-480b-a35b-instruct",
  "OPENROUTER_BASE_URL": "https://openrouter.ai/api/v1"
}
```

**Response (200):**
```json
{ "success": true, "updated": 2 }
```

**Notes:**
- Updates are upserted (insert or update if the key already exists)
- Empty string values are rejected with `VALIDATION_ERROR`
- Sensitive values are encrypted with AES-256-GCM at rest
- Changes take effect immediately — no server restart required

---

### 1.6 Preview

#### `POST /api/missions/:id/preview`

Start a live preview server for a completed mission. The service auto-installs dependencies and starts the application on an available port.

**Response (200):**
```json
{
  "url": "http://localhost:4001",
  "port": 4001,
  "status": "starting"
}
```

**Port Allocation:** Ports are dynamically allocated starting from 4001.

**Error Codes:** `NOT_FOUND` (404 — mission not found), `NOT_READY` (400 — build not complete)

---

#### `DELETE /api/missions/:id/preview`

Stop the live preview server for a mission. Cleans up the spawned process and releases the port.

**Response (200):**
```json
{ "success": true, "stopped": true }
```

**Response when no preview is running:**
```json
{ "success": true, "stopped": false }
```

---

### 1.7 Search

Semantic vector search across all indexed project documents using pgvector cosine similarity. Documents are automatically indexed after each mission completes.

#### `GET /api/search?q=user authentication&limit=10`

**Query Parameters:**

| Parameter | Required | Default | Description |
|---|---|---|---|
| `q` | ✓ | — | Natural language search query |
| `limit` | — | 10 | Max results (1–50) |
| `projectId` | — | — | Filter results to a specific project |
| `source` | — | — | Filter by source: `idea`, `file`, `log` |
| `threshold` | — | 0 | Minimum similarity score (0.0–1.0, higher = stricter) |

**Response (200):**
```json
{
  "query": "user authentication",
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

**Indexing Details:**
- Documents are chunked at 2000 characters with 200-character overlap
- Logs are chunked at 3000 characters with 300-character overlap
- Chunking respects natural boundaries (newlines, sentence ends)
- Embeddings are generated in batches of 20 with 200ms delay between batches
- Indexing runs asynchronously after mission completion (non-blocking)

---

#### `GET /api/search/stats`

Get search index statistics for the authenticated organization.

**Response (200):**
```json
{
  "totalChunks": 1523,
  "projectsIndexed": 42,
  "sources": {
    "idea": 42,
    "file": 1200,
    "log": 281
  }
}
```

---

### 1.8 Design

#### `POST /api/design/analyze`

Analyze a design description and extract structured design tokens (colors, typography, spacing, layout, style).

**Request Body:**
```json
{
  "description": "A modern dark-mode dashboard with cyan accent colors, glassmorphism cards, and a sidebar layout. Think Vercel meets Linear.",
  "imageUrl": "https://example.com/screenshot.png"
}
```

| Field | Required | Type | Description |
|---|---|---|---|
| `description` | ✓ | string | Detailed design description (3–5000 chars) |
| `imageUrl` | — | string (URL) | Reference image URL for additional context |

**Response (200):**
```json
{
  "tokens": {
    "primaryColor": "#06b6d4",
    "secondaryColor": "#8b5cf6",
    "backgroundColor": "#0f172a",
    "surfaceColor": "#1e293b",
    "textColor": "#f8fafc",
    "mutedTextColor": "#94a3b8",
    "borderColor": "#334155",
    "errorColor": "#ef4444",
    "successColor": "#22c55e",
    "warningColor": "#f59e0b",
    "fontFamily": "Inter, system-ui, sans-serif",
    "headingFont": "Inter, system-ui, sans-serif",
    "baseFontSize": 16,
    "borderRadius": 12,
    "spacingUnit": 4,
    "isDark": true,
    "style": "glassmorphism",
    "layout": "sidebar + main content"
  },
  "styleNotes": "The design uses a dark color scheme with cyan accents...",
  "componentSuggestions": ["SidebarNav", "StatsCard", "DataTable"]
}
```

---

#### `POST /api/design/generate`

Generate a React component from design tokens and a specification. Returns the component code in AEGIS File Protocol (AFP) format.

**Request Body:**
```json
{
  "componentName": "StatsCard",
  "specification": "A card showing a metric with icon, label, value, and trend indicator",
  "tokens": {
    "primaryColor": "#06b6d4",
    "backgroundColor": "#0f172a",
    "surfaceColor": "#1e293b",
    "textColor": "#f8fafc",
    "borderRadius": 12,
    "fontFamily": "Inter, system-ui, sans-serif"
  }
}
```

**Response (200):**
```json
{
  "content": "<FILE path=\"StatsCard.tsx\">\n'use client';\nimport { LucideIcon } from 'lucide-react';\n...\n</FILE>",
  "componentName": "StatsCard"
}
```

---

#### `GET /api/design/tokens`

Get the default design tokens for UI preview and reference.

**Response (200):**
```json
{
  "tokens": { ... },
  "styleNotes": "...",
  "componentSuggestions": ["HeroSection", "FeatureCard", "NavigationBar"]
}
```

---

## 2. MCP Tools

For MCP (Model Context Protocol) integration details, see [MCP_SERVER.md](./MCP_SERVER.md).

| Tool | Description |
|---|---|
| `aegis_create_mission` | Create mission from natural language idea |
| `aegis_list_missions` | List missions with optional status filter |
| `aegis_get_mission` | Get mission details + logs + file tree |
| `aegis_delete_mission` | Delete mission and files (requires `confirm: true`) |
| `aegis_search` | Semantic vector search across all projects |
| `aegis_analyze_design` | Extract design tokens from description or image URL |
| `aegis_get_settings` | View configuration (sensitive values redacted) |
| `aegis_update_settings` | Update configuration in bulk |

---

## 3. SSE Events

The SSE stream (`GET /api/missions/:id/stream`) emits real-time events throughout the mission lifecycle.

**Connection:**
- Client subscribes via `EventSource` or `fetch` with streaming
- Server confirms with a `connected` event
- Heartbeat comments sent every 15 seconds to keep the connection alive
- Auto-reconnect is supported (standard SSE behavior)

**Event Payload:**

```json
{
  "projectId": "a1b2c3d4-...",
  "agent": "conductor",
  "message": "Analyzing mission requirements...",
  "type": "info",
  "timestamp": "2026-05-25T10:00:01.000Z"
}
```

| Field | Type | Description |
|---|---|---|
| `projectId` | string | Mission ID |
| `agent` | string | Agent name |
| `message` | string | Log message |
| `type` | enum | `info` — informational, `file` — file created, `error` — error occurred |
| `timestamp` | string | ISO 8601 timestamp |

---

## 4. Error Codes

All API errors follow a consistent JSON structure:

```json
{
  "error": "Human-readable error message",
  "code": "ERROR_CODE"
}
```

| Code | HTTP Status | Description |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Input validation failed (Zod schema) |
| `INVALID_PATH` | 400 | Path traversal detected or invalid file path |
| `FILE_TOO_LARGE` | 400 | File exceeds 1MB read limit |
| `NOT_READY` | 400 | Build not yet complete or artifact not available |
| `UNAUTHORIZED` | 401 | Missing or invalid API key |
| `NOT_FOUND` | 404 | Resource not found (mission, key, file, etc.) |
| `RATE_LIMITED` | 429 | Too many requests (rate limit exceeded) |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

**Validation Errors** include additional details:

```json
{
  "error": "Validation failed",
  "code": "VALIDATION_ERROR",
  "details": [
    {
      "field": "idea",
      "message": "String must contain at least 3 character(s)",
      "code": "too_small"
    }
  ]
}
```

---

## 5. Rate Limiting

Rate limiting protects the API from excessive traffic. Configured via environment variables:

| Variable | Default | Description |
|---|---|---|
| `RATE_LIMIT_WINDOW_MS` | 900000 (15 minutes) | Time window for rate limiting |
| `RATE_LIMIT_MAX` | 100 | Maximum requests per window |

**Exemptions:**
- The `/health` and `/metrics` endpoints are exempt from rate limiting
- Rate limit is applied per IP address

**Response when rate limited (429):**
```json
{
  "error": "Too many requests, please try again later",
  "code": "RATE_LIMITED"
}
```

**Rate Limit Headers:**
```
Retry-After: 900
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1680000000
```

---

*API documentation maintained by AEGIS Tech Writer agent · Generated from codebase analysis*
