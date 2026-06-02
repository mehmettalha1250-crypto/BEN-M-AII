/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface VoiceOption {
  id: string;
  name: string;
  gender: 'male' | 'female';
  pitch: number;
  rate: number;
  description: string;
}

export const VOICES: VoiceOption[] = [
  { id: 'Ali', name: 'Ali', gender: 'male', pitch: 0.90, rate: 1.25, description: 'Ali, bilge siber asistan - Can ile tamamen farklı karizmatik ton' },
  { id: 'Can', name: 'Can', gender: 'male', pitch: 1.30, rate: 1.45, description: 'Genç, enerjik, tempolu siber erkek asistan' },
  { id: 'Selin', name: 'Selin', gender: 'female', pitch: 1.55, rate: 1.35, description: 'Güler yüzlü, enerjik ve parlak kız asistan sesi (Selin)' },
  { id: 'Ebru', name: 'Ebru', gender: 'female', pitch: 1.25, rate: 1.15, description: 'Yumuşak, dinlendirici, cana yakın ve tatlı kız asistan sesi (Ebru)' }
];

let activeUtterance: SpeechSynthesisUtterance | null = null;
let sentenceQueue: string[] = [];
let currentQueueIndex = 0;
let queueVoiceId = "";
let queueOnStop: (() => void) | undefined = undefined;
let activeAudio: HTMLAudioElement | null = null;
let activeAbortController: AbortController | null = null;

if (typeof window !== 'undefined' && window.speechSynthesis) {
  try {
    window.speechSynthesis.getVoices();
    window.speechSynthesis.onvoiceschanged = () => {
      window.speechSynthesis.getVoices();
    };
  } catch (e) {
    console.warn("Speech synthesis initial load failed:", e);
  }
}

/**
 * Stop any currently running synthesized voice
 */
export function stopSpeaking() {
  if (activeAbortController) {
    try {
      activeAbortController.abort();
    } catch (e) {}
    activeAbortController = null;
  }
  if (activeAudio) {
    try {
      activeAudio.pause();
    } catch (e) {}
    activeAudio = null;
  }
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.cancel();
    activeUtterance = null;
    sentenceQueue = [];
    currentQueueIndex = 0;
    queueOnStop = undefined;
  }
}

/**
 * Speaks a custom text using ElevenLabs, with secondary SpeechSynthesis backup.
 */
