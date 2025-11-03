/**
 * Logger Configuration
 * 配置 Pino logger (Console 輸出，支援 Docker/K8s 日誌收集)
 */

import type { LoggerOptions } from 'pino'
import { pino } from 'pino'
import { existsSync, mkdirSync } from 'fs'
import { dirname, resolve } from 'path'

export const fileLoggerPath = (): string => {
    const isDev = process.env.NODE_ENV !== 'production'
    const logFilePath = process.env.LOG_FILE_PATH || `./data/logs/app-${new Date().toISOString()}.log`

    if (isDev) {
        // 解析並取得目錄路徑
        const absolutePath = resolve(logFilePath)
        const dirPath = dirname(absolutePath)

        // 檢查目錄是否存在，不存在則建立
        if (!existsSync(dirPath)) {
            mkdirSync(dirPath, { recursive: true })
        }
    }

    return logFilePath
}

/**
 * 建立 Logger 配置
 * @returns Pino Logger Options
 */
export const createLoggerConfig = (): LoggerOptions => {
    const isDev = process.env.NODE_ENV !== 'production'
    const logLevel = process.env.LOG_LEVEL || (isDev ? 'debug' : 'info')
    const usePretty = process.env.LOG_PRETTY === 'true' && isDev

    // 基礎配置
    const baseConfig: LoggerOptions = {
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
 * 建立 Logger 實例（Console 輸出）
 * @returns Pino Logger
 *
 * 注意：檔案日誌建議使用 Docker/K8s 的日誌收集功能（如 Fluentd, Logstash）
 */
export const createLogger = () => {
    const config = createLoggerConfig()
    return pino(config)
}
