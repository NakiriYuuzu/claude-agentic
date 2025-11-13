# Changelog

所有值得注意的專案變更都在此檔案中記錄。

此專案遵循 [Semantic Versioning](https://semver.org/lang/zh_TW/) 規範。

---

## [0.5.1] - 2025-11-10

### ✨ 重大功能：完成前端 Vue 3 現代化遷移

**將 old-web 的所有功能遷移到 frontend (Vue 3 + TypeScript + shadcn-vue)**

#### 📦 新增 Shared Package 類型定義
- `frontend.types.ts`: DisplayMessage, ToolExecution, QueryResult, WSMessage
- `tool-parser.ts`: 工具解析工具函數（parseToolBlocks, extractTextContent）
- `toolIcons.ts`: 工具圖示映射（支援 10+ 工具類型）
- `dateUtils.ts`: 日期格式化工具（相對時間、標準格式、時長轉換）

#### 🎨 完善 UI 組件
- **ChatToolPanel.vue**: 工具結果詳細展示、JSON 格式化、工具圖示整合
- **WorkspaceEditDialog.vue**: 新增工作空間編輯對話框（完整 CRUD 功能）
- **SessionStatsDialog.vue**: 補完統計資訊展示（8 個統計卡片 + Top 10 工具使用率）
- **ChatSidebar.vue**: 連接 session 載入功能，點擊歷史記錄恢復對話

#### 🔧 完善 Pinia Stores
- **session.ts**: 實現 `loadMessages()` 方法，支援歷史訊息載入與轉換
- **message.ts**: 訊息合併邏輯、工具解析整合
- **websocket.ts**: 完整 WebSocket 連接管理
- **workspace.ts**: CRUD 操作、資料夾選擇
- **settings.ts**: Dark Mode、查詢參數管理

#### 📡 API 服務層
- **api.ts**: 統一的 API 客戶端（WebSocketService + ApiService）
- **websocket.service.ts**: WebSocket 連接管理、自動重連機制

#### 🐛 修復
- 修復 `@workspace/shared` 依賴問題，添加到 frontend package.json
- 修復類型導入錯誤

#### 📝 技術細節
- 完全使用 TypeScript + Vue 3 Composition API
- 整合 shadcn-vue UI 組件庫（shadcn 現代化風格）
- 四個空格縮排、不使用 semicolon
- 所有組件支援 Dark Mode
- 完整的類型定義和錯誤處理

#### 🗂️ 檔案結構
```
packages/frontend/
├── src/
│   ├── components/       # 13 個 Vue 組件
│   ├── lib/             # 工具函數（toolIcons, dateUtils）
│   ├── services/        # API 服務層
│   ├── stores/          # 5 個 Pinia stores
│   └── types/           # TypeScript 類型定義
└── package.json         # 新增 @workspace/shared 依賴
```

#### 🚀 下一步
- 完成功能測試
- 刪除 packages/old-web
- 代碼格式化與優化

---

## [0.5.0] - 2025-11-09

### 🏗️ 重大架構變更：Monorepo 重構

**本版本將專案重構為 Bun Workspace Monorepo 架構**

#### 📦 新的 Package 結構

專案現在分為三個獨立的 packages：

1. **@workspace/shared** - 共享程式碼
   - TypeScript 型別定義（types/）
   - TypeBox 驗證 Schema（schemas/）
   - 編譯為獨立的 npm package

2. **@workspace/backend** - 後端服務
   - Elysia.js API 服務
   - Claude Agent SDK 整合
   - SQLite 資料庫管理
   - 依賴 @workspace/shared

3. **@workspace/frontend** - 前端應用
   - Vue.js 3 SPA
   - CDN 依賴（無 npm 依賴）
   - 由 backend 靜態服務提供

#### 🔧 技術變更

**構建系統**：
- 新增 Bun workspace 配置（`bunfig.toml`）
- 更新根目錄 `package.json` 支援 workspaces
- 各 package 獨立的 `tsconfig.json`
- 新增構建腳本：`build:shared`、`build:backend`

**Import 路徑**：
- 統一使用 `@workspace/shared` 引入共享型別
- 從 `import { Type } from 'elysia'` 改為 `import { Type as t } from '@sinclair/typebox'`
- 移除 shared 對 backend 框架的依賴

**靜態檔案**：
- 前端檔案遷移至 `packages/frontend/public/`
- Backend 靜態服務路徑更新為 `../frontend/public`

#### 📁 目錄結構變更

```
之前：
claude-agentic/
├── src/                 # 所有後端程式碼
├── public/              # 前端程式碼
└── data/                # 資料目錄

之後：
claude-agentic/
├── packages/
│   ├── shared/          # 共享程式碼（新增）
│   ├── backend/         # 後端（從 src/ 遷移）
│   └── frontend/        # 前端（從 public/ 遷移）
├── data/                # 資料目錄（保持根目錄）
└── .claude/             # SDK 資料（保持根目錄）
```

#### ✨ 優勢

- **更清晰的關注點分離**：前後端和共享程式碼完全獨立
- **可重用性**：shared package 可被其他專案引用
- **更好的型別安全**：TypeScript 跨 package 引用
- **獨立版本管理**：各 package 可獨立發布（未來）
- **並行開發**：團隊可同時開發不同 packages

#### 🔄 向後相容性

- **API 端點**：完全相容，無變更
- **環境變數**：完全相容，無變更
- **資料庫**：完全相容，位置不變（根目錄 `data/`）
- **SDK 資料**：完全相容，位置不變（根目錄 `.claude/`）

#### 📝 修改的檔案

**根目錄配置**：
- `package.json` - 改為 workspace 配置
- `bunfig.toml` - 新增 Bun workspace 配置
- `tsconfig.json` - 更新 paths 映射

**Backend 服務**：
- 所有 `src/` 檔案遷移至 `packages/backend/src/`
- Import 路徑更新（7+ 檔案）
- 靜態檔案路徑更新

**Shared Package**：
- `src/types/` → `packages/shared/src/types/`
- `src/schemas/` → `packages/shared/src/schemas/`
- Schema 從 Elysia 改為純 TypeBox

**Frontend**：
- `public/` → `packages/frontend/public/`
- 新增 `packages/frontend/README.md`

#### 📚 文件更新

- `README.md` - 新增 Monorepo 架構說明
- `packages/frontend/README.md` - 新增前端文件
- `CHANGELOG.md` - 本版本變更記錄

#### ⚠️ 已知問題

- TypeScript 型別錯誤需要修復（下個版本）
- 測試需要更新路徑

#### 🚀 遷移指南

**從 0.4.x 升級到 0.5.0**：

1. 拉取最新程式碼
2. 重新安裝依賴：`bun install`
3. 構建 packages：`bun run build`
4. 啟動服務：`bun run dev`

**注意**：如果你有自定義修改，請查看新的目錄結構並相應調整。

---

## [0.2.1] - 2025-11-03

### 🔧 重構

- **簡化 Resume 功能，使用 SDK 原生 API**
  - 移除手動載入 session 訊息邏輯（120 行程式碼）
  - 直接使用 Claude Agent SDK 的 `resume` 和 `continue` 選項
  - `AgentService` 不再依賴 `DatabaseService`，降低耦合
  - 簡化 `executeQuery` 方法，提升程式碼可讀性

### ✨ 改進

- **更穩定可靠**：使用官方 API 而非自行實作
- **程式碼簡潔**：減少維護負擔
- **支援進階功能**：如 `forkSession` 等 SDK 功能
- **向後相容**：API 介面保持不變

### 🏗️ 架構說明

實作雙軌 Session 架構：
- **SDK Sessions**：用於 resume 功能（SDK 管理）
- **Database Sessions**：用於記錄和統計（SQLite 儲存）
- 兩個系統共用 `session_id`，確保一致性

### 📝 修改檔案

- `src/services/agent.service.ts` - 移除 `loadSessionMessages` 方法
- `src/routes/query.routes.ts` - 移除 `DatabaseService` 傳遞
- `README.md` - 更新 Resume 說明和系統架構文件

---

## [0.2.0] - 2025-11-03

### 🚀 新增功能

- **Session 管理系統**
  - 完整的 Session 記錄與追蹤
  - 非同步批次寫入，不影響 SSE 效能
  - SQLite 持久化儲存

- **Resume 對話功能**
  - 支援恢復先前的對話上下文
  - 完整的訊息歷史記錄
  - 一鍵繼續進行中的對話

- **Session API 端點**
  - 查詢對話記錄
  - 檢視 Session 統計資訊
  - 列出所有 Session

### ✨ 新增服務

- `SessionService` - 核心 Session 管理邏輯（603 行）
- `SessionRecorder` - Session 訊息記錄器（214 行）
- `SessionQueueService` - 非同步批次寫入佇列（265 行）

### 📚 新增路由

- `src/routes/session.routes.ts` - Session 管理 API（394 行）

### 📋 新增資料結構

- `src/schemas/session.schema.ts` - Session 驗證 schema（191 行）
- `src/types/session.types.ts` - Session 型別定義（177 行）
- `src/types/query.types.ts` - Query 型別定義（26 行）

### 🔨 改進

- 擴展 `AgentService` 以支援 Session 記錄（159 行）
- 增強 `DatabaseService` 的 Session 支援（12 行）
- 新增 `.env.sample` 配置範本

### 📖 文件

- 大幅更新 `README.md`（166 行新增內容）
  - Session 管理說明
  - Resume 功能使用指南
  - 系統架構詳解

---

## [0.0.1] - 2025-10-30

### 🎉 初始版本

- Claude Agent SDK 整合
- Elysia.js API 框架
- SQLite 資料庫支援
- 日誌記錄功能
- CORS 支援
- Swagger 文件支援
- 靜態檔案服務
- HTML 響應支援

### 📦 技術棧

- **Runtime**: Bun
- **框架**: Elysia.js
- **AI**: Anthropic Claude Agent SDK
- **資料庫**: SQLite
- **日誌**: Pino
- **文件**: Swagger

---

## 說明

### 版本管理

本專案採用語義化版本：
- **主版本號**：不相容的 API 變更
- **次版本號**：向後相容的功能新增
- **修訂版本號**：向後相容的問題修正
- **預發版本**：以 `-alpha`、`-beta` 等標記

### 貢獻

歡迎提交 Issue 和 Pull Request！

### 授權

詳見 LICENSE 檔案
