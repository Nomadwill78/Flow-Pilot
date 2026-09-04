/**
 * FlowPilot secure proxy.
 *
 * The one job this service must never get wrong: your LLM API key stays here,
 * on the server, and never reaches a browser. Everything else — auth, rate
 * limiting, logging, provider abstraction — hangs off that.
 *
 *   npm install && cp .env.example .env && npm start
 */
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import { buildSystemPrompt, parseModelReply } from './prompt.js';
import { createRateLimiter } from './rate-limit.js';
import { callModel } from './providers.js';

const app = express();
const PORT = Number(process.env.PORT || 8787);
const IS_PROD = process.env.NODE_ENV === 'production';

app.disable('x-powered-by');
app.use(express.json({ limit: '256kb' }));

// ─── CORS ────────────────────────────────────────────────────────────────────
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

if (IS_PROD && allowedOrigins.length === 0) {
  console.error('[FlowPilot] ALLOWED_ORIGINS is empty in production. Refusing to start.');
  console.error('  Set ALLOWED_ORIGINS to the domains permitted to use this copilot.');
  process.exit(1);
}

app.use(
  cors({
    origin(origin, callback) {
      // Same-origin and server-to-server requests arrive without an Origin header.
      if (!origin) return callback(null, true);
      if (!IS_PROD && allowedOrigins.length === 0) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error(`Origin ${origin} is not allowed.`));
    },
    methods: ['POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400,
  }),
);

// ─── Auth ────────────────────────────────────────────────────────────────────
const AUTH_MODE = process.env.AUTH_MODE || 'jwt';

if (IS_PROD && AUTH_MODE === 'none') {
  console.error('[FlowPilot] AUTH_MODE=none in production would let anyone spend your API budget.');
  process.exit(1);
}

/**
 * Verify the short-lived token your app minted for the signed-in user.
 * Attaches `req.user = { id, ...claims }`.
 */
function authenticate(req, res, next) {
  if (AUTH_MODE === 'none') {
    req.user = { id: req.ip || 'anonymous' };
    return next();
  }

  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) return res.status(401).json({ error: 'Missing authentication token.' });

  try {
    const claims = jwt.verify(token, process.env.JWT_SECRET, {
      issuer: process.env.JWT_ISSUER || undefined,
    });
    req.user = { id: String(claims.sub || claims.userId || 'unknown'), ...claims };
    return next();
  } catch (error) {
    return res.status(401).json({ error: 'Session expired. Please refresh the page.' });
  }
}

// ─── Rate limiting ───────────────────────────────────────────────────────────
const limiter = createRateLimiter({
  perMinute: Number(process.env.RATE_LIMIT_PER_MINUTE || 20),
  perDay: Number(process.env.RATE_LIMIT_PER_DAY || 300),
});

// ─── Routes ──────────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'flowpilot-proxy', version: '1.0.0' });
});

app.post('/api/agent', authenticate, async (req, res) => {
  const startedAt = Date.now();
  const userId = req.user.id;

  const verdict = limiter.check(userId);
  if (!verdict.allowed) {
    return res.status(429).json({
      error:
        verdict.scope === 'day'
          ? 'You have reached your daily assistant limit.'
          : 'That was a lot of requests at once — give it a moment.',
    });
  }

  const {
    sessionId = 'unknown',
    preset = 'generic',
    systemPrompt = '',
    allowedActions = [],
    messages = [],
    page = '',
    context = {},
  } = req.body || {};

  if (typeof page !== 'string' || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Malformed request.' });
  }

  const maxPageChars = Number(process.env.MAX_PAGE_CHARS || 12000);

  try {
    const system = buildSystemPrompt({
      presetPrompt: systemPrompt,
      allowedActions,
      page: page.slice(0, maxPageChars),
      // Trusted context comes from your app, not the page. Keep it small.
      context: sanitizeContext(context),
    });

    const conversation = messages
      .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      .slice(-12)
      .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }));

    const raw = await callModel({ system, messages: conversation });
    const reply = parseModelReply(raw);

    log({
      at: new Date().toISOString(),
      userId,
      sessionId,
      preset,
      ms: Date.now() - startedAt,
      actions: reply.actions.length,
      done: reply.done,
    });

    return res.json(reply);
  } catch (error) {
    console.error('[FlowPilot] model call failed:', error.message);
    log({
      at: new Date().toISOString(),
      userId,
      sessionId,
      preset,
      ms: Date.now() - startedAt,
      error: error.message,
    });
    // Never leak provider errors or key material to the browser.
    return res.status(502).json({ error: 'The assistant is temporarily unavailable. Please try again.' });
  }
});

/** Only forward primitive, small context values from the host app. */
function sanitizeContext(context) {
  if (!context || typeof context !== 'object') return {};
  const out = {};
  let count = 0;
  for (const [key, value] of Object.entries(context)) {
    if (count++ >= 20) break;
    if (['string', 'number', 'boolean'].includes(typeof value)) {
      out[key] = typeof value === 'string' ? value.slice(0, 300) : value;
    }
  }
  return out;
}

/**
 * Structured usage log — one JSON line per turn.
 *
 * This is your billing and analytics feed. Pipe it into your warehouse and you
 * have per-customer usage without building anything else.
 */
function log(entry) {
  console.log(JSON.stringify({ type: 'flowpilot.turn', ...entry }));
}

// eslint-disable-next-line no-unused-vars
app.use((error, _req, res, _next) => {
  if (error?.message?.includes('is not allowed')) {
    return res.status(403).json({ error: 'Origin not allowed.' });
  }
  console.error('[FlowPilot]', error);
  return res.status(500).json({ error: 'Internal error.' });
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`[FlowPilot] proxy listening on :${PORT}`);
    console.log(`[FlowPilot] auth=${AUTH_MODE} origins=${allowedOrigins.join(',') || '(any — dev only)'}`);
  });
}

export default app;
