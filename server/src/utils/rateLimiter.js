/**
 * Simple in-memory rate limiter middleware.
 * Tracks requests per IP per minute window.
 * Returns 429 if more than maxRequests per windowMs.
 */

const requestCounts = new Map();

const WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS = 15;

function cleanupExpired() {
  const now = Date.now();
  for (const [key, record] of requestCounts.entries()) {
    if (now - record.windowStart > WINDOW_MS) {
      requestCounts.delete(key);
    }
  }
}

// Run cleanup every 30 seconds to prevent memory leaks
setInterval(cleanupExpired, 30000).unref();

export default function rateLimiter(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const now = Date.now();

  let record = requestCounts.get(ip);

  if (!record || now - record.windowStart > WINDOW_MS) {
    // Start a new window
    record = { windowStart: now, count: 0 };
    requestCounts.set(ip, record);
  }

  record.count += 1;

  if (record.count > MAX_REQUESTS) {
    const retryAfterSeconds = Math.ceil(
      (record.windowStart + WINDOW_MS - now) / 1000
    );
    res.set('Retry-After', String(Math.max(retryAfterSeconds, 1)));
    return res.status(429).json({
      error: 'Too many requests',
      message: `Rate limit exceeded. Maximum ${MAX_REQUESTS} requests per minute. Try again in ${retryAfterSeconds} seconds.`,
      retryAfter: Math.max(retryAfterSeconds, 1),
    });
  }

  // Add rate limit info headers
  res.set('X-RateLimit-Limit', String(MAX_REQUESTS));
  res.set('X-RateLimit-Remaining', String(MAX_REQUESTS - record.count));
  res.set(
    'X-RateLimit-Reset',
    String(Math.ceil((record.windowStart + WINDOW_MS) / 1000))
  );

  next();
}
