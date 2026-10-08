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
        // Match the CSS/browser requirements of Tailwind 4, including WebViews.
        targets: ['Chrome >= 111', 'ChromeAndroid >= 111', 'Safari >= 16.4', 'iOS >= 16.4', 'Firefox >= 128'],
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
