/* ═══════════════════════════════════════════════════════════════════
   Aria — Settings Page Logic
   ═══════════════════════════════════════════════════════════════════ */
import { DEFAULT_SETTINGS, RESPONSE_LENGTH_LABELS, TTS_VERBOSITY_LABELS } from '../shared/constants.js';
import { loadSettings, saveSettings } from '../shared/utils.js';

const $ = id => document.getElementById(id);

// All field IDs that map directly to settings keys
const FIELDS = [
  'responseLength', 'primaryProvider',
  'openaiApiKey', 'openaiModel',
  'anthropicApiKey', 'anthropicModel',
  'poeApiKey', 'poeModel',
  'ttsProvider', 'elevenlabsApiKey', 'elevenlabsVoiceId',
  'chromeTtsVoice', 'ttsSpeakingRate', 'ttsVerbosity',
  'sttSilenceTimeout',
  'planMaxSteps', 'planAutoExecute', 'planConfirmSensitive',
  'planDelayBetweenSteps', 'planMaxActionsPerStep', 'planShowStepDetail', 'planNotifyOnComplete',
  'personaName', 'personaTone', 'personaExpertise', 'customSystemPrompt',
  'autoClosePopups',
  'autoHandleCookieConsent', 'showScreenshotsInChat', 'sessionMemoryEnabled',
  'userFirstName', 'userLastName', 'userEmail', 'userPhone', 'userDob',
  'userStreet', 'userCity', 'userState', 'userPostcode', 'userCountry',
  'userCompany', 'userJobTitle', 'userUsername',
];

// ── POE Model Fetching & Curation ───────────────────────────────
// ~25 models best suited for AI browser control: intent understanding,
// structured JSON output, multi-step planning, web interaction.
// Cheaper/faster at top, premium at bottom.

const POE_RECOMMENDED = [
  { group: 'Fast & Efficient', models: [
    'gpt-4.1-nano', 'gpt-4o-mini', 'gpt-4.1-mini', 'gemini-2.0-flash-lite', 'claude-3.5-haiku',
  ]},
  { group: 'Balanced — Everyday Use', models: [
    'gpt-4o', 'gpt-4.1', 'claude-3.5-sonnet', 'claude-sonnet-4', 'gemini-2.5-flash',
  ]},
  { group: 'Reasoning & Multi-Step', models: [
    'o4-mini', 'deepseek-r1', 'qwen3-max', 'gemini-2.5-pro', 'o3',
  ]},
  { group: 'Search & Research', models: [
    'web-search', 'assistant', 'perplexity-search', 'perplexity-adv-deep-research',
  ]},
  { group: 'Premium — Higher Tokens', models: [
    'gpt-5.2-pro', 'gpt-5.3-codex-spark', 'claude-opus-4', 'claude-opus-4.5',
  ]},
];

// Store full model list for show-all toggle
let _allPoeModels = [];
let _selectedPoeModel = '';

async function fetchPoeModelsForSettings(apiKey) {
  if (!apiKey) return [];
  try {
    const resp = await fetch('https://api.poe.com/v1/models', {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });
    if (!resp.ok) return [];
    const data = await resp.json();
    return (data.data || []).map(m => m.id).filter(Boolean);
  } catch {
    return [];
  }
}

/** Find the actual POE model ID matching a desired name (fuzzy). */
function findPoeMatch(desiredId, available) {
  if (available.includes(desiredId)) return desiredId;
  const lower = desiredId.toLowerCase();
  const ci = available.find(m => m.toLowerCase() === lower);
  if (ci) return ci;
  const norm = s => s.toLowerCase().replace(/[-_.\s]/g, '');
  return available.find(m => norm(m) === norm(desiredId)) || null;
}

