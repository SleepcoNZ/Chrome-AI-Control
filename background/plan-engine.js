/* ═══════════════════════════════════════════════════════════════════
   Aria — Plan Engine
   Create, execute, and track multi-step plans.
   Ported from Alibaba orchestrator.py + agent.py plan system.
   ═══════════════════════════════════════════════════════════════════ */
import { SMART_PLAN_PROMPT, BROWSER_AGENT_PROMPT, DEFAULT_SETTINGS } from '../shared/constants.js';
import { getAIClient, getFastClient, quickChat, correctSearchQuery } from './ai-client.js';
import { parseJSON, loadSettings } from '../shared/utils.js';
import * as browser from './browser-controller.js';

// ── Helpers ──────────────────────────────────────────────────────

/** Build a user profile context string from settings, for form auto-fill */
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

// ── Plan State ──────────────────────────────────────────────────

let currentPlan = null;      // { task, steps[], currentStep, status, stepResults{} }
let executionLock = false;

// Persist plan to storage so it survives service worker restarts
async function persistPlan() {
  if (currentPlan) {
    await chrome.storage.local.set({ aria_plan: currentPlan });
  } else {
    await chrome.storage.local.remove('aria_plan');
  }
}

// Restore plan on module load
(async () => {
  const data = await chrome.storage.local.get('aria_plan');
  if (data.aria_plan && data.aria_plan.status !== 'complete' && data.aria_plan.status !== 'cancelled') {
    currentPlan = data.aria_plan;
  }
})();

export function getPlan() { return currentPlan; }

export function cancelPlan() {
  if (currentPlan) {
    currentPlan.status = 'cancelled';
    currentPlan = null;
  }
  executionLock = false;
  persistPlan();
  return { success: true, message: 'Plan cancelled' };
}

// ── Create Plan ─────────────────────────────────────────────────

export async function createPlan(task, imageB64 = null) {
  const settings = await loadSettings();
  const maxSteps = settings.planMaxSteps || DEFAULT_SETTINGS.planMaxSteps;

  const prompt = SMART_PLAN_PROMPT.replace('{task}', task);
  const client = await getAIClient();

  // Include page context if available
  let pageContext = '';
  try {
    const pageInfo = await browser.getPageInfo();
    if (pageInfo.success) {
      pageContext = `\n\nCurrent page: ${pageInfo.title} (${pageInfo.url})`;
    }
  } catch {}

  const systemMsg = `You are the planning module for Aria, an AI browser control assistant. Create intelligent multi-method plans. Maximum ${maxSteps} steps.${pageContext}`;
  const userContent = imageB64
    ? `The user has provided an image containing instructions or a task description. Analyze the image carefully, extract ALL steps/instructions shown, and create a comprehensive plan to execute them.\n\n${prompt}`
    : prompt;

  const messages = [
    { role: 'system', content: systemMsg },
    { role: 'user', content: userContent },
  ];

  const resp = await client.sendMessage(messages, { maxTokens: 4096, temperature: 0.4, imageB64 });
  const parsed = parseJSON(resp.text);

  if (!parsed) {
    return { success: false, message: 'Failed to parse plan from AI response', raw: resp.text };
  }

  if (parsed.clarification_needed) {
    return { success: true, needs_clarification: true, question: parsed.clarification_needed, message: parsed.message };
  }

  let steps = parsed.plan || [];

  // Validate & normalize
  const validMethods = new Set(['web_search', 'ai_knowledge', 'browser_action', 'page_read', 'wait_for_user']);
  steps = steps.slice(0, maxSteps).map((step, i) => ({
    step: i + 1,
    description: step.description || `Step ${i + 1}`,
    method: validMethods.has(step.method) ? step.method : 'ai_knowledge',
    action_hint: step.action_hint || null,
    needs_confirmation: step.needs_confirmation || false,
    depends_on: step.depends_on || null,
    wait_message: step.wait_message || null,
  }));

  currentPlan = {
    task,
    steps,
    currentStep: 0,
    status: 'ready',  // idle | ready | executing | paused | complete | cancelled
    stepResults: {},
  };

  await persistPlan();

  return {
    success: true,
    plan: steps,
    message: parsed.message || `Plan created with ${steps.length} steps.`,
  };
}