export function speakText(text: string, voiceId: string, onStop?: () => void) {
  // Stop current utterance/audio immediately
  stopSpeaking();

  // Strip Markdown, code tags, citations and clean formatting
  let cleanText = text
    .replace(/\[\d+\]/g, '') // remove resource citations
    .replace(/[\*\_\`\#]/g, '') // remove md formatting
    .replace(/```[\s\S]*?```/g, '') // strip large code snippets so TTS doesn't read codes
    .replace(/`[\s\S]*?`/g, '') 
    .replace(/api_error/gi, 'hata')
    .replace(/ai_error/gi, 'hata')
    .replace(/localhost:[0-9]+/gi, '')
    .trim();

  // Strip emojis
  try {
    cleanText = cleanText.replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '');
  } catch (err) {
    cleanText = cleanText.replace(/[\u{1F300}-\u{1F9FF}\u{1F000}-\u{1F9FF}\u{2600}-\u{27BF}]/gu, '');
  }

  cleanText = cleanText.replace(/\s+/g, ' ').trim();

  if (!cleanText) {
    if (onStop) onStop();
    return;
  }

  // 1. Definition of the SpeechSynthesis browser fallback mechanism
  const runSpeechSynthesisFallback = () => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      if (onStop) onStop();
      return;
    }
    const sentences = cleanText.split(/([.!?;\n]|\s{2,})/).reduce((acc: string[], val) => {
      const trimmed = val.trim();
      if (!trimmed) return acc;
      if (trimmed === '.' || trimmed === '!' || trimmed === '?' || trimmed === ';') {
        if (acc.length > 0) {
          acc[acc.length - 1] += trimmed;
        }
      } else {
        acc.push(trimmed);
      }
      return acc;
    }, []);

    if (sentences.length === 0) {
      if (onStop) onStop();
      return;
    }

    sentenceQueue = sentences;
    currentQueueIndex = 0;
    queueVoiceId = voiceId;
    queueOnStop = onStop;

    speakNextInQueue();
  };

  // 2. Try calling ElevenLabs first for state-of-the-art voice expression
  activeAbortController = new AbortController();
  const signal = activeAbortController.signal;

  fetch("/api/elevenlabs/tts", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    signal,
    body: JSON.stringify({
      text: cleanText,
      voiceId: voiceId
    })
  })
  .then(async (res) => {
    // Clear activeAbortController on successful completion
    activeAbortController = null;
    
    if (!res.ok) {
      throw new Error("ElevenLabs endpoint not OK");
    }
    const audioBlob = await res.blob();
    const audioUrl = URL.createObjectURL(audioBlob);
    const audio = new Audio(audioUrl);
    activeAudio = audio;
    
    audio.play()
      .then(() => {
        audio.onended = () => {
          URL.revokeObjectURL(audioUrl);
          if (activeAudio === audio) {
            activeAudio = null;
          }
          if (onStop) onStop();
        };
      })
      .catch((playErr) => {
        console.error("Audio playback prompt failed, triggering system fallback:", playErr);
        URL.revokeObjectURL(audioUrl);
        runSpeechSynthesisFallback();
      });
  })
  .catch((elErr) => {
    if (elErr.name === 'AbortError') {
      console.log("ElevenLabs request was aborted intentionally.");
      return;
    }
    activeAbortController = null;
    console.warn("ElevenLabs TTS failed/unavailable, using browser SpeechSynthesis backup:", elErr);
    runSpeechSynthesisFallback();
  });
}

function speakNextInQueue() {
  if (currentQueueIndex >= sentenceQueue.length) {
    if (queueOnStop) queueOnStop();
    stopSpeaking();
    return;
  }

  const chunk = sentenceQueue[currentQueueIndex].trim();
  if (!chunk || chunk.length < 1) {
    currentQueueIndex++;
    speakNextInQueue();
    return;
  }

  const utterance = new SpeechSynthesisUtterance(chunk);
  activeUtterance = utterance;

  // Find suitable system voice for Turkish
  const voices = window.speechSynthesis.getVoices();
  const trVoices = voices.filter(v => v.lang.startsWith('tr') || v.lang.includes('TR'));
  const chosenVoice = VOICES.find(v => v.id === queueVoiceId) || VOICES[2];

  let trVoice = null;
  if (trVoices.length > 0) {
    const isFemaleSelection = chosenVoice.gender === 'female';
    
    // Sort so premium/natural voices are preferred first
    const sortedTrVoices = [...trVoices].sort((a, b) => {
      const aName = a.name.toLowerCase();
      const bName = b.name.toLowerCase();
      const aNatural = aName.includes('natural') || aName.includes('premium') || aName.includes('online');
      const bNatural = bName.includes('natural') || bName.includes('premium') || bName.includes('online');
      if (aNatural && !bNatural) return -1;
      if (!aNatural && bNatural) return 1;
      return 0;
    });

    if (isFemaleSelection) {
      // Look for explicit female matches (Yelda, Seda, Emel, Hazel, Dilara, Zeynep etc. or dfm/yef/ydf codes)
      trVoice = sortedTrVoices.find(v => {
        const name = v.name.toLowerCase();
        const matchesFemaleName = name.includes('yelda') || name.includes('seda') || name.includes('emel') || 
                                  name.includes('hazel') || name.includes('dilara') || name.includes('zeynep') || 
                                  name.includes('suna') || name.includes('merve') || name.includes('filiz') || 
                                  name.includes('sinem') || name.includes('yasemin') || name.includes('emine') ||
                                  name.includes('female') || name.includes('woman') || name.includes('girl') ||
                                  name.includes('gül') || name.includes('zeynep');
        const matchesFemaleCode = name.includes('-dfm-') || name.includes('-yef-') || name.includes('-ydf-') || name.includes('-df-');
        return matchesFemaleName || matchesFemaleCode;
      });

      // Fallback if no female found explicitly: pick any voice that is NOT male
      if (!trVoice) {
        trVoice = sortedTrVoices.find(v => {
          const name = v.name.toLowerCase();
          const matchesMale = name.includes('tolga') || name.includes('cem') || name.includes('ahmet') || 
                              name.includes('hakan') || name.includes('murat') || name.includes('can') || 
                              name.includes('ali') || name.includes('male') || name.includes('man') || 
                              name.includes('-gvm-') || name.includes('-gmm-') || name.includes('-kma-');
          return !matchesMale;
        });
      }
    } else {
      // Look for explicit male matches (Tolga, Cem, Ahmet, Hakan, Cem, Murat etc. or gvm/gmm/kma codes)
      trVoice = sortedTrVoices.find(v => {
        const name = v.name.toLowerCase();
        const matchesMaleName = name.includes('tolga') || name.includes('cem') || name.includes('ahmet') || 
                                name.includes('hakan') || name.includes('murat') || name.includes('can') || 
                                name.includes('ali') || name.includes('male') || name.includes('man');
        const matchesMaleCode = name.includes('-gvm-') || name.includes('-gmm-') || name.includes('-kma-');
        return matchesMaleName || matchesMaleCode;
      });

      // Fallback if no male found explicitly: pick any voice that is NOT female
      if (!trVoice) {
        trVoice = sortedTrVoices.find(v => {
          const name = v.name.toLowerCase();
          const matchesFemale = name.includes('yelda') || name.includes('seda') || name.includes('emel') || 
                                name.includes('hazel') || name.includes('dilara') || name.includes('zeynep') || 
                                name.includes('suna') || name.includes('merve') || name.includes('female') || 
                                name.includes('woman') || name.includes('-dfm-') || name.includes('-yef-') || 
                                name.includes('-ydf-') || name.includes('-df-');
          return !matchesFemale;
        });
      }
    }

    // Ultimate fallback if still no voice found
    if (!trVoice) {
      trVoice = sortedTrVoices[0];
    }
  }

  if (trVoice) {
    utterance.voice = trVoice;
  }

  // Fetch customizable audio settings from user preferences as multipliers
  const savedRate = typeof window !== 'undefined' ? window.localStorage.getItem('voice_rate') : null;
  const savedPitch = typeof window !== 'undefined' ? window.localStorage.getItem('voice_pitch') : null;

  const rateMultiplier = savedRate ? parseFloat(savedRate) / 1.1 : 1.0;
  const pitchMultiplier = savedPitch ? parseFloat(savedPitch) : 1.0;

  // Let "Ebru" sound naturally sweet, Can siber and high pitch
  utterance.rate = Math.max(0.5, Math.min(2.0, chosenVoice.rate * rateMultiplier));
  utterance.pitch = Math.max(0.5, Math.min(2.0, chosenVoice.pitch * pitchMultiplier));

  utterance.onend = () => {
    currentQueueIndex++;
    // Small inter-sentence micro pause of 100ms for more natural flow!
    setTimeout(() => {
      speakNextInQueue();
    }, 100);
  };

  utterance.onerror = (e) => {
    console.error('Speech synthesis step error, proceeding:', e);
    currentQueueIndex++;
    speakNextInQueue();
  };

  window.speechSynthesis.speak(utterance);
}

export function isSpeaking() {
  const isAudioPlaying = activeAudio ? !activeAudio.paused : false;
  const isSynthSpeaking = typeof window !== 'undefined' && window.speechSynthesis && window.speechSynthesis.speaking;
  return !!(isAudioPlaying || isSynthSpeaking);
}
