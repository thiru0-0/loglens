/**
 * Prompt construction for AI analysis and follow-up chat.
 */

/**
 * Build system + user prompts for the main log analysis.
 *
 * @param {Object} aggregatedStats - Output from logAggregator
 * @param {Object} [config] - Optional analysis configuration
 * @param {string} [config.serviceName] - Name of the service being analyzed
 * @param {string} [config.timeWindow] - Time window description (e.g., "last 24h")
 * @param {string} [config.baseline] - Baseline context (e.g., "normal error rate is 1%")
 * @param {string} [config.additionalContext] - Any extra context
 * @returns {{ systemPrompt: string, userPrompt: string }}
 */
export function buildAnalysisPrompt(aggregatedStats, config = {}) {
  const isHealthy = aggregatedStats.totalErrors === 0;

  const systemPrompt = `You are a backend API incident analyst. Your job is to reason about API failures using pre-aggregated metrics provided to you as JSON. You do not parse raw logs. You do not invent data.

Your responsibilities:
1. CORRELATE: Identify patterns across endpoints, error codes, latency values, and timing. Look for what failed together, what stayed healthy, and what changed. Cross-reference 'services' and 'upstreams' to spot shared dependencies or cascading failures.
2. DIAGNOSE: Produce root cause hypotheses ranked by confidence.
   - HIGH: 70%+ of failures share the same signature, pattern is unambiguous, no equally plausible alternative.
   - MEDIUM: Pattern fits but one or more alternative causes are equally supported by the data.
   - LOW: Possible contributing factor, data is insufficient to confirm.
   - You MUST include a secondary alternative hypothesis, even if it has low confidence.
3. RECOMMEND: Output specific debugging steps. 
   - Limit to the top 5-7 most impactful actions, grouped by named categories (e.g., "Immediate actions", "Investigate", "Long-term fixes").
   - DO NOT use markdown code block fences (like \`\`\`bash). Format commands using inline backticks (e.g., \`tail -f var/log/syslog\`).

Critical Diagnosis Rules:
- SILENT FAILURES: If you see a '↑ STEEP' latencyTrend or high maxLatency on an endpoint without HTTP errors, diagnose this as a resource leak or slow query. Warn the user immediately.
- CASCADING FAILURES: If multiple services fail at the exact same time with the same error, identify the shared dependency (e.g. database, gateway) rather than blaming individual services.
- RATE LIMITS: If you see 'retryAfterCount' > 0 and 429 errors, diagnose it as an external rate limit/quota issue, not an internal code bug.

Hard constraints:
- Your analysis is limited strictly to what the data shows. Never reference an endpoint, timestamp, or error message that is not present in the provided JSON.
- If the data is ambiguous, say it is ambiguous. Do not fabricate certainty.
- Never assign HIGH confidence with fewer than 3 supporting data points.
- Always structure your response with exactly these markdown headers:

## Executive Summary
Provide a concise overview. ${isHealthy ? 'Emphasize that the system is completely healthy and operating normally.' : ''}

${isHealthy ? '## Latency Health Check' : '## Root Cause Analysis'}
${isHealthy 
  ? 'Since there are no errors, output exactly "None detected.", followed by a markdown table showing average and max latencies.' 
  : 'Provide your diagnosed root causes with their HIGH/MEDIUM/LOW confidence levels.'}

${isHealthy ? '## Suggestion' : '## Debugging Recommendations'}
${isHealthy 
  ? 'Advise the user that this is a clean log window and suggest expanding the time range if investigating an incident.' 
  : 'Provide your specific, numbered debugging steps based on the hypotheses.'}

## Failure Timeline
${isHealthy 
  ? 'Output exactly "No failures detected in this time window.".' 
  : `Output a strictly formatted JSON array enclosed in \`\`\`json. Each object must have:
- "timeRange": string (e.g. "20:00:00 - 20:00:06")
- "requests": number
- "errors": number
- "status": string ("success", "warning", or "failure")
- "description": string (brief summary)
- "logs": string[] (1-2 bullet points of detailed insights)
Do not include any text outside the JSON block in this section.`}`;

  // Build user prompt with stats and optional context
  const contextParts = [];

  if (config.serviceName) {
    contextParts.push(`**Service:** ${config.serviceName}`);
  }
  if (config.timeWindow) {
    contextParts.push(`**Time Window:** ${config.timeWindow}`);
  }
  if (config.baseline) {
    contextParts.push(`**Baseline Context:** ${config.baseline}`);
  }
  if (config.additionalContext) {
    contextParts.push(`**Additional Context:** ${config.additionalContext}`);
  }

  const contextSection =
    contextParts.length > 0
      ? `### Service Context\n${contextParts.join('\n')}\n\n`
      : '';

  // Trim the stats to avoid token overload – keep the most relevant parts
  const statsForPrompt = {
    totalRequests: aggregatedStats.totalRequests,
    totalErrors: aggregatedStats.totalErrors,
    errorRate: aggregatedStats.errorRate,
    statusCodeDistribution: aggregatedStats.statusCodeDistribution,
    timeRange: aggregatedStats.timeRange,
    parseQuality: aggregatedStats.parseQuality,
    // Limit endpoint breakdown to top 20 by total volume
    endpointBreakdown: limitObject(aggregatedStats.endpointBreakdown, 20),
    topErrorMessages: aggregatedStats.topErrorMessages,
    timeBuckets: aggregatedStats.timeBuckets,
    anomalies: aggregatedStats.anomalies,
  };

  const userPrompt = `Analyze the following aggregated log data and produce the structured report as specified.

${contextSection}### Aggregated Log Statistics
\`\`\`json
${JSON.stringify(statsForPrompt, null, 2)}
\`\`\`

Provide your analysis now.`;

  return { systemPrompt, userPrompt };
}

