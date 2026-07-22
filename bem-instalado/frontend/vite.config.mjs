import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const loadedEnv = loadEnv(mode, process.cwd(), '');
  const browserEnv = Object.fromEntries(
    Object.entries(loadedEnv).filter(([key]) => key.startsWith('REACT_APP_'))
  );

  return {
    plugins: [react()],
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
    },
  };
});
