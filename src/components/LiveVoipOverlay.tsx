/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Monitor, 
  Camera, 
  Mic, 
  MicOff, 
  VideoOff, 
  Volume2, 
  Sparkles,
  RefreshCw,
  Clock,
  Radio
} from 'lucide-react';
import { UserProfile } from '../types';
import { speakText, stopSpeaking } from '../utils/speak';
import Logo from './Logo';

// Cyber Space Drone Audio Synthesizer utilizing Web Audio API directly
let ambientCtx: AudioContext | null = null;
let ambientOsc1: OscillatorNode | null = null;
let ambientOsc2: OscillatorNode | null = null;
let ambientBiquad: BiquadFilterNode | null = null;
let ambientGain: GainNode | null = null;

const startAmbientSound = () => {
  stopAmbientSound();
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    ambientCtx = new AudioContextClass();
    
    // Spaceship / Deep cyber-deck background hum loop
    ambientOsc1 = ambientCtx.createOscillator();
    ambientOsc1.type = 'sawtooth';
    ambientOsc1.frequency.setValueAtTime(45, ambientCtx.currentTime); // 45Hz sub bass note
    
    ambientOsc2 = ambientCtx.createOscillator();
    ambientOsc2.type = 'triangle';
    ambientOsc2.frequency.setValueAtTime(45.4, ambientCtx.currentTime); // slightly detuned
    
    ambientBiquad = ambientCtx.createBiquadFilter();
    ambientBiquad.type = 'lowpass';
    ambientBiquad.frequency.setValueAtTime(110, ambientCtx.currentTime); // cut sharp frequencies
    ambientBiquad.Q.setValueAtTime(6, ambientCtx.currentTime);
    
    ambientGain = ambientCtx.createGain();
    ambientGain.gain.setValueAtTime(0.04, ambientCtx.currentTime); // whisper-soft background hum
    
    ambientOsc1.connect(ambientBiquad);
    ambientOsc2.connect(ambientBiquad);
    ambientBiquad.connect(ambientGain);
    ambientGain.connect(ambientCtx.destination);
    
    ambientOsc1.start();
    ambientOsc2.start();
  } catch (e) {
    console.warn("Ambient synthesized hum failed to start:", e);
  }
};

const stopAmbientSound = () => {
  try {
    if (ambientOsc1) { ambientOsc1.stop(); ambientOsc1.disconnect(); ambientOsc1 = null; }
    if (ambientOsc2) { ambientOsc2.stop(); ambientOsc2.disconnect(); ambientOsc2 = null; }
    if (ambientGain) { ambientGain.disconnect(); ambientGain = null; }
    if (ambientBiquad) { ambientBiquad.disconnect(); ambientBiquad = null; }
    if (ambientCtx) {
      if (ambientCtx.state !== 'closed') {
        ambientCtx.close();
      }
      ambientCtx = null;
    }
  } catch (e) {
    // console.warn("Stop ambient space sound failed", e);
  }
};

interface LiveVoipProps {
  isOpen: boolean;
  onClose: () => void;
  userProfile: UserProfile;
}