// ── Execute Single Step ─────────────────────────────────────────

export async function executeStep(stepIndex) {
  if (!currentPlan) return { success: false, message: 'No active plan' };

  const idx = stepIndex !== undefined ? stepIndex : currentPlan.currentStep;
  if (idx >= currentPlan.steps.length) {
    currentPlan.status = 'complete';
    return { success: true, status: 'plan_complete', message: 'All steps completed!' };
  }

  const step = currentPlan.steps[idx];
  currentPlan.currentStep = idx;
  currentPlan.status = 'executing';

  // Build context from previous step results
  const context = buildStepContext(step, currentPlan.stepResults);

  let result;
  try {
    switch (step.method) {
      case 'web_search':
        result = await executeWebSearch(step, context);
        break;
      case 'browser_action':
        result = await executeBrowserAction(step, context);
        break;
      case 'page_read':
        result = await executePageRead(step, context);
        break;
      case 'wait_for_user':
        result = await executeWaitForUser(step, context);
        break;
      case 'ai_knowledge':
      default:
        result = await executeAIKnowledge(step, context);
        break;
    }
  } catch (e) {
    result = { success: false, message: `Step failed: ${e.message}`, status: 'error' };
  }

  // Store result
  currentPlan.stepResults[step.step] = result.response || result.message;

  // Advance to next step
  if (result.status !== 'error' && result.status !== 'needs_confirmation') {
    currentPlan.currentStep = idx + 1;
    if (currentPlan.currentStep >= currentPlan.steps.length) {
      currentPlan.status = 'complete';
      result.status = 'plan_complete';
    }
  }

  await persistPlan();

  return {
    success: true,
    step: step.step,
    method: step.method,
    ...result,
  };
}

// ── Execute All Steps ───────────────────────────────────────────

