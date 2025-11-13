/**
 * Main Application
 * Claude Agent SDK + Elysia.js + SQLite API Platform
 */

import { Elysia } from 'elysia'
import { swagger } from '@elysiajs/swagger'
import { cors } from '@elysiajs/cors'
import { staticPlugin } from '@elysiajs/static'
import { logger as elysiaLogger, fileLogger as elysiaFileLogger } from '@bogeychan/elysia-logger'
import { SettingsService } from './services/settings.service'
import { createSettingsRoutes } from './routes/settings.routes'
import { createQueryRoutes } from './routes/query.routes'
import { createWebSocketRoutes } from './routes/websocket.routes'
import { createSessionRoutes } from './routes/session.routes'
import { createLoggerConfig, createFileLoggerConfig, fileLoggerPath } from './config/logger.config'
import { logger } from './utils/logger'
import { randomUUID } from 'crypto'
import { SessionQueueService } from './services/session-queue.service'
import { SessionRecorder } from './services/session-recorder'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

// 計算專案根目錄（從 packages/backend/src/index.ts 往上三層）
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const projectRoot = join(__dirname, '../../..')
const frontendPublicPath = join(projectRoot, 'packages/frontend/public')

// 從環境變數讀取設定
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000
const DATABASE_PATH = process.env.DATABASE_PATH || './data/settings.db'
const SESSION_BATCH_SIZE = process.env.SESSION_BATCH_SIZE ? parseInt(process.env.SESSION_BATCH_SIZE) : 50
const SESSION_FLUSH_INTERVAL = process.env.SESSION_FLUSH_INTERVAL ? parseInt(process.env.SESSION_FLUSH_INTERVAL) : 1000

// 初始化服務
logger.info({ event: 'app_init' }, '📦 Initializing services...')
const settingsService = new SettingsService(DATABASE_PATH)
logger.info({ event: 'db_init', path: DATABASE_PATH }, `✅ Database initialized: ${DATABASE_PATH}`)

// 初始化 Session 記錄服務
const sessionQueueService = new SessionQueueService(
    settingsService.getDatabase().sessionService,
    {
        batchSize: SESSION_BATCH_SIZE,
        flushInterval: SESSION_FLUSH_INTERVAL
    }
)
const sessionRecorder = new SessionRecorder(sessionQueueService)
logger.info({ event: 'session_recorder_init' }, '📝 Session recorder initialized')

// 定期清理超時的 sessions（每小時執行一次）
const CLEANUP_INTERVAL = 60 * 60 * 1000 // 1 小時
const SESSION_TIMEOUT_HOURS = 24 // 24 小時

const cleanupJob = setInterval(() => {
    try {
        const cleaned = settingsService.getDatabase().sessionService.cleanupStuckSessions(SESSION_TIMEOUT_HOURS)
        if (cleaned > 0) {
            logger.info(
                { event: 'session_cleanup', cleaned_count: cleaned },
                `Cleaned up ${cleaned} stuck sessions`
            )
        }
    } catch (error: any) {
        logger.error(
            { event: 'session_cleanup_error', error: error.message },
            'Failed to cleanup sessions'
        )
    }
}, CLEANUP_INTERVAL)

// 建立 Elysia 應用
const app = new Elysia()
    // Logger Middleware (先載入所有 plugins)
    .use(
        elysiaFileLogger({
            ...createFileLoggerConfig(),
            file: fileLoggerPath(),
            autoLogging: {
                ignore: (ctx) => ctx.path === '/api/health' // 忽略健康檢查
            }
        })
    )
    .use(
        elysiaLogger({
            ...createLoggerConfig(),
            autoLogging: {
                ignore: (ctx) => ctx.path === '/api/health' // 忽略健康檢查
            }
        })
    )

    // 統一處理 requestId 和 fileLogger 注入 (在所有 plugins 之後)
    .derive({ as: 'global' }, ({ request, log }) => ({
        requestId: request.headers.get('x-request-id') || randomUUID(),
        fileLogger: log
    }))

    // CORS 支援
    .use(cors())

    // 靜態檔案服務（從 frontend package 提供）
    .use(staticPlugin({
        assets: frontendPublicPath,
        prefix: ''
    }))

    // Swagger UI
    .use(swagger({
        documentation: {
            info: {
                title: 'Claude Agent API',
                version: '1.0.0',
                description: 'Claude Agent SDK + Elysia.js + SQLite API Platform'
            },
            tags: [
                { name: 'Settings', description: '工作空間設定管理' },
                { name: 'Query', description: 'Agent 查詢' },
                { name: 'Sessions', description: 'Session 查詢和管理' },
                { name: 'System', description: '系統功能' }
            ]
        }
    }))

    // 載入路由
    .use(createSettingsRoutes(settingsService.getDatabase()))
    .use(createQueryRoutes(settingsService, sessionRecorder))
    .use(createWebSocketRoutes(settingsService, sessionRecorder))
    .use(createSessionRoutes(settingsService.getDatabase()))

    // 啟動伺服器
    .listen(PORT)

logger.info(
    {
        event: 'app_start',
        port: PORT,
        hostname: app.server?.hostname,
        env: process.env.NODE_ENV || 'development',
        frontendPath: frontendPublicPath
    },
    `🦊 Elysia server is running!\n\n` +
    `🌐 API Server: http://${app.server?.hostname}:${PORT}\n` +
    `📚 Swagger UI: http://${app.server?.hostname}:${PORT}/swagger\n` +
    `🔌 WebSocket: ws://${app.server?.hostname}:${PORT}/api/ws\n` +
    `📊 Health Check: http://${app.server?.hostname}:${PORT}/api/health\n` +
    `📁 Frontend: ${frontendPublicPath}\n\n` +
    `Press Ctrl+C to stop`
)

// 優雅關閉處理函數
async function gracefulShutdown(reason: string) {
    logger.info({ event: 'app_shutdown', reason }, '\n\n👋 Shutting down gracefully...')

    clearInterval(cleanupJob)
    logger.info({ event: 'cleanup_job_cleared' }, '✅ Cleanup job stopped')

    logger.info({ event: 'session_queue_flushing' }, '📝 Flushing session queue...')
    await sessionRecorder.flush()
    logger.info({ event: 'session_queue_flushed' }, '✅ Session queue flushed')

    settingsService.close()
    logger.info({ event: 'db_closed' }, '✅ Database closed')
    process.exit(0)
}

// 錯誤處理函數
function handleError(event: string, error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorStack = error instanceof Error ? error.stack : undefined

    logger.error(
        {
            event,
            error: errorMessage,
            stack: errorStack
        },
        `❌ ${event === 'uncaught_exception' ? 'Uncaught Exception' : 'Unhandled Rejection'}`
    )
    settingsService.close()
    process.exit(1)
}

// 註冊事件處理器
process.on('SIGINT', () => gracefulShutdown('SIGINT'))
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
process.on('uncaughtException', (error) => handleError('uncaught_exception', error))
process.on('unhandledRejection', (reason) => handleError('unhandled_rejection', reason))