export default function LiveVoipOverlay({
  isOpen,
  onClose,
  userProfile
}: LiveVoipProps) {
  // Active states
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const isVoiceActiveRef = useRef(false);

  const [isUserMuted, setIsUserMuted] = useState(false);
  const isUserMutedRef = useRef(false);

  // Synchronized space drone controller
  const [isSpaceDroneEnabled, setIsSpaceDroneEnabled] = useState(false);

  useEffect(() => {
    if (isVoiceActive && isSpaceDroneEnabled) {
      startAmbientSound();
    } else {
      stopAmbientSound();
    }
    return () => {
      stopAmbientSound();
    };
  }, [isVoiceActive, isSpaceDroneEnabled]);

  const [isCameraActive, setIsCameraActive] = useState(false);
  const cameraFacingModeRef = useRef<'user' | 'environment'>('user');
  const [cameraFacingMode, setCameraFacingMode] = useState<'user' | 'environment'>('user');

  const [isScreenActive, setIsScreenActive] = useState(false);
  
  const [aiTalking, setAiTalking] = useState(false);
  const aiTalkingRef = useRef(false);

  const [transcription, setTranscription] = useState('');
  const [aiSpeechOutput, setAiSpeechOutput] = useState('');

  // Diagnostics panel status
  const [diagLogs, setDiagLogs] = useState<string[]>(['[00:00:00] Teşhis başlatıldı.']);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [micPermission, setMicPermission] = useState<string>('Bilinmiyor');

  const addDiagLog = (message: string) => {
    const time = new Date().toLocaleTimeString();
    setDiagLogs(prev => [...prev, `[${time}] ${message}`].slice(-25));
  };

  const voipHistoryRef = useRef<any[]>([]);

  useEffect(() => {
    if (isOpen) {
      addDiagLog("Siber kanal donanım taraması yapılıyor...");
      if (typeof window !== 'undefined') {
        const hasSynth = 'speechSynthesis' in window;
        addDiagLog(hasSynth ? "[OK] Hoparlör (SpeechSynthesis) sistemde aktif." : "[HATA] Hoparlör (SpeechSynthesis) sistemde desteklenmiyor.");
        
        // @ts-ignore
        const SpeechReq = window.SpeechRecognition || window.webkitSpeechRecognition;
        addDiagLog(SpeechReq ? "[OK] Ses Tanıyıcı (SpeechRecognition) sistemde aktif." : "[HATA] Ses Tanıyıcı sistemde desteklenmiyor.");

        if (navigator.permissions && navigator.permissions.query) {
          navigator.permissions.query({ name: 'microphone' as any }).then(status => {
            setMicPermission(status.state);
            addDiagLog(`[İZİN] Mikrofon izni: ${status.state.toUpperCase()}`);
          }).catch(e => {
            addDiagLog(`[İZİN] Hata: ${e.message}`);
          });
        }
      }
      
      // Clear history context on mount
      voipHistoryRef.current = [
        { id: 'voip_init', sender: 'ai', text: `Merhaba ${userProfile.displayName}! Canlı ses bağlantımız kuruldu. Dinliyorum. Konuşmaya başlayabilirsiniz.`, createdAt: Date.now() }
      ];
    }
  }, [isOpen]);

  // Update helper functions
  const updateAiTalking = (val: boolean) => {
    setAiTalking(val);
    aiTalkingRef.current = val;
  };

  const updateVoiceActive = (val: boolean) => {
    setIsVoiceActive(val);
    isVoiceActiveRef.current = val;
  };

  // Streams
  const videoRef = useRef<HTMLVideoElement>(null);
  const screenRef = useRef<HTMLVideoElement>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  
  // Speech Recognition reference for hands-free loop
  const recognitionRef = useRef<any>(null);

  // Stop everything on close
  const handleClose = () => {
    stopSpeaking();
    stopAllStreams();
    onClose();
  };

  const stopAllStreams = () => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach(t => t.stop());
      cameraStreamRef.current = null;
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(t => t.stop());
      screenStreamRef.current = null;
    }
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsCameraActive(false);
    setIsScreenActive(false);
    updateVoiceActive(false);
    updateAiTalking(false);
    setIsUserMuted(false);
    isUserMutedRef.current = false;
  };

  // Toggle Mute
  const toggleMute = () => {
    const nextVal = !isUserMuted;
    setIsUserMuted(nextVal);
    isUserMutedRef.current = nextVal;
    if (nextVal) {
      setTranscription("Mikrofonunuz sessize alındı.");
    } else {
      setTranscription("Dinleniyor...");
    }
  };

  // Switch camera facing mode
  const switchCameraFacing = async () => {
    const nextFacing = cameraFacingMode === 'user' ? 'environment' : 'user';
    setCameraFacingMode(nextFacing);
    if (isCameraActive) {
      await startCamera(nextFacing);
    }
  };

  const startCamera = async (facing: 'user' | 'environment') => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach(t => t.stop());
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: facing }, 
        audio: false 
      });
      cameraStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setIsCameraActive(true);
    } catch (err) {
      console.error('Kamera başlatılamadı:', err);
      alert('Kamera izni verilmedi veya uygun kamera bulunamadı.');
    }
  };

  // Toggle Camera
  const toggleCamera = async () => {
    if (isCameraActive) {
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach(t => t.stop());
        cameraStreamRef.current = null;
      }
      setIsCameraActive(false);
    } else {
      await startCamera(cameraFacingMode);
    }
  };

  // Toggle Screensharing
  const toggleScreen = async () => {
    if (isScreenActive) {
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(t => t.stop());
        screenStreamRef.current = null;
      }
      setIsScreenActive(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
        screenStreamRef.current = stream;
        if (screenRef.current) {
          screenRef.current.srcObject = stream;
        }
        setIsScreenActive(true);

        // Listen for screen sharing stop from native browser banner
        stream.getVideoTracks()[0].onended = () => {
          setIsScreenActive(false);
          screenStreamRef.current = null;
        };
      } catch (err) {
        console.error('Ekran paylaşımı başlatılamadı:', err);
      }
    }
  };

  // Automated reply library or Gemini query for hands free conversations
  const queryGeminiVoip = async (text: string, rec: any) => {
    updateAiTalking(true);
    setAiSpeechOutput("Düşünüyor...");
    addDiagLog(`[YAPAY ZEKA] Kullanıcı cümlesi sisteme girdi: "${text}"`);
    
    // Add User message to ref
    const userMsg = {
      id: `voip_user_${Date.now()}`,
      sender: 'user',
      text: text,
      createdAt: Date.now()
    };
    voipHistoryRef.current.push(userMsg);

    try {
      addDiagLog("[YAPAY ZEKA] Gemini API sorgusu yapılıyor...");
      const res = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: voipHistoryRef.current,
          curseMode: userProfile.curseMode,
          userAge: userProfile.age
        })
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      const reply = data.text || "Söylediğinizi tam anlayamadım, tekrar eder misiniz?";
      setAiSpeechOutput(reply);
      addDiagLog(`[YAPAY ZEKA] Yanıt alındı: "${reply.substring(0, 40)}..."`);

      const aiMsg = {
        id: `voip_ai_${Date.now()}`,
        sender: 'ai',
        text: reply,
        createdAt: Date.now()
      };
      voipHistoryRef.current.push(aiMsg);

      // Keep context limited to recent 14 entries plus the welcome banner
      if (voipHistoryRef.current.length > 15) {
        voipHistoryRef.current = [
          voipHistoryRef.current[0],
          ...voipHistoryRef.current.slice(-10)
        ];
      }

      addDiagLog(`[SES] "${userProfile.selectedVoice}" seslendirmeyi başlatıyor...`);
      speakText(reply, userProfile.selectedVoice, () => {
        updateAiTalking(false);
        addDiagLog("[SES OK] Seslendirme tamamlandı. Sistem dinlemede.");
        // Restart listen if voice mode stays green
        if (isVoiceActiveRef.current && rec) {
          try {
            rec.start();
          } catch (err) {}
        }
      });
    } catch (err: any) {
      console.error("VOIP Gemini error:", err);
      const fallback = "Parazit algılandı. Sunucuya ulaşılamıyor, lütfen tekrar deneyin.";
      setAiSpeechOutput(fallback);
      addDiagLog(`[HATA] Sunucu sorgu hatası: ${err.message}`);
      
      speakText(fallback, userProfile.selectedVoice, () => {
        updateAiTalking(false);
        if (isVoiceActiveRef.current && rec) {
          try {
            rec.start();
          } catch (err2) {}
        }
      });
    }
  };

  // Toggle Voice Recognition Conversation Mode
  const toggleVoiceMode = () => {
    if (isVoiceActiveRef.current) {
      addDiagLog("[SİSTEM] Voice mode kapatıldı.");
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      updateVoiceActive(false);
      updateAiTalking(false);
      stopSpeaking();
    } else {
      stopSpeaking();
      addDiagLog("[SİSTEM] Voice mode açıldı. Mikrofon hazırlanıyor...");
      updateVoiceActive(true);
      setIsUserMuted(false);
      isUserMutedRef.current = false;
      
      // Let's greet
      updateAiTalking(true);
      const greeting = `Ses kanalı aktif ${userProfile.displayName}! Seni dinliyorum. Konuşmaya başlayabilirsin.`;
      setAiSpeechOutput(greeting);
      addDiagLog(`[SİSTEM] Hoş geldiniz selamlaması okunuyor: "${greeting}"`);
      speakText(greeting, userProfile.selectedVoice, () => {
        updateAiTalking(false);
        addDiagLog("[SİSTEM OK] Mikrofon dinleme tüneli başlatıldı.");
        // Start listening after greet
        if (recognitionRef.current && isVoiceActiveRef.current) {
          try {
            recognitionRef.current.start();
          } catch (e) {
            addDiagLog(`[MİKROFON HATA] Kayıt başlatılamadı: ${e.message}`);
          }
        }
      });
    }
  };

  // Handle Speech Recognition setup (hands free continuous)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // @ts-ignore
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        const rec = new SpeechRecognition();
        rec.continuous = false; // single phrase to make conversation turn-based
        rec.lang = 'tr-TR';
        rec.interimResults = false;

        rec.onstart = () => {
          if (isUserMutedRef.current) {
            setTranscription('Sessiz (Kayıt duraklatıldı)...');
            addDiagLog("[MİKROFON] Kayıt açık fakat sesiniz mutelandı.");
          } else {
            setTranscription('Dinleniyor...');
            addDiagLog("[MİKROFON] Dinleme tüneli aktif, konuşun.");
          }
        };

        rec.onresult = (e: any) => {
          if (isUserMutedRef.current) {
            console.log("Muted. Ignoring input.");
            addDiagLog("[MİKROFON] Mute devrede olduğu için algılanan girdi yoksayıldı.");
            return;
          }
          const text = e.results[0][0].transcript;
          if (text) {
            setTranscription(text);
            addDiagLog(`[MİKROFON OK] Algılanan sözcükler: "${text}"`);
            queryGeminiVoip(text, rec);
          }
        };

        rec.onerror = (err: any) => {
          console.log('Voice session recognition error', err);
          addDiagLog(`[MİKROFON HATA] Hata kodu: ${err.error}`);
          if (err.error === 'no-speech') {
            // Restart if no speech to keep hands-free active
            if (isVoiceActiveRef.current && !aiTalkingRef.current) {
              setTimeout(() => {
                try {
                  if (isVoiceActiveRef.current && !aiTalkingRef.current) {
                    rec.start();
                  }
                } catch (e) {}
              }, 1000);
            }
          } else {
            setTranscription('Sinyal kesildi.');
          }
        };

        rec.onend = () => {
          addDiagLog("[MİKROFON KAPALI] Dinleme tüneli kapandı.");
          // Restart if voice mode stays active and AI is not currently speaking
          setTimeout(() => {
            if (isVoiceActiveRef.current && !aiTalkingRef.current) {
              try {
                rec.start();
              } catch (e) {}
            }
          }, 300);
        };

        recognitionRef.current = rec;
      }
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [userProfile]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/95 z-55 flex flex-col justify-between p-4 md:p-8 select-none font-sans overflow-hidden">
      {/* Immersive siber-punk backgrounds */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(6,182,212,0.12)_0%,transparent_70%)] pointer-events-none" />
      <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent" />

      {/* Top action bar */}
      <div className="flex justify-between items-center z-10 w-full">
        <div className="flex items-center gap-3">
          <Logo variant="circle" size="sm" />
          <div className="flex flex-col">
            <span className="text-xs font-black text-white uppercase tracking-widest italic flex items-center gap-2 leading-none">
              BENİM AI <span className="text-[9px] bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-black px-2 py-0.5 border border-purple-500 rounded-none not-italic tracking-widest shadow-sm shadow-purple-950/50">PRO</span>
            </span>
          </div>
        </div>

        <button
          onClick={handleClose}
          className="bg-[#0D0D0D] p-3 text-zinc-400 border border-white/10 hover:border-cyan-400/40 hover:text-cyan-400 transition-all rounded-none"
          title="Çıkış"
          id="btn_close_voip"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Integrated Live Screen Share & Camera Monitors Grid */}
      <div className="flex-1 my-6 grid grid-cols-1 lg:grid-cols-2 gap-6 items-center justify-center max-w-6xl mx-auto w-full z-10 overflow-y-auto">
        
        {/* VIEWPORT 1: Screen share portal */}
        <div className="relative border border-white/10 bg-[#060606] aspect-video w-full flex flex-col justify-between p-4 group overflow-hidden">
          <div className="absolute top-0 left-4 -translate-y-1/2 bg-black border border-white/10 text-[9px] text-cyan-400 font-mono uppercase px-2 py-0.5 tracking-widest">
            PORTAL [A] • CANLI EKRAN AKTARIMI
          </div>
          
          <div className="flex-grow flex items-center justify-center relative">
            <video 
              ref={screenRef} 
              autoPlay 
              playsInline 
              className={`w-full h-full object-contain ${isScreenActive ? 'block' : 'hidden'}`}
            />
            {!isScreenActive && (
              <div className="text-center space-y-3.5">
                <Monitor className="w-12 h-12 text-zinc-700 mx-auto animate-pulse" />
                <p className="text-[10px] text-zinc-500 font-mono tracking-widest uppercase">[ EKRAN PAYLAŞIMI ÇEVRİMDIŞI ]</p>
              </div>
            )}
          </div>

          <div className="flex justify-between items-center pt-2 border-t border-white/5 text-[9px] font-mono text-white/30 uppercase">
            <span>Sinyal hızı: 60 FPS</span>
            <button 
              onClick={toggleScreen}
              className={`px-3 py-1.5 text-[9px] font-black tracking-wider uppercase border transition-all ${
                isScreenActive 
                  ? 'bg-red-500/10 border-red-500 text-red-400' 
                  : 'bg-white/5 border-white/10 text-white hover:border-cyan-400 hover:text-cyan-400'
              }`}
              id="btn_toggle_screen"
            >
              {isScreenActive ? 'PAYLAŞIMI DURDUR' : 'EKRANIMI PAYLAŞ'}
            </button>
          </div>
        </div>

        {/* VIEWPORT 2: Camera Stream capture */}
        <div className="relative border border-white/10 bg-[#060606] aspect-video w-full flex flex-col justify-between p-4 group overflow-hidden">
          <div className="absolute top-0 left-4 -translate-y-1/2 bg-black border border-white/10 text-[9px] text-purple-400 font-mono uppercase px-2 py-0.5 tracking-widest">
            PORTAL [B] • CANLI KAMERA GÖZÜ
          </div>

          {/* Absolute Top Right Overlaid flipping camera button when active */}
          {isCameraActive && (
            <button
              onClick={switchCameraFacing}
              className="absolute top-3 right-3 bg-purple-950/90 hover:bg-purple-600 border border-purple-500/50 p-2 text-purple-400 hover:text-white transition-all z-20 rounded-none shadow-md cursor-pointer flex items-center gap-1.5 text-[9px] font-mono hover:scale-105"
              id="btn_top_right_camera_flip"
              title="Ön/Arka Kameraya Geç"
            >
              <RefreshCw className="w-3.5 h-3.5 text-purple-400" />
              <span>ÇEVİR ({cameraFacingMode === 'user' ? 'ARKA' : 'ÖN'})</span>
            </button>
          )}

          <div className="flex-grow flex items-center justify-center relative">
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              className={`w-full h-full object-cover transform -scale-x-100 ${isCameraActive ? 'block' : 'hidden'}`}
            />
            {!isCameraActive && (
              <div className="text-center space-y-3.5">
                <Camera className="w-12 h-12 text-zinc-700 mx-auto animate-pulse" />
                <p className="text-[10px] text-zinc-500 font-mono tracking-widest uppercase">[ CANLI KAMERA KAPALI ]</p>
              </div>
            )}
          </div>

          <div className="flex justify-between items-center pt-2 border-t border-white/5 text-[9px] font-mono text-white/30 uppercase">
            <span>Çözünürlük: FHD AUTO ({cameraFacingMode === 'user' ? 'ÖN KAMERA' : 'ARKA KAMERA'})</span>
            <div className="flex gap-2">
              {isCameraActive && (
                <button
                  onClick={switchCameraFacing}
                  className="px-2.5 py-1.5 text-[9px] font-black tracking-wider uppercase bg-white/5 border border-white/10 text-purple-400 hover:border-purple-400 hover:text-white transition-all rounded-none flex items-center gap-1"
                  id="btn_switch_camera_facing"
                  title="Kamerayı Ön/Arka Moduna Çevir"
                >
                  <RefreshCw className="w-3 h-3 text-purple-400" />
                  <span>Kamera Çevir</span>
                </button>
              )}
              <button 
                onClick={toggleCamera}
                className={`px-3 py-1.5 text-[9px] font-black tracking-wider uppercase border transition-all ${
                  isCameraActive 
                    ? 'bg-red-500/10 border-red-500 text-red-400' 
                    : 'bg-white/5 border-white/10 text-white hover:border-cyan-400 hover:text-cyan-400'
                }`}
                id="btn_toggle_live_camera"
              >
                {isCameraActive ? 'KAMERAYI KAPAT' : 'KAMERAYI AÇ'}
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* Bottom interactive vocal console area */}
      <div className="max-w-2xl w-full mx-auto bg-[#070707] border border-white/10 p-6 space-y-5 z-10 relative">
        <div className="absolute top-0 right-4 -translate-y-1/2 bg-black px-2 text-[8px] text-cyan-400 font-mono tracking-widest uppercase flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
          VOIP MODÜLÜ AKTİF
        </div>

        {/* Audio Waveform visualization */}
        <div className="h-16 flex items-center justify-center gap-1 bg-black/40 border border-white/5 p-2 overflow-hidden relative">
          {isVoiceActive ? (
            <div className="flex items-center gap-1.5 h-full">
              {[...Array(24)].map((_, i) => {
                const heightRand = aiTalking 
                  ? [24, 48, 16, 56, 32, 40, 12, 60][i % 8] 
                  : [8, 16, 32, 8, 40, 24, 12, 16][i % 8];
                const animDuration = aiTalking ? '0.4s' : '0.8s';

                return (
                  <div
                    key={i}
                    className={`w-1 rounded-full transition-all ${aiTalking ? 'bg-cyan-400' : 'bg-[#22D3EE]/30'}`}
                    style={{
                      height: `${heightRand}px`,
                      animationName: 'wave',
                      animationDuration: animDuration,
                      animationTimingFunction: 'ease-in-out',
                      animationIterationCount: 'infinite',
                      animationDirection: 'alternate',
                      animationDelay: `${i * 0.05}s`
                    }}
                  />
                );
              })}
            </div>
          ) : (
            <div className="h-[2px] w-4/5 bg-zinc-800" />
          )}
          <style>{`
            @keyframes wave {
              0% { transform: scaleY(0.4); }
              100% { transform: scaleY(1.3); }
            }
          `}</style>
        </div>

        {/* Interactive Speech & Reply outputs */}
        <div className="bg-[#030303] border border-white/5 p-4 rounded-none min-h-[4.5rem] flex flex-col justify-center text-center space-y-1.5">
          {isVoiceActive ? (
            <>
              <p className="text-[10px] text-cyan-400 tracking-wider font-mono uppercase">
                {aiTalking ? `Nova (${userProfile.selectedVoice}) Konuşuyor` : 'Seni Dinliyorum...'}
              </p>
              <p className="text-xs font-semibold text-zinc-300 italic tracking-wide">
                "{transcription || 'Lütfen konuşun...'}"
              </p>
              {aiSpeechOutput && (
                <p className="text-xs font-black text-white uppercase tracking-tight mt-1">
                  &gt; {aiSpeechOutput}
                </p>
              )}
            </>
          ) : (
            <div className="text-center text-zinc-500 space-y-1">
              <p className="text-xs font-black tracking-widest uppercase">SESLİ MUHABBET BAĞLANTISI YAPILMADI</p>
              <p className="text-[10px] uppercase font-mono tracking-wide">Yazı olmadan sadece konuşarak sohbet etmek için aşağıdaki mavi mikrofona basın.</p>
            </div>
          )}
        </div>

        {/* Primary speaking triggers */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 pt-2 border-t border-white/5">
          <div className="flex flex-wrap items-center gap-4 text-left">
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-cyan-400 shrink-0" />
              <span className="text-[10px] text-white/45 tracking-wider font-mono uppercase">
                Ses: <span className="text-white font-bold">{userProfile.selectedVoice.toUpperCase()}</span>
              </span>
            </div>

            {/* Live Call Speed Tuning */}
            <div className="flex items-center gap-2 border-l border-white/10 pl-3">
              <span className="text-[9px] text-white/40 uppercase tracking-wider font-mono">Okuma Hızı:</span>
              <div className="flex gap-1.5 pb-0.5">
                {[0.75, 1.0, 1.25, 1.5, 1.75].map((rate) => {
                  const currentRate = parseFloat(typeof window !== 'undefined' ? window.localStorage.getItem('voice_rate') || '1.1' : '1.1');
                  const isSelected = Math.abs(currentRate - rate) < 0.1;
                  return (
                    <button
                      key={rate}
                      type="button"
                      onClick={() => {
                        if (typeof window !== 'undefined') {
                          window.localStorage.setItem('voice_rate', rate.toString());
                          setTranscription(prev => prev); // force refresh parent
                          addDiagLog(`[Vokal Hız] Okuma hızı ${rate}x olarak ayarlandı.`);
                          speakText("Yeni okuma hızı test ediliyor.", userProfile.selectedVoice);
                        }
                      }}
                      className={`text-[9px] font-mono px-1.5 py-0.5 border cursor-pointer ${
                        isSelected 
                          ? 'bg-cyan-500 text-black border-cyan-400 font-bold' 
                          : 'bg-black/40 border-white/15 text-zinc-400 hover:text-white'
                      }`}
                    >
                      {rate.toFixed(2)}x
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Live Call Pitch Tuning */}
            <div className="flex items-center gap-2 border-l border-white/10 pl-3">
              <span className="text-[9px] text-white/40 uppercase tracking-wider font-mono">Ses Tonu:</span>
              <div className="flex gap-1.5 pb-0.5">
                {[0.5, 0.75, 1.0, 1.25, 1.5].map((pitch) => {
                  const currentPitch = parseFloat(typeof window !== 'undefined' ? window.localStorage.getItem('voice_pitch') || '1.0' : '1.0');
                  const isSelected = Math.abs(currentPitch - pitch) < 0.1;
                  return (
                    <button
                      key={pitch}
                      type="button"
                      onClick={() => {
                        if (typeof window !== 'undefined') {
                          window.localStorage.setItem('voice_pitch', pitch.toString());
                          setTranscription(prev => prev); // force refresh parent
                          addDiagLog(`[Vokal Perde] Ses modülasyonu ${pitch} olarak ayarlandı.`);
                          speakText("Yeni ses perdesi test ediliyor.", userProfile.selectedVoice);
                        }
                      }}
                      className={`text-[9px] font-mono px-1.5 py-0.5 border cursor-pointer ${
                        isSelected 
                          ? 'bg-cyan-500 text-black border-cyan-400 font-bold' 
                          : 'bg-black/40 border-white/15 text-zinc-400 hover:text-white'
                      }`}
                    >
                      {pitch === 0.5 ? 'Tok' : pitch === 1.5 ? 'İnce' : pitch.toFixed(2)}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Live Call Ambient Space Filter Noise */}
            <div className="flex items-center gap-2 border-l border-white/10 pl-3">
              <span className="text-[9px] text-white/40 uppercase tracking-wider font-mono">Telsiz Filtresi (Drone):</span>
              <button
                type="button"
                onClick={() => {
                  const nextDroneVal = !isSpaceDroneEnabled;
                  setIsSpaceDroneEnabled(nextDroneVal);
                  addDiagLog(`[Ambiyans Drone] Siber telsiz efekti ${nextDroneVal ? 'Açıldı' : 'Kapatıldı'}.`);
                }}
                className={`text-[9.5px] font-mono px-2 py-0.5 border cursor-pointer select-none transition-all ${
                  isSpaceDroneEnabled 
                    ? 'bg-purple-950/40 text-purple-400 border-purple-500 font-bold active:scale-95' 
                    : 'bg-black/40 border-white/15 text-zinc-450 hover:text-white hover:border-white/25 active:scale-95'
                }`}
              >
                {isSpaceDroneEnabled ? "AKTİF" : "KAPALI"}
              </button>
            </div>
          </div>

          <div className="flex gap-2 w-full sm:w-auto">
            {isVoiceActive && (
              <button
                type="button"
                onClick={toggleMute}
                className={`px-4 py-4 text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 border transition-all rounded-none ${
                  isUserMuted 
                    ? 'bg-amber-950/40 border-amber-500 text-amber-400' 
                    : 'bg-white/5 border-white/10 text-white hover:border-cyan-400 hover:text-cyan-400'
                }`}
                title="Sesi kapat ve dinlemeyi askıya al"
                id="btn_toggle_user_mute"
              >
                {isUserMuted ? <MicOff className="w-4 h-4 text-amber-500 animate-pulse" /> : <Mic className="w-4 h-4 text-cyan-400" />}
                <span>{isUserMuted ? "SESİ AÇ" : "SESİ KAPAT"}</span>
              </button>
            )}

            <button
              onClick={toggleVoiceMode}
              className={`flex-grow sm:flex-grow-0 px-6 py-4 text-xs font-black uppercase tracking-widest flex items-center justify-center gap-3 transition-all rounded-none ${
                isVoiceActive 
                  ? 'bg-red-500 text-white hover:bg-red-400 shadow-lg shadow-red-950/40' 
                  : 'bg-cyan-500 text-black hover:bg-cyan-400 hover:scale-105 shadow-lg shadow-cyan-950/40'
              }`}
              id="btn_toggle_voice_conversation"
            >
              {isVoiceActive ? (
                <>
                  <MicOff className="w-4 h-4" />
                  <span>KAPAT</span>
                </>
              ) : (
                <>
                  <Mic className="w-4 h-4" />
                  <span>SESLİ MUHABBET BAŞLAT</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
