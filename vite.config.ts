import { defineConfig } from 'vite';

// Simple dev-only client log relay: accepts POST /__client-log and logs to terminal
function clientLogRelay() {
  return {
    name: 'client-log-relay',
    apply: 'serve',
    configureServer(server: any) {
      server.middlewares.use('/__client-log', (req: any, res: any) => {
        if (req.method !== 'POST') {
          res.statusCode = 405; // Method Not Allowed
          return res.end();
        }
        let body = '';
        req.on('data', (chunk: any) => {
          body += chunk;
          // avoid unbounded memory usage
          if (body.length > 100_000) body = body.slice(-100_000);
        });
        req.on('end', () => {
          try {
            const data = JSON.parse(body || '{}');
            const level = (data.level || 'log').toUpperCase();
            const msg = data.message || '';
            const meta = data.meta ? ` ${JSON.stringify(data.meta)}` : '';
            const line = `[CLIENT ${level}] ${msg}${meta}`;
            // Print via appropriate console level
            if (level === 'ERROR') console.error(line);
            else if (level === 'WARN') console.warn(line);
            else console.log(line);
          } catch (e) {
            console.warn('[CLIENT LOG RELAY] Failed to parse body');
          }
          res.statusCode = 204; // No Content
          res.end();
        });
      });
    }
  }
}

export default defineConfig({
  server: { 
    port: 5173,
    host: true,
    allowedHosts: ['bring-boxed-grenada-occurred.trycloudflare.com']
  },
  plugins: [clientLogRelay()],
});
