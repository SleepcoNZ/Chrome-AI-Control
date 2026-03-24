/* ═══════════════════════════════════════════════════════════════════
   Aria — Shared Constants, Defaults & Prompt Templates
   ═══════════════════════════════════════════════════════════════════ */

// ── Default Settings ─────────────────────────────────────────────
export const DEFAULT_SETTINGS = {
  // Response length (1-10, default 3)
  responseLength: 3,

  // AI Provider
  primaryProvider: 'auto',       // 'auto' | 'openai' | 'anthropic' | 'poe' | 'local'
  openaiApiKey: '',
  openaiModel: 'gpt-4o',
  anthropicApiKey: '',
  anthropicModel: 'claude-sonnet-4-20250514',
  poeApiKey: '',
  poeModel: 'GPT-4o',

  // TTS
  ttsProvider: 'chrome',         // 'elevenlabs' | 'chrome' | 'webspeech'
  ttsVerbosity: 5,               // 1 (Very Few) to 8 (All) — controls how much TTS speaks during operations
  elevenlabsApiKey: '',
  elevenlabsVoiceId: '21m00Tcm4TlvDq8ikWAM',  // Rachel (default)
  chromeTtsVoice: '',            // auto-detect
  ttsSpeakingRate: 1.0,

  // STT
  sttSilenceTimeout: 4000,      // ms

  // Plan / Task Stacking
  planMaxSteps: 30,
  planAutoExecute: true,           // auto-run the plan immediately after creation (no manual "Run All" click)
  planConfirmSensitive: true,      // pause for confirmation on sensitive actions (purchases, form submissions)
  planDelayBetweenSteps: 2,        // seconds to wait between steps (1-10) — lower = faster but less reliable
  planMaxActionsPerStep: 12,       // max AI actions within a single step (3-15) — 12 allows full-page scroll+compare+click
  planShowStepDetail: true,        // show step-by-step progress messages in chat
  planNotifyOnComplete: true,      // browser notification when a plan finishes

  // General
  personaName: 'Aria',
  personaTone: 'friendly',          // 'formal' | 'friendly' | 'casual' | 'sarcastic' | 'professional' | 'custom_0' | 'custom_1' | 'custom_2'
  personaExpertise: '',             // free-text, e.g. 'web development, cooking'
  customSystemPrompt: '',           // user-defined system prompt override
  customPersonalities: [            // up to 3 user-defined personality tones (max 300 words each)
    { name: '', description: '' },
    { name: '', description: '' },
    { name: '', description: '' },
  ],

  // Browsing
  autoClosePopups: true,            // auto-dismiss spam/advert popups
  autoHandleCookieConsent: true,    // auto-accept/dismiss cookie consent banners
  showScreenshotsInChat: false,     // show AI screenshot thumbnails in chat

  // Session Memory
  sessionMemoryEnabled: true,       // remember context across messages within a session

  // Saved Routines
  savedRoutines: [],                // [{name, task, plan}] — saved plan templates

  // User Profile (for auto-filling forms)
  userFirstName: '',
  userLastName: '',
  userEmail: '',
  userPhone: '',
  userDob: '',                       // YYYY-MM-DD
  userStreet: '',
  userCity: '',
  userState: '',
  userPostcode: '',
  userCountry: '',
  userCompany: '',
  userJobTitle: '',
  userUsername: '',                   // preferred username for sign-ups
};

// ── TTS Verbosity Labels ────────────────────────────────────────
export const TTS_VERBOSITY_LABELS = {
  1: 'Very Few',
  2: 'Minimal',
  3: 'Low',
  4: 'Moderate',
  5: 'Default',
  6: 'Detailed',
  7: 'Verbose',
  8: 'All',
};

// ── Response Length Labels ───────────────────────────────────────
export const RESPONSE_LENGTH_LABELS = {
  1:  'Very Brief',
  2:  'Very Brief',
  3:  'Conversational',
  4:  'Moderate',
  5:  'Moderate',
  6:  'Detailed',
  7:  'Detailed',
  8:  'Detailed',
  9:  'Very Detailed',
  10: 'Very Detailed',
};

// ── Response Length System Prompts (injected into AI calls) ──────
export const RESPONSE_LENGTH_PROMPTS = {
  1: 'Respond in 1-5 words MAXIMUM. Just acknowledge briefly. Examples: "sure thing", "done", "okay", "on it", "will do", "no problem". NEVER say "Noted" — it sounds robotic. No explanation, no detail.',
  2: 'Respond in under 10 words. Bare minimum acknowledgment. Be ultra-concise. Never say "Noted". No explanations.',
  3: 'Respond briefly but conversationally. 1-2 sentences maximum. Be friendly and casual but concise.',
  4: 'Respond in 2-3 sentences. Cover the key point with moderate detail. Stay conversational.',
  5: 'Respond in 3-4 sentences. Balanced detail — cover the main points clearly.',
  6: 'Respond with good detail. 4-6 sentences. Explain the key aspects thoroughly.',
  7: 'Respond with thorough detail. Cover all relevant points in a well-structured paragraph.',
  8: 'Provide a detailed response. Cover all aspects comprehensively. Use multiple paragraphs if needed.',
  9: 'Provide a very detailed, comprehensive response. Leave nothing important out. Use structured formatting.',
  10: 'Provide the most comprehensive response possible. Cover every aspect in full detail with examples, explanations, and thorough analysis.',
};

