const timestamp = (h, m, s) => `2024-03-15T${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}.${String(Math.floor(Math.random()*999)).padStart(3,'0')}Z`;

const lines = [];
const endpoints = [
  { method: 'GET', path: '/api/health', service: 'gateway' },
  { method: 'POST', path: '/api/payments', service: 'payment-api' },
  { method: 'GET', path: '/api/users/12345', service: 'user-service' },
  { method: 'POST', path: '/api/orders', service: 'order-service' },
  { method: 'GET', path: '/api/payments/pay_abc123/status', service: 'payment-api' },
  { method: 'POST', path: '/api/refunds', service: 'payment-api' },
  { method: 'GET', path: '/api/inventory/sku/98765', service: 'inventory-service' },
];

const userAgents = [
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
  'PostmanRuntime/7.36.1',
  'axios/1.6.2',
  'python-requests/2.31.0',
];

const traceId = () => Math.random().toString(16).slice(2, 18);

// Normal traffic 14:15 - 14:28
for (let m = 15; m <= 28; m++) {
  const count = m < 25 ? 4 : 6;
  for (let i = 0; i < count; i++) {
    const ep = endpoints[Math.floor(Math.random() * endpoints.length)];
    const dur = 20 + Math.floor(Math.random() * 180);
    const s = Math.floor(Math.random() * 60);
    lines.push(JSON.stringify({
      timestamp: timestamp(14, m, s),
      level: 'info',
      method: ep.method,
      path: ep.path,
      statusCode: 200,
      duration: dur,
      service: ep.service,
      traceId: traceId(),
      userAgent: userAgents[Math.floor(Math.random() * userAgents.length)],
      requestId: `req_${Math.random().toString(36).slice(2, 14)}`,
      message: 'Request completed successfully',
    }));
  }
}

// Slow responses 14:28 - 14:30 (degradation begins)
for (let m = 28; m <= 30; m++) {
  for (let i = 0; i < 5; i++) {
    const ep = endpoints[Math.floor(Math.random() * 3) + 1]; // payment, user, order
    const dur = 800 + Math.floor(Math.random() * 4200);
    const status = dur > 3000 ? 504 : 200;
    const s = Math.floor(Math.random() * 60);
    lines.push(JSON.stringify({
      timestamp: timestamp(14, m, s),
      level: status === 200 ? 'warn' : 'error',
      method: ep.method,
      path: ep.path,
      statusCode: status,
      duration: dur,
      service: ep.service,
      traceId: traceId(),
      userAgent: userAgents[Math.floor(Math.random() * userAgents.length)],
      requestId: `req_${Math.random().toString(36).slice(2, 14)}`,
      message: status === 504 ? 'Gateway timeout — upstream did not respond in time' : `Slow response detected (${dur}ms)`,
    }));
  }
}

// Error spike 14:30 - 14:38
const errorMessages = [
  'upstream connect error or disconnect/reset before headers',
  'connection timed out after 5000ms',
  'service temporarily unavailable',
  'ECONNREFUSED 10.0.3.42:5432',
  'read ECONNRESET',
  'no healthy upstream',
  'circuit breaker OPEN for payment-api',
  'connection pool exhausted — max 50 connections reached',
];

for (let m = 30; m <= 38; m++) {
  const errorRate = m <= 34 ? 0.6 : 0.75;
  const count = m >= 33 ? 8 : 6;
  for (let i = 0; i < count; i++) {
    const ep = endpoints[Math.floor(Math.random() * 4) + 1];
    const isError = Math.random() < errorRate;
    const statusCode = isError
      ? [500, 502, 503, 503, 503, 500][Math.floor(Math.random() * 6)]
      : 200;
    const dur = isError ? 5000 + Math.floor(Math.random() * 3000) : 150 + Math.floor(Math.random() * 400);
    const s = Math.floor(Math.random() * 60);
    const msg = isError
      ? errorMessages[Math.floor(Math.random() * errorMessages.length)]
      : 'Request completed successfully';

    lines.push(JSON.stringify({
      timestamp: timestamp(14, m, s),
      level: isError ? 'error' : 'info',
      method: ep.method,
      path: ep.path,
      statusCode,
      duration: dur,
      service: ep.service,
      traceId: traceId(),
      userAgent: userAgents[Math.floor(Math.random() * userAgents.length)],
      requestId: `req_${Math.random().toString(36).slice(2, 14)}`,
      message: msg,
      ...(isError && statusCode === 503 && { retryAfter: 30 }),
      ...(isError && { errorDetails: { upstream: '10.0.3.42:5432', connectionPool: { active: 50, max: 50, waiting: 23 } } }),
    }));
  }
}

// Rate limiting 14:35 - 14:38
for (let m = 35; m <= 38; m++) {
  for (let i = 0; i < 3; i++) {
    const s = Math.floor(Math.random() * 60);
    lines.push(JSON.stringify({
      timestamp: timestamp(14, m, s),
      level: 'warn',
      method: 'POST',
      path: '/api/payments',
      statusCode: 429,
      duration: 8,
      service: 'gateway',
      traceId: traceId(),
      userAgent: userAgents[Math.floor(Math.random() * userAgents.length)],
      requestId: `req_${Math.random().toString(36).slice(2, 14)}`,
      message: 'Rate limit exceeded — 100 requests per minute',
      retryAfter: 60,
      rateLimitRemaining: 0,
    }));
  }
}

// Recovery 14:38 - 14:45
for (let m = 38; m <= 45; m++) {
  const errorRate = Math.max(0, 0.5 - (m - 38) * 0.08);
  const count = m > 42 ? 4 : 5;
  for (let i = 0; i < count; i++) {
    const ep = endpoints[Math.floor(Math.random() * endpoints.length)];
    const isError = Math.random() < errorRate;
    const statusCode = isError ? 503 : 200;
    const dur = isError ? 5000 + Math.floor(Math.random() * 2000) : 50 + Math.floor(Math.random() * 200);
    const s = Math.floor(Math.random() * 60);

    lines.push(JSON.stringify({
      timestamp: timestamp(14, m, s),
      level: isError ? 'error' : 'info',
      method: ep.method,
      path: ep.path,
      statusCode,
      duration: dur,
      service: ep.service,
      traceId: traceId(),
      userAgent: userAgents[Math.floor(Math.random() * userAgents.length)],
      requestId: `req_${Math.random().toString(36).slice(2, 14)}`,
      message: isError ? 'service temporarily unavailable' : 'Request completed successfully',
    }));
  }
}

// Sort by timestamp
lines.sort((a, b) => {
  const ta = JSON.parse(a).timestamp;
  const tb = JSON.parse(b).timestamp;
  return ta.localeCompare(tb);
});

export const SAMPLE_LOGS = lines.join('\n');

export const SAMPLE_LOGS_DESCRIPTION =
  'Simulated 30-minute traffic snapshot (14:15–14:45 UTC) for a payment API stack. ' +
  'Contains normal traffic, followed by a degradation spike with 503/500 errors, ' +
  'connection pool exhaustion, rate limiting (429), and gradual recovery. ' +
  'Covers endpoints: /api/payments, /api/users, /api/orders, /api/health, /api/refunds, /api/inventory.';
