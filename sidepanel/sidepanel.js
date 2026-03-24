/* ═══════════════════════════════════════════════════════════════════
   Aria — Side Panel Logic
   Chat UI, STT/TTS, plan display, message routing via service worker.
   ═══════════════════════════════════════════════════════════════════ */
import { MSG_TYPES, STRATEGY_BADGES, PLAN_METHOD_LABELS, PLAN_TRIGGERS, DEFAULT_SETTINGS } from '../shared/constants.js';
import { renderMarkdown, loadSettings } from '../shared/utils.js';

// ── DOM Refs ─────────────────────────────────────────
const $ = id => document.getElementById(id);

const chatMessages  = $('chatMessages');
const chatInput     = $('chatInput');
const chatImageStrip = $('chatImageStrip');
const planSection   = $('planSection');
const planList      = $('planList');
const btnSend       = $('btnSend');
const btnExecAll    = $('btnExecAll');
const btnStep       = $('btnStep');
const btnCancel     = $('btnCancel');
const btnSettings   = $('btnSettings');
const liveToggle    = $('liveToggle');
const liveSwitch    = $('liveSwitch');
const liveLabel     = $('liveLabel');
const voiceSpeaking = $('voiceSpeaking');
const statusDot     = $('statusDot');
const statusText    = $('statusText');
const headerTitle   = $('headerTitle');
const confirmOverlay = $('confirmOverlay');
const confirmMessage = $('confirmMessage');
const inputHint     = $('inputHint');

// ── State ────────────────────────────────────────────
let settings = {};
let liveChatOn = false;
let sttSilenceTimer = null;
let sttFinalText = '';
let sttInterimText = '';
let sttReconnectAttempts = 0;
const STT_MAX_RECONNECTS = 5;
let pendingPlanMode = false;
let isSpeaking = false;
let currentAudio = null;
let chatImages = [];
let chatHistory = [];
let msgCounter = 0;

// ── TTS Verbosity Gate ───────────────────────────────
// Categories and minimum verbosity level required to speak:
//   error/decision  = 1 (Very Few)    — always spoken
//   plan_complete   = 1 (Very Few)    — always spoken
//   first_action    = 2 (Minimal)     — first AI response in a session turn
//   plan_created    = 3 (Low)
//   final_step      = 4 (Moderate)    — last step result of a plan
//   step_result     = 5 (Default)     — each step result
//   response        = 5 (Default)     — normal chat responses
//   step_update     = 7 (Verbose)     — step description / progress
//   all             = 8 (All)         — everything else
const TTS_CATEGORY_LEVEL = {
  error: 1, decision: 1, plan_complete: 1,
  first_action: 2,
  plan_created: 3,
  final_step: 4,
  step_result: 5, response: 5,
  stream_response: 6,
  step_update: 7,
  all: 8,
};
function shouldSpeak(category) {
  if (!liveChatOn) return false;
  const verbosity = settings.ttsVerbosity ?? DEFAULT_SETTINGS.ttsVerbosity ?? 5;
  return verbosity >= (TTS_CATEGORY_LEVEL[category] || 8);
}
let currentPlan = [];
let isExecuting = false;
let streamMsgId = null;
let streamText = '';

// ── Init ─────────────────────────────────────────────
async function init() {
  settings = await loadSettings();
  const name = settings.personaName || 'Aria';
  headerTitle.textContent = name;
  document.getElementById('chatInput').placeholder = `Ask ${name} anything…`;

  setupEventListeners();
  setupImageHandlers();
  autoResizeInput();
  restoreChatState();
  setStatus('ready', 'Ready');

  // Load saved routines
  sendSW(MSG_TYPES.LIST_ROUTINES);
}

init();

// ── Event Listeners ──────────────────────────────────
function setupEventListeners() {
  btnSend.addEventListener('click', sendChat);
  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendChat();
    }
  });
  chatInput.addEventListener('input', autoResizeInput);

  liveLabel.addEventListener('click', toggleLiveChat);
  liveSwitch.addEventListener('click', toggleLiveChat);

  btnExecAll.addEventListener('click', () => sendSW(MSG_TYPES.EXECUTE_ALL));
  btnStep.addEventListener('click', () => sendSW(MSG_TYPES.EXECUTE_STEP));
  btnCancel.addEventListener('click', () => {
    sendSW(MSG_TYPES.CANCEL_PLAN);
    planSection.style.display = 'none';
    currentPlan = [];
  });

  $('btnConfirm').addEventListener('click', () => confirmAction('confirm'));
  $('btnRetry').addEventListener('click', () => confirmAction('retry'));
  $('btnSkip').addEventListener('click', () => confirmAction('skip'));
  $('btnCancelConfirm').addEventListener('click', () => confirmAction('cancel'));

  $('btnClearChat').addEventListener('click', clearChat);

  // Save / Reset
  btnSettings.addEventListener('click', () => chrome.runtime.openOptionsPage());

  // Listen for messages from service worker
  chrome.runtime.onMessage.addListener(handleSWMessage);
}