/** Build the curated, categorized <optgroup> dropdown. */
function buildCuratedDropdown(select, allModels, selectedModel) {
  select.innerHTML = '';
  const matchedIds = new Set();

  for (const { group, models } of POE_RECOMMENDED) {
    const matched = [];
    for (const desired of models) {
      const actual = findPoeMatch(desired, allModels);
      if (actual && !matchedIds.has(actual)) {
        matched.push(actual);
        matchedIds.add(actual);
      }
    }
    if (matched.length === 0) continue;
    const optgroup = document.createElement('optgroup');
    optgroup.label = group;
    for (const m of matched) {
      const opt = document.createElement('option');
      opt.value = m;
      opt.textContent = m;
      optgroup.appendChild(opt);
    }
    select.appendChild(optgroup);
  }

  // If the saved model isn't in the curated list, add it at the top
  if (selectedModel) {
    const actual = findPoeMatch(selectedModel, allModels);
    if (actual && !matchedIds.has(actual)) {
      const optgroup = document.createElement('optgroup');
      optgroup.label = 'Currently Selected';
      const opt = document.createElement('option');
      opt.value = actual;
      opt.textContent = actual;
      optgroup.appendChild(opt);
      select.prepend(optgroup);
    }
  }

  restorePoeSelection(select, allModels, selectedModel);
}

/** Build a flat alphabetical dropdown of ALL models. */
function buildFullDropdown(select, allModels, selectedModel) {
  select.innerHTML = '';
  const sorted = [...allModels].sort((a, b) => a.localeCompare(b));
  for (const m of sorted) {
    const opt = document.createElement('option');
    opt.value = m;
    opt.textContent = m;
    select.appendChild(opt);
  }
  restorePoeSelection(select, allModels, selectedModel);
}

/** Restore the selected model after rebuilding the dropdown. */
function restorePoeSelection(select, allModels, selectedModel) {
  if (!selectedModel) return;
  const actual = findPoeMatch(selectedModel, allModels);
  if (actual) select.value = actual;
}

async function refreshPoeModelDropdown(apiKey, selectedModel) {
  const select = $('poeModel');
  const hint = $('poeModelHint');
  const btn = $('btnRefreshPoeModels');
  const showAllLabel = $('poeShowAllLabel');
  const showAllCb = $('poeShowAllModels');

  if (!apiKey) {
    select.innerHTML = '<option value="">— enter API key to load models —</option>';
    if (hint) hint.textContent = '';
    if (showAllLabel) showAllLabel.style.display = 'none';
    return;
  }

  // Show loading state
  select.innerHTML = '<option value="">Loading models…</option>';
  if (btn) btn.classList.add('spinning');
  if (hint) hint.textContent = '';

  const models = await fetchPoeModelsForSettings(apiKey);
  if (btn) btn.classList.remove('spinning');

  _allPoeModels = models;
  _selectedPoeModel = selectedModel || '';

  if (models.length > 0) {
    // Build the appropriate view
    if (showAllCb && showAllCb.checked) {
      buildFullDropdown(select, models, selectedModel);
    } else {
      buildCuratedDropdown(select, models, selectedModel);
    }

    // Update hint & show-all toggle
    if (hint) hint.textContent = `Showing recommended models`;
    if (showAllLabel) {
      showAllLabel.style.display = '';
      $('poeModelCount').textContent = models.length;
    }

    // Warn if saved model wasn't found at all
    if (selectedModel && !findPoeMatch(selectedModel, models)) {
      if (hint) hint.textContent = `"${selectedModel}" not found on POE — pick a new model`;
    }
  } else {
    // Fallback: use curated names as static options (without verification)
    select.innerHTML = '';
    for (const { group, models: ids } of POE_RECOMMENDED) {
      const optgroup = document.createElement('optgroup');
      optgroup.label = group;
      for (const m of ids) {
        const opt = document.createElement('option');
        opt.value = m;
        opt.textContent = m;
        optgroup.appendChild(opt);
      }
      select.appendChild(optgroup);
    }
    if (selectedModel) select.value = selectedModel;
    if (hint) hint.textContent = 'Could not fetch models — showing common defaults';
    if (showAllLabel) showAllLabel.style.display = 'none';
  }
}

/** Toggle between curated and full model views. */
function togglePoeModelView() {
  const select = $('poeModel');
  const hint = $('poeModelHint');
  const showAll = $('poeShowAllModels').checked;
  // Remember current selection before rebuilding
  const current = select.value || _selectedPoeModel;

  if (_allPoeModels.length === 0) return;

  if (showAll) {
    buildFullDropdown(select, _allPoeModels, current);
    if (hint) hint.textContent = `Showing all ${_allPoeModels.length} models`;
  } else {
    buildCuratedDropdown(select, _allPoeModels, current);
    if (hint) hint.textContent = 'Showing recommended models';
  }
}

