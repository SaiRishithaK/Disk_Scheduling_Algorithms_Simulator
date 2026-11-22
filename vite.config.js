import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  base: '/Disk_Scheduling_Algorithms_Simulator/',
  plugins: [react(), tailwindcss()],
})
