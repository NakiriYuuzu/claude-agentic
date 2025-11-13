/**
 * Date formatting utility functions
 * Provides relative time display and formatting utilities
 */

/**
 * Formats a date string to relative time or formatted date
 * Handles ISO 8601 date strings with flexible timezone support
 *
 * @param dateString - ISO 8601 date string (e.g., "2025-11-11T10:30:00Z" or "2025-11-11 10:30:00")
 * @returns Formatted string:
 *   - "剛剛" for less than 1 minute
 *   - "X 分鐘前" for less than 1 hour
 *   - "X 小時前" for less than 24 hours
 *   - "X 天前" for less than 7 days
 *   - "YYYY/MM/DD HH:mm" for older dates
 *
 * @example
 * formatDate("2025-11-11T10:30:00Z") // "剛剛" or "5 分鐘前"
 * formatDate("2025-11-10T10:30:00Z") // "1 天前"
 * formatDate("2025-11-01T10:30:00Z") // "2025/11/01 10:30"
 */
export function formatDate(dateString: string): string {
    let date: Date

    // Normalize date string: handle both ISO 8601 and space-separated formats
    if (!dateString.endsWith('Z') && !dateString.includes('+')) {
        const normalizedString = dateString.replace(' ', 'T') + 'Z'
        date = new Date(normalizedString)
    } else {
        date = new Date(dateString)
    }

    // Validate date
    if (isNaN(date.getTime())) {
        return 'Invalid date'
    }

    const now = new Date()
    const diffMs = now.getTime() - date.getTime()

    // Handle future dates
    if (diffMs < 0) {
        return 'In the future'
    }

    const MS_PER_MINUTE = 60 * 1000
    const MS_PER_HOUR = 60 * MS_PER_MINUTE
    const MS_PER_DAY = 24 * MS_PER_HOUR
    const MS_PER_WEEK = 7 * MS_PER_DAY

    if (diffMs < MS_PER_MINUTE) {
        return '剛剛'
    }

    if (diffMs < MS_PER_HOUR) {
        const minutes = Math.floor(diffMs / MS_PER_MINUTE)
        return `${minutes} 分鐘前`
    }

    if (diffMs < MS_PER_DAY) {
        const hours = Math.floor(diffMs / MS_PER_HOUR)
        return `${hours} 小時前`
    }

    if (diffMs < MS_PER_WEEK) {
        const days = Math.floor(diffMs / MS_PER_DAY)
        return `${days} 天前`
    }

    // Format as YYYY/MM/DD HH:mm for older dates
    return formatDateTime(dateString).split(' ')[0] === 'Invalid' ? 'Invalid date' : formatDateTime(dateString).substring(0, 16)
}

/**
 * Formats a date string to standard datetime format
 * Returns date in "YYYY/MM/DD HH:mm:ss" format in Asia/Taipei timezone
 *
 * @param dateString - ISO 8601 date string (e.g., "2025-11-11T10:30:00Z")
 * @returns Formatted string in pattern "YYYY/MM/DD HH:mm:ss"
 *
 * @example
 * formatDateTime("2025-11-11T10:30:45Z") // "2025/11/11 18:30:45"
 */
export function formatDateTime(dateString: string): string {
    let date: Date

    // Normalize date string
    if (!dateString.endsWith('Z') && !dateString.includes('+')) {
        const normalizedString = dateString.replace(' ', 'T') + 'Z'
        date = new Date(normalizedString)
    } else {
        date = new Date(dateString)
    }

    // Validate date
    if (isNaN(date.getTime())) {
        return 'Invalid date'
    }

    // Format using locale string with Taiwan timezone
    const formatter = new Intl.DateTimeFormat('zh-TW', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZone: 'Asia/Taipei',
        hour12: false
    })

    // Get formatted parts
    const parts = formatter.formatToParts(date)
    const dateObj: Record<string, string> = {}

    for (const part of parts) {
        if (part.type !== 'literal') {
            dateObj[part.type] = part.value
        }
    }

    // Construct YYYY/MM/DD HH:mm:ss format
    const year = dateObj['year'] || '0000'
    const month = dateObj['month'] || '00'
    const day = dateObj['day'] || '00'
    const hour = dateObj['hour'] || '00'
    const minute = dateObj['minute'] || '00'
    const second = dateObj['second'] || '00'

    return `${year}/${month}/${day} ${hour}:${minute}:${second}`
}

/**
 * Formats milliseconds to human-readable duration string
 * Automatically selects appropriate unit based on magnitude
 *
 * @param ms - Duration in milliseconds
 * @returns Formatted string:
 *   - "XYZ ms" for less than 1000ms (e.g., "500 ms")
 *   - "X.Y s" for less than 60 seconds (e.g., "5.3 s")
 *   - "X min Y s" for less than 60 minutes (e.g., "2 min 30 s")
 *   - "X h Y min" for 60 minutes or more (e.g., "1 h 30 min")
 *
 * @example
 * formatDuration(500) // "500 ms"
 * formatDuration(1500) // "1.5 s"
 * formatDuration(65000) // "1 min 5 s"
 * formatDuration(3665000) // "1 h 1 min"
 */
