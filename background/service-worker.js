/* ═══════════════════════════════════════════════════════════════════
   Aria — Service Worker (Background)
   Central message router: side panel ↔ AI ↔ browser ↔ content scripts
   ═══════════════════════════════════════════════════════════════════ */
import { MSG_TYPES, RESPONSE_LENGTH_PROMPTS, DEFAULT_SETTINGS } from '../shared/constants.js';
import { loadSettings, parseJSON } from '../shared/utils.js';
import { getAIClient, getFastClient, quickChat, clearClientCache, correctSearchQuery, optimizeSearchQuery, fetchPoeModels } from './ai-client.js';
import { classifyIntent } from './intent-classifier.js';
import * as browser from './browser-controller.js';
import * as tts from './tts-engine.js';
import * as plan from './plan-engine.js';

// ── Streaming flag ───────────────────────────────────
let streamingEnabled = true;

// ── Session Memory (scratchpad that persists across chat messages) ──
let sessionMemory = {
  notes: [],          // AI observations, extracted data
  urls: [],           // recently visited URLs
  lastAction: null,   // last browser action taken
  taskContext: '',     // what the user is doing (inferred)
};

function addSessionNote(note) {
  sessionMemory.notes.push(note);
  if (sessionMemory.notes.length > 30) sessionMemory.notes = sessionMemory.notes.slice(-30);
}

function addSessionUrl(url, title) {
  const last = sessionMemory.urls[sessionMemory.urls.length - 1];
  if (last?.url === url) return;
  sessionMemory.urls.push({ url, title, time: Date.now() });
  if (sessionMemory.urls.length > 20) sessionMemory.urls = sessionMemory.urls.slice(-20);
}

function buildSessionContext() {
  const parts = [];
  if (sessionMemory.taskContext) parts.push(`Current task: ${sessionMemory.taskContext}`);
  if (sessionMemory.urls.length) {
    const recent = sessionMemory.urls.slice(-5).map(u => `  ${u.title || u.url}`).join('\n');
    parts.push(`Recent pages:\n${recent}`);
  }
  if (sessionMemory.notes.length) {
    const notes = sessionMemory.notes.slice(-10).join('\n  ');
    parts.push(`Notes:\n  ${notes}`);
  }
  return parts.length ? `\n─── SESSION MEMORY ───\n${parts.join('\n')}` : '';
}

// ── Side Panel Setup ─────────────────────────────────
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

// ── Context Menu ─────────────────────────────────────
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'aria-summarize',
    title: 'Ask Aria about this page',
    contexts: ['page'],
  });
  chrome.contextMenus.create({
    id: 'aria-selection',
    title: 'Ask Aria about "%s"',
    contexts: ['selection'],
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  // Open side panel first
  await chrome.sidePanel.open({ tabId: tab.id });

  if (info.menuItemId === 'aria-summarize') {
    await handleChat({ message: 'Summarize this page', history: [] });
  } else if (info.menuItemId === 'aria-selection' && info.selectionText) {
    await handleChat({ message: `Explain: ${info.selectionText}`, history: [] });
  }
});

// ── Message Router ───────────────────────────────────
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // Only accept messages from our own extension
  if (sender.id !== chrome.runtime.id) return;

  // Route based on message type
  switch (msg.type) {
    case MSG_TYPES.CHAT_MESSAGE:
      handleChat(msg);
      break;
    case MSG_TYPES.CREATE_PLAN:
      handleCreatePlan(msg);
      break;
    case MSG_TYPES.EXECUTE_STEP:
      handleExecuteStep();
      break;
    case MSG_TYPES.EXECUTE_ALL:
      handleExecuteAll();
      break;
    case MSG_TYPES.CANCEL_PLAN:
      handleCancelPlan();
      break;
    case MSG_TYPES.CONFIRM_ACTION:
      handleConfirmAction(msg);
      break;
    case MSG_TYPES.TTS_SPEAK:
      handleTTSSpeak(msg);
      break;
    case MSG_TYPES.TTS_STOP:
      tts.stopChromeTTS();
      break;

    // Saved routines
    case MSG_TYPES.SAVE_ROUTINE:
      handleSaveRoutine(msg);
      break;
    case MSG_TYPES.LOAD_ROUTINE:
      handleLoadRoutine(msg);
      break;
    case MSG_TYPES.DELETE_ROUTINE:
      handleDeleteRoutine(msg);
      break;
    case MSG_TYPES.LIST_ROUTINES:
      handleListRoutines(true);
      break;

    // Session memory
    case MSG_TYPES.SESSION_MEMORY:
      if (msg.action === 'clear') {
        sessionMemory = { notes: [], urls: [], lastAction: null, taskContext: '' };
      }
      break;

    // POE model discovery
    case MSG_TYPES.FETCH_POE_MODELS:
      fetchPoeModels(msg.apiKey).then(models => {
        sendResponse({ models });
      });
      return true; // async sendResponse

    // STT messages pass through between relay tab ↔ side panel — ignore in SW
    case 'STT_START':
    case 'STT_STOP':
    case 'MIC_PERMISSION_GRANTED':
    case 'STT_STARTED':
    case 'STT_RESULT':
    case 'STT_ERROR':
    case 'STT_ENDED':
      break;
  }
  // Return true for async responses (not needed for fire-and-forget pattern)
  return false;
});

