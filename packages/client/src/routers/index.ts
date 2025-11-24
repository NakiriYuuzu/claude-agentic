import {createRouter, createWebHistory} from 'vue-router'
import routerRoutes from '@/routers/routes'
import {routerBeforeGuard} from '@/routers/guard.ts'

/**
 * 定義初始化路由
 */
const router = createRouter({
    history: createWebHistory(import.meta.env.VITE_APP_ROUTER_BASE),
    routes: routerRoutes,
    scrollBehavior(_, __, savedPosition) { // to, from
        return savedPosition || {top: 0}
    }
})

/**
 * 路由守卫 - onMounted前
 * 在路由跳轉前，會先執行，所以這邊可以做一些驗證
 */
router.beforeEach(async (to, from, next) => {
    await routerBeforeGuard(to, from, next)
})

/**
 * 路由守卫 - onMounted后
 * 在路由跳轉後，執行onMounted的時候會執行
 */
router.afterEach((to, from) => {
    document.title = `${to.meta.title} ${import.meta.env.VITE_APP_TITLE ? "| " + import.meta.env.VITE_APP_TITLE : ''}`
})

/**
 * typescript 的模塊擴展
 */
declare module 'vue-router' {
    /**
     * 因爲原先是直接取是不會顯示 Route 的 Meta，在這邊設定后就會顯示
     */
    interface RouteMeta {
        title: string,
        roles: string[],
        requiresAuth: boolean
    }

    /**
     * 定義路由的 `params` 類型，請必須用 `非必填`
     * @example
     * ```ts
     * const params = route.params as RouteParam // 可以這樣用 params.id
     * const { id: projectId } = route.params as RouteParam // 這是型別轉換
     * const { id } = route.params satisfies RouteParam // 這是滿足的類型
     * ```
     */
    interface RouteParam {
        id?: string
    }
}

export default router
