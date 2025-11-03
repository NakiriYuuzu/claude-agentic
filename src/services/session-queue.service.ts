import type { QueueItem, SDKMessage, CreateSessionData, SessionResult } from '../types/session.types'
import type { SessionService } from './session.service'
import { logger } from '../utils/logger'

/**
 * Session 非同步佇列服務
 * 使用記憶體佇列批次處理資料庫寫入，避免影響 SSE 串流效能
 */
export class SessionQueueService {
    private queue: QueueItem[] = []
    private processing = false
    private batchSize: number
    private flushInterval: number
    private flushTimer: Timer | null = null

    constructor(
        private sessionService: SessionService,
        options: {
            batchSize?: number
            flushInterval?: number
        } = {}
    ) {
        this.batchSize = options.batchSize || 50
        this.flushInterval = options.flushInterval || 1000 // 1 秒

        logger.info(
            {
                event: 'queue_initialized',
                batchSize: this.batchSize,
                flushInterval: this.flushInterval
            },
            'SessionQueueService initialized'
        )
    }

    /**
     * 將項目加入佇列
     */
    enqueue(item: QueueItem): void {
        this.queue.push(item)

        logger.debug(
            {
                event: 'queue_enqueue',
                type: item.type,
                queue_size: this.queue.length
            },
            'Item enqueued'
        )

        // 如果佇列達到批次大小，立即處理
        if (this.queue.length >= this.batchSize) {
            this.processQueue()
        } else if (!this.flushTimer) {
            // 設定定時器在指定時間後處理佇列
            this.flushTimer = setTimeout(() => {
                this.processQueue()
            }, this.flushInterval)
        }
    }

    /**
     * 加入建立 Session 項目
     */
    enqueueCreateSession(data: CreateSessionData): void {
        this.enqueue({
            type: 'session',
            data,
            timestamp: Date.now()
        })
    }

    /**
     * 加入更新狀態項目
     */
    enqueueUpdateStatus(sessionId: string, status: string): void {
        this.enqueue({
            type: 'update_status',
            data: { sessionId, status },
            timestamp: Date.now()
        })
    }

    /**
     * 加入更新結果項目
     */
    enqueueUpdateResult(sessionId: string, result: SessionResult): void {
        this.enqueue({
            type: 'update_result',
            data: { sessionId, result },
            timestamp: Date.now()
        })
    }

    /**
     * 加入新增訊息項目
     */
    enqueueAddMessage(sessionId: string, message: SDKMessage): void {
        this.enqueue({
            type: 'message',
            data: { sessionId, message },
            timestamp: Date.now()
        })
    }

    /**
     * 處理佇列中的所有項目
     */
    private async processQueue(): Promise<void> {
        // 清除定時器
        if (this.flushTimer) {
            clearTimeout(this.flushTimer)
            this.flushTimer = null
        }

        if (this.processing || this.queue.length === 0) {
            return
        }

        this.processing = true

        // 取出當前佇列中的所有項目
        const batch = this.queue.splice(0, this.queue.length)

        logger.debug(
            {
                event: 'queue_process_start',
                batch_size: batch.length
            },
            'Processing queue batch'
        )

        const startTime = Date.now()

        try {
            await this.processBatch(batch)

            const duration = Date.now() - startTime

            logger.debug(
                {
                    event: 'queue_process_complete',
                    batch_size: batch.length,
                    duration_ms: duration
                },
                'Queue batch processed'
            )
        } catch (error: any) {
            logger.error(
                {
                    event: 'queue_process_error',
                    batch_size: batch.length,
                    error: error.message
                },
                'Failed to process queue batch'
            )

            // 處理失敗的項目可以選擇重新加入佇列或丟棄
            // 這裡選擇記錄錯誤後丟棄
        } finally {
            this.processing = false

            // 如果還有項目在佇列中，繼續處理
            if (this.queue.length > 0) {
                this.processQueue()
            }
        }
    }

    /**
     * 批次處理項目
     */
    private async processBatch(batch: QueueItem[]): Promise<void> {
        for (const item of batch) {
            try {
                switch (item.type) {
                    case 'session':
                        this.sessionService.createSession(item.data as CreateSessionData)
                        break

                    case 'update_status':
                        this.sessionService.updateSessionStatus(
                            item.data.sessionId,
                            item.data.status
                        )
                        break

                    case 'update_result':
                        this.sessionService.updateSessionResult(
                            item.data.sessionId,
                            item.data.result
                        )
                        break

                    case 'message':
                        this.sessionService.addMessage(item.data.sessionId, item.data.message)
                        break

                    default:
                        logger.warn(
                            {
                                event: 'queue_unknown_type',
                                type: (item as any).type
                            },
                            'Unknown queue item type'
                        )
                }
            } catch (error: any) {
                logger.error(
                    {
                        event: 'queue_item_error',
                        type: item.type,
                        error: error.message
                    },
                    'Failed to process queue item'
                )
                // 繼續處理下一個項目
            }
        }
    }

    /**
     * 強制處理佇列中的所有項目（用於優雅關閉）
     */
    async flush(): Promise<void> {
        logger.info(
            {
                event: 'queue_flush_start',
                queue_size: this.queue.length
            },
            'Flushing queue'
        )

        // 清除定時器
        if (this.flushTimer) {
            clearTimeout(this.flushTimer)
            this.flushTimer = null
        }

        // 等待當前批次處理完成
        while (this.processing) {
            await new Promise((resolve) => setTimeout(resolve, 100))
        }

        // 處理剩餘的所有項目
        if (this.queue.length > 0) {
            await this.processQueue()
        }

        logger.info({ event: 'queue_flush_complete' }, 'Queue flushed')
    }

    /**
     * 取得佇列狀態
     */
    getStatus(): {
        queueSize: number
        processing: boolean
    } {
        return {
            queueSize: this.queue.length,
            processing: this.processing
        }
    }
}
