import type {NavigationGuardNext, RouteLocationNormalized} from 'vue-router'

/**
 * 客制化個人的 router guard
 * @param to
 * @param from
 * @param next
 */
export const routerBeforeGuard = async (to: RouteLocationNormalized, from: RouteLocationNormalized, next: NavigationGuardNext) => {
    // 這邊可以做一些驗證，例如驗證 token 是否存在
    next()
}
