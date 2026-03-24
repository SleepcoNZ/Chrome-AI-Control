/* ═══════════════════════════════════════════════════════════════════
   Aria — Content Script: Page Reader
   Extract readable text, headings, links, form fields from pages.
   Runs in the context of every web page.
   ═══════════════════════════════════════════════════════════════════ */

(() => {
  if (window.__ariaPageReader) return;
  window.__ariaPageReader = true;

  // ── Message Handler ─────────────────────────────────────────

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'page_read') {
      try {
        const result = handleRead(msg.readType);
        sendResponse(result);
      } catch (e) {
        sendResponse({ content: '', error: e.message });
      }
      return true;
    }
  });

  // ── Read Dispatcher ─────────────────────────────────────────

  function handleRead(readType) {
    switch (readType) {
      case 'full':
        return { content: getReadableContent() };
      case 'first':
      case 'firstParagraphs':
        return { content: getFirstParagraphs(5) };
      case 'headings':
        return { content: getHeadings() };
      case 'links':
        return { content: getLinks() };
      case 'forms':
        return { content: getFormFields() };
      case 'selection':
        return { content: getSelection() };
      case 'meta':
        return { content: getMetaInfo() };
      default:
        return { content: getReadableContent() };
    }
  }

  // ── Readable Content Extraction ─────────────────────────────

  function getReadableContent() {
    // Try to find main content area
    const mainSelectors = [
      'main', 'article', '[role="main"]',
      '#content', '#main-content', '.content', '.main-content',
      '.post-content', '.article-content', '.entry-content',
    ];

    let root = null;
    for (const sel of mainSelectors) {
      root = document.querySelector(sel);
      if (root && root.textContent.trim().length > 200) break;
      root = null;
    }

    if (!root) root = document.body;

    // Clone and strip unwanted elements
    const clone = root.cloneNode(true);
    const stripSelectors = [
      'nav', 'header', 'footer', 'aside', '.sidebar', '.nav',
      '.menu', '.ad', '.advertisement', '.social-share',
      'script', 'style', 'noscript', 'iframe',
      '[role="navigation"]', '[role="banner"]', '[role="complementary"]',
      '.cookie-banner', '.popup', '.modal', '.overlay',
    ];

    for (const sel of stripSelectors) {
      clone.querySelectorAll(sel).forEach(el => el.remove());
    }

    // Extract text with structure
    const text = extractStructuredText(clone);

    // Limit length
    return text.slice(0, 15000);
  }

  function extractStructuredText(root) {
    const parts = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);

    let node;
    while (node = walker.nextNode()) {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent.trim();
        if (text) parts.push(text);
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const tag = node.tagName.toLowerCase();
        // Add structure markers
        if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tag)) {
          parts.push(`\n## ${node.textContent.trim()}\n`);
          // Skip children — we already got the text
          walker.nextSibling();
          continue;
        }
        if (tag === 'p' || tag === 'br' || tag === 'div') {
          if (parts.length && parts[parts.length - 1] !== '\n') {
            parts.push('\n');
          }
        }
        if (tag === 'li') {
          parts.push('\n• ');
        }
      }
    }

    return parts.join(' ')
      .replace(/\n\s*\n/g, '\n\n')  // Collapse multiple newlines
      .replace(/  +/g, ' ')          // Collapse multiple spaces
      .trim();
  }

  // ── First N Paragraphs ─────────────────────────────────────

  function getFirstParagraphs(n = 5) {
    const paragraphs = document.querySelectorAll('p');
    const texts = [];
    let count = 0;

    for (const p of paragraphs) {
      const text = p.textContent.trim();
      if (text.length > 30) {  // Skip tiny paragraphs
        texts.push(text);
        count++;
        if (count >= n) break;
      }
    }

    return texts.join('\n\n') || 'No paragraphs found on this page.';
  }

  // ── Headings ────────────────────────────────────────────────

  function getHeadings() {
    const headings = document.querySelectorAll('h1, h2, h3, h4');
    const parts = [];

    for (const h of headings) {
      const level = parseInt(h.tagName[1]);
      const indent = '  '.repeat(level - 1);
      const text = h.textContent.trim();
      if (text) parts.push(`${indent}${h.tagName}: ${text}`);
    }

    return parts.join('\n') || 'No headings found.';
  }

  // ── Links ───────────────────────────────────────────────────

  function getLinks() {
    const links = document.querySelectorAll('a[href]');
    const seen = new Set();
    const parts = [];

    for (const a of links) {
      const text = a.textContent.trim();
      const href = a.href;
      if (text && href && !seen.has(href) && !href.startsWith('javascript:')) {
        seen.add(href);
        parts.push(`[${text.substring(0, 80)}](${href})`);
        if (parts.length >= 50) break;  // Limit
      }
    }

    return parts.join('\n') || 'No links found.';
  }

  // ── Form Fields ─────────────────────────────────────────────

  function getFormFields() {
    const inputs = document.querySelectorAll('input, textarea, select, button[type="submit"]');
    const parts = [];

    for (const el of inputs) {
      const type = el.type || el.tagName.toLowerCase();
      const name = el.name || el.id || '';
      const label = findLabelFor(el);
      const sensitiveTypes = new Set(['password', 'hidden', 'credit-card']);
      const sensitiveNames = /passw|secret|token|card|cvv|ssn|credit/i;
      const isSensitive = sensitiveTypes.has(type) || sensitiveNames.test(name) || sensitiveNames.test(label);
      const value = el.value && !isSensitive ? ` [value: "${el.value.substring(0, 30)}"]` : (el.value && isSensitive ? ' [value: ••••]' : '');
      const placeholder = el.placeholder ? ` (${el.placeholder})` : '';

      parts.push(`• ${type}: ${label || name}${placeholder}${value}`);
    }

    return parts.join('\n') || 'No form fields found.';
  }

  function findLabelFor(el) {
    // By for attribute
    if (el.id) {
      const label = document.querySelector(`label[for="${el.id}"]`);
      if (label) return label.textContent.trim();
    }
    // By parent label
    const parent = el.closest('label');
    if (parent) return parent.textContent.trim().replace(el.value || '', '').trim();
    // By aria-label
    return el.getAttribute('aria-label') || '';
  }

  // ── Selection ───────────────────────────────────────────────

  function getSelection() {
    const sel = window.getSelection();
    return sel ? sel.toString().trim() : '';
  }

  // ── Meta Info ───────────────────────────────────────────────

  function getMetaInfo() {
    const title = document.title;
    const desc = document.querySelector('meta[name="description"]')?.content || '';
    const canonical = document.querySelector('link[rel="canonical"]')?.href || '';
    const ogTitle = document.querySelector('meta[property="og:title"]')?.content || '';
    const ogDesc = document.querySelector('meta[property="og:description"]')?.content || '';

    return [
      `Title: ${title}`,
      `URL: ${location.href}`,
      desc && `Description: ${desc}`,
      ogTitle && ogTitle !== title && `OG Title: ${ogTitle}`,
      ogDesc && ogDesc !== desc && `OG Description: ${ogDesc}`,
      canonical && `Canonical: ${canonical}`,
    ].filter(Boolean).join('\n');
  }
})();