// ── Service Worker Communication ─────────────────────
function sendSW(type, data = {}) {
  chrome.runtime.sendMessage({ type, ...data });
}

function handleSWMessage(msg) {
  switch (msg.type) {
    case MSG_TYPES.CHAT_RESPONSE:
      handleChatResponse(msg);
      break;
    case MSG_TYPES.STREAM_CHUNK:
      handleStreamChunk(msg);
      break;
    case MSG_TYPES.STREAM_END:
      handleStreamEnd(msg);
      break;
    case MSG_TYPES.PLAN_CREATED:
      handlePlanCreated(msg);
      break;
    case MSG_TYPES.PLAN_UPDATE:
      handlePlanUpdate(msg);
      break;
    case MSG_TYPES.PLAN_COMPLETE:
      handlePlanComplete(msg);
      break;
    case MSG_TYPES.STEP_RESULT:
      handleStepResult(msg);
      break;
    case MSG_TYPES.NEED_CONFIRMATION:
      showConfirmation(msg.message, msg.isClarification);
      break;
    case MSG_TYPES.STATUS_UPDATE:
      setStatus(msg.status, msg.text);
      break;
    case MSG_TYPES.TTS_SPEAK:
      playTTS(msg);
      break;
    case MSG_TYPES.TTS_STOP:
      stopTTS();
      break;
    case MSG_TYPES.ERROR:
      removeThinking();
      addChat('system', 'Error: ' + (msg.message || 'Unknown error'));
      setStatus('error', 'Error');
      break;

    case MSG_TYPES.SCREENSHOT_TAKEN:
      handleScreenshot(msg);
      break;
    case MSG_TYPES.CAPTCHA_DETECTED:
      handleCaptchaDetected(msg);
      break;
    case MSG_TYPES.ROUTINES_LIST:
      handleRoutinesList(msg);
      break;

    // STT messages from offscreen document
    case 'STT_STARTED':
      liveToggle.classList.add('listening');
      sttReconnectAttempts = 0;
      break;
    case 'STT_RESULT':
      if (msg.final) sttFinalText += msg.final;
      sttInterimText = msg.interim || '';
      chatInput.value = (sttFinalText + ' ' + sttInterimText).trim();
      autoResizeInput();
      clearTimeout(sttSilenceTimer);
      sttSilenceTimer = setTimeout(onSilenceDetected,
        settings.sttSilenceTimeout || DEFAULT_SETTINGS.sttSilenceTimeout);
      break;
    case 'STT_ERROR':
      if (msg.error === 'not-allowed') {
        // The relay tab will handle showing its own UI for retry.
        // Just update side panel state.
        liveChatOn = false;
        liveSwitch.classList.remove('active');
        liveToggle.classList.remove('listening');
      }
      break;
    case 'MIC_PERMISSION_GRANTED':
      // Permission was granted on the relay tab — it will auto-start
      // recognition, so just update the side panel state.
      if (!liveChatOn) {
        liveChatOn = true;
        liveSwitch.classList.add('active');
      }
      addChat('system', '✓ Microphone access granted! Listening…');
      break;
    case 'STT_ENDED':
      liveToggle.classList.remove('listening');
      break;
  }
}