// ── Broadcast to Side Panel ──────────────────────────
function broadcast(msg) {
  chrome.runtime.sendMessage(msg).catch(() => {
    // Side panel may not be open — ignore
  });
}

// ── Chat Handler ─────────────────────────────────────
async function handleChat(msg) {
  try {
    const settings = await loadSettings();
    const level = settings.responseLength || DEFAULT_SETTINGS.responseLength;

    // Get current page context for smart decisions
    const pageContext = await browser.getPageInfo().catch(() => ({}));

    // Classify intent with page awareness
    const intent = await classifyIntent(msg.message, pageContext);

    // Handle routine fast-path actions immediately
    if (intent.action === 'listRoutines') {
      await handleListRoutines();
      return;
    }
    if (intent.action === 'loadRoutine' && intent.params) {
      await handleLoadRoutine({ name: intent.params });
      return;
    }
    if (intent.action === 'saveRoutine') {
      const name = intent.params || 'Untitled Routine';
      const activePlan = plan.getPlan();
      if (!activePlan) {
        broadcast({ type: MSG_TYPES.CHAT_RESPONSE, response: "No active plan to save. Run a multi-step task first, then say 'save this as a routine'.", strategy: 'direct' });
        return;
      }
      await handleSaveRoutine({ name, task: activePlan.task });
      return;
    }

    let response = '';
    let strategy = intent.strategy;
    let actionDescription = '';
    let streamed = false;

    switch (strategy) {
      case 'browser_action':
        ({ response, actionDescription } = await handleBrowserAction(intent, msg, settings, level, pageContext));
        break;

      case 'web_search':
        ({ response, actionDescription } = await handleWebSearch(intent, msg, settings, level));
        break;

      case 'page_read':
        ({ response } = await handlePageRead(intent, msg, settings, level));
        break;

      case 'plan':
        // Redirect to plan creation
        await handleCreatePlan({ task: intent.planDescription || msg.message });
        return;

      case 'clarify':
        // Ask the user for clarification instead of acting
        response = intent.question || 'Could you clarify what you mean?';
        strategy = 'direct'; // Display as a normal AI response
        break;

      case 'direct':
      default:
        ({ response, streamed } = await handleDirectResponse(msg, settings, level));
        break;
    }

    // If already streamed, don't send full response again
    if (!streamed) {
      broadcast({
        type: MSG_TYPES.CHAT_RESPONSE,
        response,
        strategy,
        actionDescription,
      });
    }

  } catch (e) {
    console.error('[Aria] Chat error:', e);
    broadcast({ type: MSG_TYPES.ERROR, message: e.message });
  }
}

// ── Strategy Handlers ────────────────────────────────

