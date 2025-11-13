# Claude Agent API Platform

基於 **Claude Agent SDK (TypeScript)** + **Elysia.js** + **SQLite** 的 API 平台系統，提供工作空間設定管理與 AI Agent 查詢功能。

## ✨ 功能特點

- ✅ **SQLite 資料庫**：使用 Bun SQLite 儲存工作空間設定與 session 歷史
- ✅ **完整 CRUD API**：透過 REST API 管理設定
- ✅ **多工作空間支援**：每個工作路徑獨立設定
- ✅ **自動設定載入**：查詢時自動套用對應設定
- ✅ **SSE 串流回應**：即時串流 Agent 執行結果
- ✅ **Session 管理**：自動記錄對話歷史、支援查詢統計與恢復對話
- ✅ **非同步記錄佇列**：高效能的批次寫入，不影響 SSE 效能
- ✅ **Resume 功能**：繼續先前的對話，支援指定 session 或自動繼續
- ✅ **結構化日誌系統**：Pino + Console/檔案雙輸出 + Request ID 追蹤
- ✅ **Swagger UI**：內建 API 文件介面
- ✅ **型別安全**：完整的 TypeScript 支援
- ✅ **混合儲存模式**：基本欄位分開，複雜結構用 JSON

## 📦 技術棧

- **運行環境**：Bun
- **Web 框架**：Elysia.js
- **資料庫**：Bun SQLite (`bun:sqlite`)
- **AI SDK**：Claude Agent SDK
- **驗證**：TypeBox (Elysia 內建)
- **文件**：Swagger UI
- **前端**：Vue.js 3 + Tailwind CSS + VueUse（CDN）

## 🏗️ Monorepo 架構

本專案採用 **Bun Workspace Monorepo** 架構，分為三個獨立的 packages：

```
claude-agentic/
├── packages/
│   ├── shared/              # 共享程式碼
│   │   ├── src/
│   │   │   ├── types/      # TypeScript 型別定義
│   │   │   └── schemas/    # TypeBox 驗證 Schema
│   │   └── dist/           # 編譯輸出
│   │
│   ├── backend/             # 後端服務
│   │   ├── src/
│   │   │   ├── config/     # 設定檔
│   │   │   ├── routes/     # API 路由
│   │   │   ├── services/   # 業務邏輯
│   │   │   └── index.ts    # 應用入口
│   │   └── dist/           # 編譯輸出
│   │
│   └── frontend/            # 前端應用
│       └── public/          # Vue.js 3 SPA
│
├── data/                    # 資料目錄（gitignored）
├── .claude/                 # Claude SDK 資料（gitignored）
├── package.json             # 根配置 + workspaces
└── bunfig.toml              # Bun workspace 配置
```

### Packages 說明

#### 📦 `@workspace/shared`
- **用途**：共享型別定義和驗證 Schema
- **依賴**：TypeBox
- **特點**：編譯為 JavaScript + TypeScript 宣告檔案

#### 🚀 `@workspace/backend`
- **用途**：Elysia.js API 服務
- **依賴**：shared + Elysia.js + Claude SDK + SQLite
- **特點**：依賴 shared package，提供 REST API 和 WebSocket

#### 🎨 `@workspace/frontend`
- **用途**：Vue.js 3 前端應用
- **依賴**：無（完全基於 CDN）
- **特點**：由 backend 的靜態服務提供

### 構建順序

由於 backend 依賴 shared，構建時必須先編譯 shared：

```bash
bun run build        # 自動按順序構建：shared → backend
bun run build:shared # 僅構建 shared
bun run build:backend # 僅構建 backend（需先構建 shared）
```

## 🚀 快速開始

### 1. 安裝依賴

```bash
bun install
```

### 2. 設定環境變數

複製環境變數範本：

```bash
cp .env.sample .env
```

編輯 `.env` 檔案，填入您的 API Key：

```env
ANTHROPIC_API_KEY=sk-ant-xxx
CONTEXT7_API_KEY=ctx7_xxx  # 可選
PORT=3000
DATABASE_PATH=./data/settings.db

# 日誌設定
LOG_LEVEL=info      # debug, info, warn, error
LOG_PRETTY=true     # 開發環境美化輸出
```