export async function executeAll(onUpdate) {
  if (!currentPlan) return { success: false, message: 'No active plan' };
  if (executionLock) return { success: false, message: 'Plan is already executing' };

  executionLock = true;
  const settings = await loadSettings();
  currentPlan.status = 'executing';

  for (let i = currentPlan.currentStep; i < currentPlan.steps.length; i++) {
    if (currentPlan.status === 'cancelled') break;
    if (currentPlan.status === 'paused') break;

    const step = currentPlan.steps[i];

    // Notify step start
    if (onUpdate) {
      onUpdate({
        type: 'step_start',
        step: step.step,
        total_steps: currentPlan.steps.length,
        description: step.description,
        method: step.method,
      });
    }

    // Check if step needs confirmation
    if (step.needs_confirmation && settings.planConfirmSensitive) {
      currentPlan.status = 'paused';
      if (onUpdate) {
        onUpdate({
          type: 'needs_confirmation',
          step: step.step,
          message: `Step ${step.step}: ${step.description}\n\nThis action requires your confirmation.`,
        });
      }
      // Wait for confirmation (the service worker will call confirmStep)
      executionLock = false;
      await persistPlan();
      return { success: true, status: 'paused', step: step.step, message: 'Waiting for confirmation' };
    }

    // Execute step with retry
    let result;
    let retries = 0;
    const maxRetries = 1;

    while (retries <= maxRetries) {
      result = await executeStep(i);

      // Verify the step worked (for browser actions that navigate/interact)
      if (result.status !== 'error' && step.method === 'browser_action') {
        const verified = await verifyStepResult(step, result);
        if (!verified.ok && retries < maxRetries) {
          retries++;
          if (onUpdate) onUpdate({ type: 'step_retry', step: step.step, reason: verified.reason });
          await new Promise(r => setTimeout(r, 2000));
          continue;
        }
        if (!verified.ok) {
          // Verification failed after retries — ask for clarification
          currentPlan.status = 'paused';
          currentPlan.pauseReason = 'verification_failed';
          currentPlan.pauseContext = verified.reason;
          if (onUpdate) {
            onUpdate({
              type: 'needs_clarification',
              step: step.step,
              message: `Step ${step.step} may not have completed as expected: ${verified.reason}\n\nShould I retry, skip this step, or cancel the plan?`,
            });
          }
          executionLock = false;
          await persistPlan();
          return { success: true, status: 'paused', step: step.step, message: verified.reason };
        }
      }

      break; // Step succeeded
    }

    // Notify result
    if (onUpdate) {
      onUpdate({
        type: 'step_result',
        step: step.step,
        method: step.method,
        ...result,
      });
    }

    if (result.status === 'error') {
      // Ask if user wants to retry, skip, or cancel
      currentPlan.status = 'paused';
      currentPlan.pauseReason = 'step_error';
      if (onUpdate) {
        onUpdate({
          type: 'needs_clarification',
          step: step.step,
          message: `Step ${step.step} failed: ${result.message}\n\nShould I retry, skip this step, or cancel the plan?`,
        });
      }
      executionLock = false;
      await persistPlan();
      return result;
    }

    // Wait-for-user steps pause and ask user to complete a manual task
    if (result.status === 'needs_confirmation' || result.isWaitForUser) {
      currentPlan.status = 'paused';
      currentPlan.pauseReason = 'wait_for_user';
      if (onUpdate) {
        onUpdate({
          type: 'needs_clarification',
          step: step.step,
          message: `⏸ ${result.message || step.description}\n\nClick Confirm when you're done, or Skip to move on.`,
        });
      }
      executionLock = false;
      await persistPlan();
      return { success: true, status: 'paused', step: step.step, message: result.message };
    }

    // Wait between steps — use smart page-load waiting for browser actions
    if (step.method === 'browser_action') {
      try { await browser.waitForPageReady(undefined, 8000); } catch {}
      await new Promise(r => setTimeout(r, 500));
    } else if (step.method === 'web_search') {
      const delayMs = (settings.planDelayBetweenSteps || 2) * 1000;
      await new Promise(r => setTimeout(r, Math.max(delayMs, 1000)));
    }
  }

  if (currentPlan.status !== 'paused' && currentPlan.status !== 'cancelled') {
    currentPlan.status = 'complete';
    if (onUpdate) onUpdate({ type: 'complete', message: 'Plan completed!' });

    // Browser notification if enabled
    if (settings.planNotifyOnComplete !== false) {
      try {
        chrome.notifications.create('plan-done', {
          type: 'basic',
          iconUrl: chrome.runtime.getURL('icons/icon128.png'),
          title: 'Aria — Plan Complete',
          message: `Finished: ${currentPlan.task}`,
        });
      } catch {}
    }
  }

  executionLock = false;
  await persistPlan();
  return { success: true, status: currentPlan.status === 'complete' ? 'plan_complete' : currentPlan.status, message: 'Done' };
}

// ── Confirm / Skip / Cancel ─────────────────────────────────────

