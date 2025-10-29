import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    fs: {
      // Allow serving files that start with dot (needed for .zarray, .zattrs)
      strict: false
    }
  },
  publicDir: 'public',
  assetsInclude: ['**/.zarray', '**/.zattrs', '**/*.0', '**/zarr.json']
})
