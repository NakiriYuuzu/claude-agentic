/**
 * Global Logger Instance
 * 提供給 Service 層使用的全域 logger
 */

import { createLogger } from '../config/logger.config'

// 建立全域 logger 實例
export const logger = createLogger()
