import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

import express from 'express';
import cors from 'cors';
import aiRouter from './routes/ai.js';
import { aiLimiter } from './lib/rateLimit.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '6mb' }));

app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

app.use('/api', aiLimiter, aiRouter);

app.listen(PORT, () => {
  console.log(`[IVLA server] listening on http://localhost:${PORT}`);
  const hasKey = Boolean(process.env.NVIDIA_API_KEY && process.env.NVIDIA_API_KEY.trim());
  console.log(`AI key: ${hasKey ? 'configured' : 'missing'}`);
});