// ── Send Chat ────────────────────────────────────────
function sendChat() {
  const text = chatInput.value.trim();
  const images = [...chatImages];
  if (!text && images.length === 0) return;

  chatInput.value = '';
  chatInput.style.height = 'auto';
  chatImages = [];
  renderImageStrip();

  // Track history
  chatHistory.push({ role: 'user', content: text || '(image)' });
  if (chatHistory.length > 30) chatHistory = chatHistory.slice(-30);

  // Display user message
  addChat('user', text, images.map(i => i.dataUrl));

  // Check for plan triggers
  const lower = text.toLowerCase();
  const matchesPlan = PLAN_TRIGGERS.some(t => lower.startsWith(t) || lower.includes(t));

  if (matchesPlan) {
    // Extract plan description after trigger
    let planDesc = '';
    for (const t of PLAN_TRIGGERS) {
      const idx = lower.indexOf(t);
      if (idx !== -1) {
        planDesc = text.substring(idx + t.length).replace(/^[-:,]\s*/, '').trim();
        break;
      }
    }

    if (planDesc.length > 10) {
      showThinking('Creating plan…');
      sendSW(MSG_TYPES.CREATE_PLAN, { task: planDesc });
    } else {
      pendingPlanMode = true;
      inputHint.textContent = '📋 Plan mode — describe what to plan';
      addChat('system', "What's the plan? Describe what you'd like me to do.");
      if (shouldSpeak('first_action')) speakDirect("Sure, what's the plan?");
    }
    return;
  }

  if (pendingPlanMode) {
    pendingPlanMode = false;
    inputHint.textContent = '';
    showThinking('Creating plan…');
    sendSW(MSG_TYPES.CREATE_PLAN, { task: text });
    return;
  }

  // Regular chat
  showThinking();
  setStatus('working', 'Thinking…');

  const payload = {
    message: text || '(image)',
    history: chatHistory,
  };
  if (images.length) {
    payload.images = images.map(i => ({ b64: i.b64, mimeType: i.mimeType }));
  }
  sendSW(MSG_TYPES.CHAT_MESSAGE, payload);
}

// ── Response Handlers ────────────────────────────────

/**
 * Summarise a raw actionDescription string for display.
 * Returns { text, errorHtml } — text goes through renderMarkdown, errorHtml is injected as-is.
 */
function formatActionSummary(raw) {
  const steps = raw.split(' ⚡ ').map(s => s.trim()).filter(Boolean);
  const successes = [];
  const errors = [];

  for (const step of steps) {
    if (/failed|error|not a valid selector|exception/i.test(step)) {
      errors.push(step);
    } else {
      // Clean up technical junk from action descriptions
      let clean = step
        .replace(/\s*<\w+>\s*/g, '')              // remove <div>, <input>, etc.
        .replace(/\s*\([^)]*\)\s*/g, '')           // remove (120, 340), (auto-submit), etc.
        .replace(/input\[.*?\]/gi, '')             // remove input[placeholder='search'] etc.
        .replace(/\s{2,}/g, ' ')                   // collapse whitespace
        .trim();
      if (!clean) clean = step.trim();
      // Skip if it's a duplicate of the previous step
      if (successes.length && successes[successes.length - 1] === clean) continue;
      successes.push(clean);
    }
  }

  let text = '';
  if (successes.length) {
    text = '⚡ ' + successes.join(' · ');
  }

  let errorHtml = '';
  if (errors.length) {
    const count = errors.length;
    const label = `⚠️ ${count} error${count > 1 ? 's' : ''} encountered`;
    const body = errors.map(e => e.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')).join('\n');
    errorHtml = `<details class="error-dropdown"><summary>${label}</summary><div class="error-content">${body}</div></details>`;
  }
  return { text, errorHtml };
}

function handleChatResponse(msg) {
  removeThinking();
  setStatus('ready', 'Ready');
  resetScreenshotStrip();

  const strategy = msg.strategy || 'direct';
  const badge = STRATEGY_BADGES[strategy] || '';
  let text = msg.response || '';
  let errorHtml = '';

  if (msg.actionDescription && msg.actionDescription !== msg.response) {
    const summary = formatActionSummary(msg.actionDescription);
    if (summary.text) text += '\n' + summary.text;
    errorHtml = summary.errorHtml;
  }

  const msgId = addChat('ai', text, null, strategy);

  // Append collapsible error dropdown after the rendered message
  if (errorHtml) {
    const msgDiv = document.getElementById(msgId);
    const richDiv = msgDiv?.querySelector('.ai-response-text');
    if (richDiv) richDiv.insertAdjacentHTML('beforeend', errorHtml);
  }

  chatHistory.push({ role: 'assistant', content: (msg.response || '').substring(0, 1000) });
  if (chatHistory.length > 30) chatHistory = chatHistory.slice(-30);

  // TTS
  if (shouldSpeak('response') && msg.response) {
    sendSW(MSG_TYPES.TTS_SPEAK, { text: msg.response });
  }

  saveChatState();
}