async function handleBrowserAction(intent, msg, settings, level, pageContext = {}) {
  let actionDescription = '';
  let response = '';

  // Natural confirmations for fast-path actions (instead of robotic messages)
  const quickConfirm = {
    navigateNewTab: 'Done — new tab opened.',
    newTab:         'Done — new tab opened.',
    navigate:       'On it.',
    searchGoogle:   'Searching now.',
    search:         'Searching now.',
    goBack:         'Going back.',
    goForward:      'Going forward.',
    closeTab:       'Tab closed.',
    reloadPage:     'Reloading.',
    scroll:         'Done.',
    click:          'Done.',
    bookmark:       'Bookmarked.',
    zoomIn:         'Zoomed in.',
    zoomOut:        'Zoomed out.',
    zoomReset:      'Zoom reset.',
    fullscreen:     'Going fullscreen.',
    screenshot:     'Screenshot taken.',
    print:          'Opening print dialog.',
    closePopups:    'Done — closing popups.',
    signInWithGoogle: 'Signing in with Google.',
  };

  // If fast-path matched a direct action, execute immediately
  if (intent.action) {
    // Spell-correct and optimize search queries before executing
    if ((intent.action === 'searchGoogle' || intent.action === 'search') && intent.params) {
      const original = intent.params;
      intent.params = await correctSearchQuery(intent.params);
      const siteCtx = pageContext.url ? `Searching on: ${pageContext.title || pageContext.url}` : '';
      intent.params = await optimizeSearchQuery(intent.params, siteCtx);
      if (intent.params !== original) {
        broadcast({ type: MSG_TYPES.CHAT_RESPONSE, response: `🔍 *"${original}"* → **${intent.params}**`, strategy: 'direct' });
      }
    }

    const result = await browser.dispatchAction({
      type: intent.action,
      ...(intent.params !== undefined ? parseActionParams(intent.action, intent.params) : {}),
    });
    actionDescription = result.message || intent.action;
    response = quickConfirm[intent.action] || actionDescription;

    // Track in session memory
    sessionMemory.lastAction = intent.action;
    const pageInfo = await browser.getPageInfo().catch(() => ({}));
    if (pageInfo.url) addSessionUrl(pageInfo.url, pageInfo.title);
  } else {
    // Use AI + screenshot in a multi-action loop — keeps going until goal is complete
    const client = await getAIClient();
    const MAX_ACTIONS = 5;
    const actionHistory = [];
    let scrollMemory = '';

    for (let i = 0; i < MAX_ACTIONS; i++) {
      // Smart page-load waiting on first iteration or after navigation
      if (i === 0 || (actionHistory.length > 0 && ['navigate', 'navigateNewTab', 'searchGoogle'].includes(actionHistory[actionHistory.length - 1]?.action))) {
        await browser.waitForPageReady(null, 5000);
      }

      const screenshot = await browser.captureScreenshot();
      const currentPage = await browser.getPageInfo().catch(() => pageContext);
      const pageDesc = currentPage.url ? `\nCurrent page: "${currentPage.title || ''}" (${currentPage.url})` : '';

      // Track URL in session memory
      if (currentPage.url) addSessionUrl(currentPage.url, currentPage.title);

      // CAPTCHA detection — stop and hand off to user
      const captchaCheck = await browser.detectCaptcha();
      if (captchaCheck.hasCaptcha) {
        broadcast({ type: MSG_TYPES.CAPTCHA_DETECTED, signals: captchaCheck.signals });
        response = `I've hit a CAPTCHA (${captchaCheck.signals.join(', ')}). Please solve it manually, then tell me to continue.`;
        break;
      }

      // Broadcast screenshot to chat only at milestones:
      // first iteration, after navigation, or last action
      const lastAction = actionHistory[actionHistory.length - 1]?.action;
      const afterNav = lastAction && ['navigate', 'navigateNewTab', 'searchGoogle', 'search', 'goBack', 'goForward'].includes(lastAction);
      const isMilestone = i === 0 || afterNav;
      if (settings.showScreenshotsInChat && screenshot.success && isMilestone) {
        broadcast({ type: MSG_TYPES.SCREENSHOT_TAKEN, imageB64: screenshot.imageB64 });
      }

      // Read page structure for better awareness (forms, interactive elements)
      let pageStructure = '';
      try {
        const forms = await browser.readPageContent('forms');
        if (forms.success && forms.content) pageStructure += `\nPage interactive elements:\n${forms.content}`;
      } catch { /* content script may not be injected yet */ }

      // Inject user profile if forms are present on the page
      const profileContext = pageStructure.includes('input') || pageStructure.includes('form')
        ? buildProfileContext(settings) : '';

      // Build multi-tab context
      let tabContext = '';
      try {
        const tabs = await browser.getTabContext();
        if (tabs.length > 1) {
          const tabList = tabs.map(t => `  ${t.active ? '→' : ' '} Tab ${t.index}: ${t.title} (${t.url})`).join('\n');
          tabContext = `\n\nOpen tabs (${tabs.length}):\n${tabList}`;
        }
      } catch {}

      // Build session memory context
      const sessionCtx = settings.sessionMemoryEnabled !== false ? buildSessionContext() : '';

      const actionInstructions = ` You control a Chrome browser. Based on the user's request, the current page context, and the screenshot, decide what action to take.${pageDesc}${pageStructure}${tabContext}${sessionCtx}

You MUST respond with valid JSON in this exact format:
{"thought": "brief reasoning", "message": "short user-facing message", "action": {"type": "ACTION_TYPE", ...params}}

When the goal is FULLY COMPLETE, respond with:
{"done": true, "message": "description of what was accomplished"}

Available action types and their params:
- navigate: {"type":"navigate","url":"https://example.com"} — open URL in current tab
- navigateNewTab: {"type":"navigateNewTab","url":"https://example.com"} — open URL in NEW tab (preserves current)
- click: {"type":"click","selector":"CSS selector"} — click an element
- type: {"type":"type","selector":"CSS selector","text":"text to type"} — type into a field
- press: {"type":"press","key":"Enter"} — press a key (Enter, Tab, Escape, etc.)
- scroll: {"type":"scroll","direction":"down"} — scroll up/down
- goBack: {"type":"goBack"} — go back
- goForward: {"type":"goForward"} — go forward  
- newTab: {"type":"newTab","url":"optional URL"} — open new tab
- closeTab: {"type":"closeTab"} — close current tab
- searchGoogle: {"type":"searchGoogle","query":"search terms"} — Google search
- none: {"type":"none"} — no action needed, just respond

RULES — USE COMMON SENSE TO COMPLETE THE FULL TASK:
- COMPLETE THE GOAL, not just one step. After typing in a search box, IMMEDIATELY press Enter to submit. Do NOT scroll or look for a search button — Enter works on 95% of search boxes.
- "open X in a new tab" → use navigateNewTab, NEVER navigate (which overwrites current tab).
- If the user is on a specific site and asks to search, search ON THAT SITE, not Google.
- If the page shows a redirect notice or confirmation, click through to the intended destination.
- For site names without a URL (e.g. "Trade Me"), use the site name as the url — the system resolves it.
- Look at the screenshot AND page interactive elements to understand what's on screen before deciding.
- Use the page interactive elements list to identify form fields, buttons, and inputs — this tells you what the page offers even if it's not obvious in the screenshot.
IMPORTANT: Always respond with valid JSON only, no markdown or extra text.${profileContext}`;

      const systemPrompt = buildPersonaPrompt(settings, RESPONSE_LENGTH_PROMPTS[level], actionInstructions);
      const messages = buildMessages(msg, systemPrompt);

      // First iteration: add site-search context if applicable
      if (i === 0 && intent.siteSearchQuery) {
        // Spell-correct and optimize the search query
        let correctedQuery = await correctSearchQuery(intent.siteSearchQuery);
        const siteName = currentPage.title || new URL(currentPage.url).hostname;
        correctedQuery = await optimizeSearchQuery(correctedQuery, `Searching on: ${siteName}`);
        if (correctedQuery !== intent.siteSearchQuery) {
          broadcast({ type: MSG_TYPES.CHAT_RESPONSE, response: `🔍 *"${intent.siteSearchQuery}"* → **${correctedQuery}**`, strategy: 'direct' });
        }
        messages.push({
          role: 'user',
          content: `I'm on ${siteName}. Find the search box, type "${correctedQuery}", and press Enter to submit the search. Complete the entire search — don't stop after just typing.`,
        });
      }

      // Subsequent iterations: add action history + scroll memory and continuation prompt
      if (i > 0) {
        const memoryPayload = { actions_completed: actionHistory };
        if (scrollMemory) memoryPayload.scroll_memory = scrollMemory;
        messages.push({
          role: 'assistant',
          content: JSON.stringify(memoryPayload),
        });
        messages.push({
          role: 'user',
          content: 'Look at the updated screenshot. Is the goal fully complete? If YES, respond with {"done": true, "message": "..."}. If more actions are needed to finish the task, provide the next action. REMEMBER: If the task involves finding a superlative (cheapest/best/etc), do NOT declare done until you have scrolled through the ENTIRE page. Your scroll_memory above contains everything you\'ve observed so far — use it to make decisions.',
        });
      }

      const opts = { maxTokens: level <= 3 ? 400 : 1024, temperature: 0.3 };
      if (screenshot.success) opts.imageB64 = screenshot.imageB64;

      const result = await client.sendMessage(messages, opts);
      const parsed = parseJSON(result.text);

      // Check if AI says we're done
      if (!parsed || parsed.done || !parsed.action || parsed.action.type === 'none') {
        response = parsed?.message || result.text;
        // Send final milestone screenshot if we acted at least once
        if (settings.showScreenshotsInChat && screenshot.success && actionHistory.length > 0) {
          broadcast({ type: MSG_TYPES.SCREENSHOT_TAKEN, imageB64: screenshot.imageB64 });
        }
        break;
      }

      // Spell-correct and optimize text being typed into search inputs
      if (parsed.action.type === 'type' && parsed.action.text) {
        const sel = (parsed.action.selector || '').toLowerCase();
        const isSearchField = sel.includes('search') || sel.includes('[type="search"]')
          || sel.includes('[role="searchbox"]') || sel.includes('[name="q"]')
          || sel.includes('[name="query"]') || sel.includes('[name="keyword"]')
          || (parsed.thought || '').toLowerCase().includes('search');
        if (isSearchField) {
          const beforeOpt = parsed.action.text;
          parsed.action.text = await correctSearchQuery(parsed.action.text);
          const siteCtx = currentPage.url ? `Searching on: ${currentPage.title || currentPage.url}` : '';
          parsed.action.text = await optimizeSearchQuery(parsed.action.text, siteCtx);
          if (parsed.action.text !== beforeOpt) {
            broadcast({ type: MSG_TYPES.CHAT_RESPONSE, response: `🔍 *"${beforeOpt}"* → **${parsed.action.text}**`, strategy: 'direct' });
          }
        }
      }

      // Execute the action
      const actionResult = await browser.dispatchAction(parsed.action);
      const desc = actionResult.message || parsed.action.type;
      actionHistory.push({ action: parsed.action.type, result: desc, thought: parsed.thought || '' });
      actionDescription += (actionDescription ? ' ⚡ ' : '') + desc;
      response = parsed.message || parsed.thought || desc;

      // Auto-Enter enforcement: after typing into a search field, immediately press Enter
      // rather than waiting for the AI to do it (it sometimes forgets)
      if (parsed.action.type === 'type' && parsed.action.text) {
        const sel = (parsed.action.selector || '').toLowerCase();
        const thought = (parsed.thought || '').toLowerCase();
        const isSearch = sel.includes('search') || sel.includes('[type="search"]')
          || sel.includes('[role="searchbox"]') || sel.includes('[name="q"]')
          || sel.includes('[name="query"]') || sel.includes('[name="keyword"]')
          || thought.includes('search');
        if (isSearch) {
          await new Promise(r => setTimeout(r, 300));
          await browser.dispatchAction({ type: 'press', key: 'Enter' });
          actionHistory.push({ action: 'press', result: 'Enter (auto-submit)', thought: 'Auto-pressed Enter after typing in search field' });
          actionDescription += ' ⚡ Enter (auto)';
        }
      }

      // Track in session memory
      sessionMemory.lastAction = parsed.action.type;
      if (parsed.thought) addSessionNote(parsed.thought);

      // Accumulate scroll memory
      if (parsed.thought) {
        scrollMemory += `[Action ${i + 1}] ${parsed.thought}\n`;
      }

      // Smart wait — use page-ready detection for navigation, shorter for other actions
      const isNav = ['navigate', 'navigateNewTab', 'searchGoogle', 'search'].includes(parsed.action.type);
      const isScroll = parsed.action.type === 'scroll';
      if (isNav) {
        await browser.waitForPageReady(null, 5000);
      } else {
        await new Promise(r => setTimeout(r, isScroll ? 350 : 800));
      }
    }
  }

  return { response, actionDescription };
}

