/* ═══════════════════════════════════════════════════════════════════
   Aria — AI Client Abstraction Layer
   Multi-provider: OpenAI, Anthropic, POE, Chrome local AI
   ═══════════════════════════════════════════════════════════════════ */
import { DEFAULT_SETTINGS } from '../shared/constants.js';
import { loadSettings, parseJSON } from '../shared/utils.js';

const AI_REQUEST_TIMEOUT = 60000; // 60s timeout for AI requests

function fetchWithTimeout(url, options, timeout = AI_REQUEST_TIMEOUT) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
}

// ── OpenAI Client ───────────────────────────────────────────────

class OpenAIClient {
  constructor(apiKey, model) {
    this.apiKey = apiKey;
    this.model = model || 'gpt-4o';
    this.baseUrl = 'https://api.openai.com/v1/chat/completions';
  }

  get available() { return !!this.apiKey; }
  get name() { return `OpenAI → ${this.model}`; }

  async sendMessage(messages, { maxTokens = 2048, temperature = 0.7, imageB64 = null } = {}) {
    const body = {
      model: this.model,
      messages: this._buildMessages(messages, imageB64),
      max_tokens: maxTokens,
      temperature,
    };

    const resp = await fetchWithTimeout(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`OpenAI ${resp.status}: ${err}`);
    }

    const data = await resp.json();
    return {
      text: data.choices?.[0]?.message?.content || '',
      usage: data.usage,
      model: data.model,
    };
  }

  async *sendMessageStreaming(messages, { maxTokens = 2048, temperature = 0.7, imageB64 = null } = {}) {
    const body = {
      model: this.model,
      messages: this._buildMessages(messages, imageB64),
      max_tokens: maxTokens,
      temperature,
      stream: true,
    };

    const resp = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`OpenAI ${resp.status}: ${err}`);
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data: ')) continue;
        const payload = trimmed.slice(6);
        if (payload === '[DONE]') return;

        try {
          const chunk = JSON.parse(payload);
          const delta = chunk.choices?.[0]?.delta?.content;
          if (delta) yield delta;
        } catch {}
      }
    }
  }

  _buildMessages(messages, imageB64) {
    if (!imageB64) return messages;

    // Attach image to the last user message
    return messages.map((msg, i) => {
      if (i === messages.length - 1 && msg.role === 'user') {
        return {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageB64}` } },
            { type: 'text', text: typeof msg.content === 'string' ? msg.content : msg.content },
          ],
        };
      }
      return msg;
    });
  }
}

// ── Anthropic Client ────────────────────────────────────────────

class AnthropicClient {
  constructor(apiKey, model) {
    this.apiKey = apiKey;
    this.model = model || 'claude-sonnet-4-20250514';
    this.baseUrl = 'https://api.anthropic.com/v1/messages';
  }

  get available() { return !!this.apiKey; }
  get name() { return `Anthropic → ${this.model}`; }

  async sendMessage(messages, { maxTokens = 2048, temperature = 0.7, imageB64 = null } = {}) {
    // Extract system prompt
    let system = '';
    const filtered = [];
    for (const msg of messages) {
      if (msg.role === 'system') {
        system += (system ? '\n' : '') + msg.content;
      } else {
        filtered.push(msg);
      }
    }

    // Attach image to last user message as Anthropic content blocks
    const apiMessages = this._buildMessages(filtered, imageB64);

    const body = {
      model: this.model,
      max_tokens: maxTokens,
      temperature,
      messages: apiMessages,
    };
    if (system) body.system = system;

    const resp = await fetchWithTimeout(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`Anthropic ${resp.status}: ${err}`);
    }

    const data = await resp.json();
    const text = data.content?.map(b => b.text).join('') || '';
    return { text, usage: data.usage, model: data.model };
  }

  async *sendMessageStreaming(messages, { maxTokens = 2048, temperature = 0.7, imageB64 = null } = {}) {
    let system = '';
    const filtered = [];
    for (const msg of messages) {
      if (msg.role === 'system') {
        system += (system ? '\n' : '') + msg.content;
      } else {
        filtered.push(msg);
      }
    }

    const body = {
      model: this.model,
      max_tokens: maxTokens,
      temperature,
      messages: this._buildMessages(filtered, imageB64),
      stream: true,
    };
    if (system) body.system = system;

    const resp = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify(body),
    });

    if (!resp.ok) throw new Error(`Anthropic ${resp.status}: ${await resp.text()}`);

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data: ')) continue;
        try {
          const event = JSON.parse(trimmed.slice(6));
          if (event.type === 'content_block_delta' && event.delta?.text) {
            yield event.delta.text;
          }
        } catch {}
      }
    }
  }

  _buildMessages(messages, imageB64) {
    if (!imageB64) {
      // Anthropic expects content to be string or content blocks
      return messages.map(m => ({
        role: m.role,
        content: typeof m.content === 'string' ? m.content : m.content,
      }));
    }

    return messages.map((msg, i) => {
      if (i === messages.length - 1 && msg.role === 'user') {
        return {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: imageB64 } },
            { type: 'text', text: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content) },
          ],
        };
      }
      return { role: msg.role, content: msg.content };
    });
  }
}

// ── POE Model Discovery & Resolution ────────────────────────────

let _poeModelCache = null;  // { models: [...], ts: Date.now() }
const POE_CACHE_TTL = 30 * 60 * 1000; // 30 min

/**
 * Fetch available models from POE's API.
 * Returns an array of model-id strings, e.g. ['GPT-4o', 'Claude-3.5-Sonnet', ...].
 */
export async function fetchPoeModels(apiKey) {
  if (!apiKey) return [];

  // Return cache if fresh
  if (_poeModelCache && Date.now() - _poeModelCache.ts < POE_CACHE_TTL) {
    return _poeModelCache.models;
  }

  try {
    const resp = await fetchWithTimeout('https://api.poe.com/v1/models', {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${apiKey}` },
    }, 15000);

    if (!resp.ok) {
      console.warn(`[Aria POE] /v1/models returned ${resp.status}`);
      return [];
    }

    const data = await resp.json();
    const models = (data.data || []).map(m => m.id).filter(Boolean);
    _poeModelCache = { models, ts: Date.now() };
    console.log(`[Aria POE] Fetched ${models.length} models from POE`);
    return models;
  } catch (e) {
    console.warn('[Aria POE] Model fetch failed:', e.message);
    return [];
  }
}

