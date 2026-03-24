/* ═══════════════════════════════════════════════════════════════════
   Aria — Content Script: Page Controller
   DOM interaction: click, type, scroll, highlight
   Runs in the context of every web page.
   ═══════════════════════════════════════════════════════════════════ */

(() => {
  // Prevent double-injection
  if (window.__ariaPageController) return;
  window.__ariaPageController = true;

  // ── Message Handler ─────────────────────────────────────────

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'page_action') {
      handleAction(msg.action).then(sendResponse).catch(e => {
        sendResponse({ success: false, message: e.message });
      });
      return true; // async response
    }
  });

  // ── Action Dispatcher ───────────────────────────────────────

  async function handleAction(action) {
    if (!action || !action.type) return { success: false, message: 'No action' };

    switch (action.type) {
      case 'click':
        return doClick(action.x, action.y);

      case 'clickSelector':
        return doClickSelector(action.selector);

      case 'type':
        return doType(action.text, action.selector);

      case 'scroll':
        return doScroll(action.direction || 'down', action.amount || 500);

      case 'scrollSlowly':
        return doScrollSlowly(action.direction || 'down');

      case 'scrollTo':
        return doScrollTo(action.position || 'top');

      case 'press':
        return doPress(action.key, action.modifiers);

      case 'highlight':
        return doHighlight(action.selector);

      case 'findText':
        return doFindText(action.text);

      case 'selectAll':
        return doSelectAll(action.selector);

      case 'focus':
        return doFocus(action.selector);

      case 'getValue':
        return doGetValue(action.selector);

      case 'setAttribute':
        return doSetAttribute(action.selector, action.attr, action.value);

      case 'waitForSelector':
        return await doWaitForSelector(action.selector, action.timeout);

      case 'hover':
        return doHover(action.selector, action.x, action.y);

      case 'doubleClick':
        return doDoubleClick(action.selector, action.x, action.y);

      case 'rightClick':
        return doRightClick(action.selector, action.x, action.y);

      case 'toggleCheckbox':
        return doToggleCheckbox(action.selector);

      case 'selectOption':
        return doSelectOption(action.selector, action.value);

      case 'submitForm':
        return doSubmitForm(action.selector);

      case 'clearInput':
        return doClearInput(action.selector);

      case 'scrollIntoView':
        return doScrollIntoView(action.selector);

      case 'getElementInfo':
        return doGetElementInfo(action.selector);

      case 'extractTable':
        return doExtractTable(action.selector);

      case 'countElements':
        return doCountElements(action.selector);

      // Clipboard
      case 'copyText':
        return doCopyText(action.text);

      case 'copySelection':
        return doCopySelection();

      case 'pasteText':
        return doPasteText(action.selector);

      // Detection
      case 'detectCaptcha':
        return doDetectCaptcha();

      case 'detectPageState':
        return doDetectPageState();

      // Popup & modal management
      case 'closePopups':
        return doClosePopups();

      // Google sign-in account picker
      case 'signInWithGoogle':
        return doSignInWithGoogle(action.accountIndex);

      default:
        return { success: false, message: `Unknown page action: ${action.type}` };
    }
  }

  // ── Click ───────────────────────────────────────────────────

  function doClick(x, y) {
    // Show visual marker
    showClickMarker(x, y);

    const el = document.elementFromPoint(x, y);
    if (el) {
      // Simulate real click events
      const events = ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'];
      for (const eventType of events) {
        el.dispatchEvent(new MouseEvent(eventType, {
          bubbles: true, cancelable: true, view: window,
          clientX: x, clientY: y, button: 0,
        }));
      }
      const label = el.textContent?.trim().substring(0, 30) || el.getAttribute('aria-label') || el.tagName.toLowerCase();
      return { success: true, message: `Clicked ${label}` };
    }
    return { success: false, message: 'Click missed — no element found' };
  }

  function doClickSelector(selector) {
    // Try querySelector, handling invalid selectors gracefully
    let el;
    try {
      el = document.querySelector(selector);
    } catch {
      // Selector may contain invalid pseudo-classes like :contains()
      // Try each comma-separated part individually
      if (selector.includes(',')) {
        for (const part of selector.split(',')) {
          try { el = document.querySelector(part.trim()); } catch { /* skip invalid */ }
          if (el) break;
        }
      }
    }

    if (el) {
      showClickMarkerOnElement(el);
      el.click();
      const label = el.textContent?.trim().substring(0, 30) || el.getAttribute('aria-label') || el.getAttribute('placeholder') || el.tagName.toLowerCase();
      return { success: true, message: `Clicked ${label}` };
    }

    // Try finding by text content
    const byText = findElementByText(selector);
    if (byText) {
      showClickMarkerOnElement(byText);
      byText.click();
      const label = byText.textContent?.trim().substring(0, 30) || byText.getAttribute('aria-label') || 'element';
      return { success: true, message: `Clicked ${label}` };
    }

    return { success: false, message: 'Element not found' };
  }

  // ── Type (Robust — multiple strategies) ─────────────────────

  function doType(text, selector) {
    let el;

    if (selector) {
      el = document.querySelector(selector);
      if (!el) {
        // Try finding by text/label
        el = findInputByLabel(selector);
      }
    }

    if (!el) {
      // Use focused element
      el = document.activeElement;
    }

    if (!el || el === document.body) {
      return { success: false, message: 'No element to type into' };
    }

    // Focus the element
    el.focus();

    const tag = el.tagName.toLowerCase();
    const isContentEditable = el.isContentEditable || el.getAttribute('contenteditable') === 'true';

    if (isContentEditable) {
      // ContentEditable div (like chat inputs)
      el.innerHTML = '';
      el.textContent = text;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    } else if (tag === 'input' || tag === 'textarea') {
      // Standard input — aggressively clear pre-populated / autocomplete values

      // Step 1: Select all existing text via Ctrl+A, then delete it (triggers framework listeners naturally)
      el.select?.();
      el.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', code: 'KeyA', ctrlKey: true, bubbles: true }));
      el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', code: 'Backspace', keyCode: 8, bubbles: true }));
      el.dispatchEvent(new KeyboardEvent('keyup', { key: 'Backspace', code: 'Backspace', keyCode: 8, bubbles: true }));

      // Step 2: Force-clear via native setter (handles React/Vue controlled inputs)
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        tag === 'textarea' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
        'value'
      )?.set;

      if (nativeInputValueSetter) {
        nativeInputValueSetter.call(el, '');
      } else {
        el.value = '';
      }
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));

      // Step 3: Set the desired text
      if (nativeInputValueSetter) {
        nativeInputValueSetter.call(el, text);
      } else {
        el.value = text;
      }
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));

      // Step 4: Dismiss any autocomplete dropdown so it doesn't overwrite on Enter
      el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true }));
      el.dispatchEvent(new KeyboardEvent('keyup', { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true }));
      // Also try to close native autocomplete
      el.setAttribute('autocomplete', 'off');
    } else {
      // Unknown element — try textContent
      el.textContent = text;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }

    const label = el.getAttribute('placeholder') || el.getAttribute('aria-label') || el.getAttribute('name') || tag;
    return { success: true, message: `Typed "${text.substring(0, 30)}" into ${label}` };
  }

  // ── Scroll ──────────────────────────────────────────────────

  function doScroll(direction, amount) {
    const y = direction === 'up' ? -amount : amount;
    window.scrollBy({ top: y, behavior: 'smooth' });
    return { success: true, message: `Scrolled ${direction}` };
  }

  function doScrollSlowly(direction) {
    const amount = direction === 'up' ? -2 : 2;
    let scrolled = 0;
    const target = 800;

    const interval = setInterval(() => {
      window.scrollBy(0, amount);
      scrolled += Math.abs(amount);
      if (scrolled >= target) clearInterval(interval);
    }, 16); // ~60fps

    return { success: true, message: `Scrolling slowly ${direction}` };
  }

  function doScrollTo(position) {
    if (position === 'top') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (position === 'bottom') {
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    }
    return { success: true, message: `Scrolled to ${position}` };
  }

  // ── Key Press ───────────────────────────────────────────────

  function doPress(key, modifiers) {
    const el = document.activeElement || document.body;
    const mods = modifiers || {};
    const keyMap = {
      'Enter': { key: 'Enter', code: 'Enter', keyCode: 13 },
      'Tab': { key: 'Tab', code: 'Tab', keyCode: 9 },
      'Escape': { key: 'Escape', code: 'Escape', keyCode: 27 },
      'Backspace': { key: 'Backspace', code: 'Backspace', keyCode: 8 },
      'Delete': { key: 'Delete', code: 'Delete', keyCode: 46 },
      'Space': { key: ' ', code: 'Space', keyCode: 32 },
      'ArrowDown': { key: 'ArrowDown', code: 'ArrowDown', keyCode: 40 },
      'ArrowUp': { key: 'ArrowUp', code: 'ArrowUp', keyCode: 38 },
      'ArrowLeft': { key: 'ArrowLeft', code: 'ArrowLeft', keyCode: 37 },
      'ArrowRight': { key: 'ArrowRight', code: 'ArrowRight', keyCode: 39 },
      'Home': { key: 'Home', code: 'Home', keyCode: 36 },
      'End': { key: 'End', code: 'End', keyCode: 35 },
      'PageUp': { key: 'PageUp', code: 'PageUp', keyCode: 33 },
      'PageDown': { key: 'PageDown', code: 'PageDown', keyCode: 34 },
    };

    // Handle single character keys (a-z, 0-9)
    let mapped = keyMap[key];
    if (!mapped) {
      const upper = key.length === 1 ? key.toUpperCase() : key;
      mapped = { key: key.length === 1 ? key : upper, code: key.length === 1 ? `Key${upper}` : key, keyCode: key.length === 1 ? upper.charCodeAt(0) : 0 };
    }

    const eventInit = {
      key: mapped.key, code: mapped.code, keyCode: mapped.keyCode,
      which: mapped.keyCode, bubbles: true, cancelable: true,
      ctrlKey: !!mods.ctrl, shiftKey: !!mods.shift,
      altKey: !!mods.alt, metaKey: !!mods.meta,
    };

    el.dispatchEvent(new KeyboardEvent('keydown', eventInit));
    el.dispatchEvent(new KeyboardEvent('keypress', eventInit));
    el.dispatchEvent(new KeyboardEvent('keyup', eventInit));

    const modStr = [mods.ctrl && 'Ctrl', mods.shift && 'Shift', mods.alt && 'Alt', mods.meta && 'Meta'].filter(Boolean).join('+');
    return { success: true, message: `Pressed ${modStr ? modStr + '+' : ''}${key}` };
  }

  // ── Select All ──────────────────────────────────────────────

  function doSelectAll(selector) {
    const el = selector ? document.querySelector(selector) : document.activeElement;
    if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) {
      el.select();
      return { success: true, message: 'Selected all text in input' };
    }
    document.execCommand('selectAll');
    return { success: true, message: 'Selected all' };
  }

  // ── Focus ───────────────────────────────────────────────────

  function doFocus(selector) {
    const el = selector ? document.querySelector(selector) : null;
    if (!el) {
      const input = findInputByLabel(selector);
      if (input) { input.focus(); return { success: true, message: `Focused: ${selector}` }; }
      return { success: false, message: `Element not found: ${selector}` };
    }
    el.focus();
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return { success: true, message: `Focused: ${selector}` };
  }

  // ── Get Value ───────────────────────────────────────────────

  function doGetValue(selector) {
    const el = selector ? document.querySelector(selector) : document.activeElement;
    if (!el) return { success: false, message: 'Element not found' };
    const val = el.value !== undefined ? el.value : el.textContent;
    return { success: true, value: (val || '').substring(0, 1000), message: `Value: ${(val || '').substring(0, 100)}` };
  }

  // ── Set Attribute ───────────────────────────────────────────

  function doSetAttribute(selector, attr, value) {
    if (!selector || !attr) return { success: false, message: 'Selector and attribute required' };
    const el = document.querySelector(selector);
    if (!el) return { success: false, message: `Element not found: ${selector}` };
    el.setAttribute(attr, value);
    return { success: true, message: `Set ${attr}="${value}" on ${selector}` };
  }

  // ── Wait for Selector ──────────────────────────────────────

  function doWaitForSelector(selector, timeout = 5000) {
    return new Promise(resolve => {
      const el = document.querySelector(selector);
      if (el) return resolve({ success: true, message: `Found: ${selector}` });

      const observer = new MutationObserver(() => {
        if (document.querySelector(selector)) {
          observer.disconnect();
          clearTimeout(timer);
          resolve({ success: true, message: `Found: ${selector}` });
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });

      const timer = setTimeout(() => {
        observer.disconnect();
        resolve({ success: false, message: `Timeout waiting for: ${selector}` });
      }, timeout);
    });
  }

  // ── Hover ───────────────────────────────────────────────────

  function doHover(selector, x, y) {
    let el;
    if (selector) {
      el = document.querySelector(selector) || findElementByText(selector);
    } else if (x !== undefined && y !== undefined) {
      el = document.elementFromPoint(x, y);
    }
    if (!el) return { success: false, message: `Element not found: ${selector || `(${x},${y})`}` };

    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const opts = { bubbles: true, cancelable: true, view: window, clientX: cx, clientY: cy };
    el.dispatchEvent(new MouseEvent('mouseenter', opts));
    el.dispatchEvent(new MouseEvent('mouseover', opts));
    el.dispatchEvent(new MouseEvent('mousemove', opts));
    return { success: true, message: `Hovered over <${el.tagName.toLowerCase()}>` };
  }

  // ── Double Click ────────────────────────────────────────────

  function doDoubleClick(selector, x, y) {
    let el;
    if (selector) {
      el = document.querySelector(selector) || findElementByText(selector);
    } else if (x !== undefined && y !== undefined) {
      el = document.elementFromPoint(x, y);
      showClickMarker(x, y);
    }
    if (!el) return { success: false, message: `Element not found: ${selector || `(${x},${y})`}` };

    showClickMarkerOnElement(el);
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const opts = { bubbles: true, cancelable: true, view: window, clientX: cx, clientY: cy, detail: 2, button: 0 };
    el.dispatchEvent(new MouseEvent('dblclick', opts));
    return { success: true, message: `Double-clicked <${el.tagName.toLowerCase()}>` };
  }

  // ── Right Click ─────────────────────────────────────────────

  function doRightClick(selector, x, y) {
    let el;
    if (selector) {
      el = document.querySelector(selector) || findElementByText(selector);
    } else if (x !== undefined && y !== undefined) {
      el = document.elementFromPoint(x, y);
      showClickMarker(x, y);
    }
    if (!el) return { success: false, message: `Element not found: ${selector || `(${x},${y})`}` };

    showClickMarkerOnElement(el);
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const opts = { bubbles: true, cancelable: true, view: window, clientX: cx, clientY: cy, button: 2 };
    el.dispatchEvent(new MouseEvent('contextmenu', opts));
    return { success: true, message: `Right-clicked <${el.tagName.toLowerCase()}>` };
  }

  // ── Toggle Checkbox ─────────────────────────────────────────

  function doToggleCheckbox(selector) {
    const el = selector ? (document.querySelector(selector) || findInputByLabel(selector)) : null;
    if (!el) return { success: false, message: `Checkbox not found: ${selector}` };
    if (el.type !== 'checkbox' && el.type !== 'radio') {
      // Try finding a checkbox inside the element
      const inner = el.querySelector('input[type="checkbox"], input[type="radio"]');
      if (inner) {
        inner.click();
        return { success: true, message: `Toggled ${inner.type}: now ${inner.checked ? 'checked' : 'unchecked'}` };
      }
      return { success: false, message: 'Element is not a checkbox' };
    }
    el.click();
    return { success: true, message: `Toggled ${el.type}: now ${el.checked ? 'checked' : 'unchecked'}` };
  }

  // ── Select Option ───────────────────────────────────────────

  function doSelectOption(selector, value) {
    const el = selector ? (document.querySelector(selector) || findInputByLabel(selector)) : null;
    if (!el || el.tagName.toLowerCase() !== 'select') {
      return { success: false, message: `Select element not found: ${selector}` };
    }
    // Try matching by value first, then by visible text
    let found = false;
    for (const opt of el.options) {
      if (opt.value === value || opt.textContent.trim().toLowerCase() === (value || '').toLowerCase()) {
        el.value = opt.value;
        found = true;
        break;
      }
    }
    if (!found) return { success: false, message: `Option "${value}" not found in <select>` };
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return { success: true, message: `Selected "${value}" in ${selector}` };
  }

  // ── Submit Form ─────────────────────────────────────────────

  function doSubmitForm(selector) {
    let form;
    if (selector) {
      form = document.querySelector(selector);
      if (form && form.tagName.toLowerCase() !== 'form') {
        form = form.closest('form');
      }
    }
    if (!form) {
      // Find the first visible form, or the form containing the focused element
      form = document.activeElement?.closest('form') || document.querySelector('form');
    }
    if (!form) return { success: false, message: 'No form found' };

    // Try submit button first, then form.submit()
    const submitBtn = form.querySelector('button[type="submit"], input[type="submit"]');
    if (submitBtn) {
      submitBtn.click();
    } else {
      form.requestSubmit();
    }
    return { success: true, message: 'Form submitted' };
  }

  // ── Clear Input ─────────────────────────────────────────────

  function doClearInput(selector) {
    const el = selector ? (document.querySelector(selector) || findInputByLabel(selector)) : document.activeElement;
    if (!el) return { success: false, message: 'No input found' };
    const tag = el.tagName.toLowerCase();
    if (tag === 'input' || tag === 'textarea') {
      const nativeSetter = Object.getOwnPropertyDescriptor(
        tag === 'textarea' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, 'value'
      )?.set;
      if (nativeSetter) {
        nativeSetter.call(el, '');
      } else {
        el.value = '';
      }
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return { success: true, message: `Cleared input: ${selector || el.name || el.id}` };
    }
    if (el.isContentEditable) {
      el.innerHTML = '';
      el.dispatchEvent(new Event('input', { bubbles: true }));
      return { success: true, message: 'Cleared content-editable' };
    }
    return { success: false, message: 'Element is not an input' };
  }

  // ── Scroll Into View ───────────────────────────────────────

  function doScrollIntoView(selector) {
    const el = selector ? document.querySelector(selector) : null;
    if (!el) return { success: false, message: `Element not found: ${selector}` };
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    showClickMarkerOnElement(el);
    return { success: true, message: `Scrolled to ${selector}` };
  }

  // ── Get Element Info ────────────────────────────────────────

  function doGetElementInfo(selector) {
    const el = selector ? document.querySelector(selector) : document.activeElement;
    if (!el) return { success: false, message: 'Element not found' };
    const rect = el.getBoundingClientRect();
    const computed = window.getComputedStyle(el);
    return {
      success: true,
      info: {
        tag: el.tagName.toLowerCase(),
        id: el.id || null,
        classes: [...el.classList],
        text: (el.textContent || '').substring(0, 200).trim(),
        value: el.value !== undefined ? el.value : null,
        href: el.href || null,
        src: el.src || null,
        visible: computed.display !== 'none' && computed.visibility !== 'hidden',
        rect: { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) },
        attributes: Object.fromEntries([...el.attributes].slice(0, 20).map(a => [a.name, a.value])),
      },
      message: `<${el.tagName.toLowerCase()}> ${el.id ? '#' + el.id : ''} (${Math.round(rect.width)}×${Math.round(rect.height)})`,
    };
  }

  // ── Extract Table ───────────────────────────────────────────

  function doExtractTable(selector) {
    const table = selector ? document.querySelector(selector) : document.querySelector('table');
    if (!table || table.tagName.toLowerCase() !== 'table') {
      return { success: false, message: 'No table found' };
    }
    const rows = [];
    const headers = [];
    const ths = table.querySelectorAll('thead th, thead td, tr:first-child th');
    ths.forEach(th => headers.push(th.textContent.trim()));

    const bodyRows = table.querySelectorAll('tbody tr, tr');
    for (const tr of bodyRows) {
      const cells = tr.querySelectorAll('td');
      if (!cells.length) continue;
      const row = {};
      cells.forEach((td, i) => {
        const key = headers[i] || `col${i + 1}`;
        row[key] = td.textContent.trim();
      });
      rows.push(row);
      if (rows.length >= 100) break; // limit
    }
    return { success: true, data: rows, rowCount: rows.length, headers, message: `Extracted ${rows.length} rows from table` };
  }

  // ── Count Elements ──────────────────────────────────────────

  function doCountElements(selector) {
    if (!selector) return { success: false, message: 'Selector required' };
    const count = document.querySelectorAll(selector).length;
    return { success: true, count, message: `Found ${count} elements matching: ${selector}` };
  }

  // ── Highlight / Find ────────────────────────────────────────

  function doHighlight(selector) {
    const el = document.querySelector(selector);
    if (!el) return { success: false, message: `Not found: ${selector}` };
    showClickMarkerOnElement(el);
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return { success: true, message: `Highlighted: ${selector}` };
  }

  function doFindText(text) {
    // Use TreeWalker to find text nodes containing the text
    const walker = document.createTreeWalker(
      document.body, NodeFilter.SHOW_TEXT, null
    );

    let node;
    while (node = walker.nextNode()) {
      if (node.textContent.toLowerCase().includes(text.toLowerCase())) {
        const parent = node.parentElement;
        if (parent) {
          showClickMarkerOnElement(parent);
          parent.scrollIntoView({ behavior: 'smooth', block: 'center' });
          return { success: true, message: `Found text: "${text}"` };
        }
      }
    }

    return { success: false, message: `Text not found: "${text}"` };
  }

  // ── Clipboard ────────────────────────────────────────────────

  async function doCopyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return { success: true, message: `Copied to clipboard: "${text.substring(0, 50)}..."` };
    } catch {
      // Fallback: execCommand
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;left:-9999px';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      return { success: true, message: `Copied to clipboard: "${text.substring(0, 50)}..."` };
    }
  }

  async function doCopySelection() {
    const sel = window.getSelection();
    const text = sel ? sel.toString() : '';
    if (!text) return { success: false, message: 'No text selected' };
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      document.execCommand('copy');
    }
    return { success: true, message: `Copied selection: "${text.substring(0, 50)}..."` };
  }

  async function doPasteText(selector) {
    let el = selector ? (document.querySelector(selector) || findInputByLabel(selector)) : document.activeElement;
    if (!el || el === document.body) return { success: false, message: 'No element to paste into' };
    el.focus();
    try {
      const text = await navigator.clipboard.readText();
      if (!text) return { success: false, message: 'Clipboard is empty' };
      // Use the same robust strategy as doType
      const tag = el.tagName.toLowerCase();
      if (el.isContentEditable) {
        document.execCommand('insertText', false, text);
      } else if (tag === 'input' || tag === 'textarea') {
        const setter = Object.getOwnPropertyDescriptor(
          tag === 'textarea' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, 'value'
        )?.set;
        if (setter) { setter.call(el, el.value + text); }
        else { el.value += text; }
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }
      return { success: true, message: `Pasted "${text.substring(0, 50)}..." into <${tag}>` };
    } catch {
      return { success: false, message: 'Clipboard read failed — permission denied' };
    }
  }

  // ── CAPTCHA Detection ───────────────────────────────────────

  function doDetectCaptcha() {
    const captchaSignals = [];

    // reCAPTCHA v2 (checkbox "I'm not a robot")
    if (document.querySelector('iframe[src*="recaptcha"]') ||
        document.querySelector('.g-recaptcha') ||
        document.querySelector('#recaptcha')) {
      captchaSignals.push('reCAPTCHA');
    }

    // reCAPTCHA v3 badge
    if (document.querySelector('.grecaptcha-badge')) {
      captchaSignals.push('reCAPTCHA-v3-badge');
    }

    // hCaptcha
    if (document.querySelector('iframe[src*="hcaptcha"]') ||
        document.querySelector('.h-captcha') ||
        document.querySelector('[data-hcaptcha-sitekey]')) {
      captchaSignals.push('hCaptcha');
    }

    // Cloudflare challenge / turnstile
    if (document.querySelector('iframe[src*="challenges.cloudflare"]') ||
        document.querySelector('.cf-turnstile') ||
        document.querySelector('#cf-challenge-running') ||
        document.querySelector('#challenge-running') ||
        document.title.includes('Just a moment')) {
      captchaSignals.push('Cloudflare-challenge');
    }

    // Generic "prove you're human" text
    const bodyText = (document.body?.textContent || '').substring(0, 3000).toLowerCase();
    const captchaPhrases = ['prove you are human', 'verify you are human', 'i\'m not a robot',
      'complete this captcha', 'security check', 'bot protection', 'challenge required'];
    for (const phrase of captchaPhrases) {
      if (bodyText.includes(phrase)) {
        captchaSignals.push('text-hint: ' + phrase);
        break;
      }
    }

    const hasCaptcha = captchaSignals.length > 0;
    return {
      success: true,
      hasCaptcha,
      signals: captchaSignals,
      message: hasCaptcha ? `CAPTCHA detected: ${captchaSignals.join(', ')}` : 'No CAPTCHA detected',
    };
  }

  // ── Page State Detection ────────────────────────────────────

  function doDetectPageState() {
    const state = {
      loading: false,
      hasSpinners: false,
      hasSkeletons: false,
      hasErrorPage: false,
      errorType: null,
      isBlank: false,
    };

    // Check for loading spinners
    const spinnerSelectors = [
      '[class*="spinner" i]', '[class*="loading" i]:not(html)',
      '[class*="loader" i]', '[role="progressbar"]',
      '[class*="skeleton" i]', '[class*="shimmer" i]',
      '[class*="placeholder" i][class*="anim" i]',
    ];
    for (const sel of spinnerSelectors) {
      const els = document.querySelectorAll(sel);
      for (const el of els) {
        const style = window.getComputedStyle(el);
        if (style.display !== 'none' && style.visibility !== 'hidden') {
          if (sel.includes('skeleton') || sel.includes('shimmer') || sel.includes('placeholder')) {
            state.hasSkeletons = true;
          } else {
            state.hasSpinners = true;
          }
          state.loading = true;
          break;
        }
      }
    }

    // Check for error pages
    const title = document.title.toLowerCase();
    const bodyText = (document.body?.textContent || '').substring(0, 2000).toLowerCase();
    const errorPatterns = [
      { pattern: /404|not found|page not found/i, type: '404' },
      { pattern: /403|forbidden|access denied/i, type: '403' },
      { pattern: /500|internal server error/i, type: '500' },
      { pattern: /502|bad gateway/i, type: '502' },
      { pattern: /503|service unavailable/i, type: '503' },
      { pattern: /this site can.t be reached|dns_probe|err_connection/i, type: 'dns_error' },
      { pattern: /too many requests|rate limit/i, type: 'rate_limited' },
    ];
    const textToCheck = title + ' ' + bodyText;
    for (const { pattern, type } of errorPatterns) {
      if (pattern.test(textToCheck)) {
        state.hasErrorPage = true;
        state.errorType = type;
        break;
      }
    }

    // Blank page
    if ((document.body?.textContent || '').trim().length < 50) {
      state.isBlank = true;
    }

    return {
      success: true,
      ...state,
      message: state.hasErrorPage ? `Error page: ${state.errorType}` :
               state.loading ? 'Page still loading...' :
               state.isBlank ? 'Page appears blank' : 'Page loaded normally',
    };
  }

  // ── Cookie Consent Auto-Handler ─────────────────────────────

  (async function initCookieConsentHandler() {
    let enabled = true;
    try {
      const result = await chrome.storage.local.get('autoHandleCookieConsent');
      if (result.autoHandleCookieConsent === false) enabled = false;
    } catch { /* default to enabled */ }

    if (!enabled) return;

    const CONSENT_ACCEPT_SELECTORS = [
      // Common CMP (Consent Management Platform) buttons
      '[class*="cookie" i] button[class*="accept" i]',
      '[class*="cookie" i] button[class*="agree" i]',
      '[class*="cookie" i] button[class*="allow" i]',
      '[class*="cookie" i] button[class*="got-it" i]',
      '[class*="cookie" i] button[class*="ok" i]',
      '[id*="cookie" i] button[class*="accept" i]',
      '[id*="cookie" i] button[class*="agree" i]',
      '[class*="consent" i] button[class*="accept" i]',
      '[class*="consent" i] button[class*="agree" i]',
      '[class*="consent" i] button[class*="allow" i]',
      '[id*="consent" i] button[class*="accept" i]',
      '[class*="gdpr" i] button[class*="accept" i]',
      '[class*="gdpr" i] button[class*="agree" i]',
      '[class*="ccpa" i] button[class*="accept" i]',
      // CMP vendor-specific
      '#onetrust-accept-btn-handler',
      '#accept-all-cookies',
      '.cc-accept', '.cc-allow', '.cc-btn.cc-dismiss',
      '[data-action="accept-cookies"]',
      '[data-cookiefirst-action="accept"]',
      '[data-testid*="cookie-accept" i]',
      '[data-testid*="accept-cookie" i]',
      '#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll',
      '#didomi-notice-agree-button',
      '.evidon-banner-acceptbutton',
      '#truste-consent-button',
      '#cookies-eu-accept',
      '.js-cookie-consent-agree',
      // Generic accept/OK/got it buttons inside cookie containers
      '[class*="cookie" i] [class*="close" i]',
      '[class*="cookie" i] [class*="dismiss" i]',
    ];

    // Text patterns for "accept cookies" buttons
    const ACCEPT_TEXT_PATTERNS = /^(accept(\s+all)?|agree|allow(\s+all)?|got it|ok|i understand|i agree|allow cookies|accept cookies|accept & close|accept and close|continue|that'?s? ok|yes,? i agree)$/i;

    function dismissCookieBanner() {
      // Strategy 1: Click a known accept button
      for (const sel of CONSENT_ACCEPT_SELECTORS) {
        const btn = document.querySelector(sel);
        if (btn && btn.offsetParent !== null) {
          btn.click();
          return true;
        }
      }

      // Strategy 2: Find buttons inside cookie/consent containers by text content
      const containers = document.querySelectorAll(
        '[class*="cookie" i], [class*="consent" i], [class*="gdpr" i], [class*="ccpa" i], [id*="cookie" i], [id*="consent" i]'
      );
      for (const container of containers) {
        const style = window.getComputedStyle(container);
        if (style.display === 'none' || style.visibility === 'hidden') continue;
        const buttons = container.querySelectorAll('button, a[role="button"], [class*="btn" i]');
        for (const btn of buttons) {
          const text = (btn.textContent || '').trim();
          if (ACCEPT_TEXT_PATTERNS.test(text)) {
            btn.click();
            return true;
          }
        }
      }

      return false;
    }

    // Run after delays (banners often lazy-load)
    setTimeout(dismissCookieBanner, 1500);
    setTimeout(dismissCookieBanner, 3500);
    setTimeout(dismissCookieBanner, 7000);

    // Watch for dynamically injected cookie banners
    const cookieObserver = new MutationObserver(() => {
      setTimeout(dismissCookieBanner, 500);
    });
    cookieObserver.observe(document.body, { childList: true, subtree: true });

    // Stop watching after 30 seconds (banner should be handled by then)
    setTimeout(() => cookieObserver.disconnect(), 30000);
  })();

  // ── Helpers ─────────────────────────────────────────────────

  // Synonym groups — if the search text matches any word in a group, all words in that group are tried
  const SYNONYM_GROUPS = [
    ['sign up', 'register', 'create account', 'join', 'get started', 'start free trial', 'try for free', 'try it free', 'start here', 'begin'],
    ['log in', 'sign in', 'access account', 'my account'],
    ['buy', 'purchase', 'add to cart', 'add to bag', 'buy now', 'order now', 'shop now', 'subscribe'],
    ['submit', 'send', 'continue', 'next', 'done', 'finish', 'complete', 'confirm'],
    ['learn more', 'read more', 'see details', 'view', 'explore', 'discover'],
    ['download', 'get the app', 'install'],
  ];

  function findElementByText(text) {
    const clean = text.toLowerCase().trim();
    const all = document.querySelectorAll('button, a, [role="button"], input[type="submit"], input[type="button"]');

    // Direct match first
    for (const el of all) {
      const elText = (el.textContent || el.value || el.getAttribute('aria-label') || '').toLowerCase().trim();
      if (elText.includes(clean) || clean.includes(elText)) return el;
    }

    // Synonym fallback — find which group(s) the search text belongs to, then try all synonyms
    const synonyms = [];
    for (const group of SYNONYM_GROUPS) {
      if (group.some(s => clean.includes(s) || s.includes(clean))) {
        for (const s of group) if (s !== clean) synonyms.push(s);
      }
    }
    for (const syn of synonyms) {
      for (const el of all) {
        const elText = (el.textContent || el.value || el.getAttribute('aria-label') || '').toLowerCase().trim();
        if (elText.includes(syn) || syn.includes(elText)) return el;
      }
    }

    return null;
  }

  function findInputByLabel(labelText) {
    const clean = labelText.toLowerCase().trim();
    // Try by label element
    const labels = document.querySelectorAll('label');
    for (const label of labels) {
      if (label.textContent.toLowerCase().includes(clean)) {
        const input = label.querySelector('input, textarea, select') ||
                      document.getElementById(label.htmlFor);
        if (input) return input;
      }
    }
    // Try by placeholder
    const inputs = document.querySelectorAll('input, textarea');
    for (const input of inputs) {
      if ((input.placeholder || '').toLowerCase().includes(clean)) return input;
      if ((input.getAttribute('aria-label') || '').toLowerCase().includes(clean)) return input;
    }
    return null;
  }

  // ── Close Popups / Modals (on-demand) ────────────────────────

  function doClosePopups() {
    let closed = 0;

    // 1. Try all visible modals/overlays/popups with close buttons
    const overlaySelectors = [
      '[class*="popup" i]', '[class*="overlay" i]', '[class*="modal" i]',
      '[class*="dialog" i]', '[class*="interstitial" i]', '[class*="banner" i]',
      '[class*="cookie" i]', '[class*="consent" i]', '[class*="newsletter" i]',
      '[class*="subscribe" i]', '[class*="notification" i][class*="perm" i]',
      '[role="dialog"]', '[role="alertdialog"]',
    ];

    const closeButtonSelectors = [
      'button[class*="close" i]', '[aria-label*="close" i]', '[aria-label*="dismiss" i]',
      'button[class*="dismiss" i]', '.close', '[data-dismiss]', '[data-close]',
      'button[class*="reject" i]', 'button[class*="deny" i]',
      'button[class*="decline" i]', 'button[class*="no-thanks" i]',
    ];

    // Find and close visible overlays
    for (const sel of overlaySelectors) {
      for (const el of document.querySelectorAll(sel)) {
        if (el.offsetParent === null && !window.getComputedStyle(el).position.match(/fixed|absolute/)) continue;
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity) === 0) continue;

        // Try close button within
        let didClose = false;
        for (const closeSel of closeButtonSelectors) {
          const btn = el.querySelector(closeSel);
          if (btn && btn.offsetParent !== null) { btn.click(); didClose = true; closed++; break; }
        }
        if (didClose) continue;

        // Try X / × buttons
        for (const btn of el.querySelectorAll('button, [role="button"]')) {
          const text = (btn.textContent || '').trim();
          const aria = (btn.getAttribute('aria-label') || '').toLowerCase();
          if (text === '×' || text === 'X' || text === '✕' || text === '✖' || text === 'x' ||
              aria.includes('close') || aria.includes('dismiss')) {
            btn.click(); closed++; didClose = true; break;
          }
        }
        if (didClose) continue;

        // Try "Don't allow" / "No thanks" / "Not now" text buttons
        for (const btn of el.querySelectorAll('button, a[role="button"], a[class*="btn" i]')) {
          const text = (btn.textContent || '').trim().toLowerCase();
          if (/^(don'?t allow|no thanks|not now|maybe later|skip|cancel|deny|reject|decline|close|dismiss)$/i.test(text)) {
            btn.click(); closed++; didClose = true; break;
          }
        }
      }
    }

    // 2. Also try standalone close buttons at page level
    if (closed === 0) {
      for (const closeSel of closeButtonSelectors) {
        for (const btn of document.querySelectorAll(closeSel)) {
          if (btn.offsetParent === null) continue;
          const style = window.getComputedStyle(btn);
          const z = parseInt(style.zIndex) || 0;
          if (z >= 100 || style.position === 'fixed' || style.position === 'absolute') {
            btn.click(); closed++;
          }
        }
      }
    }

    if (closed > 0) {
      return { success: true, message: `Closed ${closed} popup${closed > 1 ? 's' : ''}` };
    }
    return { success: true, message: 'No popups found to close' };
  }

  // ── Google Sign-In Account Picker ───────────────────────────

  function doSignInWithGoogle(accountIndex = 0) {
    // Google's "Sign in with Google" popup uses an iframe or a new modal
    // The account picker shows email addresses as clickable divs/buttons

    // 1. Look for Google One Tap / account chooser in iframes
    const iframes = document.querySelectorAll('iframe[src*="accounts.google.com"], iframe[src*="gsi"]');
    for (const iframe of iframes) {
      try {
        // Can't access cross-origin iframe content, but we can click it
        // Google One Tap is usually a single-click iframe
        if (iframe.offsetParent !== null) {
          iframe.click();
          return { success: true, message: 'Clicked Google sign-in prompt' };
        }
      } catch { /* cross-origin, expected */ }
    }

    // 2. Look for the Google account chooser overlay/modal
    // These typically show up as divs with emails as click targets
    const accountSelectors = [
      // Google's account chooser (accounts.google.com embedded)
      '[data-email]',
      '[data-identifier]',
      'div[data-authuser]',
      // Generic Google sign-in buttons
      'div[class*="google" i] li', 'div[class*="google" i] a',
      'ul[class*="account" i] li',
      // Account picker list items
      '#profileIdentifier', '.account-name', '.profile-name',
    ];

    for (const sel of accountSelectors) {
      const accounts = document.querySelectorAll(sel);
      if (accounts.length > 0) {
        const idx = Math.min(accountIndex, accounts.length - 1);
        const target = accounts[idx];
        target.click();
        const email = target.getAttribute('data-email') || target.textContent?.trim().substring(0, 40) || '';
        return { success: true, message: `Selected account${email ? ': ' + email : ''} (#${idx + 1})` };
      }
    }

    // 3. Look for "Sign in with Google" / "Continue with Google" buttons
    const googleBtnSelectors = [
      'button[class*="google" i]', 'a[class*="google" i]',
      '[data-provider="google"]', '[data-method="google"]',
      'button[aria-label*="Google" i]', 'a[aria-label*="Google" i]',
      '[class*="social" i] [class*="google" i]',
    ];

    for (const sel of googleBtnSelectors) {
      const btn = document.querySelector(sel);
      if (btn && btn.offsetParent !== null) {
        btn.click();
        return { success: true, message: 'Clicked "Sign in with Google" button' };
      }
    }

    // 4. Text-based search for Google sign-in buttons
    const allButtons = document.querySelectorAll('button, a[role="button"], a[class*="btn" i], div[role="button"]');
    for (const btn of allButtons) {
      const text = (btn.textContent || '').trim().toLowerCase();
      if ((text.includes('google') || text.includes('gmail')) &&
          (text.includes('sign in') || text.includes('log in') || text.includes('continue') || text.includes('login'))) {
        btn.click();
        return { success: true, message: 'Clicked Google sign-in button' };
      }
    }

    return { success: false, message: 'No Google sign-in option found on this page' };
  }

  // ── Visual Feedback ─────────────────────────────────────────

  function showClickMarker(x, y) {
    const marker = document.createElement('div');
    Object.assign(marker.style, {
      position: 'fixed', left: (x - 15) + 'px', top: (y - 15) + 'px',
      width: '30px', height: '30px', borderRadius: '50%',
      border: '3px solid #1a73e8', background: 'rgba(26,115,232,0.15)',
      pointerEvents: 'none', zIndex: '2147483647',
      animation: 'ariaClickPulse 0.6s ease-out forwards',
    });
    document.body.appendChild(marker);
    setTimeout(() => marker.remove(), 700);
  }

  function showClickMarkerOnElement(el) {
    const rect = el.getBoundingClientRect();
    showClickMarker(rect.left + rect.width / 2, rect.top + rect.height / 2);
  }

  // Inject animation keyframes
  if (!document.getElementById('aria-click-styles')) {
    const style = document.createElement('style');
    style.id = 'aria-click-styles';
    style.textContent = `
      @keyframes ariaClickPulse {
        0% { transform: scale(0.5); opacity: 1; }
        100% { transform: scale(2); opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  }

  // ── Auto-Close Spam/Advert Popups ─────────────────────────

  (async function initPopupBlocker() {
    // Check if setting is enabled
    let enabled = true;
    try {
      const result = await chrome.storage.sync.get('autoClosePopups');
      if (result.autoClosePopups === false) enabled = false;
    } catch { /* default to enabled */ }

    if (!enabled) return;

    // Heuristic selectors for ad/spam popup close buttons
    const CLOSE_SELECTORS = [
      // Common close buttons
      '[class*="close" i][class*="popup" i]',
      '[class*="close" i][class*="overlay" i]',
      '[class*="close" i][class*="modal" i]:not([class*="login" i]):not([class*="auth" i])',
      '[class*="dismiss" i]',
      '[aria-label*="close" i][aria-label*="popup" i]',
      '[aria-label="Close" i]',
      '[aria-label="Dismiss" i]',
      // Cookie / consent banners
      '[class*="cookie" i] [class*="close" i]',
      '[class*="cookie" i] [class*="accept" i]',
      '[class*="cookie" i] [class*="reject" i]',
      '[class*="consent" i] [class*="accept" i]',
      '[class*="consent" i] [class*="reject" i]',
      '[id*="cookie" i] [class*="close" i]',
      '[id*="cookie" i] button',
      // Newsletter / subscribe popups
      '[class*="newsletter" i] [class*="close" i]',
      '[class*="subscribe" i] [class*="close" i]',
      '[class*="signup" i][class*="popup" i] [class*="close" i]',
    ];

    // Heuristic: identify ad/spam overlays (NOT login, checkout, or functional modals)
    const SPAM_OVERLAY_PATTERNS = /newsletter|subscribe|signup|sign-up|notification-perm|push-notif|cookie|consent|gdpr|ccpa|adblock|interstitial|promo|discount|offer-popup|exit-intent|welcome-mat/i;
    const FUNCTIONAL_PATTERNS = /login|signin|sign-in|auth|checkout|cart|payment|account|profile|settings|preferences|search|filter|confirm|dialog/i;

    function isSpamOverlay(el) {
      const text = (el.className || '') + ' ' + (el.id || '') + ' ' + (el.getAttribute('data-testid') || '');
      if (FUNCTIONAL_PATTERNS.test(text)) return false;
      if (SPAM_OVERLAY_PATTERNS.test(text)) return true;

      // Check by visual heuristics: fixed/absolute position covering a large area
      const style = window.getComputedStyle(el);
      const pos = style.position;
      if (pos !== 'fixed' && pos !== 'absolute') return false;
      const zIndex = parseInt(style.zIndex) || 0;
      if (zIndex < 999) return false;

      const rect = el.getBoundingClientRect();
      const viewW = window.innerWidth;
      const viewH = window.innerHeight;
      const coversScreen = rect.width > viewW * 0.5 && rect.height > viewH * 0.5;
      if (!coversScreen) return false;

      // Check inner text for spam signals
      const innerText = (el.textContent || '').toLowerCase().substring(0, 500);
      const spamPhrases = ['subscribe', 'newsletter', 'notification', 'allow notifications', 'sign up for', 'don\'t miss', 'special offer', 'discount', 'free shipping', 'exit intent', 'before you go', 'wait!', 'limited time', 'accept cookies', 'cookie policy', 'we use cookies'];
      return spamPhrases.some(p => innerText.includes(p));
    }

    function tryClosePopup(el) {
      // Try clicking a close button within the element
      for (const sel of CLOSE_SELECTORS) {
        const closeBtn = el.querySelector(sel);
        if (closeBtn) {
          closeBtn.click();
          return true;
        }
      }
      // Try generic close button patterns: X buttons, × character
      const buttons = el.querySelectorAll('button, [role="button"], .close, [class*="close" i]');
      for (const btn of buttons) {
        const btnText = (btn.textContent || '').trim();
        const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
        if (btnText === '×' || btnText === 'X' || btnText === '✕' || btnText === '✖' ||
            ariaLabel.includes('close') || ariaLabel.includes('dismiss')) {
          btn.click();
          return true;
        }
      }
      return false;
    }

    function scanAndClose() {
      // Scan for overlay/backdrop elements
      const allFixed = document.querySelectorAll('[class*="popup" i], [class*="overlay" i], [class*="modal" i], [class*="interstitial" i], [class*="cookie" i], [class*="consent" i], [class*="newsletter" i], [class*="subscribe" i]');
      for (const el of allFixed) {
        if (el.offsetParent === null && !window.getComputedStyle(el).position.match(/fixed|absolute/)) continue;
        if (isSpamOverlay(el)) {
          if (!tryClosePopup(el)) {
            // As a last resort, hide the element
            el.style.display = 'none';
          }
        }
      }
    }

    // Run initial scan after a delay (popups often appear after page load)
    setTimeout(scanAndClose, 2000);
    setTimeout(scanAndClose, 5000);

    // Watch for new popups via MutationObserver
    const observer = new MutationObserver(mutations => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType !== Node.ELEMENT_NODE) continue;
          // Small delay to let the popup render fully
          setTimeout(() => {
            if (isSpamOverlay(node)) {
              tryClosePopup(node) || (node.style.display = 'none');
            }
            // Also check children
            const children = node.querySelectorAll?.('[class*="popup" i], [class*="overlay" i], [class*="modal" i], [class*="cookie" i], [class*="consent" i]');
            if (children) {
              for (const child of children) {
                if (isSpamOverlay(child)) {
                  tryClosePopup(child) || (child.style.display = 'none');
                }
              }
            }
          }, 500);
        }
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
  })();
})();
