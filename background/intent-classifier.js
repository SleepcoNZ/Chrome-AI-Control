/* ═══════════════════════════════════════════════════════════════════
   Aria — Intent Classifier
   Routes user messages → strategy using fast-path regex + AI fallback
   ═══════════════════════════════════════════════════════════════════ */
import { FAST_PATH_PATTERNS, CLASSIFY_PROMPT, PLAN_TRIGGERS } from '../shared/constants.js';
import { getFastClient } from './ai-client.js';
import { parseJSON } from '../shared/utils.js';

/**
 * Classify user intent into a strategy.
 * Fast-path regex handles obvious commands; AI handles ambiguous ones.
 *
 * Returns: { strategy, action?, params?, reasoning }
 */
export async function classifyIntent(message, pageContext = {}) {
  if (!message) return { strategy: 'direct', reasoning: 'empty message' };

  const text = message.trim();
  const lower = text.toLowerCase();
  const pageUrl = pageContext.url || '';
  const isOnSpecificSite = pageUrl && !pageUrl.startsWith('chrome://') && !pageUrl.startsWith('chrome-extension://') 
    && !pageUrl.includes('google.com/search') && !pageUrl.includes('newtab') && !pageUrl.startsWith('about:');

  // ── Check plan triggers first ───────────────────────────────
  for (const trigger of PLAN_TRIGGERS) {
    if (lower.startsWith(trigger) || lower.includes(trigger)) {
      const desc = extractPlanDescription(text, trigger);
      return {
        strategy: 'plan',
        reasoning: 'Plan trigger phrase detected',
        planDescription: desc || null,
      };
    }
  }

  // ── Multi-step detection (before fast-path) ─────────────────
  // If the message chains multiple distinct actions with commas, "and then", "then", etc.
  // route to plan so the planner can break it into proper steps
  if (looksLikeMultiStep(lower)) {
    return {
      strategy: 'plan',
      reasoning: 'Multiple chained actions detected',
      planDescription: text,
    };
  }

  // ── Fast-path regex matching ────────────────────────────────
  for (const fp of FAST_PATH_PATTERNS) {
    const match = text.match(fp.pattern);
    if (match) {
      // Context-aware override: "search for X" on a specific site should search ON that site,
      // not Google. Route to browser_action so AI uses screenshot to find the search box.
      if ((fp.action === 'searchGoogle' || fp.strategy === 'web_search') && isOnSpecificSite) {
        const query = fp.paramIndex && match[fp.paramIndex] ? match[fp.paramIndex].trim() : text;
        return {
          strategy: 'browser_action',
          // No action — forces AI+screenshot path to figure out how to search on this site
          reasoning: `Search on current site: ${pageUrl}`,
          siteSearchQuery: query,
        };
      }

      const result = {
        strategy: fp.strategy,
        action: fp.action,
        reasoning: 'Fast-path match',
      };

      // Extract parameter if specified
      if (fp.fixedParam) {
        result.params = fp.fixedParam;
      } else if (fp.paramIndex && match[fp.paramIndex]) {
        result.params = match[fp.paramIndex].trim();
      }

      return result;
    }
  }

  // ── AI Classification (for ambiguous requests) ──────────────
  try {
    const client = await getFastClient();
    // Include page context so the AI classifier can make smart decisions
    const contextHint = pageUrl ? `\n[Current page: "${pageContext.title || ''}" — ${pageUrl}]` : '';
    const messages = [
      { role: 'system', content: CLASSIFY_PROMPT },
      { role: 'user', content: text + contextHint },
    ];

    const resp = await client.sendMessage(messages, { maxTokens: 200, temperature: 0.1 });
    const parsed = parseJSON(resp.text);

    if (parsed && parsed.strategy) {
      const strategy = normalizeStrategy(parsed.strategy);
      const result = {
        strategy,
        reasoning: parsed.reasoning || '',
      };

      // Pass through clarification question
      if (strategy === 'clarify' && parsed.question) {
        result.question = parsed.question;
      }

      // Pass through plan description
      if (strategy === 'plan' && parsed.planDescription) {
        result.planDescription = parsed.planDescription;
      }

      return result;
    }
  } catch (e) {
    console.warn('[Aria] Intent classification failed:', e.message);
  }

  // ── Fallback heuristics ─────────────────────────────────────
  // Multi-step detection: look for chained actions with "and then", "then", comma-separated verbs
  const multiStepPattern = /\b(and\s+then|then\s+(?:open|search|find|go|click|navigate|show|compare|draft|compose|write|send|create|reply|edit|fill|submit|play|watch))\b|,\s*(?:then\s+)?(?:open|search|find|go|click|navigate|show|compare|draft|compose|write|send|create|reply|edit|fill|submit|play|watch)\b/i;
  const hasMultipleVerbs = (lower.match(/\b(open|search|find|go to|click|navigate|show|close|type|scroll|download|bookmark|draft|compose|write|send|create|reply|edit|fill|submit|play|watch|listen)\b/gi) || []).length >= 2;
  if (multiStepPattern.test(lower) || (hasMultipleVerbs && (lower.includes(' and ') || lower.includes(' then ')))) {
    return { strategy: 'plan', reasoning: 'Heuristic: multi-step request detected', planDescription: text };
  }

  if (lower.includes('summarize') || lower.includes('summarise') || lower.includes('what\'s on this page')) {
    return { strategy: 'page_read', reasoning: 'Heuristic: page read keyword' };
  }
  if (lower.includes('search') || lower.includes('find') || lower.includes('look up')) {
    // If on a specific site, route to browser_action so AI searches on-site
    if (isOnSpecificSite) {
      return { strategy: 'browser_action', reasoning: 'Heuristic: search on current site', siteSearchQuery: text };
    }
    return { strategy: 'web_search', reasoning: 'Heuristic: search keyword' };
  }
  if (lower.includes('open') || lower.includes('click') || lower.includes('scroll') || lower.includes('go to') || lower.includes('navigate')) {
    return { strategy: 'browser_action', reasoning: 'Heuristic: browser keyword' };
  }

  return { strategy: 'direct', reasoning: 'Default: direct AI response' };
}