### 3. 啟動伺服器

```bash
# 開發模式（熱重載）
bun run dev

# 生產模式
bun run start
```

### 4. 訪問服務

- **API Server**: http://localhost:3000
- **Swagger UI**: http://localhost:3000/swagger
- **Health Check**: http://localhost:3000/api/health

## 📚 API 文件

### 工作空間設定管理

#### 1. 建立工作空間設定

```bash
POST /api/workspaces
```

**欄位說明**：

| 欄位 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `workspacePath` | string | ✅ 必填 | 工作空間路徑（唯一識別碼） |
| `systemPrompt` | string | ❌ 選填 | 自訂系統提示 |
| `allowedTools` | string[] | ❌ 選填 | 允許的工具清單 |
| `disallowedTools` | string[] | ❌ 選填 | 禁止的工具清單 |
| `agents` | object | ❌ 選填 | Agent 定義 |
| `mcpServers` | object | ❌ 選填 | MCP Server 設定 |
| `hooks` | object | ❌ 選填 | Hook 設定 |

**完整範例**（包含所有選填欄位）：

```json
{
  "workspacePath": "/Users/yuuzu/projects/my-app",
  "systemPrompt": "You are a helpful coding assistant",
  "allowedTools": ["Read", "Write", "Edit", "Bash"],
  "agents": {
    "code-reviewer": {
      "description": "Code reviewer",
      "prompt": "Review code for best practices",
      "tools": ["Read", "Grep", "Glob"],
      "model": "sonnet"
    }
  },
  "mcpServers": {
    "context7": {
      "type": "sse",
      "url": "https://mcp.context7.com/sse",
      "headers": {
        "CONTEXT7_API_KEY": "ctx7_xxx"
      }
    }
  }
}
```

**最小化範例**（只有必填欄位）：

```json
{
  "workspacePath": "/Users/yuuzu/projects/my-app"
}
```

#### 2. 取得工作空間設定

```bash
GET /api/workspaces/:path
```

**範例**：

```bash
# workspacePath 需要 URL encode
curl http://localhost:3000/api/workspaces/%2FUsers%2Fyuuzu%2Fprojects%2Fmy-app
```

#### 3. 更新工作空間設定

```bash
PUT /api/workspaces/:path
```

**請求範例**：

```json
{
  "systemPrompt": "Updated system prompt",
  "allowedTools": ["Read", "Write"]
}
```

#### 4. 刪除工作空間設定

```bash
DELETE /api/workspaces/:path
```

#### 5. 列出所有工作空間

```bash
GET /api/workspaces
```

### Agent 查詢

#### 執行 Agent 查詢（SSE 串流）

```bash
POST /api/query
```

**請求範例**：

```json
{
  "workspacePath": "/Users/yuuzu/projects/my-app",
  "prompt": "分析這個專案的架構並提供優化建議",
  "options": {
    "permissionMode": "plan",
    "maxTurns": 10
  }
}
```

**SSE 回應範例**：

```
event: init
data: {"workspacePath":"/Users/yuuzu/projects/my-app","timestamp":"2025-11-02T..."}

event: session_init
data: {"session_id":"abc123","cwd":"/Users/yuuzu/projects/my-app","model":"claude-sonnet-4-5"}

event: assistant_message
data: {"content":[...],"uuid":"msg_..."}

event: result
data: {"result":"分析完成...","total_cost_usd":0.05,"num_turns":3,"duration_ms":5000}

event: complete
data: {"timestamp":"2025-11-02T..."}
```

### Session 管理

Session 管理功能自動記錄所有 Agent 查詢的完整對話歷史，支援查詢、統計和恢復對話。

#### 1. 列出 Sessions

```bash
GET /api/sessions?workspace_path=/path&status=completed&limit=50&offset=0
```

**Query Parameters**：

