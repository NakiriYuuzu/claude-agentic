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
import { createSessionRoutes } from './routes/session.routes'
import { createLoggerConfig, fileLoggerPath } from './config/logger.config'
import { logger } from './utils/logger'
import { randomUUID } from 'crypto'
import { createTestSSERoutes } from './routes/test-sse.routes'
import { SessionQueueService } from './services/session-queue.service'
import { SessionRecorder } from './services/session-recorder'

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
    // Request ID Middleware (在最前面)
    .derive(({ request }) => {
        const requestId = request.headers.get('x-request-id') || randomUUID()
        return { requestId }
    })

    // Logger Middleware
    .use(
        elysiaFileLogger({
            file: fileLoggerPath(),
            autoLogging: {
                ignore: (ctx) => ctx.path === '/api/health' // 忽略健康檢查
            }
        }).derive({ as: "global" }, ({ log, ...rest }) => ({
            fileLogger: log,
            ...rest,
        }))
    )
    .use(
        elysiaLogger({
            ...createLoggerConfig(),
            autoLogging: {
                ignore: (ctx) => ctx.path === '/api/health' // 忽略健康檢查
            }
        })
    )

    // CORS 支援
    .use(cors())

    // 靜態檔案服務
    .use(staticPlugin({
        assets: 'public',
        prefix: '/'
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
    .use(createSessionRoutes(settingsService.getDatabase()))
    .use(createTestSSERoutes())

    // 啟動伺服器
    .listen(PORT)

logger.info(
    {
        event: 'app_start',
        port: PORT,
        hostname: app.server?.hostname,
        env: process.env.NODE_ENV || 'development'
    },
    `🦊 Elysia server is running!\n\n` +
    `🌐 API Server: http://${app.server?.hostname}:${PORT}\n` +
    `📚 Swagger UI: http://${app.server?.hostname}:${PORT}/swagger\n` +
    `📊 Health Check: http://${app.server?.hostname}:${PORT}/api/health\n\n` +
    `Press Ctrl+C to stop`
)

// 優雅關閉
process.on('SIGINT', async () => {
    logger.info({ event: 'app_shutdown', reason: 'SIGINT' }, '\n\n👋 Shutting down gracefully...')

    // Clear cleanup job
    clearInterval(cleanupJob)
    logger.info({ event: 'cleanup_job_cleared' }, '✅ Cleanup job stopped')

    // Flush session queue before closing
    logger.info({ event: 'session_queue_flushing' }, '📝 Flushing session queue...')
    await sessionRecorder.flush()
    logger.info({ event: 'session_queue_flushed' }, '✅ Session queue flushed')

    settingsService.close()
    logger.info({ event: 'db_closed' }, '✅ Database closed')
    process.exit(0)
})

process.on('SIGTERM', async () => {
    logger.info({ event: 'app_shutdown', reason: 'SIGTERM' }, '\n\n👋 Shutting down gracefully...')

    // Clear cleanup job
    clearInterval(cleanupJob)
    logger.info({ event: 'cleanup_job_cleared' }, '✅ Cleanup job stopped')

    // Flush session queue before closing
    logger.info({ event: 'session_queue_flushing' }, '📝 Flushing session queue...')
    await sessionRecorder.flush()
    logger.info({ event: 'session_queue_flushed' }, '✅ Session queue flushed')

    settingsService.close()
    logger.info({ event: 'db_closed' }, '✅ Database closed')
    process.exit(0)
})

// 錯誤處理
process.on('uncaughtException', (error) => {
    logger.error(
        {
            event: 'uncaught_exception',
            error: error.message,
            stack: error.stack
        },
        '❌ Uncaught Exception'
    )
    settingsService.close()
    process.exit(1)
})

process.on('unhandledRejection', (reason, promise) => {
    logger.error(
        {
            event: 'unhandled_rejection',
            reason: String(reason),
            promise: String(promise)
        },
        '❌ Unhandled Rejection'
    )
    settingsService.close()
    process.exit(1)
})
