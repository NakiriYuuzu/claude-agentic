# Frontend Package

**Vue.js 3 Single Page Application (SPA)**

## 概述

這是一個輕量級的前端應用，使用 Vue.js 3 Composition API 構建。所有依賴通過 CDN 加載，無需 npm 依賴。

## 技術棧

- **Vue.js 3** - 從 unpkg.com CDN 加載
- **Tailwind CSS** - 從 CDN 加載
- **VueUse** - Vue Composition API 工具庫

## 目錄結構

```
public/
├── index.html           # 主 HTML 文件
├── app.js              # Vue 應用主入口
├── styles.css          # Tailwind CSS 配置
└── composables/        # Vue Composition API
    ├── useWebSocket.js # WebSocket 連接管理
    ├── useMessages.js  # 消息狀態管理
    ├── useSessions.js  # Session API 調用
    └── useTools.js     # 工具解析和擴展
```

## 開發方式

前端由 Backend 的 Elysia.js 靜態服務提供：

```typescript
// packages/backend/src/index.ts
import { staticPlugin } from '@elysiajs/static'

app.use(staticPlugin({
    assets: '../frontend/public',
    prefix: '/'
}))
```

### 本地開發

1. 啟動 Backend 開發伺服器（會自動服務前端）：
   ```bash
   bun run dev
   ```

2. 打開瀏覽器訪問：
   ```
   http://localhost:3000
   ```

### 修改前端代碼

所有前端檔案都是純 JavaScript/HTML/CSS，修改後刷新瀏覽器即可看到效果。

## 主要功能

### 1. WebSocket 實時通信

使用 `useWebSocket.js` composable 管理 WebSocket 連接：

```javascript
const {
    isConnected,
    sendQuery,
    disconnect
} = useWebSocket(workspacePath)
```

### 2. 消息管理

使用 `useMessages.js` 管理 Agent 回應消息：

```javascript
const {
    messages,
    addMessage,
    clearMessages
} = useMessages()
```

### 3. Session 管理

使用 `useSessions.js` 進行 Session API 調用：

```javascript
const {
    sessions,
    fetchSessions,
    deleteSession
} = useSessions()
```

## 未來改進方向

### 選項 1：轉為 npm 依賴（推薦）

**優勢**：
- 更好的版本控制
- TypeScript 支持
- 更好的開發體驗（IDE 自動完成）
- 可使用構建工具優化

**步驟**：
```bash
cd packages/frontend
bun add vue@3 @vueuse/core
bun add -d vite @vitejs/plugin-vue typescript
```

### 選項 2：保持 CDN（現狀）

**優勢**：
- 極簡設置
- 零構建時間
- 適合快速原型開發

## API 端點

前端會調用以下 Backend API：

- `GET /api/health` - 健康檢查
- `POST /api/workspaces` - 創建工作空間
- `GET /api/workspaces/:path` - 獲取設定
- `GET /api/sessions` - 列表 Sessions
- `GET /api/sessions/:id` - Session 詳情
- `WS /api/ws` - WebSocket 實時串流

## 注意事項

1. **CORS 設定**：Backend 已配置 CORS，允許跨域請求
2. **WebSocket 連接**：確保 Backend 運行在 `http://localhost:3000`
3. **環境變數**：如需配置 API URL，可在 `app.js` 中修改

## 授權

與主專案相同
