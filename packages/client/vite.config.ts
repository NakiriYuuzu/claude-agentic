import { defineConfig, loadEnv } from 'vite'
import path from 'path'
import { fileURLToPath } from 'url'
import vue from '@vitejs/plugin-vue'
import mkcert from 'vite-plugin-mkcert'
import vueDevTools from 'vite-plugin-vue-devtools'
import tailwindcss from '@tailwindcss/vite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig(({mode}) =>{
	const env = loadEnv(mode, process.cwd())
    console.log(env)
	return {
		base: env.VITE_APP_ROUTER_BASE || '/',
		plugins: [
			vue(),
            // mkcert(),
            vueDevTools(),
            tailwindcss()
		],
		resolve: {
			alias: {
                '@': path.resolve(__dirname, './src'),
            }
		},
		server: {
			port: 5173,
			proxy: {
				'/api': {
					target: 'http://localhost:3000',
					changeOrigin: true,
					ws: true,  // 支援 WebSocket
					configure: (proxy, _options) => {
						proxy.on('error', (err, _req, _res) => {
							console.log('proxy error', err);
						});
						proxy.on('proxyReq', (proxyReq, req, _res) => {
							console.log('Sending Request to the Target:', req.method, req.url);
						});
						proxy.on('proxyRes', (proxyRes, req, _res) => {
							console.log('Received Response from the Target:', proxyRes.statusCode, req.url);
						});
					},
				}
			}
		},
		build: {
			manifest: false,
			outDir: `./dist/${mode}`,
		}
	}
})
