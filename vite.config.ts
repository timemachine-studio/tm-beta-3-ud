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
                  let body: any = null;
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
                    json(data: any) {
                      res.setHeader('Content-Type', 'application/json');
                      res.end(JSON.stringify(data));
                      return vercelRes;
                    },
                    send(data: any) {
                      if (Buffer.isBuffer(data)) {
                        res.end(data);
                      } else if (typeof data === 'object') {
                        res.setHeader('Content-Type', 'application/json');
                        res.end(JSON.stringify(data));
                      } else {
                        res.end(data);
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
                res.end(JSON.stringify({ error: 'Internal Server Error', details: String(err) }));
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