/**
 * Resolve a user-selected model name to the best matching actual POE bot name.
 * Uses fuzzy matching: normalises case, punctuation, version numbers.
 */
export async function resolvePoeModel(apiKey, desiredModel) {
  if (!desiredModel) return 'GPT-4o';

  const models = await fetchPoeModels(apiKey);
  if (!models.length) return desiredModel; // Can't verify — use as-is

  // Exact match
  if (models.includes(desiredModel)) return desiredModel;

  // Case-insensitive match
  const lowerDesired = desiredModel.toLowerCase();
  const ciMatch = models.find(m => m.toLowerCase() === lowerDesired);
  if (ciMatch) return ciMatch;

  // Normalise for fuzzy matching: strip dashes/spaces/dots, lowercase
  const normalise = s => s.toLowerCase().replace(/[-_.\s]/g, '');
  const normDesired = normalise(desiredModel);
  const normMatch = models.find(m => normalise(m) === normDesired);
  if (normMatch) return normMatch;

  // Partial/keyword matching: extract key terms from desired name
  // e.g. "Claude-4-Opus" → look for models containing "claude" AND "opus"
  const keywords = desiredModel.toLowerCase().split(/[-_.\s]+/).filter(k => k.length > 1);
  if (keywords.length >= 2) {
    const candidates = models.filter(m => {
      const ml = m.toLowerCase();
      return keywords.every(k => ml.includes(k));
    });
    if (candidates.length === 1) return candidates[0];
    // If multiple, prefer the one with the highest version number
    if (candidates.length > 1) {
      // Sort by length (shorter = more specific/canonical), return first
      candidates.sort((a, b) => a.length - b.length);
      return candidates[0];
    }
  }

  // Last resort: find models that share the most keywords
  let bestMatch = null;
  let bestScore = 0;
  for (const m of models) {
    const ml = m.toLowerCase();
    const score = keywords.filter(k => ml.includes(k)).length;
    if (score > bestScore) {
      bestScore = score;
      bestMatch = m;
    }
  }
  if (bestMatch && bestScore >= 1) {
    console.log(`[Aria POE] Fuzzy resolved "${desiredModel}" → "${bestMatch}" (score: ${bestScore}/${keywords.length})`);
    return bestMatch;
  }

  console.warn(`[Aria POE] Could not resolve "${desiredModel}" — using as-is`);
  return desiredModel;
}

