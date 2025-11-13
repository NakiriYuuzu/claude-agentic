import {createPinia} from 'pinia'
import persist from 'pinia-plugin-persistedstate'

// Stores
export * from './message'
export * from './session'
export * from './settings'
export * from './websocket'
export * from './workspace'

const pinia = createPinia()
pinia.use(persist)

export default pinia