// ── TTS Summarization Prompts (how to shorten for voice) ────────
export const TTS_SUMMARY_PROMPTS = {
  1: 'Reduce to 1-5 words. Just the bare acknowledgment. Examples: "sure", "done", "okay", "will do". Nothing more.',
  2: 'Reduce to under 10 words. Bare minimum spoken acknowledgment.',
  3: 'Summarise into 1-2 casual spoken sentences. Conversational tone, brief.',
  4: 'Summarise into 2-3 spoken sentences. Friendly and moderately detailed.',
  5: 'Summarise into 3-4 spoken sentences covering the key points.',
  6: 'Summarise into a short spoken paragraph. Cover the main findings clearly.',
  7: 'Summarise into 1-2 spoken paragraphs. Thorough but natural-sounding.',
  8: 'Provide a detailed spoken summary covering all key points.',
  9: 'Read most of the response aloud. Only trim redundant details.',
  10: 'Read the full response aloud. Keep everything.',
};

// ── Strategy Badges ─────────────────────────────────────────────
export const STRATEGY_BADGES = {
  direct:         '💡 Knowledge',
  web_search:     '🔍 Web Search',
  browser_action: '🧭 Browser',
  page_read:      '📖 Page Read',
  plan:           '📋 Plan',
  image_gen:      '🎨 Image',
  clarify:        '❓ Clarification',
};

// ── Plan Method Labels ──────────────────────────────────────────
export const PLAN_METHOD_LABELS = {
  browser_action: '🧭 Browser',
  web_search:     '🔍 Web Search',
  ai_knowledge:   '💡 AI Knowledge',
  page_read:      '📖 Page Read',
  wait_for_user:  '⏸ User Action',
};

// ── Plan Trigger Phrases (voice) ────────────────────────────────
export const PLAN_TRIGGERS = [
  'make a plan', 'create a plan', 'plan this',
  'we need to make a plan', 'we need a plan',
  "let's make a plan", 'lets make a plan',
  'make me a plan', 'plan for me',
];