export async function confirmStep(action) {
  if (!currentPlan) return { success: false, message: 'No plan' };

  if (action === 'confirm') {
    // For wait_for_user steps, user has completed the task — mark done and advance
    if (currentPlan.pauseReason === 'wait_for_user') {
      const step = currentPlan.steps[currentPlan.currentStep];
      currentPlan.stepResults[step.step] = 'User completed manually';
      currentPlan.currentStep++;
      currentPlan.status = 'ready';
      currentPlan.pauseReason = null;
      await persistPlan();

      if (currentPlan.currentStep >= currentPlan.steps.length) {
        currentPlan.status = 'complete';
        return { success: true, status: 'plan_complete', message: 'All steps completed!' };
      }
      return { success: true, message: 'Continuing plan…' };
    }
    currentPlan.status = 'executing';
    return await executeStep(currentPlan.currentStep);
  } else if (action === 'retry') {
    // Smart retry: step back, gather page state, re-execute with failure context
    const failReason = currentPlan.pauseContext || 'Unknown failure';

    // Step was already advanced after execution — move back to the failed step
    if (currentPlan.currentStep > 0 && currentPlan.pauseReason === 'verification_failed') {
      currentPlan.currentStep--;
    }

    // Gather current page state for context-aware retry
    let pageCtx = '';
    try {
      const pageInfo = await browser.getPageInfo();
      if (pageInfo.success) {
        pageCtx = `Current page: "${pageInfo.title || ''}" (${pageInfo.url || ''})`;
      }
    } catch {}

    const step = currentPlan.steps[currentPlan.currentStep];
    // Inject retry context into step results so executeBrowserAction sees it
    currentPlan.stepResults[`_retry_${step.step}`] =
      `RETRY CONTEXT: Previous attempt of step ${step.step} ("${step.description}") failed because: ${failReason}. ${pageCtx}. ` +
      `This is a retry — the page may already be partially in the right state. Adapt your approach: ` +
      `if a search bar has wrong text, clear it first (select all + delete) then type the correct query. ` +
      `If the page already shows results, verify they match the goal before taking further action.`;

    currentPlan.status = 'executing';
    currentPlan.pauseReason = null;
    currentPlan.pauseContext = null;

    return await executeStep(currentPlan.currentStep);
  } else if (action === 'skip') {
    currentPlan.stepResults[currentPlan.steps[currentPlan.currentStep].step] = 'Skipped by user';
    currentPlan.currentStep++;
    currentPlan.status = 'ready';
    return { success: true, message: 'Step skipped' };
  } else {
    return cancelPlan();
  }
}

// ── Method Executors ────────────────────────────────────────────

async function executeWebSearch(step, context) {
  // Open Google search in a new tab with the search query
  const rawQuery = extractSearchQuery(step.description);
  const query = await correctSearchQuery(rawQuery);
  const searchResult = await browser.searchGoogle(query);

  // Wait for page to load
  await new Promise(r => setTimeout(r, 3000));

  // Read the search results page
  const pageContent = await browser.readPageContent('full');
  const content = pageContent.content || '';

  // Have AI analyze the search results
  const analysis = await quickChat(
    `You are Aria. Analyze these Google search results and provide a clear summary relevant to the task. ${context}`,
    `Search query: "${query}"\n\nPage content:\n${content.substring(0, 8000)}`,
  );

  return {
    response: analysis,
    status: 'executing',
    message: `Searched for: ${query}`,
  };
}

