import { toast } from 'vue-sonner'

/**
 * 代碼複製功能 Composable
 * 提供複製代碼到剪貼簿的功能，並顯示 toast 提示
 */
export function useCodeCopy() {
    /**
     * 複製文字到剪貼簿
     * @param text - 要複製的文字
     */
    const copyToClipboard = async (text: string): Promise<void> => {
        try {
            await navigator.clipboard.writeText(text)
            toast.success('已複製到剪貼簿', {
                duration: 2000
            })
        } catch (error) {
            console.error('複製失敗:', error)
            toast.error('複製失敗', {
                duration: 2000
            })
        }
    }

    /**
     * 處理代碼塊的複製按鈕點擊事件
     * @param event - 點擊事件
     */
    const handleCodeCopy = (event: MouseEvent) => {
        const target = event.target as HTMLElement

        // 檢查是否點擊了複製按鈕或其內部元素
        const button = target.closest('.code-copy-btn') as HTMLElement

        if (button) {
            event.preventDefault()
            event.stopPropagation()

            // 找到父層的 code-block-wrapper，然後找到其中的 code 元素
            const wrapper = button.closest('.code-block-wrapper')
            const code = wrapper?.querySelector('pre code')

            if (code) {
                // 獲取純文字內容（移除 HTML 標籤）
                const text = code.textContent || ''
                copyToClipboard(text)
            } else {
                console.error('無法找到代碼元素')
            }
        }
    }

    return {
        copyToClipboard,
        handleCodeCopy
    }
}