/**
 * Build system + user prompts for follow-up chat questions.
 *
 * @param {string} question - The user's follow-up question
 * @param {string} reportContext - The original analysis report text
 * @param {Object} aggregatedStats - The aggregated stats object
 * @returns {{ systemPrompt: string, userPrompt: string }}
 */
export function buildChatPrompt(question, reportContext, aggregatedStats) {
  const systemPrompt = `You are a backend API incident analyst continuing a debugging session.

Your responsibility:
CONVERSE: Answer follow-up questions using the provided incident snapshot as your only source of truth. 

Hard constraints:
- Your analysis is limited strictly to what the data shows. If the user asks about something not covered by the provided metrics — such as specific user IDs, database query performance, or infrastructure costs — tell them clearly that this information was not in the log summary and ask them to provide additional data.
- Never reference an endpoint, timestamp, or error message that is not present in the provided JSON.
- Be specific and actionable in your responses.
- Keep responses concise (under 500 words unless more detail is specifically requested).
- At the very end of your response, output a single blank line followed by exactly:
SUGGESTED_QUESTIONS: ["Question 1", "Question 2", "Question 3"]
Where the array contains exactly 3 highly relevant follow-up questions for the user based on the current context.`;

  // Compact stats summary for context
  const compactStats = {
    totalRequests: aggregatedStats.totalRequests,
    totalErrors: aggregatedStats.totalErrors,
    errorRate: aggregatedStats.errorRate,
    anomalies: aggregatedStats.anomalies,
    topErrorMessages: aggregatedStats.topErrorMessages?.slice(0, 5),
  };

  const userPrompt = `### Original Analysis Report
${reportContext}

### Aggregated Data Summary
\`\`\`json
${JSON.stringify(compactStats, null, 2)}
\`\`\`

### Follow-up Question
${question}`;

  return { systemPrompt, userPrompt };
}

/**
 * Limit an object to the top N entries by their .total property.
 */
function limitObject(obj, maxEntries) {
  if (!obj || typeof obj !== 'object') return obj;
  const entries = Object.entries(obj);
  if (entries.length <= maxEntries) return obj;

  // Sort by total descending, take top N
  entries.sort((a, b) => (b[1].total || 0) - (a[1].total || 0));
  const limited = {};
  for (let i = 0; i < maxEntries; i++) {
    limited[entries[i][0]] = entries[i][1];
  }
  return limited;
}
