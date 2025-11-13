/**
 * 權限設定
 * 這邊設定好權限后可以綁定在 Routes 的 meta 中
 * @example:
 * ```ts
 * import {authorize} from '@/routers/authorize.ts'
 * const projectRoute = {
 *     admin: {
 *         name: 'admin',
 *         path: '/admin',
 *         meta: {
 *             title: '系統管理',
 *             roles: authorize.adminAuth, <-- 加在這邊
 *             requiresAuth: true
 *         },
 *         component: () => import('@/Pages/Admin.vue')
 *     } satisfies RouteRecordRaw
 * },
 *
 * ```
 */
export default {
    adminAuth: ['admin'], // example: 只有 admin 可以進入
}
