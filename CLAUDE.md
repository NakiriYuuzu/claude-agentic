# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Project Rules

1. 使用 MCP 工具和 WebSearch：遇到不熟悉的 shadcn-vue 組件或 Monaco Editor 使用方式時，使用 MCP context7 查詢文檔
2. 遇到不確定就問：任何設計或實現上的疑問，立即詢問確認
3. 保持現有 UI 不變：Sidebar 的雙欄結構、顏色、布局不變
4. 測試每個 Phase：完成一個 Phase 後測試，確保功能正常再繼續

---

## Project Overview

**Claude Agent SDK + Elysia.js API Platform**

- **Runtime**: Bun (JavaScript/TypeScript)
- **Backend**: Elysia.js (high-performance web framework)
- **AI SDK**: @anthropic-ai/claude-agent-sdk
- **Database**: Bun SQLite (native bun:sqlite)
- **Frontend**: Vue.js 3 + Tailwind CSS + VueUse (Composition API)
- **Validation**: TypeBox (@sinclair/typebox)
- **Logging**: Pino + pino-pretty (structured logging)

**Core Features**:
- WebSocket real-time streaming for Claude Agent queries
- Dual-track session architecture (SDK + Database)
- Asynchronous batch writing for performance optimization
- Workspace configuration management

---

## Development Commands

```bash
# Development (hot reload)
bun run dev

# Production
bun run start

# Testing
bun test
bun run tests/test-database.ts  # Database tests
```

**Important URLs**:
- API Server: `http://localhost:3000`
- Swagger UI: `http://localhost:3000/swagger`
- WebSocket: `ws://localhost:3000/api/ws`
- Frontend: `http://localhost:3000/`

---

## Environment Variables

```env
# Optional
ANTHROPIC_API_KEY=sk-ant-xxx

# Optional
CONTEXT7_API_KEY=ctx7_xxx        # MCP integration
PORT=3000
NODE_ENV=development
DATABASE_PATH=./data/settings.db

# Logging
LOG_LEVEL=info                   # debug, info, warn, error
LOG_PRETTY=true                  # Pretty output for development

# Session Management
SESSION_BATCH_SIZE=50            # Batch write size
SESSION_FLUSH_INTERVAL=1000      # Flush interval (ms)
```

---

## Core Architecture Patterns

### Dual-Track Session Architecture

**Critical Design**: Sessions are managed in two separate systems:

1. **SDK Sessions** (`.claude/data/`):
   - Managed natively by Claude SDK
   - Used for `resume` functionality
   - Required for continuing conversations

2. **Database Sessions** (SQLite):
   - Recording, statistics, auditing
   - NOT used for resume functionality
   - Performance-optimized with batch writes

**Key Principle**: Both systems share the same `session_id` to ensure consistency, but serve different purposes. The SDK handles conversation continuity; the database handles analytics and history.

**Implementation**: See `src/services/session.service.ts` for database operations and `src/services/agent.service.ts` for SDK integration.

### Asynchronous Batch Writing

**Problem**: Direct SQLite writes during SSE/WebSocket streaming can cause performance bottlenecks.

**Solution**: `SessionQueueService` (src/services/session-queue.service.ts):
- In-memory queue → Batch write to SQLite
- Configurable batch size and flush interval
- Graceful shutdown ensures no data loss

**Configuration**:
```typescript
SESSION_BATCH_SIZE=50            // Write when queue reaches 50 items
SESSION_FLUSH_INTERVAL=1000      // Or write every 1000ms
```

**Why This Matters**: Allows high-frequency message streaming without blocking I/O operations.

### WebSocket Real-Time Streaming

**Architecture** (src/routes/websocket.routes.ts):
- Native Elysia.js WebSocket support
- Connection tracking: `Map<connectionId, Set<requestId>>`
- Message validation via TypeBox schemas
- Graceful cleanup on disconnect

**Message Flow**:
```
Client → WebSocket → AgentService → Claude SDK → Stream Events → WebSocket → Client
                                         ↓
                                  SessionRecorder (async batch)
```

### Configuration Priority