export function formatDuration(ms: number): string {
    // Validate input
    if (typeof ms !== 'number' || ms < 0) {
        return '0 ms'
    }

    const MS_PER_SECOND = 1000
    const SECONDS_PER_MINUTE = 60
    const MINUTES_PER_HOUR = 60

    // Less than 1 second
    if (ms < MS_PER_SECOND) {
        return `${Math.round(ms)} ms`
    }

    const totalSeconds = ms / MS_PER_SECOND

    // Less than 1 minute
    if (totalSeconds < SECONDS_PER_MINUTE) {
        // Round to 1 decimal place
        const rounded = Math.round(totalSeconds * 10) / 10
        return `${rounded} s`
    }

    const totalMinutes = totalSeconds / SECONDS_PER_MINUTE

    // Less than 1 hour
    if (totalMinutes < MINUTES_PER_HOUR) {
        const minutes = Math.floor(totalMinutes)
        const seconds = Math.round((totalMinutes - minutes) * SECONDS_PER_MINUTE)
        return `${minutes} min ${seconds} s`
    }

    // 1 hour or more
    const hours = Math.floor(totalMinutes / MINUTES_PER_HOUR)
    const remainingMinutes = Math.round(totalMinutes % MINUTES_PER_HOUR)
    return `${hours} h ${remainingMinutes} min`
}

/**
 * Formats a date string to time-only format
 * Returns time in "HH:mm:ss" format
 *
 * @param dateString - ISO 8601 date string
 * @returns Formatted time string in pattern "HH:mm:ss"
 *
 * @example
 * formatTime("2025-11-11T10:30:45Z") // "18:30:45"
 */
export function formatTime(dateString: string): string {
    let date: Date

    // Normalize date string
    if (!dateString.endsWith('Z') && !dateString.includes('+')) {
        const normalizedString = dateString.replace(' ', 'T') + 'Z'
        date = new Date(normalizedString)
    } else {
        date = new Date(dateString)
    }

    // Validate date
    if (isNaN(date.getTime())) {
        return 'Invalid date'
    }

    // Format using locale string
    const formatter = new Intl.DateTimeFormat('zh-TW', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZone: 'Asia/Taipei',
        hour12: false
    })

    // Get formatted parts
    const parts = formatter.formatToParts(date)
    const timeObj: Record<string, string> = {}

    for (const part of parts) {
        if (part.type !== 'literal') {
            timeObj[part.type] = part.value
        }
    }

    // Construct HH:mm:ss format
    const hour = timeObj['hour'] || '00'
    const minute = timeObj['minute'] || '00'
    const second = timeObj['second'] || '00'

    return `${hour}:${minute}:${second}`
}

/**
 * Formats a date string to date-only format
 * Returns date in "YYYY/MM/DD" format
 *
 * @param dateString - ISO 8601 date string
 * @returns Formatted date string in pattern "YYYY/MM/DD"
 *
 * @example
 * formatDateOnly("2025-11-11T10:30:45Z") // "2025/11/11"
 */
export function formatDateOnly(dateString: string): string {
    let date: Date

    // Normalize date string
    if (!dateString.endsWith('Z') && !dateString.includes('+')) {
        const normalizedString = dateString.replace(' ', 'T') + 'Z'
        date = new Date(normalizedString)
    } else {
        date = new Date(dateString)
    }

    // Validate date
    if (isNaN(date.getTime())) {
        return 'Invalid date'
    }

    // Format using locale string
    const formatter = new Intl.DateTimeFormat('zh-TW', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        timeZone: 'Asia/Taipei'
    })

    // Get formatted parts
    const parts = formatter.formatToParts(date)
    const dateObj: Record<string, string> = {}

    for (const part of parts) {
        if (part.type !== 'literal') {
            dateObj[part.type] = part.value
        }
    }

    // Construct YYYY/MM/DD format
    const year = dateObj['year'] || '0000'
    const month = dateObj['month'] || '00'
    const day = dateObj['day'] || '00'

    return `${year}/${month}/${day}`
}

/**
 * Checks if a date string is valid ISO 8601 format
 *
 * @param dateString - String to validate
 * @returns true if valid ISO 8601 format, false otherwise
 *
 * @example
 * isValidDate("2025-11-11T10:30:00Z") // true
 * isValidDate("invalid") // false
 */
export function isValidDate(dateString: string): boolean {
    if (typeof dateString !== 'string') {
        return false
    }

    let date: Date

    // Normalize date string
    if (!dateString.endsWith('Z') && !dateString.includes('+')) {
        const normalizedString = dateString.replace(' ', 'T') + 'Z'
        date = new Date(normalizedString)
    } else {
        date = new Date(dateString)
    }

    return !isNaN(date.getTime())
}