// ── Streaming Handlers ───────────────────────────────

function handleStreamChunk(msg) {
  if (msg.isFirst) {
    // Create the AI message element for streaming
    removeThinking();
    setStatus('working', 'Streaming…');
    streamText = '';
    streamMsgId = addChat('ai', '', null, msg.strategy || 'direct');
  }
  streamText += msg.chunk;
  // Update the streaming message in-place
  const el = document.getElementById(streamMsgId);
  if (el) {
    const richDiv = el.querySelector('.ai-response-text');
    if (richDiv) richDiv.innerHTML = renderMarkdown(streamText);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }
}

function handleStreamEnd(msg) {
  setStatus('ready', 'Ready');

  chatHistory.push({ role: 'assistant', content: streamText.substring(0, 1000) });
  if (chatHistory.length > 30) chatHistory = chatHistory.slice(-30);

  // TTS
  if (shouldSpeak('stream_response') && streamText) {
    sendSW(MSG_TYPES.TTS_SPEAK, { text: streamText });
  }

  saveChatState();
  streamMsgId = null;
  streamText = '';
}

function handlePlanCreated(msg) {
  removeThinking();
  setStatus('ready', 'Plan ready');

  if (msg.needsClarification) {
    addChat('ai', msg.question || msg.message);
    return;
  }

  currentPlan = msg.plan || [];
  renderPlan(currentPlan, 0);
  planSection.style.display = '';
  addChat('ai', msg.message || `Plan created with ${currentPlan.length} steps.`, null, 'plan');

  if (shouldSpeak('plan_created')) {
    sendSW(MSG_TYPES.TTS_SPEAK, { text: msg.message || 'Plan created.' });
  }

  // Auto-execute if setting is enabled
  loadSettings().then(settings => {
    if (settings.planAutoExecute ?? DEFAULT_SETTINGS.planAutoExecute) {
      sendSW(MSG_TYPES.EXECUTE_ALL);
    }
  });
}

function handlePlanUpdate(msg) {
  setStatus('working', `Step ${msg.step || '?'}/${msg.totalSteps || '?'}…`);

  if (msg.step !== undefined) {
    renderPlan(currentPlan, msg.step - 1);
  }

  if (msg.description) {
    const icon = PLAN_METHOD_LABELS[msg.method] || '▶';
    addChat('system', `${icon} Step ${msg.step}: ${msg.description}`);
  }
}

function handleStepResult(msg) {
  if (msg.step !== undefined) renderPlan(currentPlan, msg.step);

  if (msg.response) {
    addChat('ai', msg.response, null, msg.method || 'direct');
    if (shouldSpeak('step_result')) sendSW(MSG_TYPES.TTS_SPEAK, { text: msg.response });
  }

  if (msg.status === 'plan_complete') {
    handlePlanComplete(msg);
  }
}

function handlePlanComplete(msg) {
  setStatus('ready', 'Plan done');
  addChat('system', msg.message || 'Plan completed!');
  isExecuting = false;
  planSection.style.display = 'none';
  currentPlan = [];

  if (shouldSpeak('plan_complete')) {
    sendSW(MSG_TYPES.TTS_SPEAK, { text: 'Plan completed.' });
  }
}

// ── Plan Display ─────────────────────────────────────
function renderPlan(plan, activeStep) {
  planList.innerHTML = '';

  plan.forEach((step, i) => {
    const li = document.createElement('li');
    const icon = document.createElement('span');
    icon.className = 'step-icon';

    const content = document.createElement('div');
    content.className = 'step-content';

    const text = document.createElement('span');
    text.className = 'step-text';
    text.textContent = `${step.step}. ${step.description}`;

    const method = step.method || 'ai_knowledge';
    const badge = document.createElement('span');
    badge.className = 'step-method';
    badge.textContent = PLAN_METHOD_LABELS[method] || method;

    if (i < activeStep) {
      icon.classList.add('completed');
      icon.textContent = '✓';
      text.classList.add('completed');
    } else if (i === activeStep) {
      icon.classList.add(step.needs_confirmation ? 'confirm' : 'active');
      icon.textContent = '►';
      text.classList.add('active');
    } else {
      icon.textContent = String(i + 1);
    }

    content.appendChild(text);
    content.appendChild(badge);
    li.appendChild(icon);
    li.appendChild(content);
    planList.appendChild(li);
  });
}