**Resolution Order**:
```
API request options > Database workspace_settings > SDK defaults
```

**Example**: If a client sends `{ model: 'claude-3-opus' }` but database has `claude-3-sonnet` configured, the API option wins.

**Implementation**: See `src/services/settings.service.ts:buildAgentOptions()`.

---

## API Design

### REST Endpoints

- `POST /api/workspaces` - Create workspace
- `GET /api/workspaces/:path` - Get workspace settings
- `PUT /api/workspaces/:path` - Update workspace settings
- `DELETE /api/workspaces/:path` - Delete workspace
- `POST /api/query` - Agent query (waits for completion before returning)
- `GET /api/sessions` - List sessions with pagination
- `GET /api/sessions/:id` - Get session details
- `GET /api/sessions/stats` - Session statistics
- `GET /api/health` - Health check

### WebSocket API

**Endpoint**: `ws://localhost:3000/api/ws`

**Query Message Format**:
```typescript
{
  type: 'query',
  requestId: string,           // Unique request identifier
  workspacePath: string,        // Workspace path
  prompt: string,               // User prompt
  options?: {
    model?: string,             // Override model
    permissionMode?: string,    // 'default' | 'acceptEdits' | 'bypassPermissions' | 'plan'
    maxTurns?: number,          // Max conversation turns
    resume?: string             // SDK native resume (session_id)
  }
}
```

**Response Message Format**:
```typescript
// Streaming messages
{
  requestId: string,
  message: SDKMessage           // Claude SDK message object
}

// Completion
{
  requestId: string,
  type: 'complete'
}

// Error
{
  requestId: string,
  type: 'error',
  error: string
}
```

---

## Database Schema

### Core Tables

1. **workspaces**: Workspace metadata
   - `id` (INTEGER PRIMARY KEY)
   - `workspace_path` (TEXT UNIQUE) - Indexed
   - `created_at`, `updated_at` (TEXT)

2. **workspace_settings**: Workspace configuration
   - JSON fields: `agents`, `mcp_servers`, `hooks`, `tools`
   - Settings override SDK defaults

3. **sessions**: Session records and statistics
   - `session_id` (TEXT PRIMARY KEY) - Matches SDK session ID
   - `workspace_id` (FOREIGN KEY)
   - `status` ('running', 'completed', 'error')
   - `created_at`, `updated_at` (TEXT) - Indexed
   - `message_count`, `total_tokens`

4. **session_messages**: Complete message history
   - `message_id` (TEXT PRIMARY KEY)
   - `session_id` (FOREIGN KEY)
   - `content` (TEXT) - Full JSON message

**Key Constraints**:
- Foreign keys with `ON DELETE CASCADE`
- Auto-updated timestamps via triggers
- Optimized indexes on `workspace_path` and `updated_at`

---

## Code Style Conventions

**TypeScript Configuration** (tsconfig.json):
```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  }
}
```

**Style Guidelines**:
- ✅ No semicolons
- ✅ Single quotes
- ✅ 4-space indentation
- ✅ Full TypeScript type annotations
- ✅ ESM modules (`type: "module"`)
- ✅ Factory pattern for route creation (`createXxxRoutes`)

---

## Special Implementation Notes

### Resume Functionality

**v0.2.1 Simplification**: Removed 120 lines of manual loading logic.

**Current Approach**: Use Claude SDK native `resume` option:
```typescript
// Correct way to resume
await agent.query(prompt, { resume: sessionId })
```

**Why**: SDK handles all session state management internally. Database sessions are for analytics only.

**See**: src/services/agent.service.ts

### Graceful Shutdown

**Implementation** (src/index.ts):
```typescript
process.on('SIGINT', async () => {
  clearInterval(cleanupJob)        // Stop cleanup job
  await sessionRecorder.flush()    // Flush queue
  settingsService.close()          // Close database
  process.exit(0)
})
```

**Why**: Ensures in-memory queued messages are written before shutdown.

### Auto-Cleanup

**Job**: Every hour, mark sessions as 'error' if they've been 'running' for >24 hours.

**Purpose**: Prevent database accumulation of incomplete session records.

