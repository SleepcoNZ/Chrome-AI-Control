/* ═══════════════════════════════════════════════════════════════════
   Aria — Shared Utilities (JSON parsing, Markdown, helpers)
   ═══════════════════════════════════════════════════════════════════ */

/**
 * Robust JSON extraction from AI text responses.
 * Handles: raw JSON, code-fenced, embedded in prose.
 * Ported from Alibaba agent.py._parse_json()
 */
export function parseJSON(text) {
  if (!text) return null;
  text = text.trim();

  // Direct parse
  try { return JSON.parse(text); } catch {}

  // Code-fenced JSON
  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  if (fenceMatch) {
    try { return JSON.parse(fenceMatch[1].trim()); } catch {}
  }

  // Outermost braces extraction
  let depth = 0, start = null;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '{') {
      if (depth === 0) start = i;
      depth++;
    } else if (text[i] === '}') {
      depth--;
      if (depth === 0 && start !== null) {
        try { return JSON.parse(text.slice(start, i + 1)); } catch { start = null; }
      }
    }
  }
  return null;
}

/**
 * Render basic Markdown to HTML (safe — escapes HTML first).
 * Ported from Alibaba index.html renderMarkdown()
 */
export function renderMarkdown(text) {
  if (!text) return '';
  return text
    // Escape HTML entities
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // Headers
    .replace(/^### (.+)$/gm, '<strong>$1</strong>')
    .replace(/^## (.+)$/gm, '<strong style="font-size:1.05em">$1</strong>')
    .replace(/^# (.+)$/gm, '<strong style="font-size:1.1em">$1</strong>')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code style="background:#f0f0f0;padding:1px 4px;border-radius:3px;font-size:0.9em">$1</code>')
    // Links [text](url) — block javascript: protocol
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, text, url) => {
      if (/^\s*javascript:/i.test(url)) return text;
      return `<a href="${url}" target="_blank" rel="noopener">${text}</a>`;
    })
    // Raw URLs (not already in an <a>)
    .replace(/(?<!href="|">)(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>')
    // Horizontal rules
    .replace(/^---$/gm, '<hr style="border:none;border-top:1px solid #ddd;margin:8px 0">')
    // Line breaks
    .replace(/\n/g, '<br>');
}

/**
 * Truncate text to maxLen with ellipsis.
 */
export function truncate(text, maxLen = 100) {
  if (!text || text.length <= maxLen) return text || '';
  return text.slice(0, maxLen - 1) + '…';
}

/**
 * Load settings from chrome.storage.local (for API keys) + chrome.storage.sync (prefs).
 */
export async function loadSettings() {
  const [local, sync] = await Promise.all([
    chrome.storage.local.get(null),
    chrome.storage.sync.get(null),
  ]);
  return { ...local, ...sync };
}

/**
 * Save settings — API keys to local, everything else to sync.
 */
export async function saveSettings(settings) {
  const keyFields = ['openaiApiKey', 'anthropicApiKey', 'poeApiKey', 'elevenlabsApiKey', 'elevenlabsVoiceId'];
  const local = {};
  const sync = {};

  for (const [key, value] of Object.entries(settings)) {
    if (keyFields.includes(key)) {
      local[key] = value;
    } else {
      sync[key] = value;
    }
  }

  await Promise.all([
    Object.keys(local).length ? chrome.storage.local.set(local) : Promise.resolve(),
    Object.keys(sync).length ? chrome.storage.sync.set(sync) : Promise.resolve(),
  ]);
}

/**
 * Get a setting value with fallback to default.
 */
export function getSetting(settings, key, defaults) {
  return settings[key] !== undefined ? settings[key] : defaults[key];
}

/**
 * Generate a simple unique ID.
 */
export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