async function handleWebSearch(intent, msg, settings, level) {
  const rawQuery = intent.params || msg.message.replace(/^(search|google)\s+(for\s+)?/i, '').trim();
  let query = await correctSearchQuery(rawQuery);
  query = await optimizeSearchQuery(query);
  if (query !== rawQuery) {
    broadcast({ type: MSG_TYPES.CHAT_RESPONSE, response: `🔍 *"${rawQuery}"* → **${query}**`, strategy: 'direct' });
  }
  const searchResult = await browser.searchGoogle(query);

  // Wait for results to load
  await new Promise(r => setTimeout(r, 2500));

  // Read page content
  const pageContent = await browser.readPageContent('full');
  const content = pageContent.content || '';

  // Summarize search results
  const client = await getAIClient();
  const systemPrompt = buildPersonaPrompt(settings, RESPONSE_LENGTH_PROMPTS[level], ' Analyze these search results and provide a helpful summary.');
  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `Search query: "${query}"\n\nResults:\n${content.substring(0, 8000)}` },
  ];
  const result = await client.sendMessage(messages, { maxTokens: level <= 3 ? 300 : 1500 });

  return { response: result.text, actionDescription: `Searched: ${query}` };
}

async function handlePageRead(intent, msg, settings, level) {
  const readType = intent.action === 'readFirst' ? 'first' : 'full';
  const pageContent = await browser.readPageContent(readType);
  const pageInfo = await browser.getPageInfo();
  const content = pageContent.content || '';

  const client = await getAIClient();
  const systemPrompt = buildPersonaPrompt(settings, RESPONSE_LENGTH_PROMPTS[level]);
  const userMsg = msg.message || 'Summarize this page';
  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `Page: ${pageInfo.title} (${pageInfo.url})\nUser request: ${userMsg}\n\nContent:\n${content.substring(0, 12000)}` },
  ];
  const result = await client.sendMessage(messages, { maxTokens: level <= 3 ? 400 : 2000 });

  return { response: result.text };
}

