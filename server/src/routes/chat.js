/**
 * POST /api/chat route.
 *
 * Handles follow-up questions about a previously generated report.
 * Looks up the report from the in-memory store, builds a chat prompt
 * with context, and returns the AI's answer.
 */

import { Router } from 'express';
import { reportStore } from './analyze.js';
import { buildChatPrompt } from '../services/promptBuilder.js';
import { callAI, AuthError, AllModelsFailedError } from '../services/aiService.js';

const router = Router();

router.post('/', async (req, res) => {
  try {
    // -----------------------------------------------------------------------
    // 1. Extract and validate input
    // -----------------------------------------------------------------------
    const { reportId, question, context } = req.body || {};

    if (!reportId || typeof reportId !== 'string') {
      return res.status(400).json({
        error: 'Invalid input',
        message: 'Request body must include a "reportId" string.',
      });
    }

    if (!question || typeof question !== 'string' || question.trim().length === 0) {
      return res.status(400).json({
        error: 'Invalid input',
        message: 'Request body must include a non-empty "question" string.',
      });
    }

    // -----------------------------------------------------------------------
    // 2. Look up the report
    // -----------------------------------------------------------------------
    let stored = reportStore.get(reportId);

    // Fallback to client-provided context if server memory was cleared
    if (!stored && context) {
      stored = context;
    }

    if (!stored) {
      return res.status(404).json({
        error: 'Report not found',
        message: `No report found with ID "${reportId}". It may have expired or the server was restarted.`,
      });
    }

    // Ensure we handle both server-stored format and frontend-passed context format
    const aiReport = stored.report?.report || stored.report || {};
    const aggregatedStats = stored.aggregatedStats || {};

    // -----------------------------------------------------------------------
    // 3. Build context from the stored report
    // -----------------------------------------------------------------------
    const reportContext = [
      aiReport.executiveSummary || aiReport.summary,
      aiReport.rootCauseAnalysis || aiReport.rootCause,
      aiReport.debuggingRecommendations || aiReport.recommendations,
      aiReport.failureTimeline || aiReport.timeline,
    ]
      .filter(Boolean)
      .join('\n\n');

    const { systemPrompt, userPrompt } = buildChatPrompt(
      question.trim(),
      reportContext,
      aggregatedStats
    );

    // -----------------------------------------------------------------------
    // 4. Call AI
    // -----------------------------------------------------------------------
    let aiResult;
    try {
      aiResult = await callAI(systemPrompt, userPrompt);
    } catch (aiErr) {
      console.error('[chat] AI call failed:', aiErr);

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
        });
      }
      return res.status(502).json({
        error: 'AI service error',
        message: `AI call failed: ${aiErr.message}`,
      });
    }

    // -----------------------------------------------------------------------
    // 5. Respond
    // -----------------------------------------------------------------------
    return res.status(200).json({
      answer: aiResult.content,
      model: aiResult.model,
    });
  } catch (err) {
    console.error('[chat] Unexpected error:', err);
    return res.status(500).json({
      error: 'Internal server error',
      message: err.message || 'An unexpected error occurred.',
    });
  }
});

export default router;
