import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { env } from './config/env.js';
import { apiRouter } from './routes/api.js';
import { errorHandler, notFound } from './middlewares/errorHandler.js';
import { requireLocalClient } from './middlewares/localOnly.js';

export const app = express();

app.disable('x-powered-by');
app.use(helmet());
const allowedOrigins = new Set([env.clientOrigin, 'http://localhost:5173', 'http://127.0.0.1:5173']);
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) return callback(null, true);
    return callback(Object.assign(new Error('Origen no autorizado.'), { status: 403, code: 'ORIGIN_NOT_ALLOWED' }));
  },
  methods: ['GET', 'POST'], allowedHeaders: ['Content-Type', 'X-Repo-Manager'],
}));
app.use(express.json({ limit: '600kb' }));
app.use('/api', rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: 'draft-8', legacyHeaders: false }));
app.use('/api', requireLocalClient, apiRouter);
app.use(notFound);
app.use(errorHandler);
