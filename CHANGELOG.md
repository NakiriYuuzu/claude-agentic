# Changelog

所有值得注意的專案變更都在此檔案中記錄。

此專案遵循 [Semantic Versioning](https://semver.org/lang/zh_TW/) 規範。

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