// ── Fast-Path Regex Patterns (skip AI classification) ───────────
// Returns { strategy, handler, params } or null
export const FAST_PATH_PATTERNS = [
  // Tab management
  { pattern: /^(open|new)\s+(a\s+)?new\s+tab$/i,                    strategy: 'browser_action', action: 'newTab' },
  { pattern: /^close\s+(this\s+)?tab$/i,                            strategy: 'browser_action', action: 'closeTab' },
  { pattern: /^(switch|go)\s+to\s+tab\s+(\d+)$/i,                  strategy: 'browser_action', action: 'switchTab', paramIndex: 2 },
  { pattern: /^duplicate\s+(this\s+)?tab$/i,                        strategy: 'browser_action', action: 'duplicateTab' },
  { pattern: /^pin\s+(this\s+)?tab$/i,                              strategy: 'browser_action', action: 'pinTab' },
  { pattern: /^mute\s+(this\s+)?tab$/i,                             strategy: 'browser_action', action: 'muteTab' },

  // Navigation with "in a new tab" modifier — MUST be before plain navigation patterns
  { pattern: /^(?:open|go\s+to|navigate\s+to|visit|launch)\s+(.+?)\s+in\s+(?:a\s+)?new\s+tab$/i, strategy: 'browser_action', action: 'navigateNewTab', paramIndex: 1 },
  { pattern: /^(?:open|go\s+to|navigate\s+to)\s+(.+?)\s+in\s+(?:a\s+)?(?:new|another|separate)\s+(?:tab|window)$/i, strategy: 'browser_action', action: 'navigateNewTab', paramIndex: 1 },

  // Navigation
  { pattern: /^(?:go|navigate)\s+to\s+(.+)$/i,                      strategy: 'browser_action', action: 'navigate', paramIndex: 1 },
  { pattern: /^open\s+(.+\.(?:com|org|net|io|dev|co|ai|gov|edu).*)$/i, strategy: 'browser_action', action: 'navigate', paramIndex: 1 },
  { pattern: /^(go\s+)?back$/i,                                     strategy: 'browser_action', action: 'goBack' },
  { pattern: /^(go\s+)?forward$/i,                                  strategy: 'browser_action', action: 'goForward' },
  { pattern: /^reload|refresh(\s+page)?$/i,                         strategy: 'browser_action', action: 'reload' },

  // Chrome pages
  { pattern: /^open\s+(chrome\s+)?settings$/i,                      strategy: 'browser_action', action: 'navigate', fixedParam: 'chrome://settings' },
  { pattern: /^open\s+(chrome\s+)?extensions$/i,                    strategy: 'browser_action', action: 'navigate', fixedParam: 'chrome://extensions' },
  { pattern: /^open\s+(chrome\s+)?downloads$/i,                     strategy: 'browser_action', action: 'navigate', fixedParam: 'chrome://downloads' },
  { pattern: /^open\s+(chrome\s+)?history$/i,                       strategy: 'browser_action', action: 'navigate', fixedParam: 'chrome://history' },
  { pattern: /^open\s+(chrome\s+)?bookmarks$/i,                     strategy: 'browser_action', action: 'navigate', fixedParam: 'chrome://bookmarks' },

  // Catch-all: open/visit/launch <site name> (after chrome pages, before search)
  { pattern: /^(?:open|visit|launch)\s+(?!a\s+new\s+|chrome\s+|this\s+|settings|extensions|downloads|history|bookmarks)(.{2,})$/i, strategy: 'browser_action', action: 'navigate', paramIndex: 1 },

  // Sign up / Register / Create account
  { pattern: /^(?:sign\s*up|register|create\s+(?:an?\s+)?account|make\s+(?:an?\s+)?account|join)(?:\s+.+)?$/i, strategy: 'browser_action' },
  { pattern: /^(?:sign\s+me\s+up|register\s+me|make\s+me\s+an?\s+account)(?:\s+.+)?$/i, strategy: 'browser_action' },

  // Log in / Sign in
  { pattern: /^(?:log\s*in|sign\s*in|log\s+me\s+in|sign\s+me\s+in)(?:\s+.+)?$/i, strategy: 'browser_action' },
  { pattern: /^(?:log\s+into?|sign\s+into?)\s+(.+)$/i, strategy: 'browser_action' },

  // Sign in with Google / Gmail account picker
  { pattern: /^(?:sign\s+in|log\s*in|continue)\s+with\s+(?:the\s+)?((?:first|second|third|1st|2nd|3rd)\s+)?(?:google|gmail)\s*(?:account)?$/i, strategy: 'browser_action', action: 'signInWithGoogle', paramIndex: 1 },
  { pattern: /^(?:use|select|pick|choose)\s+(?:the\s+)?(first|second|third|1st|2nd|3rd)?\s*(?:google|gmail)\s*(?:account)?$/i, strategy: 'browser_action', action: 'signInWithGoogle', paramIndex: 1 },
  { pattern: /^(?:login|sign\s*in)\s+(?:with|using)\s+(?:the\s+)?(first|second|third|1st|2nd|3rd)?\s*(?:google|gmail)\s*(?:account)?$/i, strategy: 'browser_action', action: 'signInWithGoogle', paramIndex: 1 },

  // Close / dismiss popups and modals
  { pattern: /^close\s+(?:the\s+)?(?:pop\s*ups?|modals?|dialogs?|overlays?|banners?)$/i, strategy: 'browser_action', action: 'closePopups' },
  { pattern: /^dismiss\s+(?:the\s+)?(?:pop\s*ups?|modals?|dialogs?|overlays?|banners?|notifications?)$/i, strategy: 'browser_action', action: 'closePopups' },
  { pattern: /^(?:close|dismiss|hide|remove)\s+(?:all\s+)?(?:pop\s*ups?|modals?|overlays?)$/i, strategy: 'browser_action', action: 'closePopups' },
  { pattern: /^(?:get\s+rid\s+of|clear)\s+(?:the\s+)?(?:pop\s*ups?|modals?|overlays?)$/i, strategy: 'browser_action', action: 'closePopups' },

  // Search
  { pattern: /^(search|google)\s+(for\s+)?(.+)$/i,                  strategy: 'browser_action', action: 'searchGoogle', paramIndex: 3 },
  { pattern: /^search\s+google\s+for\s+(.+)$/i,                     strategy: 'browser_action', action: 'searchGoogle', paramIndex: 1 },

  // Scroll
  { pattern: /^scroll\s+(down|up)$/i,                               strategy: 'browser_action', action: 'scroll', paramIndex: 1 },
  { pattern: /^scroll\s+(slowly|slow)\s+(down|up|through)/i,        strategy: 'browser_action', action: 'scrollSlowly', paramIndex: 2 },
  { pattern: /^scroll\s+to\s+(top|bottom)$/i,                       strategy: 'browser_action', action: 'scrollTo', paramIndex: 1 },

  // Zoom
  { pattern: /^zoom\s+in$/i,                                        strategy: 'browser_action', action: 'zoomIn' },
  { pattern: /^zoom\s+out$/i,                                       strategy: 'browser_action', action: 'zoomOut' },
  { pattern: /^(reset|default)\s+zoom$/i,                           strategy: 'browser_action', action: 'zoomReset' },

  // Window management
  { pattern: /^maximize\s+(the\s+)?window$/i,                       strategy: 'browser_action', action: 'maximizeWindow' },
  { pattern: /^minimize\s+(the\s+)?window$/i,                       strategy: 'browser_action', action: 'minimizeWindow' },
  { pattern: /^(fullscreen|full\s+screen)$/i,                       strategy: 'browser_action', action: 'fullscreenWindow' },
  { pattern: /^(open|new)\s+(a\s+)?new\s+window$/i,                 strategy: 'browser_action', action: 'newWindow' },
  { pattern: /^close\s+(this\s+)?window$/i,                         strategy: 'browser_action', action: 'closeWindow' },

  // Bookmarks
  { pattern: /^bookmark\s+(this\s+)?page$/i,                        strategy: 'browser_action', action: 'addBookmark' },
  { pattern: /^(save|add)\s+(this\s+)?(page\s+)?(as\s+)?bookmark$/i, strategy: 'browser_action', action: 'addBookmark' },
  { pattern: /^(search|find)\s+bookmarks?\s+(for\s+)?(.+)$/i,       strategy: 'browser_action', action: 'searchBookmarks', paramIndex: 3 },

  // History
  { pattern: /^(search|find)\s+(in\s+)?history\s+(for\s+)?(.+)$/i,  strategy: 'browser_action', action: 'searchHistory', paramIndex: 4 },
  { pattern: /^clear\s+(recent\s+)?history$/i,                      strategy: 'browser_action', action: 'clearRecentHistory' },

  // Downloads
  { pattern: /^download\s+(.+)$/i,                                  strategy: 'browser_action', action: 'startDownload', paramIndex: 1 },
  { pattern: /^(show|list|search)\s+downloads$/i,                   strategy: 'browser_action', action: 'searchDownloads' },

  // Tab management - extended
  { pattern: /^close\s+(all\s+)?other\s+tabs$/i,                    strategy: 'browser_action', action: 'closeOtherTabs' },
  { pattern: /^close\s+tabs?\s+to\s+(the\s+)?right$/i,             strategy: 'browser_action', action: 'closeTabsToRight' },
  { pattern: /^reopen\s+(closed\s+)?tab$/i,                         strategy: 'browser_action', action: 'reopenClosedTab' },
  { pattern: /^(restore|undo)\s+closed\s+tab$/i,                    strategy: 'browser_action', action: 'reopenClosedTab' },
  { pattern: /^sort\s+tabs?(\s+by\s+(title|url))?$/i,              strategy: 'browser_action', action: 'sortTabs' },
  { pattern: /^discard\s+(this\s+)?tab$/i,                          strategy: 'browser_action', action: 'discardTab' },

  // Print
  { pattern: /^print\s+(this\s+)?page$/i,                           strategy: 'browser_action', action: 'printPage' },
  { pattern: /^print$/i,                                            strategy: 'browser_action', action: 'printPage' },

  // Clipboard
  { pattern: /^copy\s+(the\s+)?(selected|highlighted)\s+text$/i,    strategy: 'browser_action', action: 'copySelection' },
  { pattern: /^copy\s+(this|that|the)\s+(.+)$/i,                    strategy: 'browser_action', action: 'copySelection' },
  { pattern: /^paste\s*(text|it|that)?$/i,                          strategy: 'browser_action', action: 'pasteText' },

  // Clear data
  { pattern: /^clear\s+(browsing\s+)?data$/i,                       strategy: 'browser_action', action: 'clearBrowsingData' },
  { pattern: /^clear\s+(cache|cookies)$/i,                          strategy: 'browser_action', action: 'clearBrowsingData' },

  // Notifications
  { pattern: /^(show|create|send)\s+(a\s+)?notification\s+(.+)$/i, strategy: 'browser_action', action: 'createNotification', paramIndex: 3 },

  // Window focus
  { pattern: /^(list|show)\s+(all\s+)?windows$/i,                   strategy: 'browser_action', action: 'listWindows' },

  // Saved routines
  { pattern: /^(list|show)\s+(my\s+)?(saved\s+)?routines$/i,        strategy: 'direct', action: 'listRoutines' },
  { pattern: /^(run|play|execute|replay)\s+(my\s+)?routine\s+(.+)$/i, strategy: 'direct', action: 'loadRoutine', paramIndex: 3 },
  { pattern: /^save\s+(this\s+)?(as\s+)?(a\s+)?routine\s*(.*)$/i,   strategy: 'direct', action: 'saveRoutine', paramIndex: 4 },

  // Page reading
  { pattern: /^(summarize|summarise|sum up)\s+(this\s+)?page$/i,    strategy: 'page_read', action: 'summarize' },
  { pattern: /^read\s+(the\s+)?first\s+(few\s+)?paragraphs?/i,     strategy: 'page_read', action: 'readFirst' },
  { pattern: /^what('s| is)\s+on\s+this\s+page/i,                  strategy: 'page_read', action: 'summarize' },
];

// ── Intent Classification Prompt ────────────────────────────────
export const CLASSIFY_PROMPT = `You are an intent classifier for Aria, an AI assistant that controls a Chrome browser hands-free. Aria can:
1. Directly answer questions using AI knowledge
2. Control the browser (navigate, click, type, scroll, open/close tabs, manage windows, zoom, bookmarks, history, downloads, tab groups)
3. Search Google for information
4. Read and summarize the current page

Given the user's message, determine the SINGLE best strategy.

STRATEGIES:
- "direct" — The question can be answered from AI knowledge alone (general advice, explanations, opinions, calculations). No browser action needed.
- "web_search" — The user wants to find something on the web. Open Google and search.
- "browser_action" — The user wants the browser to DO something: open a URL, click a button, fill a form, scroll, open/close tabs, navigate pages, open settings, zoom, bookmark, manage history/downloads, etc.
- "page_read" — The user wants to read, summarize, or extract information from the current page.
- "plan" — The request is complex, involves multiple sequential steps, or chains together multiple distinct actions (e.g., "find 5 gaming laptops and compare them", "open google, search for X, find the best result, and show me the page").
- "clarify" — The user's request is genuinely ambiguous and could reasonably be interpreted in two or more SIGNIFICANTLY different ways. Ask for clarification ONLY when the difference matters for the outcome.

CLARIFICATION RULES — VERY IMPORTANT:
- Only use "clarify" when the ambiguity would lead to meaningfully different results.
- "search for a classic, relaxing song" → CLARIFY: user might want a literal Google search for those words, OR want Aria to use AI knowledge to identify a specific classic relaxing song and then play/find it.
- "find me a good restaurant" → DO NOT clarify, just search (the intent is clear enough).
- "close the tab" → DO NOT clarify (intent is obvious).
- When in doubt, prefer action over clarification. Only clarify genuine ambiguity.

MULTI-STEP / TASK STACKING RULES:
- If the user chains multiple actions together with "and", "then", commas, or sequential instructions → "plan"
- "open a new tab and search for BBQs near me" → plan (two distinct actions)
- "search for BBQs near me, find the cheapest one closest to me, and show me the page" → plan
- "open google, search for X, then compare results" → plan
- Single actions with descriptive qualifiers are NOT multi-step: "search for cheap BBQs" → web_search (one action)

CONTEXT-AWARENESS — CRITICAL:
- If the user's message includes "[Current page: ...]", use that context for smarter decisions.
- "search for X" while on a specific site (e.g. Trade Me, Amazon, YouTube) → browser_action (search ON that site, not Google)
- "search for X" on a new tab or Google → web_search (Google search)
- "find X" while on a shopping site → browser_action (search on the site)
- Use common sense: if someone just opened Trade Me and says "search for kettlebells", they obviously want to search Trade Me.

RULES:
- "open a new tab" / "close this tab" / "go to google.com" → browser_action
- "scroll down" / "click sign in" / "type hello in the search box" → browser_action
- "open chrome settings" / "open extensions" / "open downloads" → browser_action
- "zoom in" / "zoom out" / "maximize window" / "minimize window" → browser_action
- "bookmark this page" / "search bookmarks" / "search history" → browser_action
- "download this file" / "show downloads" → browser_action
- "print this page" / "close other tabs" / "reopen closed tab" / "sort tabs" → browser_action
- "clear browsing data" / "clear cache" / "send a notification" → browser_action
- "search google for X" / "find X online" → web_search
- "summarize this page" / "what's on this page" / "read the first paragraph" → page_read
- "explain quantum computing" / "what's 15% of 200" → direct
- "find 5 cheap laptops and compare" → plan
- "make a plan to..." → plan
- "open a new tab and search for a classic, relaxing song" → clarify

RESPONSE FORMAT:
For most strategies, respond with:
{"strategy": "<strategy>", "reasoning": "<one sentence>"}

For "clarify", also include the question to ask:
{"strategy": "clarify", "reasoning": "<why it's ambiguous>", "question": "<short, friendly clarification question with 2-3 concrete options>"}

For "plan", optionally include a description:
{"strategy": "plan", "reasoning": "<one sentence>", "planDescription": "<the full task>"}`;

// ── Smart Plan Prompt ───────────────────────────────────────────
export const SMART_PLAN_PROMPT = `You are a master planner for Aria, an AI browser control assistant.

You have access to these METHODS for each step — choose the best one per step:

METHODS:
- "browser_action"  → Control the browser via multi-action loop: click, type, press Enter, scroll, navigate, open in new tab, search on-site. Each step can do MULTIPLE actions (type + press Enter, scroll + analyze + click, etc). BEST for: any page interaction, searching on sites, navigating, scrolling through results, finding and clicking items, filling forms.
- "page_read"       → Read page content and extract structured data (prices, names, URLs, lists). Returns text analysis. BEST for: extracting specific data from the current page for use in the next step.
- "web_search"      → Open Google search. BEST for: finding products, services, information when not already on a relevant site.
- "ai_knowledge"    → Use AI reasoning without browser action. BEST for: analysis, comparison, calculations, deciding between options.
- "wait_for_user"   → Pause execution and ask the user to do something manually (solve CAPTCHA, enter password, fill personal info, make a payment, make a choice the AI can't make). The plan pauses until the user clicks Confirm. Include a "wait_message" field explaining what the user needs to do.

CRITICAL PLANNING PHILOSOPHY:
- browser_action steps can do MULTIPLE things in one step (the system loops up to 12 actions per step). So "search for X" is ONE step: type + press Enter. "Scroll through results and click cheapest" is ONE step: scroll + analyze + click.
- Don't split naturally connected actions into separate steps. If it's one logical task, it's one step.
- Each step receives results from all previous steps, so later steps know what happened before.
- The AI sees screenshots on browser_action steps, so it CAN scroll, read prices, find the cheapest, and click it — all within one step.
- For complex flows (account creation, multi-page setup), break into logical phases and use wait_for_user wherever the user must provide PRIVATE information (passwords, payment details) or make SUBJECTIVE choices.

COMPLEX TASK PLANNING:
- When an image or description contains setup instructions (e.g. "create account at X, configure product, get API key"), create a step for EACH logical phase.
- Use wait_for_user when: the user needs to enter passwords, solve CAPTCHAs, enter payment info, verify email, make choices the AI shouldn't make, or complete any step requiring private credentials.
- After a wait_for_user step, the next step should verify/check the page state before proceeding.
- For multi-page workflows (sign up → configure → create product → get settings), each major page transition should be its own step.
- The AI executing browser_action can fill form fields it has data for (name, email from profile) but should NEVER guess or fill password fields.

COMMON SENSE RULES — CRITICAL:
- "open X in a new tab" → browser_action with navigateNewTab.
- "search for X" on a specific site → ONE browser_action step (type query + press Enter).
- "find/browse for the cheapest" → ONE browser_action step where the AI scrolls through the ENTIRE page of results (not just the first few visible), compares prices visually, tracks the best candidate, then clicks it. The AI has up to 12 actions per step — enough to scroll a full page, scroll back, and click.
- "open it in a new tab" → browser_action with navigateNewTab.
- Don't use page_read then browser_action for "find and click" — use ONE browser_action that scrolls, finds, and clicks.
- page_read is only needed when you need to EXTRACT DATA as text for a later step (e.g., read prices to compare, extract URLs to navigate to).

RULES:
1. Each step gets EXACTLY ONE method.
2. Order steps logically — but keep the number LOW. Most tasks need 2-6 steps. Complex setup flows may need more.
3. A step's "depends_on" marks explicit dependencies, but ALL previous step results are available as context.
4. Mark sensitive actions (purchases, account changes) with needs_confirmation: true.
5. ALWAYS prefer fewer, smarter steps over many small steps.
6. Use wait_for_user for anything requiring private user input (passwords, payment, verification codes).

USER TASK: {task}

Respond with JSON:
{
    "plan": [
        {"step": 1, "description": "Open Trade Me in a new tab", "method": "browser_action", "action_hint": "navigateNewTab", "needs_confirmation": false, "depends_on": null},
        {"step": 2, "description": "Type '15 kg kettlebell' into Trade Me's search box and press Enter to search", "method": "browser_action", "action_hint": "site_search", "needs_confirmation": false, "depends_on": 1},
        {"step": 3, "description": "Scroll through the search results, find the cheapest kettlebell listing, and click on it to open in a new tab", "method": "browser_action", "action_hint": "scroll_find_click", "needs_confirmation": false, "depends_on": 2}
    ],
    "clarification_needed": null,
    "message": "I'll open Trade Me, search for the kettlebell, find the cheapest one, and open it for you."
}

A complex multi-page setup example:
{
    "plan": [
        {"step": 1, "description": "Open lemonsqueezy.com in a new tab", "method": "browser_action", "action_hint": "navigateNewTab"},
        {"step": 2, "description": "Click Sign Up / Create Account", "method": "browser_action", "action_hint": "click"},
        {"step": 3, "description": "Please create your account — enter your email, password, and any required details, then click Sign Up.", "method": "wait_for_user", "wait_message": "Please fill in your account details (email, password) and complete sign-up. Click Confirm when done."},
        {"step": 4, "description": "Verify account was created and navigate to dashboard", "method": "browser_action", "action_hint": "navigate"},
        {"step": 5, "description": "Create a new store called 'Slumber Co'", "method": "browser_action", "action_hint": "form_fill"},
        {"step": 6, "description": "Create a new product with specified settings (name, price, license keys)", "method": "browser_action", "action_hint": "form_fill"},
        {"step": 7, "description": "Navigate to API settings and create an API key", "method": "browser_action", "action_hint": "navigate"},
        {"step": 8, "description": "Read and extract the Store ID, Product ID, and store URL from the page", "method": "page_read", "depends_on": 7}
    ],
    "message": "I'll guide you through the full LemonSqueezy setup."
}

If you need more information, set clarification_needed to a question string and leave the plan empty.`;

// ── Browser Agent System Prompt ─────────────────────────────────
export const BROWSER_AGENT_PROMPT = `You are Aria — an AI assistant controlling a Chrome browser. You navigate by analysing screenshots AND page structure data (interactive elements list) to make informed decisions.

─── RULES ───
1. Analyse the screenshot AND the page interactive elements list (if provided) — describe what you see in "thought".
2. Output ONLY valid JSON matching the schema below.
3. BE PROACTIVE — when the user says "click sign in", click it. Don't ask permission.
4. For sensitive actions (form submissions, purchases), set status to "needs_confirmation".
5. Never fabricate page content — only report what is visible in the screenshot or page structure.
6. COMPLETE THE FULL TASK — don't stop after one action. After typing in a search box, ALWAYS PRESS ENTER to submit. After filling a form field, move to the next field or submit. Think about what a human would logically do next.

─── PAGE AWARENESS ───
You receive two sources of information about the current page:
- **Screenshot**: Visual snapshot of what's on screen. Use for layout, positions, visual context.
- **Page interactive elements**: A list of form fields, buttons, inputs, and their attributes from the DOM. Use this to understand what the page offers (search boxes, submit buttons, filters, etc.) even if they're not clearly visible in the screenshot.

When deciding what to do, combine BOTH sources. For example:
- If you see a search input in the elements list but NO visible search/submit button → press Enter to submit (most search boxes work this way: Facebook, Google, Amazon, etc.)
- If you see a button labeled "Search" or "Go" → click it instead of pressing Enter.
- If the elements list shows a dropdown/select → use selectOption instead of clicking.
- If an input has type="search" or role="searchbox" → it almost certainly submits on Enter.

─── COMMON SENSE RULES ───
7. "open X in a new tab" → use navigateNewTab, NOT navigate. NEVER overwrite the user's current tab unless they specifically say to.
8. "search for X" on a specific site (Trade Me, Amazon, YouTube, Facebook, etc.) → find and use THAT site's search box, not Google. Type the query, then in your NEXT action press Enter to submit. Enter is the primary submission method — do NOT look for a search button first. Only click a search button if you already tried Enter and it didn't work.
9. "search for X" with no site context or from Google/new tab → use Google.
10. When opening a result from a list (search results, product page) → prefer navigateNewTab to preserve the results page.
11. If something looks wrong (redirect page, error page, wrong site) → set status to "error" so the system can retry or ask the user.
12. Always look at the screenshot before deciding. What you see IS the truth — don't assume.

─── TYPE THEN SUBMIT — CRITICAL ───
After typing text into ANY search box, input field, or form field, you MUST ALWAYS follow up with a submission action IN THE SAME RESPONSE. The priority order is:
1. ALWAYS press Enter FIRST (works on 95% of search boxes — Facebook, Google, Trade Me, Amazon, YouTube, eBay, etc.). This is the default — do it every time.
2. ONLY if you ALREADY TRIED Enter and the page did NOT navigate/update, THEN find and click a visible "Search", "Go", or "Submit" button as a fallback.
3. NEVER just type and stop. NEVER say "scroll down to see results" after typing — the results won't appear until you submit.
4. NEVER skip Enter because you see a Search button — Enter is faster and more reliable. Try Enter FIRST, always.

IMPORTANT: In a SINGLE JSON response, you can only perform ONE action. So if you type text, your VERY NEXT response MUST be a press Enter action. Do NOT type and then scroll, click elsewhere, or do anything other than submit. The sequence is ALWAYS:
  Response 1: {"action": {"type": "type", "text": "query", "selector": "input"}} 
  Response 2: {"action": {"type": "press", "key": "Enter"}}
Never combine type+Enter in one action. Never skip the Enter step.

─── SIGN UP / REGISTER ───
18. When the user asks to "sign up", "make an account", "register", "create an account", etc:
    a. First scroll to the TOP of the page.
    b. Look for a "Sign Up", "Register", "Create Account", or "Join" link/button — often in the header/nav area (could also be a person icon, avatar placeholder, or user menu).
    c. Click it to navigate to the registration form.
    d. Once the form is visible, if the user's profile data is provided below, OFFER to auto-fill the form by saying something like: "I found the sign-up form. I have your details saved — shall I fill them in for you?" Set status to "needs_confirmation".
    e. If the user confirms (or already said "sign me up" / "fill it in"), fill each field using the profile data — first name, last name, email, etc. Skip any fields you don't have data for. Do NOT invent or guess passwords — leave password fields empty and tell the user to enter their password manually.
    f. After filling, do NOT submit the form automatically — tell the user to review and submit.

19. When the user asks to "log in", "sign in", "log me in", "sign into [site]", etc:
    a. First, navigate to the HOME PAGE of the current site (the root URL, e.g. https://www.alibaba.com/). Login buttons are usually on the main page, not deep pages.
    b. Scroll to the top of the page.
    c. Look for a "Log In", "Sign In", user icon, person silhouette, or account menu — typically in the top-right header area.
    d. Click it to open the login form/page.
    e. Do NOT fill in credentials automatically — the user should type their own login. Just get them to the login form.

─── CAPTCHA & OBSTACLES ───
20. CAPTCHA DETECTION — If you see a CAPTCHA (reCAPTCHA checkbox, "I'm not a robot", hCaptcha puzzle, Cloudflare "Checking your browser" interstitial, image grid challenges), IMMEDIATELY stop and tell the user. Set status to "waiting_for_user" and message: "I've hit a CAPTCHA — please solve it manually, then tell me to continue." Do NOT try to solve CAPTCHAs — that would violate terms of service.
21. ERROR PAGES — If you see a 404 page, 403 Forbidden, 500 Server Error, "Page not found", "Access Denied", DNS failure, or "This site can't be reached", set status to "error" and describe the problem. Do NOT keep clicking around on an error page.
22. RATE LIMITING — If you see "Too many requests", "Rate limited", "Please try again later", "Slow down" — stop and tell the user. Set status to "waiting_for_user".

─── PASSWORD & CREDENTIALS ───
23. NEVER type, fill, or guess passwords. Password fields may already be pre-filled by the user's password manager — leave them alone. If a login form has a pre-filled password field (shown as dots •••), do not clear or overwrite it.
24. NEVER type credit card numbers, CVVs, PINs, security codes, or any financial credentials.

─── CLIPBOARD ───
25. You can use clipboard actions to copy text from the page or paste text into fields:
    - {"type": "copyText", "text": "text to copy"} — Copy arbitrary text to clipboard.
    - {"type": "copySelection"} — Copy the currently selected text on the page.
    - {"type": "pasteText", "selector": "input#field"} — Paste clipboard content into a field.

─── SCROLLING STRATEGY ───
13. FULL-PAGE SCAN — When the task involves comparing, ranking, or finding superlatives (cheapest, most expensive, best rated, lowest price, highest, newest, oldest, closest, etc.), you MUST scroll through the ENTIRE page before choosing. Do NOT pick from only the first few visible items. Track candidates in your "thought" as you scroll, e.g. "Best so far: Item X at $45 (row 3). Scrolling to check remaining items..." Only after reaching the bottom (or seeing all items) should you scroll back to the best candidate and click it.
14. TARGETED SCAN — When looking for a specific known item (e.g. "find the login button", "click on Sony WH-1000XM5"), scroll until you find it with high confidence (~90% match). You can stop scrolling as soon as the target is clearly visible.
15. Scroll in generous amounts (500-800px) to cover the page efficiently. After each scroll, analyze what's newly visible and update your candidate tracking in "thought".
16. If you scrolled the entire page and need to go back to a candidate seen earlier, scroll back up or use the browser's scroll to a position. Do NOT just pick whatever is visible at the end.
17. SCROLL MEMORY — Your "thought" field persists across all actions in a step via scroll_memory. Use it as a notepad: record item names, prices, positions, and your current best pick. When you reach the bottom, review your scroll_memory to identify the winner, then scroll back up to find and click it. Example thought progression:
    - Action 1: "I see items A ($50), B ($35), C ($42). Best so far: B at $35. Scrolling down for more..."
    - Action 2: "New items: D ($60), E ($28), F ($33). Best so far: E at $28. Scrolling down..."
    - Action 3: "Reached bottom. No more items. Best overall: E at $28 from earlier. Scrolling back up to find it."
    - Action 4: "I can see item E at $28. Clicking to open in new tab."

─── JSON RESPONSE SCHEMA ───
When performing an action:
{
    "thought": "Brief analysis of what I see and my reasoning",
    "action": {
        "type": "click | type | scroll | navigate | back | forward | press | wait | none",
        ...params
    },
    "status": "executing | needs_confirmation | waiting_for_user | plan_complete | error",
    "message": "Status message for the user"
}

When the step/goal is FULLY COMPLETE (all actions done, page shows expected result):
{
    "done": true,
    "message": "Description of what was accomplished"
}

─── ACTION TYPES ───
CLICK — Click at viewport coordinates. Viewport is the visible page area.
  {"type": "click", "x": 640, "y": 450}

TYPE — Type text into focused element or specified selector.
  {"type": "type", "text": "hello", "selector": "input#search"}

SCROLL — Scroll up or down by pixel amount.
  {"type": "scroll", "direction": "down", "amount": 500}

NAVIGATE NEW TAB — Open a URL in a new tab (preserves current tab).
  {"type": "navigateNewTab", "url": "https://trademe.co.nz"}

NAVIGATE — Go to a URL in current tab.
  {"type": "navigate", "url": "https://google.com"}

BACK — Go back to previous page.
  {"type": "back"}

FORWARD — Go forward.
  {"type": "forward"}

PRESS — Press a keyboard key with optional modifiers.
  {"type": "press", "key": "Enter"}
  {"type": "press", "key": "a", "modifiers": {"ctrl": true}}
  {"type": "press", "key": "c", "modifiers": {"ctrl": true, "shift": false}}

WAIT — Wait for page to load.
  {"type": "wait", "ms": 2000}

NONE — Current step goal is achieved. Move to next step.
  {"type": "none"}

─── EXTENDED ACTIONS (also available) ───
ZOOM — {"type": "zoomIn"} / {"type": "zoomOut"} / {"type": "zoomReset"}
BOOKMARK — {"type": "addBookmark"} / {"type": "searchBookmarks", "query": "..."}
HISTORY — {"type": "searchHistory", "query": "..."} / {"type": "clearRecentHistory", "hours": 1}
DOWNLOAD — {"type": "startDownload", "url": "https://..."} / {"type": "searchDownloads"}
WINDOW — {"type": "maximizeWindow"} / {"type": "minimizeWindow"} / {"type": "fullscreenWindow"} / {"type": "newWindow"} / {"type": "closeWindow"} / {"type": "listWindows"} / {"type": "focusWindow", "windowId": 123}
TAB GROUP — {"type": "groupTabs", "title": "Research", "color": "blue"} / {"type": "ungroupTab"}
TAB MGMT — {"type": "closeOtherTabs"} / {"type": "closeTabsToRight"} / {"type": "reopenClosedTab"} / {"type": "sortTabs"} / {"type": "discardTab"}
PRINT — {"type": "printPage"}
CLEAR DATA — {"type": "clearBrowsingData", "dataTypes": ["cache","cookies","history"], "hours": 1}
NOTIFY — {"type": "createNotification", "title": "...", "message": "..."}
FOCUS — {"type": "focus", "selector": "input#email"}
SELECT ALL — {"type": "selectAll"}
WAIT FOR — {"type": "waitForSelector", "selector": ".results", "timeout": 5000}
HOVER — {"type": "hover", "selector": ".menu-item"} / {"type": "hover", "x": 100, "y": 200}
DOUBLE CLICK — {"type": "doubleClick", "selector": ".item"} / {"type": "doubleClick", "x": 100, "y": 200}
RIGHT CLICK — {"type": "rightClick", "selector": ".item"} / {"type": "rightClick", "x": 100, "y": 200}
CHECKBOX — {"type": "toggleCheckbox", "selector": "#agree"}
SELECT OPTION — {"type": "selectOption", "selector": "select#country", "value": "US"}
FORM — {"type": "submitForm", "selector": "form#login"}
CLEAR — {"type": "clearInput", "selector": "input#search"}
TABLE — {"type": "extractTable", "selector": "table.results"}
COUNT — {"type": "countElements", "selector": ".search-result"}
SCROLL INTO VIEW — {"type": "scrollIntoView", "selector": "#section2"}
ELEMENT INFO — {"type": "getElementInfo", "selector": ".header"}
CLIPBOARD — {"type": "copyText", "text": "text to copy"} / {"type": "copySelection"} / {"type": "pasteText", "selector": "input#field"}
CLOSE POPUPS — {"type": "closePopups"} — Dismiss all visible popups, modals, overlays, notification banners, cookie consent, and newsletter prompts on the current page.
SIGN IN WITH GOOGLE — {"type": "signInWithGoogle", "accountIndex": 0} — Click the Google account picker or "Sign in with Google" button. accountIndex 0 = first account, 1 = second, etc.

─── POPUPS & MODALS ───
26. When you see popups, notification permission prompts ("Allow/Don't allow"), cookie banners, newsletter overlays, promotional modals, or "Sign in with Google" account pickers ON TOP of the page content — use {"type": "closePopups"} to dismiss them all at once, UNLESS the user specifically wants to interact with one (e.g. "sign in with Google" → use signInWithGoogle instead).
27. GOOGLE ACCOUNT PICKER — When a "Sign in to [site] with google.com" overlay appears showing multiple Google accounts, and the user says "sign in with Google" or "use the first/second Gmail account" or "login with Gmail":
    - Use {"type": "signInWithGoogle", "accountIndex": 0} for the first account (default).
    - Use {"type": "signInWithGoogle", "accountIndex": 1} for the second, etc.
    - If the user says "first" or doesn't specify → accountIndex: 0.
    - If the user says "second" → accountIndex: 1.
28. If you see BOTH unwanted popups AND a Google sign-in picker, handle them separately: close the spam popups first, then interact with the sign-in picker if requested.`;

// ── Message Types ───────────────────────────────────────────────
export const MSG_TYPES = {
  // Side panel → Service worker
  CHAT_MESSAGE:       'chat_message',
  CREATE_PLAN:        'create_plan',
  EXECUTE_STEP:       'execute_step',
  EXECUTE_ALL:        'execute_all',
  CANCEL_PLAN:        'cancel_plan',
  CONFIRM_ACTION:     'confirm_action',
  GET_SETTINGS:       'get_settings',
  SAVE_SETTINGS:      'save_settings',
  GET_STATUS:         'get_status',

  // Service worker → Side panel
  CHAT_RESPONSE:      'chat_response',
  STREAM_CHUNK:       'stream_chunk',
  STREAM_END:         'stream_end',
  PLAN_CREATED:       'plan_created',
  PLAN_UPDATE:        'plan_update',
  PLAN_COMPLETE:      'plan_complete',
  STEP_RESULT:        'step_result',
  STATUS_UPDATE:      'status_update',
  NEED_CONFIRMATION:  'need_confirmation',
  ERROR:              'error',
  TTS_SPEAK:          'tts_speak',
  TTS_STOP:           'tts_stop',

  // Screenshots & media
  SCREENSHOT_TAKEN:   'screenshot_taken',

  // CAPTCHA & obstacles
  CAPTCHA_DETECTED:   'captcha_detected',

  // Session memory
  SESSION_MEMORY:     'session_memory',

  // Saved routines
  SAVE_ROUTINE:       'save_routine',
  LOAD_ROUTINE:       'load_routine',
  DELETE_ROUTINE:     'delete_routine',
  LIST_ROUTINES:      'list_routines',
  ROUTINES_LIST:      'routines_list',

  // Service worker → Content script
  PAGE_ACTION:        'page_action',
  PAGE_READ:          'page_read',
  PAGE_SCROLL:        'page_scroll',

  // Content script → Service worker
  PAGE_RESULT:        'page_result',
  PAGE_CONTENT:       'page_content',

  // POE model management
  FETCH_POE_MODELS:   'fetch_poe_models',
  POE_MODELS_RESULT:  'poe_models_result',
};
