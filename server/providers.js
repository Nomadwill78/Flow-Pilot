/**
 * LLM provider abstraction.
 *
 * Two protocols cover essentially the whole market:
 *   - "anthropic": the Anthropic Messages API
 *   - "openai":    the OpenAI Chat Completions shape, which OpenAI, Groq,
 *                  Together, OpenRouter, Alibaba DashScope, Ollama, vLLM and
 *                  most others also speak
 *
 * Switching providers is a change to .env, not to code — which is exactly what
 * you want when a customer says "we're an Azure shop" or "it has to run
 * on-prem".
 */

const PROTOCOL = (process.env.LLM_PROTOCOL || 'anthropic').toLowerCase();
const BASE_URL = (process.env.LLM_BASE_URL || 'https://api.anthropic.com/v1').replace(/\/$/, '');
const API_KEY = process.env.LLM_API_KEY;
const MODEL = process.env.LLM_MODEL || 'claude-sonnet-5';
const MAX_TOKENS = Number(process.env.MAX_TOKENS || 1024);
const TIMEOUT_MS = Number(process.env.LLM_TIMEOUT_MS || 45_000);

if (!API_KEY) {
  console.warn('[FlowPilot] LLM_API_KEY is not set — model calls will fail.');
}

/**
 * Call the configured model.
 *
 * @param {{ system: string, messages: Array<{role: string, content: string}> }} params
 * @returns {Promise<string>} Raw text of the model's reply.
 */
export async function callModel({ system, messages }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    return PROTOCOL === 'anthropic'
      ? await callAnthropic({ system, messages, signal: controller.signal })
      : await callOpenAICompatible({ system, messages, signal: controller.signal });
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('Model request timed out.');
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function callAnthropic({ system, messages, signal }) {
  const response = await fetch(`${BASE_URL}/messages`, {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system,
      messages: messages.length ? messages : [{ role: 'user', content: 'Hello' }],
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Anthropic ${response.status}: ${detail.slice(0, 300)}`);
  }

  const json = await response.json();
  return (json.content || [])
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('\n');
}

async function callOpenAICompatible({ system, messages, signal }) {
  const response = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      messages: [{ role: 'system', content: system }, ...messages],
      // Most OpenAI-compatible servers honour this; the parser tolerates
      // providers that ignore it.
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Provider ${response.status}: ${detail.slice(0, 300)}`);
  }

  const json = await response.json();
  return json.choices?.[0]?.message?.content ?? '';
}