// ── Load & Display ──────────────────────────────────────────────

async function load() {
  const settings = await loadSettings();

  // Populate POE models dropdown BEFORE setting field values
  // (so the saved poeModel value can be matched against the dynamic options)
  const poeKey = settings.poeApiKey || DEFAULT_SETTINGS.poeApiKey;
  const poeModel = settings.poeModel || DEFAULT_SETTINGS.poeModel;
  await refreshPoeModelDropdown(poeKey, poeModel);

  for (const key of FIELDS) {
    const el = $(key);
    if (!el) continue;
    // Skip poeModel — already handled by refreshPoeModelDropdown
    if (key === 'poeModel') continue;
    const val = settings[key] !== undefined ? settings[key] : DEFAULT_SETTINGS[key];
    if (el.type === 'checkbox') {
      el.checked = !!val;
    } else if (el.type === 'range') {
      el.value = val;
    } else {
      el.value = val ?? '';
    }
  }

  updateLabels();
  updateVisibility();
  populateTtsVoices();

  // Load custom personalities
  const customs = settings.customPersonalities || DEFAULT_SETTINGS.customPersonalities;
  renderCustomPersonalities(customs);
}

// ── Save ────────────────────────────────────────────────────────

async function save() {
  const settings = {};
  for (const key of FIELDS) {
    const el = $(key);
    if (!el) continue;

    if (el.type === 'checkbox') {
      settings[key] = el.checked;
    } else if (el.type === 'range' || el.type === 'number') {
      settings[key] = Number(el.value);
    } else {
      settings[key] = el.value;
    }
  }

  // Also save localEnabled separately
  const localEl = $('localEnabled');
  if (localEl) settings.localEnabled = localEl.checked;

  // Save custom personalities
  const customs = getCustomPersonalitiesFromDOM();
  const overLimit = customs.find(p => wordCount(p.description) > MAX_WORDS);
  if (overLimit) {
    showStatus(`"${overLimit.name || 'Custom personality'}" exceeds 300-word limit`, 'error');
    return;
  }
  settings.customPersonalities = customs;

  try {
    await saveSettings(settings);
    showStatus('Settings saved ✓', 'success');
  } catch (e) {
    showStatus('Save failed: ' + e.message, 'error');
  }
}

function resetToDefaults() {
  if (!confirm('Reset all settings to defaults? API keys will be cleared.')) return;
  chrome.storage.local.clear();
  chrome.storage.sync.clear();
  load();
  showStatus('Reset to defaults', 'success');
}

// ── UI Helpers ──────────────────────────────────────────────────

function updateLabels() {
  // Response length
  const rl = Number($('responseLength').value);
  $('responseLengthLabel').textContent = `${rl} — ${RESPONSE_LENGTH_LABELS[rl] || ''}`;

  // TTS rate
  $('ttsSpeakingRateLabel').textContent = Number($('ttsSpeakingRate').value).toFixed(1) + '×';

  // TTS verbosity
  const tv = Number($('ttsVerbosity').value);
  $('ttsVerbosityLabel').textContent = `${tv} — ${TTS_VERBOSITY_LABELS[tv] || ''}`;

  // STT timeout
  $('sttSilenceTimeoutLabel').textContent = (Number($('sttSilenceTimeout').value) / 1000).toFixed(1) + 's';

  // Plan delay
  const delayEl = $('planDelayBetweenSteps');
  const delayLabel = $('planDelayLabel');
  if (delayEl && delayLabel) delayLabel.textContent = delayEl.value + 's';

  // Plan max actions
  const actionsEl = $('planMaxActionsPerStep');
  const actionsLabel = $('planMaxActionsLabel');
  if (actionsEl && actionsLabel) actionsLabel.textContent = actionsEl.value;
}