| 參數 | 類型 | 說明 |
|------|------|------|
| `workspace_path` | string | 過濾指定工作空間（選填） |
| `status` | `running`/`completed`/`error`/`interrupted` | 過濾狀態（選填） |
| `limit` | number | 每頁數量（預設 50） |
| `offset` | number | 分頁偏移（預設 0） |
| `order_by` | `created_at`/`updated_at`/`total_cost_usd` | 排序欄位 |
| `order` | `asc`/`desc` | 排序方向 |

#### 2. 取得 Session 詳情

```bash
GET /api/sessions/:session_id
```

#### 3. 取得 Session 訊息

```bash
GET /api/sessions/:session_id/messages?message_type=assistant&limit=100
```

#### 4. 取得統計資訊

```bash
GET /api/sessions/stats?workspace_path=/path
```

**回應範例**：

```json
{
  "success": true,
  "data": {
    "total_sessions": 50,
    "completed_sessions": 45,
    "error_sessions": 5,
    "total_cost_usd": 2.5,
    "total_turns": 150,
    "average_duration_ms": 5000,
    "most_used_tools": [
      { "tool": "Read", "count": 120 },
      { "tool": "Write", "count": 85 }
    ]
  }
}
```

#### 5. 刪除 Session

```bash
DELETE /api/sessions/:session_id
```

#### 6. Resume 對話（繼續先前的 Session）

Resume 功能使用 Claude Agent SDK 的原生機制，SDK 會自動管理對話歷史。

**指定 Session ID 繼續**：

```json
POST /api/query
{
  "workspacePath": "/path",
  "prompt": "繼續剛才的討論",
  "options": {
    "resume": "session_abc123"
  }
}
```

**自動繼續最近的 Session**：

```json
POST /api/query
{
  "workspacePath": "/path",
  "prompt": "繼續剛才的討論",
  "options": {
    "continue": true
  }
}
```

**說明**：
- Resume 功能由 Claude Agent SDK 自動處理
- SDK 從它的內部儲存載入對話歷史
- 我們的資料庫記錄用於查詢、統計和審計，不參與 Resume 流程
- Session ID 來自 SDK，兩個系統共用相同的 session_id

### Session 配置

在 `.env` 中可設定 Session 記錄行為：

```env
# Session 批次大小（訊息數量達到此值時批次寫入）
SESSION_BATCH_SIZE=50

# Session flush 間隔（毫秒）
SESSION_FLUSH_INTERVAL=1000
```

## 💻 使用範例

### JavaScript/TypeScript 客戶端

```typescript
// 1. 建立工作空間設定
const createResponse = await fetch('http://localhost:3000/api/workspaces', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        workspacePath: '/Users/yuuzu/projects/my-app',
        systemPrompt: 'You are a helpful assistant',
        allowedTools: ['Read', 'Write', 'Edit']
    })
})

const { success, data } = await createResponse.json()
console.log('Created:', data)

// 2. 執行查詢（SSE 串流）
const queryResponse = await fetch('http://localhost:3000/api/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        workspacePath: '/Users/yuuzu/projects/my-app',
        prompt: '分析專案架構'
    })
})

const reader = queryResponse.body!.getReader()
const decoder = new TextDecoder()

while (true) {
    const { done, value } = await reader.read()
    if (done) break

    const chunk = decoder.decode(value)
    const lines = chunk.split('\n\n')

    for (const line of lines) {
        if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6))
            console.log('Event:', data)
        }
    }
}
```

### cURL 範例

```bash
# 建立工作空間設定
curl -X POST http://localhost:3000/api/workspaces \
  -H "Content-Type: application/json" \
  -d '{
    "workspacePath": "/Users/yuuzu/projects/my-app",
    "systemPrompt": "You are a helpful assistant"
  }'

# 執行查詢（SSE 串流）
curl -X POST http://localhost:3000/api/query \
  -H "Content-Type: application/json" \
  -d '{
    "workspacePath": "/Users/yuuzu/projects/my-app",
    "prompt": "分析專案架構"
  }' \
  --no-buffer
```

## 📁 專案結構

