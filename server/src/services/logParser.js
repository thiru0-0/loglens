/**
 * Multi-format log parser with three-tier fallback chain.
 *
 * Tier 1: JSON / JSONL
 * Tier 2: Apache/Nginx combined log format
 * Tier 3: Heuristic line-by-line parser
 *
 * Returns an array of normalized log entry objects.
 */

const MAX_LINES = 50000;

const HTTP_METHODS = new Set([
  'GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS', 'TRACE', 'CONNECT',
]);

const APACHE_COMBINED_RE =
  /^(\S+) \S+ \S+ \[([^\]]+)\] "(\S+) (\S+) \S+" (\d{3}) (\d+)/;

const APACHE_MONTHS = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
  Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
};

// ---------------------------------------------------------------------------
// Normalizer helpers
// ---------------------------------------------------------------------------

function normalizeJsonEntry(obj, raw) {
  const timestamp = parseTimestamp(
    obj.timestamp || obj.time || obj.date || obj['@timestamp'] || null
  );
  const method = (obj.method || obj.httpMethod || obj.req_method || null);
  const path = obj.path || obj.url || obj.uri || obj.request_uri || obj.endpoint || null;
  const statusCode = toIntOrNull(
    obj.status ?? obj.statusCode ?? obj.status_code ?? obj.response_code ?? null
  );
  const message =
    obj.message || obj.msg || obj.error || obj.err || obj.log || null;
  const duration = parseDuration(
    obj.duration ?? obj.responseTime ?? obj.response_time ?? obj.elapsed ?? obj.latency_ms ?? obj.latency ?? null
  );

  const service = obj.service || obj.app || obj.app_name || null;
  const upstream = obj.upstream || obj.backend || null;
  const retryAfter = obj.retry_after || obj.retryAfter || null;

  return {
    timestamp,
    method: method ? String(method).toUpperCase() : null,
    path: path ? String(path) : null,
    statusCode,
    message: message ? String(message) : null,
    duration,
    service: service ? String(service) : null,
    upstream: upstream ? String(upstream) : null,
    retryAfter: retryAfter != null ? Number(retryAfter) : null,
    raw: raw || JSON.stringify(obj),
    parseConfidence: 'high',
  };
}

