import { toast as sonnerToast } from 'vue-sonner'

/**
 * Toast notification composable
 * 封裝 vue-sonner 提供統一的通知介面
 */
export function useToast() {
  return {
    /**
     * 成功通知
     */
    success: (message: string, description?: string) => {
      sonnerToast.success(message, {
        description,
        duration: 3000
      })
    },

    /**
     * 錯誤通知
     */
    error: (message: string, description?: string) => {
      sonnerToast.error(message, {
        description,
        duration: 5000
      })
    },

    /**
     * 資訊通知
     */
    info: (message: string, description?: string) => {
      sonnerToast.info(message, {
        description,
        duration: 3000
      })
    },

    /**
     * 警告通知
     */
    warning: (message: string, description?: string) => {
      sonnerToast.warning(message, {
        description,
        duration: 4000
      })
    },

    /**
     * Loading 通知
     * 返回 toast ID 用於後續更新
     */
    loading: (message: string, description?: string) => {
      return sonnerToast.loading(message, {
        description
      })
    },

    /**
     * 自定義通知
     */
    custom: (message: string, options?: any) => {
      return sonnerToast(message, options)
    },

    /**
     * 關閉通知
     */
    dismiss: (toastId?: string | number) => {
      sonnerToast.dismiss(toastId)
    }
  }
}
