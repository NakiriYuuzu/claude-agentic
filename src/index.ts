/**
 * Main Application
 * Claude Agent SDK + Elysia.js + SQLite API Platform
 */

import { Elysia } from 'elysia'
import { swagger } from '@elysiajs/swagger'
import { cors } from '@elysiajs/cors'
import { logger as elysiaLogger, fileLogger as elysiaFileLogger } from '@bogeychan/elysia-logger'
import { SettingsService } from './services/settings.service'
import { createSettingsRoutes } from './routes/settings.routes'
import { createQueryRoutes } from './routes/query.routes'
import { createLoggerConfig, fileLoggerPath } from './config/logger.config'
import { logger } from './utils/logger'
import { randomUUID } from 'crypto'
import { createTestSSERoutes } from './routes/test-sse.routes'

// 從環境變數讀取設定
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000
const DATABASE_PATH = process.env.DATABASE_PATH || './data/settings.db'

// 初始化服務
logger.info({ event: 'app_init' }, '📦 Initializing services...')
const settingsService = new SettingsService(DATABASE_PATH)
logger.info({ event: 'db_init', path: DATABASE_PATH }, `✅ Database initialized: ${DATABASE_PATH}`)

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
                { name: 'System', description: '系統功能' }
            ]
        }
    }))

    // 載入路由
    .use(createSettingsRoutes(settingsService.getDatabase()))
    .use(createQueryRoutes(settingsService))
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
process.on('SIGINT', () => {
    logger.info({ event: 'app_shutdown', reason: 'SIGINT' }, '\n\n👋 Shutting down gracefully...')
    settingsService.close()
    logger.info({ event: 'db_closed' }, '✅ Database closed')
    process.exit(0)
})

process.on('SIGTERM', () => {
    logger.info({ event: 'app_shutdown', reason: 'SIGTERM' }, '\n\n👋 Shutting down gracefully...')
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
