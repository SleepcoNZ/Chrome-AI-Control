/* ═══════════════════════════════════════════════════════════════════
   Aria — TTS Engine
   Text-to-Speech with ElevenLabs, Chrome TTS, Web Speech fallback
   Response length summarization before speaking.
   ═══════════════════════════════════════════════════════════════════ */
import { DEFAULT_SETTINGS, TTS_SUMMARY_PROMPTS } from '../shared/constants.js';
import { loadSettings } from '../shared/utils.js';
import { getFastClient } from './ai-client.js';

/**
 * Prepare text for TTS by summarizing based on response length setting.
 * At level 1-2, reduces to minimal acknowledgment.
 * At level 9-10, reads near-complete response.
 */
export async function prepareTTSText(fullText, responseLength) {
  if (!fullText) return '';

  const level = responseLength || DEFAULT_SETTINGS.responseLength;

  // Very brief levels — use fast AI to distill to a few words
  if (level <= 2) {
    try {
      const client = await getFastClient();
      const result = await client.sendMessage([
        { role: 'system', content: TTS_SUMMARY_PROMPTS[level] },
        { role: 'user', content: fullText.substring(0, 1000) },
      ], { maxTokens: 30, temperature: 0.3 });
      return result.text.trim();
    } catch {
      // Fallback: just take first few words
      return fullText.split(/\s+/).slice(0, 5).join(' ');
    }
  }

  // Level 3-5 — summarize to a few sentences
  if (level <= 5) {
    // If response is already short, speak it directly
    if (fullText.length < 200) return fullText;

    try {
      const client = await getFastClient();
      const result = await client.sendMessage([
        { role: 'system', content: TTS_SUMMARY_PROMPTS[level] },
        { role: 'user', content: fullText.substring(0, 3000) },
      ], { maxTokens: 150, temperature: 0.5 });
      return result.text.trim();
    } catch {
      // Fallback: first 2 sentences
      return extractSentences(fullText, 2);
    }
  }

  // Level 6-8 — moderate summarization
  if (level <= 8) {
    if (fullText.length < 500) return fullText;

    try {
      const client = await getFastClient();
      const result = await client.sendMessage([
        { role: 'system', content: TTS_SUMMARY_PROMPTS[level] },
        { role: 'user', content: fullText.substring(0, 5000) },
      ], { maxTokens: 500, temperature: 0.5 });
      return result.text.trim();
    } catch {
      return extractSentences(fullText, 6);
    }
  }

  // Level 9-10 — near-complete / full response
  // Just clean up markdown for speech
  return cleanForSpeech(fullText);
}

/**
 * Generate TTS audio via ElevenLabs API.
 * Returns base64 audio data or null.
 */
export async function generateElevenLabsAudio(text, settings) {
  const apiKey = settings.elevenlabsApiKey;
  const voiceId = settings.elevenlabsVoiceId || '21m00Tcm4TlvDq8ikWAM';

  if (!apiKey || !text) return null;

  const resp = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: text.substring(0, 5000),
      model_id: 'eleven_turbo_v2',
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
      },
    }),
  });

  if (!resp.ok) {
    console.warn('[TTS] ElevenLabs error:', resp.status);
    return null;
  }

  const buffer = await resp.arrayBuffer();
  // Convert to base64 for passing to side panel
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Speak text using Chrome's built-in TTS API.
 */
export function speakChromeTTS(text, settings) {
  return new Promise((resolve, reject) => {
    const rate = settings.ttsSpeakingRate || 1.0;
    const voice = settings.chromeTtsVoice || undefined;

    const opts = {
      rate,
      pitch: 1.0,
      volume: 1.0,
      onEvent: (event) => {
        if (event.type === 'end' || event.type === 'cancelled') resolve();
        if (event.type === 'error') reject(new Error(event.errorMessage));
      },
    };
    if (voice) opts.voiceName = voice;

    chrome.tts.speak(text, opts);
  });
}

/**
 * Stop any ongoing Chrome TTS.
 */
export function stopChromeTTS() {
  chrome.tts.stop();
}

/**
 * Main TTS dispatch — picks provider based on settings, prepares text, speaks.
 * Returns { method, text } for the side panel to handle playback.
 */
export async function speak(fullText, responseLength) {
  const settings = await loadSettings();
  const ttsText = await prepareTTSText(fullText, responseLength || settings.responseLength);

  if (!ttsText) return { method: 'none', text: '' };

  const provider = settings.ttsProvider || DEFAULT_SETTINGS.ttsProvider;

  switch (provider) {
    case 'elevenlabs': {
      const audioB64 = await generateElevenLabsAudio(ttsText, settings);
      if (audioB64) {
        return { method: 'elevenlabs', audioB64, text: ttsText };
      }
      // Fall through to Chrome TTS
    }
    // falls through
    case 'chrome': {
      // Chrome TTS runs in service worker context
      try {
        await speakChromeTTS(ttsText, settings);
        return { method: 'chrome', text: ttsText };
      } catch {
        // Fall through to webspeech
      }
    }
    // falls through
    case 'webspeech':
    default:
      // Web Speech API runs in the side panel, so return the text
      return { method: 'webspeech', text: ttsText };
  }
}

// ── Helpers ───────────────────────────────────────────────────

function extractSentences(text, count) {
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  return sentences.slice(0, count).join(' ').trim();
}

function cleanForSpeech(text) {
  return text
    .replace(/```[\s\S]*?```/g, '')         // Remove code blocks
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Remove link formatting
    .replace(/[#*_~`]/g, '')                 // Remove markdown chars
    .replace(/\n{2,}/g, '. ')               // Paragraphs to pauses
    .replace(/\n/g, ' ')                     // Newlines to spaces
    .replace(/\s{2,}/g, ' ')                // Collapse whitespace
    .trim();
}