function updateVisibility() {
  const tts = $('ttsProvider').value;
  $('elevenlabsCard').style.display = tts === 'elevenlabs' ? '' : 'none';
  $('chromeTtsGroup').style.display = tts === 'chrome' ? '' : 'none';

  // Show/hide auto-mode hint
  const provider = $('primaryProvider').value;
  const autoHint = $('autoHint');
  if (autoHint) autoHint.style.display = provider === 'auto' ? '' : 'none';
}

function showStatus(msg, type) {
  const el = $('saveStatus');
  el.textContent = msg;
  el.className = 'save-status ' + type;
  setTimeout(() => { el.textContent = ''; el.className = 'save-status'; }, 3000);
}

// ── TTS Voice List ──────────────────────────────────────────────

function populateTtsVoices() {
  try {
    chrome.tts.getVoices(voices => {
      const select = $('chromeTtsVoice');
      const current = select.value;
      // Keep the auto-detect option
      select.innerHTML = '<option value="">Auto-detect best voice</option>';
      if (voices) {
        voices.forEach(v => {
          const opt = document.createElement('option');
          opt.value = v.voiceName;
          opt.textContent = `${v.voiceName} (${v.lang || 'unknown'})`;
          select.appendChild(opt);
        });
      }
      if (current) select.value = current;
    });
  } catch {
    // chrome.tts not available in options page context — that's ok
  }
}

// ── Toggle Password Visibility ──────────────────────────────────

function initToggleButtons() {
  document.querySelectorAll('.btn-toggle-vis').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = $(btn.dataset.target);
      if (target) {
        target.type = target.type === 'password' ? 'text' : 'password';
      }
    });
  });
}

// ── Init ────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  load();
  initToggleButtons();

  // Live label updates
  $('responseLength').addEventListener('input', updateLabels);
  $('ttsSpeakingRate').addEventListener('input', updateLabels);
  $('ttsVerbosity').addEventListener('input', updateLabels);
  $('sttSilenceTimeout').addEventListener('input', updateLabels);
  $('planDelayBetweenSteps').addEventListener('input', updateLabels);
  $('planMaxActionsPerStep').addEventListener('input', updateLabels);
  $('ttsProvider').addEventListener('change', updateVisibility);
  $('primaryProvider').addEventListener('change', updateVisibility);

  // POE model refresh — on button click or when API key changes
  $('btnRefreshPoeModels').addEventListener('click', () => {
    const apiKey = $('poeApiKey').value.trim();
    const currentModel = $('poeModel').value;
    refreshPoeModelDropdown(apiKey, currentModel);
  });

  // Toggle curated ↔ all models
  $('poeShowAllModels').addEventListener('change', togglePoeModelView);

  let _poeKeyDebounce;
  $('poeApiKey').addEventListener('input', () => {
    clearTimeout(_poeKeyDebounce);
    _poeKeyDebounce = setTimeout(() => {
      const apiKey = $('poeApiKey').value.trim();
      if (apiKey.length > 10) {
        refreshPoeModelDropdown(apiKey, $('poeModel').value);
      }
    }, 800);
  });

  // Custom personality
  $('addCustomPersonality').addEventListener('click', addCustomPersonality);

  // Save / Reset
  $('btnSave').addEventListener('click', save);
  $('btnReset').addEventListener('click', resetToDefaults);
  $('btnRefreshVoices').addEventListener('click', populateTtsVoices);
});

// ── Custom Personalities ────────────────────────────────────────

const MAX_CUSTOM = 3;
const MAX_WORDS = 300;

