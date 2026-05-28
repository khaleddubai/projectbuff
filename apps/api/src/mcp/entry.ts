#!/usr/bin/env node
/**
 * AEGIS — MCP Server Entry Point
 *
 * Starts the AEGIS MCP server with stdio transport for use with
 * AI assistants like Claude Desktop, Cursor, or any MCP-compatible client.
 *
 * Usage:
 *   npx tsx src/mcp/entry.ts
 *   node dist/mcp/entry.js          (after build)
 *
 * Environment variables (loaded from .env):
 *   DATABASE_URL   – PostgreSQL connection string
 *   LOG_LEVEL      – Logging level (default: info)
 */

import 'dotenv/config';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createMCPServer, initialize } from './index';

async function main() {
  // Initialize database connection and seed defaults
  await initialize();

  // Create and configure the MCP server
  const server = createMCPServer();

  // Connect to stdio transport — communicates with the host via stdin/stdout
  const transport = new StdioServerTransport();
  await server.connect(transport);

   
  console.error('[AEGIS-MCP] Server running on stdio transport');
  console.error('[AEGIS-MCP] Tools available: aegis_create_mission, aegis_list_missions, aegis_get_mission, aegis_delete_mission, aegis_search, aegis_analyze_design, aegis_get_settings, aegis_update_settings');
}

main().catch((err) => {
  console.error('[AEGIS-MCP] Fatal error:', err);
  process.exit(1);
});