```
claude-agentic/
├── src/
│   ├── index.ts                      # 主應用入口
│   ├── types/
│   │   └── settings.types.ts         # 型別定義
│   ├── schemas/
│   │   └── settings.schema.ts        # TypeBox 驗證
│   ├── services/
│   │   ├── database.service.ts       # 資料庫 CRUD
│   │   ├── settings.service.ts       # 設定載入
│   │   └── agent.service.ts          # Agent SDK 包裝
│   └── routes/
│       ├── settings.routes.ts        # 設定管理 API
│       └── query.routes.ts           # Agent 查詢 API
│
├── data/
│   └── settings.db                   # SQLite 資料庫
│
├── tests/
│   └── test-database.ts              # 資料庫測試
│
├── package.json
├── tsconfig.json
├── .env.sample
└── README.md
```

## 🗄️ 資料庫結構

### workspaces 表

```sql
CREATE TABLE workspaces (
    workspace_path TEXT PRIMARY KEY,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)
```

### workspace_settings 表

```sql
CREATE TABLE workspace_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workspace_path TEXT NOT NULL UNIQUE,
    system_prompt TEXT,
    allowed_tools TEXT,      -- JSON array
    disallowed_tools TEXT,   -- JSON array
    agents TEXT,             -- JSON object
    mcp_servers TEXT,        -- JSON object
    hooks TEXT,              -- JSON object
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (workspace_path) REFERENCES workspaces(workspace_path) ON DELETE CASCADE
)
```

### sessions 表

```sql
CREATE TABLE sessions (
    session_id TEXT PRIMARY KEY,
    workspace_path TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    completed_at TEXT,
    status TEXT NOT NULL DEFAULT 'running',  -- running, completed, error, interrupted

    -- Session 配置
    model TEXT,
    permission_mode TEXT,
    cwd TEXT,
    tools TEXT,              -- JSON array
    mcp_servers TEXT,        -- JSON array

    -- 執行結果
    total_cost_usd REAL DEFAULT 0,
    num_turns INTEGER DEFAULT 0,
    duration_ms INTEGER,
    duration_api_ms INTEGER,
    is_error INTEGER DEFAULT 0,
    error_message TEXT,

    -- 統計
    message_count INTEGER DEFAULT 0,

    FOREIGN KEY (workspace_path) REFERENCES workspaces(workspace_path) ON DELETE CASCADE
)
```

### session_messages 表

```sql
CREATE TABLE session_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    uuid TEXT NOT NULL UNIQUE,
    message_type TEXT NOT NULL,       -- system, user, assistant, result
    message_subtype TEXT,
    message_content TEXT NOT NULL,    -- 完整 JSON
    tools_used TEXT,                  -- JSON array (自動提取)
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
)
```

**特點**：
- **自動記錄**：每次 query 自動建立 session 並記錄所有訊息
- **非同步寫入**：使用記憶體佇列批次寫入，不影響 SSE 效能
- **完整歷史**：儲存完整的 message JSON，可完整重現對話
- **工具追蹤**：自動提取並記錄每個訊息使用的工具
- **自動清理**：定期清理超過 24 小時的 `running` 狀態 session

### Session 系統架構

本系統採用**雙軌 Session 架構**：

#### 1. SDK Sessions（Resume 功能）
- 由 Claude Agent SDK 管理
- 用於 `resume` 和 `continue` 對話
- 儲存位置由 SDK 管理（通常在 `.claude` 目錄）
- 提供穩定的對話恢復功能

#### 2. Database Sessions（記錄與分析）
- 記錄所有對話歷史到 SQLite
- 提供查詢、統計和審計功能
- 支援成本追蹤、工具使用分析
- 用於歷史回顧和數據分析

**兩個系統共用相同的 `session_id`**，確保記錄的一致性。當使用 Resume 功能時，SDK 會從它的儲存載入對話，而我們的資料庫則提供該 session 的統計資訊。

## 🧪 測試

執行資料庫測試：

```bash
bun run tests/test-database.ts
```

## 🛠️ 開發指南

### 程式碼規範

- ✅ **無分號**：JavaScript/TypeScript 不使用分號
- ✅ **4 spaces**：縮排使用 4 個空格
- ✅ **單引號**：字串使用單引號
- ✅ **型別標註**：完整的 TypeScript 型別

### 新增功能

