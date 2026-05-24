/**
 * Parse AI markdown response into structured report sections.
 */

const SECTION_KEYS = [
  { key: 'executiveSummary', header: 'Executive Summary' },
  { key: 'rootCauseAnalysis', header: 'Root Cause Analysis' },
  { key: 'debuggingRecommendations', header: 'Debugging Recommendations' },
  { key: 'failureTimeline', header: 'Failure Timeline' },
];

const FALLBACK_KEYWORDS = {
  executiveSummary: ['summary', 'overview', 'introduction', 'situation', 'tl;dr'],
  rootCauseAnalysis: ['root cause', 'cause', 'analysis', 'diagnosis', 'why'],
  debuggingRecommendations: [
    'recommendation', 'debug', 'action', 'step', 'fix', 'remediation', 'mitigation',
  ],
  failureTimeline: ['timeline', 'sequence', 'chronolog', 'event', 'history'],
};

const DEFAULT_TEXT = {
  executiveSummary:
    'No executive summary was generated. The AI response did not contain a clearly labeled summary section.',
  rootCauseAnalysis:
    'No root cause analysis was generated. Consider re-running the analysis with more detailed logs.',
  debuggingRecommendations:
    'No specific debugging recommendations were generated. Review the raw AI response for any actionable insights.',
  failureTimeline:
    'No failure timeline was reconstructed. This may indicate insufficient timestamp data in the logs.',
};

/**
 * Parse an AI markdown response into four report sections.
 *
 * @param {string} markdownText - Raw markdown from the AI
 * @returns {{ executiveSummary: string, rootCauseAnalysis: string, debuggingRecommendations: string, failureTimeline: string }}
 */
export function parseAIResponse(markdownText) {
  if (!markdownText || typeof markdownText !== 'string') {
    return { ...DEFAULT_TEXT };
  }

  const text = markdownText.trim();

  // -----------------------------------------------------------------------
  // Primary strategy: split on ## headers
  // -----------------------------------------------------------------------
  const result = extractByHeaders(text);

  // Check if we got at least 1 section via headers
  const headerHits = Object.values(result).filter((v) => v !== null).length;

  if (headerHits >= 1) {
    // Fill in missing sections with defaults
    return {
      executiveSummary: result.executiveSummary || DEFAULT_TEXT.executiveSummary,
      rootCauseAnalysis: result.rootCauseAnalysis || DEFAULT_TEXT.rootCauseAnalysis,
      debuggingRecommendations:
        result.debuggingRecommendations || DEFAULT_TEXT.debuggingRecommendations,
      failureTimeline: result.failureTimeline || DEFAULT_TEXT.failureTimeline,
    };
  }

  // -----------------------------------------------------------------------
  // Fallback: heuristic keyword splitting
  // -----------------------------------------------------------------------
  return extractByKeywords(text);
}

/**
 * Extract sections by splitting on ## headers.
 */
function extractByHeaders(text) {
  const result = {
    executiveSummary: null,
    rootCauseAnalysis: null,
    debuggingRecommendations: null,
    failureTimeline: null,
  };

  // Find all ## header positions
  const headerRegex = /^##\s+(.+)$/gm;
  const headers = [];
  let match;

  while ((match = headerRegex.exec(text)) !== null) {
    headers.push({
      title: match[1].trim(),
      index: match.index,
      fullMatchLength: match[0].length,
    });
  }

  if (headers.length === 0) return result;

  // Map each header to its content (text until the next ## header)
  for (let i = 0; i < headers.length; i++) {
    const contentStart = headers[i].index + headers[i].fullMatchLength;
    const contentEnd = i + 1 < headers.length ? headers[i + 1].index : text.length;
    const content = text.slice(contentStart, contentEnd).trim();
    const title = headers[i].title.toLowerCase();

    for (const { key, header } of SECTION_KEYS) {
      if (result[key] !== null) continue; // already matched
      if (
        title === header.toLowerCase() ||
        title.includes(header.toLowerCase()) ||
        header.toLowerCase().includes(title)
      ) {
        result[key] = content;
        break;
      }
    }
  }

  return result;
}

/**
 * Fallback: split the text into sections using keyword heuristics.
 * This handles responses that don't use ## headers but still have
 * identifiable section content.
 */
function extractByKeywords(text) {
  const result = {
    executiveSummary: DEFAULT_TEXT.executiveSummary,
    rootCauseAnalysis: DEFAULT_TEXT.rootCauseAnalysis,
    debuggingRecommendations: DEFAULT_TEXT.debuggingRecommendations,
    failureTimeline: DEFAULT_TEXT.failureTimeline,
  };

  const lines = text.split('\n');
  const paragraphs = splitIntoParagraphs(lines);

  if (paragraphs.length === 0) return result;

  // Score each paragraph against each section's keywords
  const assignments = {};

  for (const section of SECTION_KEYS) {
    let bestScore = 0;
    let bestIdx = -1;

    for (let i = 0; i < paragraphs.length; i++) {
      const lower = paragraphs[i].toLowerCase();
      let score = 0;
      for (const kw of FALLBACK_KEYWORDS[section.key]) {
        if (lower.includes(kw)) score++;
      }
      if (score > bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }

    if (bestScore > 0 && bestIdx >= 0) {
      assignments[section.key] = bestIdx;
    }
  }

  // Assign paragraphs – if multiple sections map to the same paragraph,
  // duplicate is fine; each section gets the best-matching paragraph
  for (const [key, idx] of Object.entries(assignments)) {
    result[key] = paragraphs[idx];
  }

  // If no keywords matched at all, put entire text in executiveSummary
  if (Object.keys(assignments).length === 0) {
    result.executiveSummary = text;
  }

  return result;
}

/**
 * Split lines into paragraphs (groups separated by blank lines).
 */
function splitIntoParagraphs(lines) {
  const paragraphs = [];
  let current = [];

  for (const line of lines) {
    if (line.trim() === '') {
      if (current.length > 0) {
        paragraphs.push(current.join('\n').trim());
        current = [];
      }
    } else {
      current.push(line);
    }
  }

  if (current.length > 0) {
    paragraphs.push(current.join('\n').trim());
  }

  return paragraphs;
}