/** Clear the POE model cache (call when API key changes). */
export function clearPoeModelCache() {
  _poeModelCache = null;
}

// ── POE Client (OpenAI-compatible) ──────────────────────────────

class POEClient {
  constructor(apiKey, model) {
    this.apiKey = apiKey;
    this._requestedModel = model || 'GPT-4o';
    this._resolvedModel = null;
    this.baseUrl = 'https://api.poe.com/v1/chat/completions';
  }

  get available() { return !!this.apiKey; }
  get model() { return this._resolvedModel || this._requestedModel; }
  get name() { return `POE → ${this.model}`; }

  /** Resolve the model name once (cached per client instance). */
  async _ensureModel() {
    if (!this._resolvedModel) {
      this._resolvedModel = await resolvePoeModel(this.apiKey, this._requestedModel);
      if (this._resolvedModel !== this._requestedModel) {
        console.log(`[Aria POE] Model resolved: "${this._requestedModel}" → "${this._resolvedModel}"`);
      }
    }
    return this._resolvedModel;
  }

  async sendMessage(messages, { maxTokens = 2048, temperature = 0.7, imageB64 = null } = {}) {
    const model = await this._ensureModel();
    const body = {
      model,
      messages: this._buildMessages(messages, imageB64),
      max_tokens: maxTokens,
      temperature,
    };

    const resp = await fetchWithTimeout(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!resp.ok) throw new Error(`POE ${resp.status}: ${await resp.text()}`);

    const data = await resp.json();
    return {
      text: data.choices?.[0]?.message?.content || '',
      usage: data.usage,
      model,
    };
  }

