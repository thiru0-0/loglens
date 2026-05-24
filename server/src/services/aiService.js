/**
 * AI service – OpenRouter integration with model fallback and retry logic.
 */

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

const MODEL_CHAIN = [
  'openrouter/free',
  'deepseek/deepseek-v4-flash:free',
  'google/gemma-4-31b-it:free',
  'qwen/qwen3-next-80b-a3b-instruct:free',
];

const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 2000; // 2s, 4s, 8s
const REQUEST_TIMEOUT_MS = 60000; // 60 seconds
const TEMPERATURE = 0.3;
const MAX_TOKENS = 2000;

// Custom error classes
export class RateLimitError extends Error {
  constructor(message, retryAfter) {
    super(message);
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
}

export class AuthError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AuthError';
  }
}

export class TimeoutError extends Error {
  constructor(message) {
    super(message);
    this.name = 'TimeoutError';
  }
}

export class AllModelsFailedError extends Error {
  constructor(message, attempts) {
    super(message);
    this.name = 'AllModelsFailedError';
    this.attempts = attempts;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Call a single model with retry logic for 429s.
 *
 * @param {string} model - Model identifier
 * @param {string} systemPrompt
 * @param {string} userPrompt
 * @param {string} apiKey
 * @returns {Promise<{content: string, model: string, usage: object}>}
 */
async function callModel(model, systemPrompt, userPrompt, apiKey) {
  let lastError = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(OPENROUTER_URL, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'http://localhost:5173',
          'X-Title': 'LogLens',
        },
        body: JSON.stringify({
          model,
          provider: {
            allow_fallbacks: true,
            ignore: ['z-ai'],
          },
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: TEMPERATURE,
          max_tokens: MAX_TOKENS,
        }),
      });

      clearTimeout(timeout);

      // Auth error – don't retry, don't try other models
      if (response.status === 401 || response.status === 403) {
        const body = await response.text();
        throw new AuthError(
          `Authentication failed (${response.status}): ${body.slice(0, 200)}`
        );
      }

      // Rate limited – retry with backoff
      if (response.status === 429) {
        const retryAfter = response.headers.get('retry-after');
        const backoffMs = BASE_BACKOFF_MS * Math.pow(2, attempt);
        const waitMs = retryAfter
          ? Math.max(parseInt(retryAfter, 10) * 1000, backoffMs)
          : backoffMs;

        lastError = new RateLimitError(
          `Rate limited on model ${model} (attempt ${attempt + 1}/${MAX_RETRIES})`,
          retryAfter
        );

        if (attempt < MAX_RETRIES - 1) {
          await sleep(waitMs);
          continue;
        }
        throw lastError;
      }

      // Other HTTP errors
      if (!response.ok) {
        const body = await response.text();
        throw new Error(
          `OpenRouter API error ${response.status} for model ${model}: ${body.slice(0, 300)}`
        );
      }

      const data = await response.json();

      // Validate response structure
      if (
        !data.choices ||
        !data.choices[0] ||
        !data.choices[0].message ||
        !data.choices[0].message.content
      ) {
        throw new Error(
          `Invalid response structure from model ${model}: ${JSON.stringify(data).slice(0, 300)}`
        );
      }

      return {
        content: data.choices[0].message.content,
        model: data.model || model,
        usage: data.usage || {},
      };
    } catch (err) {
      clearTimeout(timeout);

      // Auth errors should propagate immediately
      if (err instanceof AuthError) {
        throw err;
      }

      // Abort means timeout
      if (err.name === 'AbortError') {
        lastError = new TimeoutError(
          `Request to model ${model} timed out after ${REQUEST_TIMEOUT_MS / 1000}s (attempt ${attempt + 1}/${MAX_RETRIES})`
        );
        if (attempt < MAX_RETRIES - 1) {
          await sleep(BASE_BACKOFF_MS * Math.pow(2, attempt));
          continue;
        }
        throw lastError;
      }

      lastError = err;
      if (attempt < MAX_RETRIES - 1) {
        await sleep(BASE_BACKOFF_MS * Math.pow(2, attempt));
        continue;
      }
    }
  }

  throw lastError || new Error(`All ${MAX_RETRIES} retries failed for model ${model}`);
}

/**
 * Call the AI with model fallback chain.
 *
 * @param {string} systemPrompt - System instructions
 * @param {string} userPrompt - User message with data
 * @returns {Promise<{content: string, model: string, usage: object}>}
 */
export async function callAI(systemPrompt, userPrompt) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new AuthError(
      'OPENROUTER_API_KEY is not set. Please set it in your .env file.'
    );
  }

  const attempts = [];

  for (const model of MODEL_CHAIN) {
    try {
      const result = await callModel(model, systemPrompt, userPrompt, apiKey);
      return result;
    } catch (err) {
      // Auth errors are not model-specific – fail immediately
      if (err instanceof AuthError) {
        throw err;
      }

      attempts.push({ model, error: err.message });
      console.warn(
        `[aiService] Model ${model} failed: ${err.message}. Trying next model...`
      );
      continue;
    }
  }

  throw new AllModelsFailedError(
    `All models in the fallback chain failed. Attempts:\n${attempts.map((a) => `  - ${a.model}: ${a.error}`).join('\n')}`,
    attempts
  );
}
