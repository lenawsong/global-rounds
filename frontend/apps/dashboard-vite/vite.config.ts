import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
        '@gr/api': path.resolve(__dirname, '../../packages/api/src'),
        '@gr/charts': path.resolve(__dirname, '../../packages/charts/src')
      }
    },
    define: {
      __API_BASE__: JSON.stringify(env.VITE_API_BASE || 'http://localhost:8001')
    },
    server: {
      port: 3001,
      open: true
    }
  };
});