  async *sendMessageStreaming(messages, opts = {}) {
    const model = await this._ensureModel();
    const body = {
      model,
      messages: this._buildMessages(messages, opts.imageB64),
      max_tokens: opts.maxTokens || 2048,
      temperature: opts.temperature || 0.7,
      stream: true,
    };

    const resp = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!resp.ok) throw new Error(`POE ${resp.status}: ${await resp.text()}`);

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data: ')) continue;
        const payload = trimmed.slice(6);
        if (payload === '[DONE]') return;
        try {
          const chunk = JSON.parse(payload);
          const delta = chunk.choices?.[0]?.delta?.content;
          if (delta) yield delta;
        } catch {}
      }
    }
  }

  _buildMessages(messages, imageB64) {
    if (!imageB64) return messages;
    return messages.map((msg, i) => {
      if (i === messages.length - 1 && msg.role === 'user') {
        return {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageB64}` } },
            { type: 'text', text: typeof msg.content === 'string' ? msg.content : msg.content },
          ],
        };
      }
      return msg;
    });
  }
}

// ── Auto Fallback Client ────────────────────────────────────────
// Wraps multiple providers and tries them in priority order.
// If one fails (API error, out of credits, timeout), it
// automatically moves to the next configured provider.

class AutoFallbackClient {
  constructor(clients) {
    // Only keep clients that have API keys configured
    this.clients = clients.filter(c => c.available);
    if (!this.clients.length) {
      throw new Error('No AI provider configured. Open Aria settings and add at least one API key.');
    }
    this._activeIndex = 0;
  }

  get available() { return this.clients.length > 0; }
  get name() { return `Auto → ${this.clients[this._activeIndex]?.name || 'none'}`; }

  async sendMessage(messages, opts = {}) {
    let lastError;
    for (let i = 0; i < this.clients.length; i++) {
      const idx = (this._activeIndex + i) % this.clients.length;
      const client = this.clients[idx];
      try {
        const result = await client.sendMessage(messages, opts);
        // Success — remember this provider for next call
        this._activeIndex = idx;
        return result;
      } catch (e) {
        console.warn(`[Aria Auto] ${client.name} failed: ${e.message} — trying next provider`);
        lastError = e;
      }
    }
    throw lastError;
  }

  async *sendMessageStreaming(messages, opts = {}) {
    let lastError;
    for (let i = 0; i < this.clients.length; i++) {
      const idx = (this._activeIndex + i) % this.clients.length;
      const client = this.clients[idx];
      if (!client.sendMessageStreaming) continue;
      try {
        let gotChunk = false;
        for await (const chunk of client.sendMessageStreaming(messages, opts)) {
          gotChunk = true;
          yield chunk;
        }
        if (gotChunk) {
          this._activeIndex = idx;
          return;
        }
      } catch (e) {
        console.warn(`[Aria Auto] ${client.name} streaming failed: ${e.message} — trying next`);
        lastError = e;
      }
    }
    // If streaming fails on all, fall back to non-streaming
    if (lastError) {
      const result = await this.sendMessage(messages, opts);
      yield result.text;
    }
  }
}

// ── Factory ─────────────────────────────────────────────────────

let _cachedClient = null;
let _cachedProvider = null;
let _cachedFastClient = null;

/**
 * Get the primary AI client based on settings.
 */
export async function getAIClient(forceProvider = null) {
  const settings = await loadSettings();
  const provider = forceProvider || settings.primaryProvider || DEFAULT_SETTINGS.primaryProvider;

  if (_cachedClient && _cachedProvider === provider) return _cachedClient;

  switch (provider) {
    case 'openai':
      _cachedClient = new OpenAIClient(settings.openaiApiKey, settings.openaiModel);
      break;
    case 'anthropic':
      _cachedClient = new AnthropicClient(settings.anthropicApiKey, settings.anthropicModel);
      break;
    case 'poe':
      _cachedClient = new POEClient(settings.poeApiKey, settings.poeModel);
      break;
    case 'auto':
      _cachedClient = new AutoFallbackClient([
        new OpenAIClient(settings.openaiApiKey, settings.openaiModel),
        new AnthropicClient(settings.anthropicApiKey, settings.anthropicModel),
        new POEClient(settings.poeApiKey, settings.poeModel),
      ]);
      break;
    default:
      // Try providers in priority order
      if (settings.openaiApiKey) {
        _cachedClient = new OpenAIClient(settings.openaiApiKey, settings.openaiModel);
      } else if (settings.anthropicApiKey) {
        _cachedClient = new AnthropicClient(settings.anthropicApiKey, settings.anthropicModel);
      } else if (settings.poeApiKey) {
        _cachedClient = new POEClient(settings.poeApiKey, settings.poeModel);
      } else {
        throw new Error('No AI provider configured. Open Aria settings and add an API key.');
      }
  }

  _cachedProvider = provider;
  return _cachedClient;
}

/**
 * Get a fast/cheap client for classification, summarization.
 * Uses the cheapest available option.
 */
export async function getFastClient() {
  if (_cachedFastClient) return _cachedFastClient;
  const settings = await loadSettings();

  // Prefer POE with fast model, then OpenAI mini, then whatever's available
  if (settings.poeApiKey) {
    _cachedFastClient = new POEClient(settings.poeApiKey, 'gpt-4.1-mini');
  } else if (settings.openaiApiKey) {
    _cachedFastClient = new OpenAIClient(settings.openaiApiKey, 'gpt-4o-mini');
  } else if (settings.anthropicApiKey) {
    _cachedFastClient = new AnthropicClient(settings.anthropicApiKey, 'claude-haiku-3-20250414');
  } else {
    // Fall back to primary client
    _cachedFastClient = await getAIClient();
  }

  return _cachedFastClient;
}

/**
 * Clear cached clients (call after settings change).
 */
export function clearClientCache() {
  _cachedClient = null;
  _cachedProvider = null;
  _cachedFastClient = null;
  clearPoeModelCache();
}

/**
 * Quick helper — send a single message and get text back.
 */
export async function quickChat(systemPrompt, userMessage, opts = {}) {
  const client = opts.fast ? await getFastClient() : await getAIClient();
  const messages = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  messages.push({ role: 'user', content: userMessage });
  const result = await client.sendMessage(messages, opts);
  return result.text;
}

// ── Search Query Spell-Correction ────────────────────────────────
// "Did you mean?" — catches typos, missing digits, misheard words from STT
const _correctionCache = new Map();

export async function correctSearchQuery(query) {
  if (!query || query.length < 2) return query;
  if (_correctionCache.has(query)) return _correctionCache.get(query);

  try {
    const result = await quickChat(
      `You are a search query spell-checker. Your ONLY job is to fix obvious typos, missing characters, and misheard words in search queries.

RULES:
- Fix missing digits: "RTX 490" → "RTX 4090", "iPhone 1 Pro" → "iPhone 15 Pro", "PS" → "PS5"
- Fix misspellings: "Nintedo Swich" → "Nintendo Switch", "Samsnug Galaxy" → "Samsung Galaxy"
- Fix misheard words (from voice/STT): "are tee ex" → "RTX", "for tea ninety" → "4090"
- Fix spacing issues: "macbook pro" is fine, but "mac bookpro" → "MacBook Pro"
- Fix obvious brand/product errors: "Iphon" → "iPhone", "Amzon" → "Amazon"
- If the query looks correct or you're not confident, return it UNCHANGED
- NEVER add extra words, rephrase, or change the intent — ONLY fix spelling/typos
- Respond with ONLY the corrected query text, nothing else — no quotes, no explanation`,
      query,
      { fast: true, maxTokens: 80, temperature: 0.1 },
    );

    const corrected = result.trim().replace(/^["']|["']$/g, '');
    if (corrected && corrected.length > 0 && corrected.length < query.length * 3) {
      _correctionCache.set(query, corrected);
      if (_correctionCache.size > 100) {
        const first = _correctionCache.keys().next().value;
        _correctionCache.delete(first);
      }
      if (corrected !== query) {
        console.log(`[Aria Spell] "${query}" → "${corrected}"`);
      }
      return corrected;
    }
  } catch (e) {
    console.warn('[Aria Spell] Correction failed:', e.message);
  }
  return query;
}

// ── Search Query Optimization ────────────────────────────────────
// Rewrites queries so they yield the best results for the user's intent.
// Runs AFTER spell-correction.
const _optimizeCache = new Map();

export async function optimizeSearchQuery(query, context = '') {
  if (!query || query.length < 2) return query;
  const cacheKey = query + '|' + context;
  if (_optimizeCache.has(cacheKey)) return _optimizeCache.get(cacheKey);

  try {
    const result = await quickChat(
      `You are a search query optimizer. Rewrite the user's search query so it yields the BEST results.

RULES:
- Use standard abbreviations & units: "kilowatt hour" → "kWh", "miles per hour" → "mph", "pounds" → "lbs", "inches" → "in", "gigabytes" → "GB"
- Use common product/industry terms: "16 kilowatt hour battery" → "16kWh battery", "noise cancelling headphones" → "ANC headphones"
- Keep it SHORT — search engines prefer concise queries. Remove filler words ("for", "that is", "which has")
- Preserve the user's exact intent — same product/topic, just better search terms
- If the query is already well-optimized, return it UNCHANGED
- NEVER change what the user is searching for — only HOW it's phrased for search
- For shopping/product searches: use model numbers, specs, and industry shorthand
- For general searches: use the most common phrasing people search with
- Respond with ONLY the optimized query, nothing else — no quotes, no explanation
${context ? '\nContext: ' + context : ''}`,
      query,
      { fast: true, maxTokens: 80, temperature: 0.1 },
    );

    const optimized = result.trim().replace(/^["']|["']$/g, '');
    if (optimized && optimized.length > 0 && optimized.length < query.length * 3) {
      _optimizeCache.set(cacheKey, optimized);
      if (_optimizeCache.size > 100) {
        const first = _optimizeCache.keys().next().value;
        _optimizeCache.delete(first);
      }
      if (optimized !== query) {
        console.log(`[Aria Optimize] "${query}" → "${optimized}"`);
      }
      return optimized;
    }
  } catch (e) {
    console.warn('[Aria Optimize] Optimization failed:', e.message);
  }
  return query;
}
