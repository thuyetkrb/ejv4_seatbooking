import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  // Load all env (không cần prefix VITE_ vì bạn đang dùng loadEnv với prefix '')
  const env = loadEnv(mode, '.', '')

  return {
    plugins: [react(), tailwindcss()],

    // âœ… Custom domain cháº¡y á»Ÿ root
    base: '/',

    // âœ… (khuyáº¿n nghá»‹) Inject sang import.meta.env thay vÃ¬ process.env
    define: {
      'import.meta.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY ?? ''),
    },

    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },

    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  }
})
