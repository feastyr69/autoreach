import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { oceanRouter } from './routes/ocean.js';
import { prospeoRouter } from './routes/prospeo.js';
import { eazyreachRouter } from './routes/eazyreach.js';
import { brevoRouter } from './routes/brevo.js';

// Load .env from the repo root (one level up from /backend)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:4173'] }));
app.use(express.json());

// Health check
app.get('/api/health', (_req, res) => {
  const keys = {
    ocean: !!process.env.OCEAN_API,
    prospeo: !!process.env.PROSPEO_API,
    eazyreach: !!(process.env.EAZYREACH_ID && process.env.EAZYREACH_SECRET),
    brevo: !!process.env.BREVO_API,
  };
  res.json({ status: 'ok', keys });
});

// Mount route handlers
app.use('/api/ocean', oceanRouter);
app.use('/api/prospeo', prospeoRouter);
app.use('/api/eazyreach', eazyreachRouter);
app.use('/api/brevo', brevoRouter);

// Global error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Server Error]', err.message);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`\n🚀 Autoreach API proxy running on http://localhost:${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/api/health\n`);
});