function wordCount(text) {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

/** Render all custom personality cards from the stored array */
function renderCustomPersonalities(personalities) {
  const list = $('customPersonalityList');
  list.innerHTML = '';

  personalities.forEach((p, i) => {
    if (!p.name && !p.description) return; // skip empty slots
    list.appendChild(createPersonalityCard(i, p.name, p.description));
  });

  syncDropdownOptions(personalities);
  updateAddButton(personalities);
}

/** Create a single custom personality card element */
function createPersonalityCard(index, name, description) {
  const card = document.createElement('div');
  card.className = 'custom-persona-card';
  card.dataset.index = index;

  const wc = wordCount(description);
  const overClass = wc > MAX_WORDS ? ' over-limit' : '';

  card.innerHTML = `
    <div class="card-header">
      <input type="text" class="cp-name" placeholder="Personality name (e.g. Pirate)" value="${escapeAttr(name)}" maxlength="40">
      <button type="button" class="btn-remove" title="Remove">&times;</button>
    </div>
    <textarea class="cp-desc" placeholder="Describe this personality... (max 300 words)" rows="3">${escapeHtml(description)}</textarea>
    <div class="card-footer">
      <span class="word-count${overClass}">${wc} / ${MAX_WORDS} words</span>
      <button type="button" class="btn-save-persona btn-sm">Save</button>
    </div>
  `;

  // Word count live update
  const textarea = card.querySelector('.cp-desc');
  const counter = card.querySelector('.word-count');
  textarea.addEventListener('input', () => {
    const wc = wordCount(textarea.value);
    counter.textContent = `${wc} / ${MAX_WORDS} words`;
    counter.className = 'word-count' + (wc > MAX_WORDS ? ' over-limit' : '');
  });

  // Name change → update dropdown label
  const nameInput = card.querySelector('.cp-name');
  nameInput.addEventListener('input', () => {
    const opt = document.querySelector(`option[value="custom_${index}"]`);
    if (opt) opt.textContent = nameInput.value || `Custom ${index + 1}`;
  });

  // Remove button
  card.querySelector('.btn-remove').addEventListener('click', () => {
    removeCustomPersonality(index);
  });

  // Save button — triggers global save
  card.querySelector('.btn-save-persona').addEventListener('click', () => {
    save();
  });

  return card;
}

function addCustomPersonality() {
  const personalities = getCustomPersonalitiesFromDOM();
  const usedCount = personalities.filter(p => p.name || p.description).length;
  if (usedCount >= MAX_CUSTOM) return;

  // Find first empty slot
  let slot = personalities.findIndex(p => !p.name && !p.description);
  if (slot === -1) slot = personalities.length;
  if (slot >= MAX_CUSTOM) return;

  // Append card directly (renderCustomPersonalities skips empty slots)
  const list = $('customPersonalityList');
  list.appendChild(createPersonalityCard(slot, '', ''));

  // Hide add button if we've reached the max
  const cardCount = list.querySelectorAll('.custom-persona-card').length;
  $('addCustomPersonality').style.display = cardCount >= MAX_CUSTOM ? 'none' : '';

  // Focus the new card's name input
  const newCard = list.querySelector(`.custom-persona-card[data-index="${slot}"]`);
  if (newCard) newCard.querySelector('.cp-name').focus();
}

function removeCustomPersonality(index) {
  const personalities = getCustomPersonalitiesFromDOM();
  personalities[index] = { name: '', description: '' };

  // If current tone was pointing at the removed one, revert to friendly
  if ($('personaTone').value === `custom_${index}`) {
    $('personaTone').value = 'friendly';
  }

  renderCustomPersonalities(personalities);
}

/** Read current custom personality data from DOM cards */
function getCustomPersonalitiesFromDOM() {
  const result = [
    { name: '', description: '' },
    { name: '', description: '' },
    { name: '', description: '' },
  ];
  $('customPersonalityList').querySelectorAll('.custom-persona-card').forEach(card => {
    const i = Number(card.dataset.index);
    result[i] = {
      name: card.querySelector('.cp-name').value.trim(),
      description: card.querySelector('.cp-desc').value.trim(),
    };
  });
  return result;
}

/** Show/hide dropdown options based on which custom slots have content */
function syncDropdownOptions(personalities) {
  for (let i = 0; i < MAX_CUSTOM; i++) {
    const opt = document.querySelector(`option[value="custom_${i}"]`);
    if (!opt) continue;
    const p = personalities[i];
    const hasContent = p && (p.name || p.description);
    opt.style.display = hasContent ? '' : 'none';
    opt.textContent = (p && p.name) || `Custom ${i + 1}`;
  }
}

/** Show/hide add button based on how many are used */
function updateAddButton(personalities) {
  const usedCount = personalities.filter(p => p.name || p.description).length;
  $('addCustomPersonality').style.display = usedCount >= MAX_CUSTOM ? 'none' : '';
}

function escapeAttr(s) {
  return (s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}
function escapeHtml(s) {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