// ── Confirmation ─────────────────────────────────────
function showConfirmation(message) {
  confirmMessage.textContent = message || 'This action requires your confirmation.';
  confirmOverlay.classList.add('visible');
}

function confirmAction(action) {
  confirmOverlay.classList.remove('visible');
  sendSW(MSG_TYPES.CONFIRM_ACTION, { action });
}

// ── Chat Rendering ───────────────────────────────────
function addChat(role, text, imageUrls, strategy) {
  const div = document.createElement('div');
  const msgId = 'msg-' + (++msgCounter);
  div.id = msgId;
  div.className = 'chat-msg ' + role;

  // Close button
  const closeBtn = document.createElement('button');
  closeBtn.className = 'msg-close';
  closeBtn.textContent = '×';
  closeBtn.title = 'Remove message';
  closeBtn.addEventListener('click', () => { div.remove(); saveChatState(); });
  div.appendChild(closeBtn);

  if (role === 'ai') {
    // Label with strategy badge
    const lbl = document.createElement('span');
    lbl.className = 'msg-label';
    lbl.textContent = settings.personaName || 'Aria';

    if (strategy) {
      const badge = document.createElement('span');
      badge.className = 'strategy-badge';
      badge.textContent = STRATEGY_BADGES[strategy] || strategy;
      lbl.appendChild(badge);
    }
    div.appendChild(lbl);

    const richDiv = document.createElement('div');
    richDiv.className = 'ai-response-text';
    richDiv.innerHTML = renderMarkdown(text);
    div.appendChild(richDiv);
  } else {
    if (text) div.appendChild(document.createTextNode(text));
  }

  // Image thumbnails
  if (imageUrls && imageUrls.length) {
    imageUrls.forEach(url => {
      const img = document.createElement('img');
      img.src = url;
      img.className = 'chat-msg-img';
      img.alt = 'Attached';
      div.appendChild(img);
    });
  }

  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return msgId;
}

function showThinking(text) {
  removeThinking();
  const div = document.createElement('div');
  div.id = 'thinking';
  div.className = 'chat-msg system';
  div.textContent = text || '⌛ Thinking…';
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function removeThinking() {
  const el = document.getElementById('thinking');
  if (el) el.remove();
}

// ── Status ───────────────────────────────────────────
function setStatus(state, text) {
  statusDot.className = 'status-dot ' + state;
  statusText.textContent = text || '';
}

// ── Auto-resize textarea ─────────────────────────────
function autoResizeInput() {
  chatInput.style.height = 'auto';
  chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px';
}

// ── Image Paste/Drop ─────────────────────────────────
function setupImageHandlers() {
  const area = $('chatInputArea');

  chatInput.addEventListener('paste', (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        addImageFile(item.getAsFile());
      }
    }
  });

  area.addEventListener('dragover', (e) => {
    e.preventDefault();
    area.classList.add('drag-over');
  });
  area.addEventListener('dragleave', () => area.classList.remove('drag-over'));
  area.addEventListener('drop', (e) => {
    e.preventDefault();
    area.classList.remove('drag-over');
    for (const file of e.dataTransfer.files) {
      if (file.type.startsWith('image/')) addImageFile(file);
    }
  });
}

function addImageFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    const dataUrl = reader.result;
    const b64 = dataUrl.split(',')[1];
    chatImages.push({ dataUrl, b64, mimeType: file.type || 'image/png' });
    renderImageStrip();
  };
  reader.readAsDataURL(file);
}

function renderImageStrip() {
  chatImageStrip.innerHTML = '';
  chatImages.forEach((img, i) => {
    const wrap = document.createElement('div');
    wrap.className = 'chat-thumb-wrap';

    const thumb = document.createElement('img');
    thumb.src = img.dataUrl;
    thumb.alt = 'Attached';
    wrap.appendChild(thumb);

    const btn = document.createElement('button');
    btn.className = 'chat-thumb-remove';
    btn.textContent = '×';
    btn.addEventListener('click', () => {
      chatImages.splice(i, 1);
      renderImageStrip();
    });
    wrap.appendChild(btn);

    chatImageStrip.appendChild(wrap);
  });
}

// ── Screenshot Display ───────────────────────────────
let _screenshotStrip = null;
let _lastScreenshotB64 = null;