async function executeBrowserAction(step, context) {
  const settings = await loadSettings();
  const MAX_ACTIONS = settings.planMaxActionsPerStep || 12;
  const actionHistory = [];
  let lastResponse = null;
  let scrollMemory = '';  // Accumulated observations from scrolling (items seen, best candidates, etc.)

  for (let i = 0; i < MAX_ACTIONS; i++) {
    const screenshot = await browser.captureScreenshot();
    const pageInfo = await browser.getPageInfo().catch(() => ({}));

    if (!screenshot.success && i === 0) {
      // Screenshot failed — execute known action hints directly without needing a screenshot
      const hint = step.action_hint || '';
      const desc = step.description.toLowerCase();

      if (hint === 'navigateNewTab' || (desc.includes('open') && desc.includes('new tab'))) {
        // Extract the site/URL from the description
        const siteMatch = step.description.match(/open\s+(.+?)\s+(in|to)/i) || step.description.match(/open\s+(.+)/i);
        const site = siteMatch ? siteMatch[1].trim() : extractSearchQuery(step.description);
        const result = await browser.navigateInNewTab(site);
        // Wait for new tab to load before proceeding
        await new Promise(r => setTimeout(r, 3000));
        return { response: result.message, status: 'executing', message: result.message };
      }

      if (hint === 'navigate' || desc.includes('go to') || desc.includes('navigate to')) {
        const site = extractSearchQuery(step.description);
        const result = await browser.navigate(site);
        await new Promise(r => setTimeout(r, 3000));
        return { response: result.message, status: 'executing', message: result.message };
      }

      if (hint === 'search' || hint === 'site_search' || desc.includes('search for')) {
        const query = extractSearchQuery(step.description);
        const result = await browser.searchGoogle(query);
        return { response: result.message, status: 'executing', message: result.message };
      }

      return { response: 'Cannot capture screenshot — waiting for page to load', status: 'error', message: 'Screenshot failed' };
    }

    if (!screenshot.success && i > 0) {
      // Screenshot failed mid-loop — page might still be loading from previous action, wait and retry
      await new Promise(r => setTimeout(r, 2000));
      const retryScreenshot = await browser.captureScreenshot();
      if (!retryScreenshot.success) {
        // Still can't capture — assume last action completed the step
        break;
      }
      // Use the retry screenshot
      Object.assign(screenshot, retryScreenshot);
    }

    // Build rich context for the AI
    const pageDesc = pageInfo.url ? `\nCurrent page: "${pageInfo.title || ''}" (${pageInfo.url})` : '';

    // Read page structure for better awareness (forms, interactive elements)
    let pageStructure = '';
    try {
      const forms = await browser.readPageContent('forms');
      if (forms.success && forms.content) pageStructure += `\n\nPage interactive elements:\n${forms.content}`;
    } catch { /* content script may not be injected yet */ }

    // Inject user profile if forms are present on the page
    const profileContext = pageStructure.includes('input') || pageStructure.includes('form')
      ? buildProfileContext(settings) : '';

    // Multi-tab context for AI awareness
    let tabContext = '';
    try {
      const tabs = await browser.getTabContext();
      if (tabs.length > 1) tabContext = `\n\nOpen tabs: ${JSON.stringify(tabs)}`;
    } catch {}

    // Ask AI to analyze the screenshot and determine action
    const client = await getAIClient();
    const messages = [
      { role: 'system', content: BROWSER_AGENT_PROMPT + pageDesc + pageStructure + profileContext + tabContext + (context ? `\n\nContext from previous steps:\n${context}` : '') },
      { role: 'user', content: `Current task step: ${step.description}\n\nAnalyze the screenshot and page elements to determine the best action. RULES:\n- COMPLETE the full step — don't stop partway.\n- After typing into ANY search box or input: your VERY NEXT action MUST be pressing Enter to submit. Do NOT scroll, do NOT look for a search button — press Enter FIRST. 95% of search boxes submit on Enter. Only click a Search button if you already tried Enter and the page didn't change.\n- If the step says "find the cheapest" or "browse for", scroll through the page, compare what you see, and click the best option.\n- If the step says "open in a new tab", use navigateNewTab.\n- You can take multiple actions per step — type, press Enter, scroll, click — do whatever is needed to finish this step completely.\n- For FORM FILLING: fill fields you have data for (name, email from profile), tab or click to next field. NEVER fill password fields — leave them empty. If you encounter a password field, CAPTCHA, or payment form, set status to "needs_confirmation" with a message explaining what the user needs to fill in.\n- If the page shows a login wall, CAPTCHA, email verification, or any blocker requiring user action, set status to "needs_confirmation" and describe what the user should do.\n\nSCROLLING: If the task involves comparing or finding a superlative (cheapest, best, most, least, etc.), you MUST scroll the ENTIRE page before deciding — do NOT pick from only the first few visible items. Track your best candidate in "thought" as you scroll (e.g. "Best so far: X at $45"). Only click after you've seen ALL items on the page.` },
    ];

    // On subsequent iterations, add action history AND accumulated scroll memory
    if (i > 0) {
      const memoryPayload = { actions_completed: actionHistory };
      if (scrollMemory) memoryPayload.scroll_memory = scrollMemory;
      messages.push({
        role: 'assistant',
        content: JSON.stringify(memoryPayload),
      });
      messages.push({
        role: 'user',
        content: 'Look at the updated screenshot. Is this step fully complete? If YES, respond with {"done": true, "message": "..."}. If more actions are needed, provide the next action. REMEMBER: If the task involves finding a superlative (cheapest/best/etc), do NOT declare done until you have scrolled through the ENTIRE page. Track your best candidate in "thought". Your scroll_memory above contains everything you\'ve observed so far — use it to make decisions.',
      });
    }

    const opts = {
      maxTokens: 1024,
      temperature: 0.2,
    };
    if (screenshot.success) opts.imageB64 = screenshot.imageB64;

    const resp = await client.sendMessage(messages, opts);
    const parsed = parseJSON(resp.text);

    if (!parsed) {
      lastResponse = { response: resp.text, status: 'executing', message: 'AI response (no action)' };
      break;
    }

    // Check if AI says the step is done
    if (parsed.done || !parsed.action || parsed.action.type === 'none') {
      lastResponse = {
        response: parsed.message || parsed.thought || 'Step goal achieved',
        status: parsed.status || 'executing',
        message: parsed.message || 'Step complete',
      };
      // If AI detected something requiring user input, flag it
      if (parsed.status === 'needs_confirmation') {
        lastResponse.isWaitForUser = true;
      }
      break;
    }

    // Spell-correct text being typed into search inputs
    if (parsed.action.type === 'type' && parsed.action.text) {
      const sel = (parsed.action.selector || '').toLowerCase();
      const isSearchField = sel.includes('search') || sel.includes('[type="search"]')
        || sel.includes('[role="searchbox"]') || sel.includes('[name="q"]')
        || sel.includes('[name="query"]') || sel.includes('[name="keyword"]')
        || (parsed.thought || '').toLowerCase().includes('search');
      if (isSearchField) {
        parsed.action.text = await correctSearchQuery(parsed.action.text);
      }
    }

    // Execute the action
    const actionResult = await browser.dispatchAction(parsed.action);
    const desc = actionResult.message || parsed.action.type;
    actionHistory.push({ action: parsed.action.type, result: desc, thought: parsed.thought || '' });

    // Auto-Enter enforcement: after typing into a search field, immediately press Enter
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
      }
    }

    // Accumulate scroll memory — AI's observations as it scrolls through the page
    if (parsed.thought) {
      scrollMemory += `[Action ${i + 1}] ${parsed.thought}\n`;
    }

    lastResponse = {
      response: parsed.message || parsed.thought || 'Action executed',
      status: parsed.status || 'executing',
      message: `${parsed.action.type}: ${desc}`,
      action: parsed.action,
      thought: parsed.thought,
    };

    // Smart page-load waiting
    const isNav = ['navigate', 'navigateNewTab', 'searchGoogle', 'search'].includes(parsed.action.type);
    const isScroll = parsed.action.type === 'scroll';
    if (isNav) {
      try { await browser.waitForPageReady(undefined, 8000); } catch { /* fallback below */ }
      await new Promise(r => setTimeout(r, 500));
    } else {
      await new Promise(r => setTimeout(r, isScroll ? 350 : 800));
    }

    // CAPTCHA detection after navigation actions
    if (isNav) {
      try {
        const captcha = await browser.detectCaptcha();
        if (captcha.detected) {
          lastResponse = {
            response: `CAPTCHA detected (${captcha.type}). Please solve it manually, then say "continue" to resume.`,
            status: 'needs_confirmation',
            message: `CAPTCHA: ${captcha.type}`,
          };
          break;
        }
      } catch { /* content script not ready */ }
    }
  }

  return lastResponse || { response: 'Max actions reached', status: 'executing', message: 'Completed available actions' };
}