function parseTimestamp(value) {
  if (value == null) return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  if (typeof value === 'number') {
    // Assume epoch ms if > 1e12, else epoch seconds
    const ms = value > 1e12 ? value : value * 1000;
    const d = new Date(ms);
    return isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(String(value));
  return isNaN(d.getTime()) ? null : d;
}

function toIntOrNull(value) {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : null;
}

function parseDuration(value) {
  if (value == null) return null;
  if (typeof value === 'number') return value;
  const s = String(value).trim();
  // Match patterns like "123ms", "1.5s", "200μs", "2m"
  const m = s.match(/^([\d.]+)\s*(ms|s|us|μs|m|min)?$/i);
  if (m) {
    const num = parseFloat(m[1]);
    const unit = (m[2] || 'ms').toLowerCase();
    switch (unit) {
      case 'ms':
        return num;
      case 's':
        return num * 1000;
      case 'us':
      case 'μs':
        return num / 1000;
      case 'm':
      case 'min':
        return num * 60000;
      default:
        return num;
    }
  }
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

// ---------------------------------------------------------------------------
// Tier 1 – JSON / JSONL
// ---------------------------------------------------------------------------

function tryJsonParse(rawText) {
  // Attempt 1: full JSON array
  try {
    const parsed = JSON.parse(rawText);
    if (Array.isArray(parsed)) {
      return parsed.map((obj) => normalizeJsonEntry(obj, JSON.stringify(obj)));
    }
    // Single JSON object
    if (typeof parsed === 'object' && parsed !== null) {
      return [normalizeJsonEntry(parsed, rawText.trim())];
    }
  } catch {
    // Not valid JSON as a whole – fall through to JSONL
  }

  // Attempt 2: JSONL – line-by-line
  const lines = rawText.split('\n');
  const entries = [];
  let jsonLineCount = 0;
  let totalNonEmpty = 0;

  for (let i = 0; i < Math.min(lines.length, MAX_LINES); i++) {
    const line = lines[i].trim();
    if (!line) continue;
    totalNonEmpty++;
    try {
      const obj = JSON.parse(line);
      if (typeof obj === 'object' && obj !== null) {
        entries.push(normalizeJsonEntry(obj, line));
        jsonLineCount++;
      }
    } catch {
      // Not JSON
    }
  }

  // Consider it JSON if at least 50% of non-empty lines parsed as JSON
  if (totalNonEmpty > 0 && jsonLineCount / totalNonEmpty >= 0.5) {
    return entries;
  }

  return null; // Signal: not JSON
}

// ---------------------------------------------------------------------------
// Tier 2 – Apache / Nginx Combined
// ---------------------------------------------------------------------------

function parseApacheDate(dateStr) {
  // Format: 10/Oct/2000:13:55:36 -0700
  const m = dateStr.match(
    /(\d{1,2})\/(\w{3})\/(\d{4}):(\d{2}):(\d{2}):(\d{2})\s*([+-]\d{4})?/
  );
  if (!m) return null;
  const day = parseInt(m[1], 10);
  const month = APACHE_MONTHS[m[2]];
  if (month === undefined) return null;
  const year = parseInt(m[3], 10);
  const hour = parseInt(m[4], 10);
  const min = parseInt(m[5], 10);
  const sec = parseInt(m[6], 10);

  const d = new Date(Date.UTC(year, month, day, hour, min, sec));
  if (m[7]) {
    const tzSign = m[7][0] === '+' ? -1 : 1;
    const tzH = parseInt(m[7].slice(1, 3), 10);
    const tzM = parseInt(m[7].slice(3, 5), 10);
    d.setTime(d.getTime() + tzSign * (tzH * 60 + tzM) * 60000);
  }
  return isNaN(d.getTime()) ? null : d;
}

function tryApacheParse(rawText) {
  const lines = rawText.split('\n');
  const entries = [];
  let matchCount = 0;
  let totalNonEmpty = 0;

  // Probe first 20 non-empty lines
  for (let i = 0; i < Math.min(lines.length, 20); i++) {
    const line = lines[i].trim();
    if (!line) continue;
    totalNonEmpty++;
    if (APACHE_COMBINED_RE.test(line)) matchCount++;
  }

  // Need at least 50% match among probed lines
  if (totalNonEmpty === 0 || matchCount / totalNonEmpty < 0.5) return null;

  for (let i = 0; i < Math.min(lines.length, MAX_LINES); i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const m = line.match(APACHE_COMBINED_RE);
    if (m) {
      entries.push({
        timestamp: parseApacheDate(m[2]),
        method: m[3].toUpperCase(),
        path: m[4],
        statusCode: parseInt(m[5], 10),
        message: null,
        duration: null,
        raw: line,
        parseConfidence: 'high',
      });
    } else {
      // Non-matching line in an otherwise Apache log
      entries.push({
        timestamp: null,
        method: null,
        path: null,
        statusCode: null,
        message: line,
        duration: null,
        raw: line,
        parseConfidence: 'low',
      });
    }
  }

  return entries;
}

// ---------------------------------------------------------------------------
// Tier 3 – Heuristic line-by-line
// ---------------------------------------------------------------------------

// Timestamp patterns
const ISO_TS_RE =
  /\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?/;
const COMMON_TS_RE =
  /\d{1,2}\/\w{3}\/\d{4}:\d{2}:\d{2}:\d{2}/;
const SYSLOG_TS_RE =
  /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}\s+\d{2}:\d{2}:\d{2}\b/;

const STATUS_RE = /\b([1-5]\d{2})\b/;
const METHOD_RE = /\b(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)\b/i;
const PATH_RE = /(?:^|\s)(\/[\w\-./]+(?:\?[\w\-=&%.]*)?)/;
const ERROR_KW_RE =
  /\b(ERROR|WARN(?:ING)?|FATAL|CRIT(?:ICAL)?|EMERG|Exception|timeout|failed|failure|panic|crash|abort|refused|denied|unavailable)\b/i;
const DURATION_RE = /\b(\d+(?:\.\d+)?)\s*(ms|s|us|μs)\b/i;

function heuristicParseLine(line) {
  // Timestamp
  let timestamp = null;
  let tsMatch = line.match(ISO_TS_RE);
  if (tsMatch) {
    timestamp = new Date(tsMatch[0]);
    if (isNaN(timestamp.getTime())) timestamp = null;
  }
  if (!timestamp) {
    tsMatch = line.match(COMMON_TS_RE);
    if (tsMatch) {
      timestamp = parseApacheDate(tsMatch[0]);
    }
  }
  if (!timestamp) {
    tsMatch = line.match(SYSLOG_TS_RE);
    if (tsMatch) {
      // Syslog timestamps lack year; assume current year
      const withYear = tsMatch[0] + ' ' + new Date().getFullYear();
      const d = new Date(withYear);
      timestamp = isNaN(d.getTime()) ? null : d;
    }
  }

  // HTTP method
  const methodMatch = line.match(METHOD_RE);
  const method = methodMatch ? methodMatch[1].toUpperCase() : null;

  // Path
  const pathMatch = line.match(PATH_RE);
  const path = pathMatch ? pathMatch[1] : null;

  // Status code – prefer one near a method/path context
  let statusCode = null;
  const statusMatch = line.match(STATUS_RE);
  if (statusMatch) {
    statusCode = parseInt(statusMatch[1], 10);
  }

  // Duration
  let duration = null;
  const durMatch = line.match(DURATION_RE);
  if (durMatch) {
    duration = parseDuration(durMatch[0]);
  }

  // Error-level message
  const errMatch = line.match(ERROR_KW_RE);
  const message = errMatch ? line : null;

  // Confidence: high if we got timestamp + at least status or method; medium if partial
  let parseConfidence = 'low';
  const fieldCount = [timestamp, method, path, statusCode].filter(Boolean).length;
  if (fieldCount >= 3) parseConfidence = 'medium';
  if (fieldCount === 4) parseConfidence = 'high';

  return {
    timestamp,
    method,
    path,
    statusCode,
    message,
    duration,
    raw: line,
    parseConfidence,
  };
}

function heuristicParse(rawText) {
  const lines = rawText.split('\n');
  const entries = [];

  for (let i = 0; i < Math.min(lines.length, MAX_LINES); i++) {
    const line = lines[i].trim();
    if (!line) continue;
    entries.push(heuristicParseLine(line));
  }

  return entries;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Parse raw log text into normalized entries.
 *
 * @param {string} rawText - Raw log text content
 * @param {string} [formatHint] - Optional hint: 'json', 'apache', 'auto'
 * @returns {Array<Object>} Array of normalized log entries
 */
export function parseLogs(rawText, formatHint = 'auto') {
  if (!rawText || typeof rawText !== 'string') {
    return [];
  }

  const hint = (formatHint || 'auto').toLowerCase();

  // If user provides a hint, try that tier first
  if (hint === 'json') {
    const result = tryJsonParse(rawText);
    if (result && result.length > 0) {
      result.detectedFormat = 'JSON';
      return result;
    }
  }

  if (hint === 'apache' || hint === 'nginx') {
    const result = tryApacheParse(rawText);
    if (result && result.length > 0) {
      result.detectedFormat = 'Apache/Nginx';
      return result;
    }
  }

  // Auto: try tiers in order
  // Tier 1: JSON
  const jsonResult = tryJsonParse(rawText);
  if (jsonResult && jsonResult.length > 0) {
    jsonResult.detectedFormat = 'JSON';
    return jsonResult;
  }

  // Tier 2: Apache / Nginx combined
  const apacheResult = tryApacheParse(rawText);
  if (apacheResult && apacheResult.length > 0) {
    apacheResult.detectedFormat = 'Apache/Nginx';
    return apacheResult;
  }

  // Tier 3: Heuristic
  const heuristicResult = heuristicParse(rawText);
  heuristicResult.detectedFormat = 'Plain Text (Heuristic)';
  return heuristicResult;
}
