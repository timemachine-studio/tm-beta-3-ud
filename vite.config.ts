import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

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
                  // Parse query parameters
                  const query: Record<string, string | string[]> = {};
                  urlObj.searchParams.forEach((value, key) => {
                    if (query[key]) {
                      if (Array.isArray(query[key])) {
                        (query[key] as string[]).push(value);
                      } else {
                        query[key] = [query[key] as string, value];
                      }
                    } else {
                      query[key] = value;
                    }
                  });

                  // Read request body if present
                  let body: unknown = null;
                  if (req.method === 'POST' || req.method === 'PUT') {
                    body = await new Promise((resolve) => {
                      let data = '';
                      req.on('data', chunk => { data += chunk; });
                      req.on('end', () => {
                        try {
                          resolve(JSON.parse(data));
                        } catch {
                          resolve(data);
                        }
                      });
                    });
                  }

                  const vercelReq = Object.assign(req, {
                    query,
                    body,
                  });

                  const vercelRes = Object.assign(res, {
                    status(code: number) {
                      res.statusCode = code;
                      return vercelRes;
                    },
                    json(data: unknown) {
                      res.setHeader('Content-Type', 'application/json');
                      res.end(JSON.stringify(data));
                      return vercelRes;
                    },
                    send(data: unknown) {
                      if (Buffer.isBuffer(data)) {
                        res.end(data);
                      } else if (typeof data === 'object') {
                        res.setHeader('Content-Type', 'application/json');
                        res.end(JSON.stringify(data));
                      } else {
                        res.end(String(data));
                      }
                      return vercelRes;
                    }
                  });

                  await handler(vercelReq, vercelRes);
                  return;
                }
              } catch (err) {
                console.error(`Error executing API handler for ${urlObj.pathname}:`, err);
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                // Never return the exception text: it is a stack trace and
                // whatever the handler was holding (production-check.md 1.7).
                res.end(JSON.stringify({ error: { code: 'UNKNOWN', message: 'Internal Server Error' } }));
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

