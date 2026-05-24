/**
 * LogLens Express server entry point.
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import analyzeRouter from './routes/analyze.js';
import chatRouter from './routes/chat.js';
import rateLimiter from './utils/rateLimiter.js';

const app = express();
const PORT = process.env.PORT || 3001;

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

// CORS – allow the Vite dev server
app.use(
  cors({
    origin: 'http://localhost:5173',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// JSON body parser – 10 MB limit for large log payloads
app.use(express.json({ limit: '10mb' }));

// Rate limiting
app.use(rateLimiter);

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

app.use('/api/analyze', analyzeRouter);
app.use('/api/chat', chatRouter);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// ---------------------------------------------------------------------------
// Global error handler
// ---------------------------------------------------------------------------

// 404 for unmatched routes
app.use((_req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: 'The requested endpoint does not exist.',
  });
});

// Error handler middleware (must have 4 args)
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('[server] Unhandled error:', err);

  // Handle JSON parse errors from express.json()
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({
      error: 'Invalid JSON',
      message: 'The request body contains invalid JSON.',
    });
  }

  // Handle payload too large
  if (err.type === 'entity.too.large') {
    return res.status(413).json({
      error: 'Payload too large',
      message: 'The request body exceeds the 10MB limit.',
    });
  }

  res.status(err.status || 500).json({
    error: 'Internal server error',
    message:
      process.env.NODE_ENV === 'production'
        ? 'An unexpected error occurred.'
        : err.message || 'An unexpected error occurred.',
  });
});

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------

app.listen(PORT, () => {
  console.log(`🔍 LogLens server running on http://localhost:${PORT}`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   API key configured: ${process.env.OPENROUTER_API_KEY ? 'Yes' : 'No'}`);
});

export default app;
