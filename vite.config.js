import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [],
  server: {
    port: 3000,
    open: false,
    proxy: {
      '/api': {
        target: 'http://localhost:5001',
        changeOrigin: true
      }
    }
  }
});