async function handleDirectResponse(msg, settings, level) {
  const client = await getAIClient();
  const sessionCtx = settings.sessionMemoryEnabled !== false ? buildSessionContext() : '';
  const systemPrompt = buildPersonaPrompt(settings, RESPONSE_LENGTH_PROMPTS[level], sessionCtx);
  const messages = buildMessages(msg, systemPrompt);
  const opts = { maxTokens: level <= 3 ? 300 : level <= 6 ? 800 : 2000 };

  // Include images if present
  if (msg.images && msg.images.length) {
    opts.imageB64 = msg.images[0].b64;
  }

  // Try streaming if enabled
  if (streamingEnabled && client.sendMessageStreaming) {
    try {
      let full = '';
      broadcast({ type: MSG_TYPES.STREAM_CHUNK, chunk: '', strategy: 'direct', isFirst: true });
      for await (const chunk of client.sendMessageStreaming(messages, opts)) {
        full += chunk;
        broadcast({ type: MSG_TYPES.STREAM_CHUNK, chunk });
      }
      broadcast({ type: MSG_TYPES.STREAM_END, strategy: 'direct' });
      return { response: full, streamed: true };
    } catch (e) {
      console.warn('[Aria] Streaming failed, falling back to non-streaming:', e.message);
    }
  }

  const result = await client.sendMessage(messages, opts);
  return { response: result.text };
}