1. **新增 API 端點**：在 `src/routes/` 目錄下建立新的路由檔案
2. **修改資料庫結構**：更新 `DatabaseService.initialize()` 方法
3. **新增型別**：在 `src/types/` 目錄下定義新型別

## 📝 設定優先順序

當執行 Agent 查詢時，設定的優先順序為：

```
1. API 請求的 options 參數（最高優先）
2. 資料庫中的工作空間設定（中等優先）
3. SDK 預設值（最低優先）
```

範例：

```json
{
  "workspacePath": "/project-a",
  "prompt": "Hello",
  "options": {
    "model": "opus"  // 這會覆蓋資料庫中的 model 設定
  }
}
```

## 📊 日誌系統

### 功能特點

- **高效能日誌**：使用 Pino（最快的 Node.js logger）
- **Console 輸出**：stdout 輸出，適合 Docker/Kubernetes 日誌收集
- **Request ID 追蹤**：為每個 HTTP 請求產生唯一 ID，貫穿整個執行鏈
- **結構化日誌**：JSON 格式，便於分析和查詢
- **環境適配**：開發環境美化輸出，生產環境 JSON 格式

### 環境變數設定

```env
# 日誌等級（debug, info, warn, error）
LOG_LEVEL=info

# 開發環境美化輸出（true/false）
LOG_PRETTY=true
```

> **📌 關於檔案日誌**：現代雲原生應用建議使用 Docker/Kubernetes 的日誌收集功能（如 Fluentd, Logstash, CloudWatch），而非直接寫入檔案。

### 日誌等級說明

| 等級 | 用途 | 範例 |
|------|------|------|
| `debug` | 詳細執行流程、資料庫查詢、SDK 訊息 | 開發調試 |
| `info` | 重要業務事件、API 請求、Agent 執行結果 | **生產環境推薦** |
| `warn` | 警告訊息、資源未找到 | 潛在問題 |
| `error` | 錯誤事件、異常處理 | 需要關注的問題 |

### 日誌輸出範例

**開發環境（Pretty 格式）**：
```
[12:34:56.789] INFO (HTTP): Incoming request
  method: "POST"
  path: "/api/query"
  requestId: "req_abc123"

[12:34:56.890] INFO (AgentService): Query started
  workspacePath: "/Users/yuuzu/projects/my-app"
  promptPreview: "分析這個專案的架構..."

[12:34:59.234] INFO (HTTP): Request completed
  method: "POST"
  path: "/api/query"
  statusCode: 200
  duration: 2445
  requestId: "req_abc123"
```

**生產環境（JSON 格式）**：
```json
{"level":"info","time":"2025-11-03T12:34:56.789Z","msg":"Query started","workspacePath":"/Users/yuuzu/projects/my-app","requestId":"req_abc123"}
{"level":"info","time":"2025-11-03T12:34:59.234Z","msg":"Request completed","method":"POST","path":"/api/query","statusCode":200,"duration":2445,"requestId":"req_abc123"}
```

### Request ID 使用

每個 HTTP 請求都會自動產生或使用 `x-request-id` header：

```bash
# 自動產生 Request ID
curl -X POST http://localhost:3000/api/query

# 自訂 Request ID
curl -X POST http://localhost:3000/api/query \
  -H "x-request-id: my-custom-id" \
  -H "Content-Type: application/json"
```

所有與該請求相關的日誌都會包含相同的 `requestId`，方便追蹤和除錯。

## ⚠️ 注意事項

1. **API Key 安全**：不要將 `.env` 檔案提交到版本控制
2. **workspacePath 格式**：在 URL 中需要進行 URL encode
3. **資料庫備份**：定期備份 `data/settings.db` 檔案
4. **權限控制**：預設使用 `permissionMode: "default"`，可透過 API 覆寫

## 📖 相關文件

- [Claude Agent SDK 文檔](https://docs.claude.com/en/api/agent-sdk/overview)
- [Elysia.js 文檔](https://elysiajs.com)
- [Bun SQLite 文檔](https://bun.sh/docs/api/sqlite)

## 📄 授權

MIT License

## 🤝 貢獻

歡迎提交 Issue 和 Pull Request！