// ── Helpers ───────────────────────────────────────────────────

function normalizeStrategy(strategy) {
  const valid = ['direct', 'web_search', 'browser_action', 'page_read', 'plan', 'clarify'];
  if (valid.includes(strategy)) return strategy;
  // Map common aliases
  if (strategy === 'alibaba_nav') return 'browser_action';
  if (strategy === 'web_research') return 'web_search';
  if (strategy === 'multi_step') return 'plan';
  return 'direct';
}

function extractPlanDescription(text, trigger) {
  const lower = text.toLowerCase();
  const idx = lower.indexOf(trigger);
  if (idx === -1) return '';
  let desc = text.substring(idx + trigger.length).trim();
  // Remove leading punctuation
  desc = desc.replace(/^[-:,]\s*/, '').trim();
  return desc.length > 5 ? desc : '';
}

/**
 * Detect if a message contains multiple chained actions.
 * e.g. "open trademe in a new tab, search for kettlebell, find the cheapest, and open it"
 */
function looksLikeMultiStep(lower) {
  // Action verbs that indicate distinct browser/task actions
  const actionVerbsPattern = /\b(open|go to|navigate|search|find|click|scroll|browse|close|switch|type|look for|show me|compare|draft|compose|write|send|create|reply|forward|delete|edit|update|fill|fill out|submit|log in|sign in|sign up|check|read|download|upload|share|post|comment|set up|order|buy|purchase|book|add|remove|play|watch|listen)\b/gi;
  const matches = lower.match(actionVerbsPattern);
  if (!matches || matches.length < 2) return false;

  // Check for chaining indicators: commas between clauses, "then", "and then", "after that"
  const chainingPatterns = /,\s*(then\s+)?(open|go|navigate|search|find|click|scroll|browse|close|switch|type|look|show|compare|draft|compose|write|send|create|reply|forward|delete|edit|update|fill|submit|log|sign|check|read|download|upload|share|post|comment|set|order|buy|purchase|book|add|remove|play|watch|listen)|(\bthen\b|\band then\b|\bafter that\b|\bnext\b)/i;
  if (chainingPatterns.test(lower)) return true;

  // "verb X and verb Y" pattern (two actions joined by "and")
  const andChaining = /\b(open|go to|navigate|search|find|click|scroll|browse|close|switch|type|draft|compose|write|send|create|reply|edit|fill|submit|check|read|download|share|post|play|watch|listen|sign in|log in|sign up|look for|show me|compare)\b.+\band\b.+\b(open|go to|navigate|search|find|click|scroll|browse|close|switch|type|draft|compose|write|send|create|reply|edit|fill|submit|check|read|download|share|post|play|watch|listen|sign in|log in|sign up|look for|show me|compare)\b/i;
  if (andChaining.test(lower)) return true;

  // Multiple commas with action verbs suggest step chaining
  const commaSegments = lower.split(',').filter(s => s.trim().length > 5);
  if (commaSegments.length >= 3) {
    const hasVerb = /\b(open|go to|navigate|search|find|click|scroll|browse|close|switch|type|look for|show me|compare|draft|compose|write|send|create|reply|edit|fill|submit|check|read|download|share|post|play|watch|listen)\b/i;
    const segmentsWithVerbs = commaSegments.filter(s => hasVerb.test(s));
    if (segmentsWithVerbs.length >= 2) return true;
  }

  return false;
}