function handleScreenshot(msg) {
  if (!msg.imageB64) return;

  // Deduplicate — skip if identical to last screenshot
  if (msg.imageB64 === _lastScreenshotB64) return;
  _lastScreenshotB64 = msg.imageB64;

  loadSettings().then(s => {
    if (s.showScreenshotsInChat === false) return;
    const dataUrl = 'data:image/png;base64,' + msg.imageB64;

    // Reuse existing strip if the last chat element is one, otherwise create new
    if (!_screenshotStrip || !chatMessages.lastElementChild?.classList.contains('screenshot-strip')) {
      _screenshotStrip = document.createElement('div');
      _screenshotStrip.className = 'screenshot-strip';
      chatMessages.appendChild(_screenshotStrip);
    }

    const img = document.createElement('img');
    img.src = dataUrl;
    img.className = 'screenshot-thumb';
    img.alt = 'Screenshot';
    img.title = msg.description || 'Screenshot captured';
    _screenshotStrip.appendChild(img);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  });
}

/** Reset screenshot strip so the next batch starts a new row */
function resetScreenshotStrip() { _screenshotStrip = null; _lastScreenshotB64 = null; }

// ── CAPTCHA Notification ─────────────────────────────
function handleCaptchaDetected(msg) {
  removeThinking();
  const captchaMsg = `⚠️ CAPTCHA detected (${msg.captchaType || 'unknown'}). Please solve it in the browser, then say "continue" or click Confirm.`;
  addChat('system', captchaMsg);
  setStatus('warning', 'CAPTCHA — waiting');
  showConfirmation('CAPTCHA detected! Please solve it in the browser tab, then click Confirm to continue.');
  if (shouldSpeak('error')) speakDirect('Captcha detected. Please solve it, then say continue.');
}

// ── Routines List ────────────────────────────────────
let savedRoutines = [];

function handleRoutinesList(msg) {
  savedRoutines = msg.routines || [];
  renderRoutinesPanel();
}

function renderRoutinesPanel() {
  const panel = document.getElementById('routinesPanel');
  if (!panel) return;
  const list = panel.querySelector('.routines-list');
  if (!list) return;

  if (savedRoutines.length === 0) {
    list.innerHTML = '<li class="routine-empty">No saved routines</li>';
    return;
  }

  list.innerHTML = '';
  savedRoutines.forEach(r => {
    const li = document.createElement('li');
    li.className = 'routine-item';

    const name = document.createElement('span');
    name.className = 'routine-name';
    name.textContent = r.name;
    name.title = r.task;

    const btns = document.createElement('span');
    btns.className = 'routine-actions';

    const runBtn = document.createElement('button');
    runBtn.className = 'btn btn-sm btn-exec';
    runBtn.textContent = '▶';
    runBtn.title = 'Run routine';
    runBtn.addEventListener('click', () => sendSW(MSG_TYPES.LOAD_ROUTINE, { name: r.name, id: r.id }));

    const delBtn = document.createElement('button');
    delBtn.className = 'btn btn-sm btn-cancel';
    delBtn.textContent = '✕';
    delBtn.title = 'Delete routine';
    delBtn.addEventListener('click', () => {
      if (confirm(`Delete routine "${r.name}"?`)) {
        sendSW(MSG_TYPES.DELETE_ROUTINE, { name: r.name, id: r.id });
      }
    });

    btns.appendChild(runBtn);
    btns.appendChild(delBtn);
    li.appendChild(name);
    li.appendChild(btns);
    list.appendChild(li);
  });
}

// ═══════════════════════════════════════════════════════
// STT — Speech-to-Text (via relay tab)
// The relay tab runs SpeechRecognition in a real page
// context where mic prompts work, and sends transcripts
// back via chrome.runtime messages.
// ═══════════════════════════════════════════════════════

let sttTabId = null;

function toggleLiveChat() {
  liveChatOn = !liveChatOn;

  if (liveChatOn) {
    liveSwitch.classList.add('active');
    startSTT();
  } else {
    liveSwitch.classList.remove('active');
    liveToggle.classList.remove('listening');
    stopSTT();
    stopTTS();
    pendingPlanMode = false;
    inputHint.textContent = '';
  }
}

