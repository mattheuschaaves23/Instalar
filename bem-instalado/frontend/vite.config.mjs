import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import legacy from '@vitejs/plugin-legacy';

export default defineConfig(({ mode }) => {
  const loadedEnv = loadEnv(mode, process.cwd(), '');
  const browserEnv = Object.fromEntries(
    Object.entries(loadedEnv).filter(([key]) => key.startsWith('REACT_APP_'))
  );

  return {
    plugins: [
      react(),
      legacy({
        targets: ['Chrome >= 60', 'ChromeAndroid >= 60', 'Safari >= 11.1', 'iOS >= 11.3'],
      }),
    ],
    define: {
      'process.env': JSON.stringify({
        ...browserEnv,
        NODE_ENV: mode === 'production' ? 'production' : 'development',
      }),
    },
    build: {
      outDir: 'build',
      emptyOutDir: true,
      manifest: true,
      sourcemap: false,
      chunkSizeWarningLimit: 750,
    },
  };
});
