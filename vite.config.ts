import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: './', // use relative asset paths so GitHub Pages works from a subdirectory
  plugins: [react()],
})
