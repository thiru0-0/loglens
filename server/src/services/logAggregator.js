/**
 * Log aggregation service.
 * Computes stats, breakdowns, time buckets, and anomaly detection
 * from an array of normalized log entries.
 */

/**
 * Aggregate an array of parsed log entries into a compact stats object.
 *
 * @param {Array<Object>} entries - Normalized log entries from logParser
 * @returns {Object} Aggregated statistics
 */
export function aggregateLogs(entries) {
  if (!entries || entries.length === 0) {
    return emptyStats();
  }

  // Sort entries chronologically to ensure trend analysis is accurate
  entries.sort((a, b) => {
    const tA = a.timestamp instanceof Date && !isNaN(a.timestamp.getTime()) ? a.timestamp.getTime() : 0;
    const tB = b.timestamp instanceof Date && !isNaN(b.timestamp.getTime()) ? b.timestamp.getTime() : 0;
    return tA - tB;
  });

  const totalRequests = entries.length;

  // -----------------------------------------------------------------------
  // 1-2. Total errors and error rate
  // -----------------------------------------------------------------------
  let totalErrors = 0;
  const statusCodeDistribution = {};
  const endpointMap = {}; // "METHOD /path" -> { total, errors, statusCodes }
  const messageCounter = {};
  const parseQuality = { high: 0, medium: 0, low: 0 };
  const timestamps = [];

  for (const entry of entries) {
    // Parse quality
    const confidence = entry.parseConfidence || 'low';
    if (confidence in parseQuality) {
      parseQuality[confidence]++;
    } else {
      parseQuality.low++;
    }

    // Status code distribution
    const status = entry.statusCode;
    if (status != null) {
      statusCodeDistribution[status] = (statusCodeDistribution[status] || 0) + 1;
      if (status >= 400 && status <= 599) {
        totalErrors++;
      }
    }

    // Endpoint breakdown
    const method = entry.method || 'UNKNOWN';
    const path = entry.path || '/unknown';
    const epKey = `${method} ${path}`;

    if (!endpointMap[epKey]) {
      endpointMap[epKey] = { 
        total: 0, 
        errors: 0, 
        statusCodes: {},
        durations: [],
        services: new Set(),
        upstreams: new Set(),
        retryAfterCount: 0
      };
    }
    const ep = endpointMap[epKey];
    ep.total++;
    if (status != null) {
      ep.statusCodes[status] = (ep.statusCodes[status] || 0) + 1;
      if (status >= 400 && status <= 599) {
        ep.errors++;
      }
    }
    if (entry.duration != null) ep.durations.push(entry.duration);
    if (entry.service) ep.services.add(entry.service);
    if (entry.upstream) ep.upstreams.add(entry.upstream);
    if (entry.retryAfter != null) ep.retryAfterCount++;

    // Message counting
    if (entry.message) {
      const msg = entry.message.length > 200
        ? entry.message.slice(0, 200)
        : entry.message;
      messageCounter[msg] = (messageCounter[msg] || 0) + 1;
    }

    // Timestamps
    if (entry.timestamp instanceof Date && !isNaN(entry.timestamp.getTime())) {
      timestamps.push(entry.timestamp.getTime());
    }
  }

  // -----------------------------------------------------------------------
  // 3. Error rate
  // -----------------------------------------------------------------------
  const errorRate =
    totalRequests > 0
      ? `${((totalErrors / totalRequests) * 100).toFixed(1)}%`
      : '0.0%';

  // -----------------------------------------------------------------------
  // 4. Endpoint breakdown with error rates and latency trends
  // -----------------------------------------------------------------------
  const endpointBreakdown = {};
  for (const [key, ep] of Object.entries(endpointMap)) {
    let avgLatency = null;
    let maxLatency = null;
    let latencyTrend = 'STABLE';

    if (ep.durations.length > 0) {
      const sum = ep.durations.reduce((a, b) => a + b, 0);
      avgLatency = Math.round(sum / ep.durations.length);
      maxLatency = Math.round(Math.max(...ep.durations));

      if (ep.durations.length >= 4) {
        const half = Math.floor(ep.durations.length / 2);
        const firstHalf = ep.durations.slice(0, half);
        const secondHalf = ep.durations.slice(half);
        const avg1 = firstHalf.reduce((a, b) => a + b, 0) / half;
        const avg2 = secondHalf.reduce((a, b) => a + b, 0) / (ep.durations.length - half);

        if (avg2 > avg1 * 2 && avg2 > 500) {
          latencyTrend = '↑ STEEP';
        } else if (avg2 > avg1 * 1.5) {
          latencyTrend = '↑ STEADY';
        }
      }
    }

    endpointBreakdown[key] = {
      total: ep.total,
      errors: ep.errors,
      errorRate: ep.total > 0 ? `${((ep.errors / ep.total) * 100).toFixed(1)}%` : '0.0%',
      statusCodes: ep.statusCodes,
      avgLatency,
      maxLatency,
      latencyTrend,
      services: Array.from(ep.services),
      upstreams: Array.from(ep.upstreams),
      retryAfterCount: ep.retryAfterCount
    };
  }

  // -----------------------------------------------------------------------
  // 5. Top error messages
  // -----------------------------------------------------------------------
  const topErrorMessages = Object.entries(messageCounter)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([message, count]) => ({ message, count }));

  // -----------------------------------------------------------------------
  // 7. Time range
  // -----------------------------------------------------------------------
  let timeRange = null;
  if (timestamps.length > 0) {
    timestamps.sort((a, b) => a - b);
    const earliest = new Date(timestamps[0]);
    const latest = new Date(timestamps[timestamps.length - 1]);
    const durationMinutes = (latest - earliest) / 60000;
    timeRange = {
      earliest: earliest.toISOString(),
      latest: latest.toISOString(),
      durationMinutes: Math.round(durationMinutes * 100) / 100,
    };
  }

  // -----------------------------------------------------------------------
  // 8. Time buckets (~10 buckets)
  // -----------------------------------------------------------------------
  let timeBuckets = [];
  if (timestamps.length > 0 && timeRange) {
    const bucketCount = Math.min(10, timestamps.length);
    const earliest = timestamps[0];
    const latest = timestamps[timestamps.length - 1];
    const span = latest - earliest;
    const bucketSize = span > 0 ? span / bucketCount : 1;

    // Initialize buckets
    for (let i = 0; i < bucketCount; i++) {
      const bucketStart = new Date(earliest + i * bucketSize);
      const bucketEnd = new Date(earliest + (i + 1) * bucketSize);
      timeBuckets.push({
        start: bucketStart.toISOString(),
        end: bucketEnd.toISOString(),
        total: 0,
        errors: 0,
      });
    }

    // Fill buckets from entries (only those with timestamps & status)
    for (const entry of entries) {
      if (
        !(entry.timestamp instanceof Date) ||
        isNaN(entry.timestamp.getTime())
      ) {
        continue;
      }
      const t = entry.timestamp.getTime();
      let bucketIndex = Math.floor((t - earliest) / bucketSize);
      if (bucketIndex >= bucketCount) bucketIndex = bucketCount - 1;
      if (bucketIndex < 0) bucketIndex = 0;

      timeBuckets[bucketIndex].total++;
      const status = entry.statusCode;
      if (status != null && status >= 400 && status <= 599) {
        timeBuckets[bucketIndex].errors++;
      }
    }
  }

  // -----------------------------------------------------------------------
  // 9. Anomalies – endpoints with error rate > 5%, or steep latency, or rate limited
  // -----------------------------------------------------------------------
  const anomalies = [];
  for (const [endpoint, ep] of Object.entries(endpointBreakdown)) {
    if (ep.total === 0) continue;
    const errRateNum = parseFloat(ep.errorRate);
    
    let isAnomaly = false;
    let severity = 'low';
    let reason = '';

    if (errRateNum > 5) {
      isAnomaly = true;
      // Count 5xx errors
      let fiveXxCount = 0;
      for (const [code, count] of Object.entries(ep.statusCodes)) {
        if (Number(code) >= 500 && Number(code) <= 599) {
          fiveXxCount += count;
        }
      }
      if (errRateNum > 20 || fiveXxCount > 50) severity = 'high';
      else if (errRateNum > 10 || fiveXxCount > 20) severity = 'medium';
      
      let dominantErrorCode = null;
      let maxCount = 0;
      for (const [code, count] of Object.entries(ep.statusCodes)) {
        if (Number(code) >= 400 && count > maxCount) {
          maxCount = count;
          dominantErrorCode = code;
        }
      }
      reason = dominantErrorCode ? `HTTP ${dominantErrorCode}` : 'Unknown Error';
    }

    // Check rate limit
    if (ep.retryAfterCount > 0 && errRateNum >= 5) {
      isAnomaly = true;
      severity = 'medium';
      reason = 'Rate Limited (429)';
    }

    // Check latency anomaly
    if (ep.latencyTrend === '↑ STEEP' || (ep.avgLatency > 2000 && ep.maxLatency > 3000)) {
      isAnomaly = true;
      if (severity === 'low') severity = 'warning';
      if (reason === '') reason = 'Degrading Latency';
    }

    if (isAnomaly) {
      const parts = endpoint.split(' ');
      const method = parts[0];
      const path = parts.slice(1).join(' ') || endpoint;
      anomalies.push({
        endpoint,
        method: method || 'UNKNOWN',
        path: path,
        total: ep.total,
        errorType: reason,
        count: ep.errors,
        errorRate: ep.errorRate,
        severity,
        avgLatency: ep.avgLatency,
        maxLatency: ep.maxLatency,
        latencyTrend: ep.latencyTrend
      });
    }
  }

  // Sort anomalies by severity (high first) then by count
  const severityOrder = { high: 0, medium: 1, low: 2 };
  anomalies.sort(
    (a, b) =>
      severityOrder[a.severity] - severityOrder[b.severity] ||
      b.count - a.count
  );

  // Calculate recoveryStatus
  let recoveryStatus = 'Healthy';
  if (totalErrors > 0) {
    const lastEntry = entries[entries.length - 1];
    if (lastEntry.statusCode >= 500 || lastEntry.message != null) {
      recoveryStatus = 'Ongoing at last log entry';
    } else {
      let lastErrorTs = null;
      for (let i = entries.length - 1; i >= 0; i--) {
        if (entries[i].statusCode >= 500 || entries[i].message != null) {
          lastErrorTs = entries[i].timestamp;
          break;
        }
      }
      if (lastErrorTs) {
        recoveryStatus = `Recovered at ${lastErrorTs.toISOString()}`;
      } else {
        recoveryStatus = 'Recovered';
      }
    }
  }

  return {
    totalRequests,
    totalErrors,
    errorRate: `${((totalErrors / totalRequests) * 100).toFixed(1)}%`,
    detectedFormat: entries.detectedFormat || 'Unknown',
    recoveryStatus,
    endpointBreakdown,
    topErrorMessages,
    statusCodeDistribution,
    timeRange,
    timeBuckets,
    anomalies,
    parseQuality,
  };
}

function emptyStats() {
  return {
    totalRequests: 0,
    totalErrors: 0,
    errorRate: '0.0%',
    endpointBreakdown: {},
    topErrorMessages: [],
    statusCodeDistribution: {},
    timeRange: null,
    timeBuckets: [],
    anomalies: [],
    parseQuality: { high: 0, medium: 0, low: 0 },
  };
}
