# Contributing to AEGIS

We love contributions from the community! Here's how to get started.

---

## Development Setup

### Prerequisites

- Node.js >= 22.0.0
- npm >= 10.0.0
- Redis 7+ (required for BullMQ job queue)
- An OpenRouter API key (get one at [openrouter.ai/keys](https://openrouter.ai/keys))

### Clone & Install

```bash
git clone https://github.com/yourusername/aegis
cd aegis
cd apps/api && npm install
cd ../web && npm install
```

### Environment

```bash
cp apps/api/.env.example apps/api/.env
# Edit .env with your OpenRouter API key
# The database defaults to SQLite (zero config)
```

### Start Development

```bash
# Terminal 1: API Server (port 3001)
cd apps/api && npm run dev

# Terminal 2: Web Dashboard (port 3000)
cd apps/web && npm run dev

# Terminal 3: MCP Server (optional)
cd apps/api && npm run mcp
```

---

## Code Quality Standards

All code must pass these checks before merging:

```bash
cd apps/api
npm run lint          # ESLint check
npm run format:check  # Prettier check
npm run typecheck     # TypeScript type check
npm run test          # Vitest unit tests
npm run test:coverage # Coverage report
```

### TypeScript Standards

- **Strict mode** enabled in `tsconfig.json`
- No `any` type casts — use proper types or generics
- Async/await preferred over raw promises
- All function parameters and return types explicitly annotated
- Use Zod schemas for runtime validation on all API inputs

### Commit Conventions

We follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` — New feature
- `fix:` — Bug fix
- `docs:` — Documentation
- `refactor:` — Code restructuring
- `test:` — Adding/updating tests
- `chore:` — Maintenance, config changes

**Example:**
```
feat: add multi-file block splitting to file writer
fix: correct LLM_PROVIDER default from nvidia to openrouter
docs: update architecture docs for SQLite + Redis
```

---

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the full system design.

### Key Directories

```
apps/api/src/
├── routes/          # Express route handlers (missions, auth, settings, etc.)
├── middleware/      # Express middleware (auth, validation, error handling, metrics)
├── services/        # Business logic (build, design, embedding, indexing, crypto, etc.)
├── mcp/             # MCP server (stdio + SSE transports, 8 tools)
├── agents/          # AI agent system prompts (9 agents)
├── utils/           # Utilities (fileWriter, zipper, logger, paths)
├── config/          # Centralized environment configuration (Zod)
├── types/           # TypeScript type definitions
├── orchestrator.ts  # Mission lifecycle engine (BullMQ worker)
├── db.ts            # Prisma client + database initialization
└── index.ts         # Express server entry point

apps/web/
├── app/             # Next.js App Router pages + layout
├── components/      # React components (Overview, Missions, ApiKeys, etc.)
├── hooks/           # Custom React hooks (useStats, useMissions, etc.)
├── lib/             # Utilities (api-client, utils, types)
└── tailwind.config.js # Custom design system configuration
```

### Data Flow Summary

```
User Input → Dashboard → POST /api/missions
    → BullMQ Queue (Redis)
    → Mission Worker → runMission()
    → Conductor LLM → JSON Battle Plan
    → Agent Pipeline (sequential phases)
    → parseAndWriteFiles() → output/{id}/
    → Auto-Fix Loop (max 3x)
    → Security Audit → SECURITY_AUDIT.md
    → ZIP + RAG Indexing
    → SSE broadcast → Dashboard update
```

---

## Testing Guidelines

- Write tests for all new features and bug fixes
- Maintain 60%+ code coverage minimum
- Use **Vitest** for unit tests (configured in `vitest.config.ts`)
- Mock external APIs (LLM calls) in unit tests
- Test file naming: `*.test.ts` colocated with source files

### Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npx vitest run src/utils/fileWriter.test.ts

# Watch mode
npx vitest

# Coverage report
npm run test:coverage
```

---

## Pull Request Process

1. **Create a feature branch** from `main`:
   ```bash
   git checkout -b feat/your-feature-name
   ```

2. **Make your changes** with clean, atomic commits following conventional commit format

3. **Run all quality checks** locally:
   ```bash
   cd apps/api
   npm run lint
   npm run typecheck
   npm run test
   ```

4. **Submit a PR** with a clear description of:
   - What the change does
   - Why it's needed
   - How it was tested
   - Any breaking changes

5. **Await review** from maintainers. Address any feedback promptly.

---

## Security

- **Never commit API keys or secrets** — use environment variables
- All sensitive data must be added to `.env.example` (not `.env`)
- Settings are stored with AES-256-GCM encryption via `cryptoService.ts`
- API keys are SHA-256 hashed before storage — raw keys never persisted
- Report security issues privately to the maintainers — do not file public issues

---

## Documentation

- Update relevant documentation for any feature changes or additions
- Documentation files are located in the project root:
  - `README.md` — Project overview and quick start
  - `ARCHITECTURE.md` — C4-style system architecture
  - `API.md` — REST API reference (20+ endpoints)
  - `MCP_SERVER.md` — MCP integration guide
  - `USER_MANUAL.md` — Comprehensive user guide
  - `CHANGELOG.md` — Version history (add entry for your changes)

---

## License

This project is licensed under the MIT License — see [LICENSE](./LICENSE).