**Implementation**: src/index.ts cleanup job.

---

## Directory Structure (Monorepo)

```
claude-agentic/
├── packages/
│   ├── shared/                      # Shared code package
│   │   ├── src/
│   │   │   ├── types/              # TypeScript type definitions
│   │   │   │   ├── query.types.ts
│   │   │   │   ├── session.types.ts
│   │   │   │   └── settings.types.ts
│   │   │   ├── schemas/            # TypeBox validation schemas
│   │   │   │   ├── session.schema.ts
│   │   │   │   └── settings.schema.ts
│   │   │   └── index.ts            # Package exports
│   │   ├── dist/                   # Compiled output
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── backend/                     # Backend API service
│   │   ├── src/
│   │   │   ├── index.ts            # App entry, middleware, graceful shutdown
│   │   │   ├── config/             # Configuration files
│   │   │   │   └── logger.config.ts
│   │   │   ├── routes/             # API routes (factory pattern)
│   │   │   │   ├── query.routes.ts
│   │   │   │   ├── session.routes.ts
│   │   │   │   ├── settings.routes.ts
│   │   │   │   ├── websocket.routes.ts
│   │   │   │   └── test-sse.routes.ts
│   │   │   ├── services/           # Business logic layer
│   │   │   │   ├── database.service.ts       # SQLite CRUD
│   │   │   │   ├── settings.service.ts       # Configuration loading
│   │   │   │   ├── agent.service.ts          # Claude SDK wrapper
│   │   │   │   ├── session.service.ts        # Session management
│   │   │   │   ├── session-queue.service.ts  # Async batch writing
│   │   │   │   └── session-recorder.ts       # Session recorder
│   │   │   └── utils/              # Utility functions
│   │   │       └── logger.ts
│   │   ├── tests/                  # Test files
│   │   ├── dist/                   # Compiled output
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── client/                    # Frontend Vue.js SPA
│       ├── public/
│       │   ├── index.html          # Vue.js 3 SPA
│       │   ├── app.js              # Main application logic
│       │   ├── styles.css          # Tailwind CSS
│       │   └── composables/        # Vue Composition API
│       │       ├── useWebSocket.js # WebSocket connection management
│       │       ├── useMessages.js  # Message state management
│       │       ├── useSessions.js  # Session API calls
│       │       └── useTools.js     # Tool parsing and expansion
│       ├── package.json
│       └── README.md
│
├── data/                            # SQLite database and logs (gitignored)
├── .claude/                         # Claude SDK session data (gitignored)
├── .logs/                           # File log output (gitignored)
│
├── package.json                     # Root package.json (workspace config)
├── bunfig.toml                      # Bun workspace configuration
├── tsconfig.json                    # Root TypeScript configuration
├── .gitignore
├── CLAUDE.md
├── README.md
└── CHANGELOG.md
```

**Package Structure**:
- `@workspace/shared`: Shared types and schemas (compiled to dist/)
- `@workspace/backend`: Backend API service (depends on shared)
- `@workspace/client`: Frontend SPA (no npm dependencies, uses CDN)

**Special Directories**:
- `.claude/`: Claude SDK auto-generated session data (gitignored)
- `data/`: SQLite database and logs (gitignored, root level)
- `.logs/`: File log output (gitignored, root level)

---

## Logging System

**Strategy**: Structured logging with request ID tracking.

**Configuration** (src/config/logger.config.ts):
- **Development**: Pretty-printed output via pino-pretty
- **Production**: JSON format for log aggregation
- **Transport**: Console output (Docker/K8s friendly)

**Request ID Tracking**: Each HTTP request generates unique ID for tracing.

**Log Levels**: debug, info, warn, error (configurable via `LOG_LEVEL` env)

---

## Version History

- **0.4.2**: Cross-platform compatibility optimization
- **0.4.1**: Frontend refactor → Composition API
- **0.4.0**: WebSocket real-time streaming
- **0.3.0**: Folder selection + static file serving
- **0.2.1**: Simplified resume with SDK native API
- **0.2.0**: Session management and resume
- **0.0.1**: Initial version