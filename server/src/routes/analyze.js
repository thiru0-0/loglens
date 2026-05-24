/**
 * POST /api/analyze route.
 *
 * Pipeline: parse logs → aggregate → build prompt → call AI → parse response
 * Stores report in an in-memory Map for follow-up chat.
 */

import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { parseLogs } from '../services/logParser.js';
import { aggregateLogs } from '../services/logAggregator.js';
import { buildAnalysisPrompt } from '../services/promptBuilder.js';
import { callAI, AuthError, AllModelsFailedError } from '../services/aiService.js';
import { parseAIResponse } from '../services/responseParser.js';

const router = Router();

// In-memory report store – shared with chat route via export
export const reportStore = new Map();

router.post('/', async (req, res) => {
  const startTime = Date.now();

  try {
    // -----------------------------------------------------------------------
    // 1. Extract and validate input
    // -----------------------------------------------------------------------
    const { logs, config } = req.body || {};

    if (!logs || typeof logs !== 'string' || logs.trim().length === 0) {
      return res.status(400).json({
        error: 'Invalid input',
        message: 'Request body must include a non-empty "logs" string.',
      });
    }

    // -----------------------------------------------------------------------
    // 2. Parse logs
    // -----------------------------------------------------------------------
    let entries;
    try {
      entries = parseLogs(logs, config?.formatHint);
    } catch (parseErr) {
      console.error('[analyze] Log parsing failed:', parseErr);
      return res.status(422).json({
        error: 'Log parsing failed',
        message: `Could not parse the provided logs: ${parseErr.message}`,
      });
    }

    if (entries.length === 0) {
      return res.status(422).json({
        error: 'No log entries found',
        message:
          'The parser could not extract any log entries from the provided text. Check the log format.',
      });
    }

    // -----------------------------------------------------------------------
    // 3. Aggregate stats
    // -----------------------------------------------------------------------
    let aggregatedStats;
    try {
      aggregatedStats = aggregateLogs(entries);
    } catch (aggErr) {
      console.error('[analyze] Aggregation failed:', aggErr);
      return res.status(500).json({
        error: 'Aggregation failed',
        message: `Failed to compute log statistics: ${aggErr.message}`,
      });
    }

    // -----------------------------------------------------------------------
    // 4. Build AI prompt
    // -----------------------------------------------------------------------
    const { systemPrompt, userPrompt } = buildAnalysisPrompt(
      aggregatedStats,
      config || {}
    );

    // -----------------------------------------------------------------------
    // 5. Call AI
    // -----------------------------------------------------------------------
    let aiResult;
    try {
      aiResult = await callAI(systemPrompt, userPrompt);
    } catch (aiErr) {
      console.error('[analyze] AI call failed:', aiErr);

      if (aiErr instanceof AuthError) {
        return res.status(401).json({
          error: 'Authentication error',
          message: aiErr.message,
        });
      }
      if (aiErr instanceof AllModelsFailedError) {
        return res.status(502).json({
          error: 'AI service unavailable',
          message: aiErr.message,
          attempts: aiErr.attempts,
        });
      }
      return res.status(502).json({
        error: 'AI service error',
        message: `AI call failed: ${aiErr.message}`,
      });
    }

    // -----------------------------------------------------------------------
    // 6. Parse AI response into sections
    // -----------------------------------------------------------------------
    const report = parseAIResponse(aiResult.content);

    // -----------------------------------------------------------------------
    // 7. Generate report ID and store
    // -----------------------------------------------------------------------
    const id = uuidv4();
    const timestamp = new Date().toISOString();

    const storedReport = {
      id,
      report,
      aggregatedStats,
      model: aiResult.model,
      timestamp,
      rawAIResponse: aiResult.content,
    };

    reportStore.set(id, storedReport);

    // Evict old reports if store grows too large (keep last 100)
    if (reportStore.size > 100) {
      const keys = [...reportStore.keys()];
      for (let i = 0; i < keys.length - 100; i++) {
        reportStore.delete(keys[i]);
      }
    }

    // -----------------------------------------------------------------------
    // 8. Respond
    // -----------------------------------------------------------------------
    const elapsed = Date.now() - startTime;
    console.log(
      `[analyze] Completed in ${elapsed}ms – ${entries.length} entries, model: ${aiResult.model}`
    );

    return res.status(200).json({
      id,
      report,
      aggregatedStats,
      model: aiResult.model,
      timestamp,
    });
  } catch (err) {
    console.error('[analyze] Unexpected error:', err);
    return res.status(500).json({
      error: 'Internal server error',
      message: err.message || 'An unexpected error occurred.',
    });
  }
});

export default router;
