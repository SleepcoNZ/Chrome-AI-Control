/* ═══════════════════════════════════════════════════════════════════
   Aria — STT Relay Tab
   This page runs in a real Chrome tab so SpeechRecognition + mic
   permission prompts work correctly. It grants mic access on first
   visit, then acts as a live speech-to-text relay, sending
   transcripts back to the side panel via chrome.runtime messages.
   ═══════════════════════════════════════════════════════════════════ */

const btn = document.getElementById('grant');
const status = document.getElementById('status');

let recognition = null;
let running = false;

// ── Mic permission grant ─────────────────────────────
btn.addEventListener('click', async () => {
  btn.disabled = true;
  btn.textContent = 'Requesting…';
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach(t => t.stop());
    status.textContent = '✓ Microphone access granted! Starting voice input…';
    status.className = 'status ok';
    btn.textContent = 'Listening…';
    chrome.runtime.sendMessage({ type: 'MIC_PERMISSION_GRANTED' });
    // Now start recognition in this tab
    startRecognition();
  } catch (err) {
    status.textContent = '✗ Permission denied. If Chrome didn\'t show a prompt, click the lock/tune icon in the address bar → Site settings → Microphone → Allow, then try again.';
    status.className = 'status fail';
    btn.textContent = 'Try Again';
    btn.disabled = false;
  }
});

// ── Listen for commands from side panel / service worker ──
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'STT_START') {
    startRecognition(msg.lang || 'en-US');
  } else if (msg.type === 'STT_STOP') {
    stopRecognition();
  }
});

// ── Speech Recognition ───────────────────────────────
function startRecognition(lang) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    send('STT_ERROR', { error: 'not-supported' });
    return;
  }

  stopRecognition();

  recognition = new SR();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = lang || 'en-US';

  recognition.onstart = () => {
    running = true;
    send('STT_STARTED');
    status.textContent = '🔴 Listening… (keep this tab open)';
    status.className = 'status ok';
    btn.textContent = 'Listening…';
    btn.disabled = true;
  };

  recognition.onresult = (event) => {
    let interim = '';
    let final = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const t = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        final += t;
      } else {
        interim += t;
      }
    }
    send('STT_RESULT', { final, interim });
  };

  recognition.onerror = (event) => {
    send('STT_ERROR', { error: event.error });
    if (event.error === 'not-allowed') {
      status.textContent = '✗ Mic denied — click "Try Again"';
      status.className = 'status fail';
      btn.textContent = 'Try Again';
      btn.disabled = false;
      running = false;
    }
  };

  recognition.onend = () => {
    if (running) {
      // Auto-restart if still supposed to be listening
      try { recognition.start(); } catch {
        running = false;
        send('STT_ENDED');
        status.textContent = 'Stopped. Toggle Live in Aria to restart.';
        btn.textContent = 'Grant Microphone Access';
        btn.disabled = false;
      }
    } else {
      send('STT_ENDED');
      status.textContent = 'Stopped. Toggle Live in Aria to restart.';
      btn.textContent = 'Grant Microphone Access';
      btn.disabled = false;
    }
  };

  try {
    recognition.start();
  } catch {
    send('STT_ERROR', { error: 'start-failed' });
  }
}

function stopRecognition() {
  running = false;
  if (recognition) {
    try { recognition.abort(); } catch {}
    recognition = null;
  }
}

function send(type, data = {}) {
  chrome.runtime.sendMessage({ type, ...data }).catch(() => {});
}

// ── Auto-check: if mic already granted, start immediately ──
(async () => {
  try {
    const result = await navigator.permissions.query({ name: 'microphone' });
    if (result.state === 'granted') {
      status.textContent = '✓ Mic already authorized — starting…';
      status.className = 'status ok';
      btn.disabled = true;
      btn.textContent = 'Starting…';
      chrome.runtime.sendMessage({ type: 'MIC_PERMISSION_GRANTED' });
      startRecognition();
    }
  } catch {}
})();
