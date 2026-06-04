import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const missingClientEnv = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY']
    .filter((key) => !env[key]?.trim());

  if (missingClientEnv.length > 0) {
    throw new Error(
      `Missing required Vite environment variable(s): ${missingClientEnv.join(', ')}. ` +
      'Set them in Vercel Project Settings -> Environment Variables and redeploy.'
    );
  }

  return {
    plugins: [react()],
    resolve: {
      dedupe: ['react', 'react-dom'],
    },
    optimizeDeps: {
      include: ['lucide-react']
    }
  };
});
