/**
 * WorkRate API — Entry Point
 * ══════════════════════════
 * Start:  npm start       (production)
 * Dev:    npm run dev     (watch mode, Node ≥ 18)
 * Migrate: npm run migrate
 */
import 'dotenv/config';
import express           from 'express';
import cors              from 'cors';
import { rateLimit }     from 'express-rate-limit';

import authRoutes        from './routes/auth.js';
import sessionsRoutes    from './routes/sessions.js';
import clientsRoutes     from './routes/clients.js';

const app  = express();
const PORT = process.env.PORT ?? 3001;

/* ══════════════════════════════════════════════════════════════════════════
   MIDDLEWARE
══════════════════════════════════════════════════════════════════════════ */

// CORS — whitelist the dashboard and the Chrome extension
const ALLOWED = (process.env.ALLOWED_ORIGINS ?? '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

// Auto-allow Netlify deploy previews and Railway internal URLs in non-prod
const AUTO_ALLOW_PATTERNS = [
  /\.netlify\.app$/,
  /\.netlify\.live$/,
  /\.railway\.app$/,
  /^http:\/\/localhost:/,
  /^chrome-extension:\/\//,
];

app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true); // curl / server-to-server
    if (ALLOWED.includes(origin)) return callback(null, true);
    if (ALLOWED.some(o => origin.startsWith(o))) return callback(null, true);
    // In development/staging auto-allow known safe patterns
    if (process.env.NODE_ENV !== 'production') {
      if (AUTO_ALLOW_PATTERNS.some(p => p.test(origin))) return callback(null, true);
    }
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
  methods: ['GET','POST','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
}));

app.use(express.json({ limit: '2mb' })); // sessions with activityBlocks can be large

// Global rate limiter — tighten per-route in production
app.use(rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? 900_000),
  max:      parseInt(process.env.RATE_LIMIT_MAX ?? 100),
  standardHeaders: true,
  legacyHeaders:   false,
  message: { error: 'Too many requests, please slow down.' },
}));

// Tighter limit for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 min
  max: 20,
  message: { error: 'Too many auth attempts. Try again in 15 minutes.' },
});

/* ══════════════════════════════════════════════════════════════════════════
   ROUTES
══════════════════════════════════════════════════════════════════════════ */
app.use('/api/auth',     authLimiter, authRoutes);
app.use('/api/sessions', sessionsRoutes);
app.use('/api/clients',  clientsRoutes);

/* ══════════════════════════════════════════════════════════════════════════
   HEALTH CHECK
══════════════════════════════════════════════════════════════════════════ */
app.get('/health', (_req, res) => {
  res.json({
    status:  'ok',
    version: '1.0.0',
    env:     process.env.NODE_ENV ?? 'development',
    ts:      new Date().toISOString(),
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   404 + ERROR HANDLERS
══════════════════════════════════════════════════════════════════════════ */
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.use((err, _req, res, _next) => {
  const status = err.status ?? 500;
  const msg    = process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message;
  console.error('[error]', err.message);
  res.status(status).json({ error: msg });
});

/* ══════════════════════════════════════════════════════════════════════════
   START
══════════════════════════════════════════════════════════════════════════ */
app.listen(PORT, () => {
  console.log(`
  ┌─────────────────────────────────────────┐
  │  WorkRate API                           │
  │  http://localhost:${PORT}                  │
  │  ENV: ${process.env.NODE_ENV ?? 'development'}                    │
  └─────────────────────────────────────────┘
  `);
});

export default app;