async function executePageRead(step, context) {
  const pageContent = await browser.readPageContent('full');
  const pageInfo = await browser.getPageInfo();

  const analysis = await quickChat(
    `You are Aria. Read and analyze this page content as requested. Extract SPECIFIC data: names, prices, URLs, quantities — whatever is relevant to the task. Be precise and structured so the next step can act on your findings. ${context}`,
    `Page: ${pageInfo.title} (${pageInfo.url})\nTask: ${step.description}\n\nContent:\n${(pageContent.content || '').substring(0, 10000)}`,
  );

  return {
    response: analysis,
    status: 'executing',
    message: `Read page: ${pageInfo.title}`,
  };
}

async function executeAIKnowledge(step, context) {
  const analysis = await quickChat(
    `You are Aria, an AI browser assistant. Provide thoughtful analysis. ${context}`,
    step.description,
  );

  return {
    response: analysis,
    status: 'executing',
    message: 'AI analysis complete',
  };
}

// ── Wait For User ───────────────────────────────────────────────

async function executeWaitForUser(step) {
  // Pause execution and ask the user to complete a manual task
  // (e.g. solve CAPTCHA, enter password, fill personal details, make a choice)
  const msg = step.wait_message || step.description;
  return {
    response: msg,
    status: 'needs_confirmation',
    message: msg,
    isWaitForUser: true,
  };
}