async function startSTT() {
  const relayUrl = chrome.runtime.getURL('sidepanel/mic-permission.html');

  // Reuse existing relay tab if still open
  if (sttTabId != null) {
    try {
      const tab = await chrome.tabs.get(sttTabId);
      if (tab && tab.url && tab.url.startsWith(relayUrl)) {
        // Tab exists — tell it to start
        chrome.runtime.sendMessage({ type: 'STT_START', lang: 'en-US' });
        return;
      }
    } catch {}
    sttTabId = null;
  }

  // Find an already-open relay tab
  const tabs = await chrome.tabs.query({ url: relayUrl });
  if (tabs.length > 0) {
    sttTabId = tabs[0].id;
    chrome.runtime.sendMessage({ type: 'STT_START', lang: 'en-US' });
    return;
  }

  // Open a new relay tab (it will auto-start if mic is already granted)
  const newTab = await chrome.tabs.create({ url: relayUrl, active: false });
  sttTabId = newTab.id;
}

function stopSTT() {
  clearTimeout(sttSilenceTimer);
  chrome.runtime.sendMessage({ type: 'STT_STOP' }).catch(() => {});
  sttFinalText = '';
  sttInterimText = '';
}

function pauseSTT() {
  chrome.runtime.sendMessage({ type: 'STT_STOP' }).catch(() => {});
  liveToggle.classList.remove('listening');
}

function resumeSTT() {
  if (liveChatOn && !isSpeaking) startSTT();
}

function onSilenceDetected() {
  const text = sttFinalText.trim();
  sttFinalText = '';
  sttInterimText = '';
  if (!text) return;

  chatInput.value = text;
  sendChat();
}

// ═══════════════════════════════════════════════════════
// TTS — Text-to-Speech Playback (in side panel context)
// ═══════════════════════════════════════════════════════

function playTTS(msg) {
  if (!msg.text && !msg.audioB64) return;

  pauseSTT();
  isSpeaking = true;
  voiceSpeaking.classList.add('active');

  if (msg.method === 'elevenlabs' && msg.audioB64) {
    // Play ElevenLabs audio blob
    const binary = atob(msg.audioB64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const blob = new Blob([bytes], { type: 'audio/mpeg' });
    const url = URL.createObjectURL(blob);
    currentAudio = new Audio(url);
    currentAudio.onended = () => { URL.revokeObjectURL(url); finishSpeaking(); };
    currentAudio.onerror = () => { URL.revokeObjectURL(url); finishSpeaking(); };
    currentAudio.play();
  } else if (msg.method === 'chrome') {
    // Chrome TTS handled in service worker — just wait for completion
    finishSpeaking();
  } else {
    // Web Speech API (runs in side panel window)
    const utterance = new SpeechSynthesisUtterance(msg.text);
    utterance.rate = settings.ttsSpeakingRate || 1.0;
    utterance.onend = () => finishSpeaking();
    utterance.onerror = () => finishSpeaking();
    window.speechSynthesis.speak(utterance);
  }
}

function speakDirect(text) {
  if (!liveChatOn) return;
  pauseSTT();
  isSpeaking = true;
  voiceSpeaking.classList.add('active');
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = settings.ttsSpeakingRate || 1.0;
  utterance.onend = () => finishSpeaking();
  utterance.onerror = () => finishSpeaking();
  window.speechSynthesis.speak(utterance);
}

function finishSpeaking() {
  isSpeaking = false;
  currentAudio = null;
  voiceSpeaking.classList.remove('active');
  resumeSTT();
}

function stopTTS() {
  if (currentAudio) { currentAudio.pause(); currentAudio = null; }
  window.speechSynthesis.cancel();
  isSpeaking = false;
  voiceSpeaking.classList.remove('active');
}

// ── Chat Persistence ─────────────────────────────────

function saveChatState() {
  const msgs = chatMessages.querySelectorAll('.chat-msg');
  const store = [];
  msgs.forEach(m => {
    const role = m.classList.contains('user') ? 'user' : m.classList.contains('ai') ? 'ai' : 'system';
    const richText = m.querySelector('.ai-response-text');
    const text = richText ? richText.textContent : m.textContent;
    store.push({ role, text });
  });
  chrome.storage.local.set({ aria_chat: store.slice(-100) });
}

function restoreChatState() {
  chrome.storage.local.get('aria_chat', (data) => {
    if (!data.aria_chat || !data.aria_chat.length) return;
    chatMessages.innerHTML = '';
    data.aria_chat.forEach(m => addChat(m.role, m.text));
  });
}

function clearChat() {
  chatMessages.innerHTML = '';
  chrome.storage.local.remove('aria_chat');
}