// ── Plan Handlers ────────────────────────────────────

async function handleCreatePlan(msg) {
  try {
    broadcast({ type: MSG_TYPES.STATUS_UPDATE, status: 'working', text: 'Creating plan…' });
    const imageB64 = msg.images?.[0]?.b64 || null;
    const result = await plan.createPlan(msg.task, imageB64);

    if (!result.success) {
      broadcast({ type: MSG_TYPES.ERROR, message: result.message });
      return;
    }

    broadcast({
      type: MSG_TYPES.PLAN_CREATED,
      plan: result.plan,
      message: result.message,
      needsClarification: result.needs_clarification,
      question: result.question,
    });
  } catch (e) {
    broadcast({ type: MSG_TYPES.ERROR, message: 'Plan creation failed: ' + e.message });
  }
}

async function handleExecuteStep() {
  try {
    broadcast({ type: MSG_TYPES.STATUS_UPDATE, status: 'working', text: 'Executing step…' });
    const result = await plan.executeStep();

    broadcast({
      type: MSG_TYPES.STEP_RESULT,
      ...result,
    });
  } catch (e) {
    broadcast({ type: MSG_TYPES.ERROR, message: 'Step failed: ' + e.message });
  }
}

async function handleExecuteAll() {
  try {
    const settings = await loadSettings();
    const showDetail = settings.planShowStepDetail !== false;

    await plan.executeAll((update) => {
      switch (update.type) {
        case 'step_start':
          if (showDetail) {
            broadcast({
              type: MSG_TYPES.PLAN_UPDATE,
              step: update.step,
              totalSteps: update.total_steps,
              description: update.description,
              method: update.method,
            });
          }
          break;
        case 'step_result':
          if (showDetail) {
            broadcast({ type: MSG_TYPES.STEP_RESULT, ...update });
          }
          break;
        case 'step_retry':
          broadcast({ type: MSG_TYPES.PLAN_UPDATE, step: update.step, description: `Retrying: ${update.reason}`, method: 'retry' });
          break;
        case 'needs_confirmation':
          broadcast({ type: MSG_TYPES.NEED_CONFIRMATION, step: update.step, message: update.message });
          break;
        case 'needs_clarification':
          broadcast({ type: MSG_TYPES.NEED_CONFIRMATION, step: update.step, message: update.message, isClarification: true });
          break;
        case 'complete':
          broadcast({ type: MSG_TYPES.PLAN_COMPLETE, message: update.message });
          break;
      }
    });
  } catch (e) {
    broadcast({ type: MSG_TYPES.ERROR, message: 'Plan execution failed: ' + e.message });
  }
}

