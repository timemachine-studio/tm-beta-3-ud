import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import {
  ApiRequestError,
  createVercelRequest,
  withVercelResponseHelpers,
} from './api/_lib/nodeHttpAdapter.js';

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

  // Vite's loadEnv() does NOT populate process.env. The dev-only serverless
  // middleware below executes api/*.ts handlers in-process, and those handlers
  // read secrets from process.env (as they do on Vercel). Without this bridge
  // every /api/* route crashes locally with "supabaseKey is required".
  for (const [key, value] of Object.entries(env)) {
    if (process.env[key] === undefined) process.env[key] = value;
  }

  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'api-serverless-middleware',
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            const urlObj = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
            if (urlObj.pathname.startsWith('/api/')) {
              // Extract API endpoint name (strip leading /api/ and potential query parameters)
              const apiName = urlObj.pathname.slice(5);
              const apiPath = path.resolve(process.cwd(), 'api', `${apiName}.ts`);

              try {
                // Compile and load the serverless TS module using Vite's ssrLoadModule
                const module = await server.ssrLoadModule(apiPath);
                const handler = module.default;

                if (typeof handler === 'function') {
                  const vercelReq = await createVercelRequest(req, urlObj);
                  const vercelRes = withVercelResponseHelpers(res);

                  await handler(vercelReq, vercelRes);
                  return;
                }
              } catch (err) {
                console.error(`Error executing API handler for ${urlObj.pathname}:`, err);
                res.statusCode = err instanceof ApiRequestError ? err.statusCode : 500;
                res.setHeader('Content-Type', 'application/json');
                // Never return the exception text: it is a stack trace and
                // whatever the handler was holding (production-check.md 1.7).
                res.end(JSON.stringify(err instanceof ApiRequestError
                  ? { error: {
                    code: err.statusCode === 413 ? 'PAYLOAD_TOO_LARGE' : 'BAD_REQUEST',
                    message: err.message,
                  } }
                  : { error: { code: 'UNKNOWN', message: 'Internal Server Error' } }));
                return;
              }
            }
            next();
          });
        }
      }
    ],
    resolve: {
      dedupe: ['react', 'react-dom'],
    },
    optimizeDeps: {
      include: ['lucide-react']
    }
  };
});
