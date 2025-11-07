/**
 * Logger Configuration
 * 配置 Pino logger (Console 輸出，支援 Docker/K8s 日誌收集)
 */

import type { LoggerOptions } from 'pino'
import { pino } from 'pino'
import { existsSync, mkdirSync } from 'fs'
import { dirname, resolve } from 'path'

export const fileLoggerPath = (): string => {
    // Windows 檔案系統不允許檔名中包含 : 字符，所以替換為 -
    const timestamp = new Date().toISOString().replace(/:/g, '-')
    const logFilePath = process.env.LOG_FILE_PATH || `./data/logs/app-${timestamp}.log`

    // 確保日誌目錄存在（跨平台兼容，所有環境都建立）
    const absolutePath = resolve(logFilePath)
    const dirPath = dirname(absolutePath)

    if (!existsSync(dirPath)) {
        mkdirSync(dirPath, { recursive: true })
    }

    return logFilePath
}

/**
 * 建立基礎 Logger 配置（不含 transport）
 * @returns Pino Logger Options
 */
const createBaseLoggerConfig = (): LoggerOptions => {
    const isDev = process.env.NODE_ENV !== 'production'
    const logLevel = process.env.LOG_LEVEL || (isDev ? 'debug' : 'info')

    return {
        level: logLevel,
        // 自訂時間戳格式
        timestamp: () => `,"time":"${new Date().toISOString()}"`,
        // 格式化器
        formatters: {
            level: (label: string) => ({ level: label }),
            bindings: (bindings: any) => ({
                // 移除預設的 pid 和 hostname
                ...bindings,
                pid: undefined,
                hostname: undefined
            })
        }
    }
}

/**
 * 建立 Logger 配置（Console 輸出，開發環境使用 pino-pretty）
 * @returns Pino Logger Options
 */
export const createLoggerConfig = (): LoggerOptions => {
    const isDev = process.env.NODE_ENV !== 'production'
    const usePretty = process.env.LOG_PRETTY === 'true' && isDev
    const baseConfig = createBaseLoggerConfig()

    // 開發環境使用 pino-pretty
    if (usePretty) {
        return {
            ...baseConfig,
            transport: {
                target: 'pino-pretty',
                options: {
                    colorize: true,
                    translateTime: 'HH:MM:ss.l',
                    ignore: 'pid,hostname',
                    singleLine: false
                }
            }
        }
    }

    // 生產環境使用 JSON 格式（預設）
    return baseConfig
}

/**
 * 建立檔案 Logger 配置（不使用 transport，純 JSON 輸出）
 * @returns Pino Logger Options
 */
export const createFileLoggerConfig = (): LoggerOptions => {
    return createBaseLoggerConfig()
}

/**
 * 建立 Logger 實例（Console 輸出）
 * @returns Pino Logger
 *
 * 注意：檔案日誌建議使用 Docker/K8s 的日誌收集功能（如 Fluentd, Logstash）
 */
export const createLogger = () => {
    const config = createLoggerConfig()
    return pino(config)
}