function handleCancelPlan() {
  plan.cancelPlan();
  broadcast({ type: MSG_TYPES.PLAN_COMPLETE, message: 'Plan cancelled.' });
}

async function handleConfirmAction(msg) {
  try {
    const result = await plan.confirmStep(msg.action);
    broadcast({ type: MSG_TYPES.STEP_RESULT, ...result });

    // After retry, confirm, or skip, resume executing remaining steps
    if ((msg.action === 'retry' || msg.action === 'confirm' || msg.action === 'skip') && result.status !== 'error' && result.status !== 'plan_complete') {
      handleExecuteAll();
    }
  } catch (e) {
    broadcast({ type: MSG_TYPES.ERROR, message: e.message });
  }
}

// ── TTS Handler ──────────────────────────────────────
async function handleTTSSpeak(msg) {
  try {
    const result = await tts.speak(msg.text);
    // Forward to side panel for playback if webspeech or elevenlabs
    if (result.method === 'webspeech' || result.method === 'elevenlabs') {
      broadcast({ type: MSG_TYPES.TTS_SPEAK, ...result });
    }
  } catch (e) {
    console.warn('[Aria TTS]', e.message);
  }
}

// ── Saved Routines Handlers ──────────────────────────

async function handleSaveRoutine(msg) {
  try {
    const data = await chrome.storage.local.get('savedRoutines');
    const routines = data.savedRoutines || [];
    routines.push({
      id: Date.now(),
      name: msg.name || `Routine ${routines.length + 1}`,
      task: msg.task,
      createdAt: new Date().toISOString(),
    });
    await chrome.storage.local.set({ savedRoutines: routines });
    broadcast({ type: MSG_TYPES.ROUTINES_LIST, routines });
    broadcast({ type: MSG_TYPES.CHAT_RESPONSE, response: `Routine "${msg.name}" saved! Say "run routine ${msg.name}" to replay it.`, strategy: 'direct' });
  } catch (e) {
    broadcast({ type: MSG_TYPES.ERROR, message: 'Failed to save routine: ' + e.message });
  }
}

async function handleLoadRoutine(msg) {
  try {
    const data = await chrome.storage.local.get('savedRoutines');
    const routines = data.savedRoutines || [];
    const routine = routines.find(r => r.name.toLowerCase() === (msg.name || '').toLowerCase() || r.id === msg.id);
    if (!routine) {
      broadcast({ type: MSG_TYPES.CHAT_RESPONSE, response: `Routine "${msg.name}" not found. Say "list routines" to see saved routines.`, strategy: 'direct' });
      return;
    }
    // Execute routine as a plan
    await handleCreatePlan({ task: routine.task });
  } catch (e) {
    broadcast({ type: MSG_TYPES.ERROR, message: 'Failed to load routine: ' + e.message });
  }
}

async function handleDeleteRoutine(msg) {
  try {
    const data = await chrome.storage.local.get('savedRoutines');
    let routines = data.savedRoutines || [];
    routines = routines.filter(r => r.name.toLowerCase() !== (msg.name || '').toLowerCase() && r.id !== msg.id);
    await chrome.storage.local.set({ savedRoutines: routines });
    broadcast({ type: MSG_TYPES.ROUTINES_LIST, routines });
    broadcast({ type: MSG_TYPES.CHAT_RESPONSE, response: `Routine "${msg.name}" deleted.`, strategy: 'direct' });
  } catch (e) {
    broadcast({ type: MSG_TYPES.ERROR, message: 'Failed to delete routine: ' + e.message });
  }
}

