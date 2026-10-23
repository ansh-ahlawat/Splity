import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';
import { createApp } from './server/app';

const PORT = Number(process.env.PORT) || 3000;

async function startServer() {
  const app = createApp();

  // Vite development middleware or static production serving
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        watch: {
          ignored: [
            '**/data_store.json',
            '**/data_store*.json',
            '**/server/**',
            '**/server.ts',
            '**/.env*',
          ],
        },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Expense Buddy server running on http://0.0.0.0:${PORT}`);
  });
}

// Auto start if run directly
if (!process.env.AWS_LAMBDA_FUNCTION_NAME && !process.env.LAMBDA_TASK_ROOT) {
  startServer();
}

export { createApp, startServer };