// ── Post-Step Verification ──────────────────────────────────────

async function verifyStepResult(step, result) {
  // Only verify browser actions that interact with pages
  if (step.method !== 'browser_action') return { ok: true };

  try {
    // Smart wait for page to settle
    try { await browser.waitForPageReady(undefined, 5000); } catch {}
    await new Promise(r => setTimeout(r, 500));

    const pageInfo = await browser.getPageInfo();
    if (!pageInfo.success) return { ok: true }; // Can't verify, assume ok

    const url = pageInfo.url || '';
    const title = pageInfo.title || '';

    // Check for common error states
    if (url === 'chrome://newtab/' && step.description.toLowerCase().includes('navigate')) {
      return { ok: false, reason: 'Still on new tab — navigation may have failed' };
    }
    if (title === 'Redirect Notice') {
      return { ok: false, reason: 'Stuck on a redirect notice page' };
    }
    if (url.includes('chrome-error://')) {
      return { ok: false, reason: 'Page failed to load (network error)' };
    }

    // Optional: use AI to quickly verify if the step goal was met
    if (step.description.length > 10) {
      const screenshot = await browser.captureScreenshot();
      if (screenshot.success) {
        const client = await getFastClient();
        const resp = await client.sendMessage([
          { role: 'system', content: 'You verify whether a browser action completed successfully. Be GENEROUS in verification:\n- Search query optimizations/rewrites count as success if results are relevant.\n- Clicking a semantically equivalent button counts as success (e.g. step says "Sign Up" but AI clicked "Get Started" — that IS success because "Get Started" leads to sign-up on most sites).\n- Page navigation to a registration/login/product page counts as success even if the exact button label didn\'t match.\n- Only fail if the page is clearly wrong (error page, completely unrelated page, nothing happened).\nRespond with ONLY valid JSON: {"ok": true/false, "reason": "brief reason"}' },
          { role: 'user', content: `Step goal: "${step.description}"\nCurrent page: "${title}" (${url})\nDid this step complete successfully? Remember: semantically equivalent actions count as success (clicking "Get Started" when step says "Sign Up" is success). Optimized search queries and autocomplete rewrites are also success if results are relevant.` },
        ], { maxTokens: 80, temperature: 0.1, imageB64: screenshot.imageB64 });

        const parsed = parseJSON(resp.text);
        if (parsed && parsed.ok === false) {
          return { ok: false, reason: parsed.reason || 'Step verification failed' };
        }
      }
    }

    return { ok: true };
  } catch (e) {
    // Verification itself failed — don't block, assume ok
    return { ok: true };
  }
}

// ── Helpers ───────────────────────────────────────────────────

function buildStepContext(step, stepResults) {
  // Always pass ALL previous step results so the AI has full context
  const parts = [];
  const allSteps = Object.keys(stepResults).map(Number).filter(n => !isNaN(n)).sort((a, b) => a - b);

  for (const stepNum of allSteps) {
    if (stepNum < step.step && stepResults[stepNum]) {
      parts.push(`── Step ${stepNum} result ──\n${stepResults[stepNum]}`);
    }
  }

  // Include retry context if present for this step
  const retryKey = `_retry_${step.step}`;
  if (stepResults[retryKey]) {
    parts.push(`── ${stepResults[retryKey]}`);
    delete stepResults[retryKey]; // consume once
  }

  return parts.length ? '\nContext from previous steps:\n' + parts.join('\n\n') : '';
}

function extractSearchQuery(description) {
  // Remove common prefixes
  let query = description
    .replace(/^(search|google|find|look up|research)\s+(for|about|on|the)?\s*/i, '')
    .replace(/\s+on\s+google$/i, '')
    .trim();
  return query || description;
}