async function handleListRoutines(silent = false) {
  try {
    const data = await chrome.storage.local.get('savedRoutines');
    const routines = data.savedRoutines || [];
    broadcast({ type: MSG_TYPES.ROUTINES_LIST, routines });
    if (!silent) {
      if (routines.length === 0) {
        broadcast({ type: MSG_TYPES.CHAT_RESPONSE, response: 'No saved routines yet. After I complete a plan, say "save this as a routine" to save it.', strategy: 'direct' });
      } else {
        const list = routines.map((r, i) => `${i + 1}. **${r.name}** — ${r.task}`).join('\n');
        broadcast({ type: MSG_TYPES.CHAT_RESPONSE, response: `Saved routines:\n${list}\n\nSay "run routine [name]" to replay one.`, strategy: 'direct' });
      }
    }
  } catch (e) {
    broadcast({ type: MSG_TYPES.ERROR, message: 'Failed to list routines: ' + e.message });
  }
}

// ── Helpers ──────────────────────────────────────────

function buildPersonaPrompt(settings, levelPrompt, suffix = '') {
  const name = settings.personaName || 'Aria';

  // Custom system prompt overrides everything
  if (settings.customSystemPrompt) {
    return `${settings.customSystemPrompt}\n${levelPrompt}${suffix}`;
  }

  const toneMap = {
    friendly: 'Be warm, friendly, and approachable.',
    casual: 'Be super casual and relaxed, like a chill friend.',
    professional: 'Be professional and efficient.',
    formal: 'Be formal, polished, and precise.',
    sarcastic: 'Be witty and mildly sarcastic, but still helpful.',
  };

  let tone = toneMap[settings.personaTone];

  // Check for custom personality tones (custom_0, custom_1, custom_2)
  if (!tone && settings.personaTone?.startsWith('custom_')) {
    const idx = Number(settings.personaTone.split('_')[1]);
    const customs = settings.customPersonalities || [];
    const custom = customs[idx];
    if (custom?.description) {
      tone = custom.description;
    }
  }

  tone = tone || toneMap.friendly;
  const expertise = settings.personaExpertise
    ? ` You have special expertise in: ${settings.personaExpertise}.`
    : '';

  return `You are ${name}, a helpful AI assistant built into a Chrome browser. ${tone}${expertise} Never say "Noted" or "Noted." — use natural alternatives like "Sure", "On it", "Done", "Will do", "No problem" instead. ${levelPrompt}${suffix}`;
}

/** Build a user profile context string from settings, for injecting into AI prompts when forms are present */
function buildProfileContext(settings) {
  const fields = [
    ['First Name', settings.userFirstName],
    ['Last Name', settings.userLastName],
    ['Email', settings.userEmail],
    ['Phone', settings.userPhone],
    ['Date of Birth', settings.userDob],
    ['Username', settings.userUsername],
    ['Street', settings.userStreet],
    ['City', settings.userCity],
    ['State/Region', settings.userState],
    ['Postcode', settings.userPostcode],
    ['Country', settings.userCountry],
    ['Company', settings.userCompany],
    ['Job Title', settings.userJobTitle],
  ].filter(([, v]) => v);

  if (!fields.length) return '';
  return `\n\n─── USER PROFILE (for auto-filling forms) ───\n${fields.map(([k, v]) => `${k}: ${v}`).join('\n')}\nIMPORTANT: Only use this data when the user explicitly asks you to fill a form, sign up, or register. Never expose this data otherwise. Leave password fields empty — tell the user to enter passwords manually.`;
}

function buildMessages(msg, systemPrompt) {
  const messages = [{ role: 'system', content: systemPrompt }];

  // Add conversation history
  if (msg.history && msg.history.length) {
    for (const h of msg.history.slice(-10)) {
      messages.push({ role: h.role === 'assistant' ? 'assistant' : 'user', content: h.content });
    }
  }

  // Add current message
  messages.push({ role: 'user', content: msg.message });
  return messages;
}

function parseActionParams(action, params) {
  switch (action) {
    case 'navigate':
    case 'navigateNewTab':
    case 'searchGoogle':
      return { url: params, query: params };
    case 'switchTab':
      return { tabIndex: parseInt(params, 10) };
    case 'scroll':
      return { direction: params };
    case 'scrollSlowly':
      return { direction: params };
    case 'scrollTo':
      return { position: params };
    case 'searchBookmarks':
    case 'searchHistory':
    case 'searchDownloads':
      return { query: params };
    case 'startDownload':
      return { url: params };
    case 'createNotification':
      return { title: 'Aria', message: params };
    case 'signInWithGoogle': {
      const ordinals = { first: 0, '1st': 0, second: 1, '2nd': 1, third: 2, '3rd': 2 };
      return { accountIndex: ordinals[(params || '').trim().toLowerCase()] ?? 0 };
    }
    default:
      return {};
  }
}
