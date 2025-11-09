/**
 * Elysia Context 擴展型別定義
 * 定義通過 .derive() 添加的自定義屬性
 */

import type { Logger } from 'pino'

/**
 * 擴展的 Elysia Context
 * 包含通過 middleware 注入的屬性
 */
export interface ExtendedContext {
    log: Logger
    fileLogger: Logger
    requestId: string
}

/**
 * WebSocket Context 擴展
 */
export interface WebSocketContext extends ExtendedContext {
    connectionId: string
}
