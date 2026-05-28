#!/usr/bin/env node
/**
 * AEGIS — MCP Server (HTTP/SSE Transport)
 *
 * Starts the AEGIS MCP server with HTTP/SSE transport for use with
 * remote AI assistants over HTTP. Provides both SSE streaming and
 * POST-based message endpoints per the MCP specification.
 *
 * Usage:
 *   npx tsx src/mcp/sse.ts
 *   npm run mcp:sse
 *
 * The server listens on the port specified by MCP_PORT (default 3002).
 * Compatible with Claude Desktop, Cursor, and any MCP-compatible client
 * that supports SSE transport.
 *
 * Environment variables:
 *   MCP_PORT   – HTTP server port (default: 3002)
 *   DATABASE_URL – PostgreSQL connection string
 *   LOG_LEVEL  – Logging level (default: info)
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { createMCPServer, initialize } from './index';

const PORT = parseInt(process.env.MCP_PORT || '3002', 10);

async function main() {
  // Initialize database connection and seed defaults
  await initialize();

  // Create and configure the MCP server
  const server = createMCPServer();

  const app = express();

  // CORS for remote clients
  app.use(cors({
    origin: process.env.MCP_CORS_ORIGINS?.split(',') || '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }));

  app.use(express.json());

  // ── Health check ──
  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'aegis-mcp',
      transport: 'sse',
      version: '1.0.0',
    });
  });

  // ── SSE endpoint: establishes the session ──
  // Client connects here to receive SSE events.
  let activeTransport: SSEServerTransport | null = null;

  app.get('/sse', async (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    // Create SSE transport for this session
    const transport = new SSEServerTransport('/messages', res);
    activeTransport = transport;

    // Cleanup on client disconnect
    req.on('close', () => {
      if (activeTransport === transport) {
        activeTransport = null;
      }
    });

    // Connect the MCP server to this transport
    await server.connect(transport);
  });

  // ── Message endpoint: receives client messages ──
  app.post('/messages', async (req, res) => {
    if (!activeTransport) {
      res.status(503).json({ error: 'No active SSE session. Connect to /sse first.', code: 'NO_SESSION' });
      return;
    }

    try {
      await activeTransport.handlePostMessage(req, res, req.body as Record<string, unknown>);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('[AEGIS-MCP-SSE] Message handling error:', message);
      if (!res.headersSent) {
        res.status(500).json({ error: message, code: 'HANDLER_ERROR' });
      }
    }
  });

  // ── Start server ──
  const httpServer = app.listen(PORT, () => {
    console.error(`[AEGIS-MCP-SSE] Server running on http://localhost:${PORT}`);
    console.error(`[AEGIS-MCP-SSE] SSE endpoint: http://localhost:${PORT}/sse`);
    console.error(`[AEGIS-MCP-SSE] Message endpoint: http://localhost:${PORT}/messages`);
    console.error('[AEGIS-MCP-SSE] Tools: aegis_create_mission, aegis_list_missions, aegis_get_mission, aegis_delete_mission, aegis_search, aegis_analyze_design, aegis_get_settings, aegis_update_settings');
  });

  // ── Graceful shutdown ──
  const shutdown = () => {
    console.error('[AEGIS-MCP-SSE] Shutting down...');
    httpServer.close(() => {
      console.error('[AEGIS-MCP-SSE] Server closed');
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 5000); // Force exit after 5s
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('[AEGIS-MCP-SSE] Fatal error:', err);
  process.exit(1);
});
