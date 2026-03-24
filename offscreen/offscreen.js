/* ═══════════════════════════════════════════════════════════════════
   Aria — Offscreen SpeechRecognition
   Runs in an offscreen document so Chrome grants microphone access.
   Communicates with the side panel via chrome.runtime messages.
   ═══════════════════════════════════════════════════════════════════ */

let recognition = null;
let running = false;

chrome.runtime.onMessage.addListener((msg) => {
  switch (msg.type) {
    case 'STT_START':
      startRecognition(msg.lang || 'en-US');
      break;
    case 'STT_STOP':
      stopRecognition();
      break;
  }
});

async function startRecognition(lang) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    send('STT_ERROR', { error: 'not-supported' });
    return;
  }

  // Ensure mic permission is active before starting recognition.
  // Offscreen docs can use already-granted permissions.
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach(t => t.stop());
  } catch (err) {
    send('STT_ERROR', { error: 'not-allowed' });
    return;
  }

  stopRecognition();

  recognition = new SR();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = lang;

  recognition.onstart = () => {
    running = true;
    send('STT_STARTED');
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
  };

  recognition.onend = () => {
    // If still supposed to be running, auto-restart
    if (running) {
      try { recognition.start(); } catch {
        running = false;
        send('STT_ENDED');
      }
    } else {
      send('STT_ENDED');
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
