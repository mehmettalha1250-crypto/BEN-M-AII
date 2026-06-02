/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, 
  Camera, 
  Mic, 
  MicOff, 
  HelpCircle, 
  Volume2, 
  VolumeX, 
  Image as ImageIcon, 
  Paperclip,
  X,
  Sparkles,
  RefreshCw,
  Video,
  Loader2,
  MoreHorizontal
} from 'lucide-react';
import { Message, UserProfile } from '../types';
import { speakText, stopSpeaking, isSpeaking } from '../utils/speak';
import Logo from './Logo';

const SafeImage = ({ src, alt, className }: { src: string; alt: string; className: string }) => {
  const [loaded, setLoaded] = useState(false);
  return (
    <div className="relative min-h-[160px] w-full bg-[#050505] flex items-center justify-center overflow-hidden border border-white/5">
      {!loaded && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-3 bg-[#070707] z-10 animate-pulse">
          <Loader2 className="w-5 h-5 text-cyan-400 animate-spin mb-1.5" />
          <span className="text-[9px] font-bold text-cyan-400/80 tracking-widest uppercase font-mono">GÖRSEL YÜKLENİYOR...</span>
        </div>
      )}
      <img
        src={src}
        alt={alt}
        className={`${className} transition-all duration-300 ${loaded ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}
        onLoad={() => setLoaded(true)}
        referrerPolicy="no-referrer"
      />
    </div>
  );
};

interface ChatViewProps {
  messages: Message[];
  onSendMessage: (text: string, image?: { mimeType: string; base64Data: string } | null) => void;
  isGenerating: boolean;
  userProfile: UserProfile;
  onOpenVoip: () => void;
}

export default function ChatView({
  messages,
  onSendMessage,
  isGenerating,
  userProfile,
  onOpenVoip
}: ChatViewProps) {
  const [inputText, setInputText] = useState('');
  const [isDictating, setIsDictating] = useState(false);
  const [activeSpeechId, setActiveSpeechId] = useState<string | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
  // Auto speak preference stored in localStorage
  const [autoSpeak, setAutoSpeak] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('nova_chat_auto_speak') === 'true';
    }
    return false;
  });

  // Diagnostic states
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [diagLogs, setDiagLogs] = useState<string[]>(['[00:00:00] Teşhis paneli başlatıldı.']);
  const [micPermission, setMicPermission] = useState<string>('Bilinmiyor');

  const addDiagLog = (message: string) => {
    const time = new Date().toLocaleTimeString();
    setDiagLogs(prev => [...prev, `[${time}] ${message}`].slice(-25));
  };

  const toggleAutoSpeak = () => {
    const nextVal = !autoSpeak;
    setAutoSpeak(nextVal);
    if (typeof window !== 'undefined') {
      localStorage.setItem('nova_chat_auto_speak', nextVal ? 'true' : 'false');
    }
    addDiagLog(`[AYAR] Otomatik sesli yanıt okuma ${nextVal ? 'AKTİF edildi.' : 'KAPATILDI.'}`);
  };

  useEffect(() => {
    addDiagLog("Sistem donanım taraması başlatılıyor...");
    if (typeof window !== 'undefined') {
      if ('speechSynthesis' in window) {
        addDiagLog("[OK] Hoparlör (SpeechSynthesis) sistemi aktif.");
        addDiagLog(`[BİLGİ] Kayıtlı sistem sesleri sayısı: ${window.speechSynthesis.getVoices().length}`);
      } else {
        addDiagLog("[HATA] Hoparlör (SpeechSynthesis) sistem tarafından desteklenmiyor!");
      }

      // @ts-ignore
      const SpeechReq = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechReq) {
        addDiagLog("[OK] Mikrofon (SpeechRecognition) sistemi aktif.");
      } else {
        addDiagLog("[HATA] Mikrofon (SpeechRecognition) bu tarayıcıda desteklenmiyor.");
      }

      if (navigator.permissions && navigator.permissions.query) {
        navigator.permissions.query({ name: 'microphone' as any })
          .then((status) => {
            setMicPermission(status.state);
            addDiagLog(`[BİLGİ] Mikrofon donanım izni: ${status.state.toUpperCase()}`);
            status.onchange = () => {
              setMicPermission(status.state);
              addDiagLog(`[İZİN DEĞİŞTİ] Yeni izin: ${status.state.toUpperCase()}`);
            };
          })
          .catch(err => {
            addDiagLog(`[İZİN HATA] İzin sorgulama yapılamadı: ${err.message}`);
          });
      }
    }
  }, []);

  const handleTestSpeaker = () => {
    addDiagLog("[HOPARLÖR TEST] Seslendirme testi tetikleniyor...");
    speakText("Sinyal kalitesi mükemmel! Ses testi başarıyla tamamlandı. Benim AI sizi duyabiliyor ve cevap verebiliyor.", userProfile?.selectedVoice || 'Selin', () => {
      addDiagLog("[HOPARLÖR TEST] Test tamamlandı.");
    });
  };

  // Camera capture states
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [attachedImage, setAttachedImage] = useState<{ mimeType: string; base64Data: string } | null>(null);

  // References
  const messageEndRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<any>(null);

  // Auto scroll and automatic speech playback trigger
  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });

    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.sender === 'ai' && !lastMessage.id.startsWith('msg_status_') && autoSpeak) {
        // Trigger speaking dynamically!
        if (activeSpeechId !== lastMessage.id) {
          handleReadLatest(lastMessage.id, lastMessage.text);
        }
      }
    }
  }, [messages, autoSpeak]);

  // Clean speaking on unmount
  useEffect(() => {
    return () => {
      stopSpeaking();
    };
  }, []);

  // Initialize Speech recognition for Speech-to-Text in Turkish
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // @ts-ignore
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.lang = 'tr-TR';
        recognition.interimResults = false;

        recognition.onstart = () => {
          setIsDictating(true);
          addDiagLog("[MİKROFON] Dinleme tüneli aktif. Konuşmanız dinleniyor...");
        };

        recognition.onresult = (e: any) => {
          const resultText = e.results[0][0].transcript;
          if (resultText) {
            setInputText(prev => prev ? `${prev} ${resultText}` : resultText);
            addDiagLog(`[MİKROFON ALINDI] Yazıya döküldü: "${resultText}"`);
          }
        };

        recognition.onerror = (e: any) => {
          console.error('Speech recognition error:', e);
          setIsDictating(false);
          addDiagLog(`[MİKROFON HATASI] Kod: ${e.error}. Lütfen mikrofon izinlerini teyit edin.`);
        };

        recognition.onend = () => {
          setIsDictating(false);
          addDiagLog("[MİKROFON KAPALI] Dinleme tüneli sonlandırıldı.");
        };

        recognitionRef.current = recognition;
      }
    }
  }, []);

  const handleStartDictation = () => {
    if (recognitionRef.current) {
      if (isDictating) {
        recognitionRef.current.stop();
      } else {
        stopSpeaking();
        recognitionRef.current.start();
      }
    } else {
      alert('Ses tanıma tarayıcınız tarafından desteklenmiyor. Lütfen Chrome deneyin.');
    }
  };

  // ----------------------------------------------------
  // CAMERA INTEGRATION CODES
  // ----------------------------------------------------
  const handleToggleCamera = async () => {
    if (isCameraActive) {
      stopCamera();
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'environment' } // Prefer back camera (perfect for question solving on tablet/mobile!)
        });
        mediaStreamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setIsCameraActive(true);
      } catch (err) {
        console.error('Kamera başlatılamadı:', err);
        alert('Kamera izni verilmedi veya cihazda kamera bulunamadı.');
      }
    }
  };

  const stopCamera = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const captureFrame = () => {
    if (videoRef.current) {
      const vid = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = vid.videoWidth || 640;
      canvas.height = vid.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(vid, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        const base64Data = dataUrl.split(',')[1];
        setAttachedImage({
          mimeType: 'image/jpeg',
          base64Data
        });
        stopCamera();
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        const base64Data = result.split(',')[1];
        setAttachedImage({
          mimeType: file.type || 'image/jpeg',
          base64Data
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSend = () => {
    const textToSend = inputText.trim();
    if (!textToSend && !attachedImage) return;

    onSendMessage(textToSend || 'Fotoğrafı inceleyebilir misin?', attachedImage);
    setInputText('');
    setAttachedImage(null);
  };

  // Text playback selector
  const handleReadLatest = (msgId: string, text: string) => {
    if (activeSpeechId === msgId) {
      stopSpeaking();
      setActiveSpeechId(null);
      addDiagLog("[HOPARLÖR] Seslendirme durduruldu.");
    } else {
      setActiveSpeechId(msgId);
      addDiagLog(`[HOPARLÖR] "${userProfile.selectedVoice}" karakteri metni okuyor (${text.length} karakter)...`);
      speakText(text, userProfile.selectedVoice, () => {
        setActiveSpeechId(null);
        addDiagLog("[HOPARLÖR OK] Seslendirme tamamlandı.");
      });
    }
  };

  // Helper inside renderer to find code snippets
  const renderMessageContent = (text: string) => {
    // Regex looking for markdown ```codeBlocks```
    const regex = /```([\s\S]*?)```/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
      const matchIndex = match.index;
      if (matchIndex > lastIndex) {
        parts.push({ type: 'text', content: text.substring(lastIndex, matchIndex) });
      }
      parts.push({ type: 'code', content: match[1] });
      lastIndex = regex.lastIndex;
    }

    if (lastIndex < text.length) {
      parts.push({ type: 'text', content: text.substring(lastIndex) });
    }

    if (parts.length === 0) {
      return <p className="leading-relaxed whitespace-pre-wrap">{text}</p>;
    }

    return (
      <div className="space-y-2">
        {parts.map((p, i) => {
          if (p.type === 'code') {
            const lines = p.content.trim().split('\n');
            const lang = lines[0].length < 10 ? lines[0] : '';
            const code = lang ? lines.slice(1).join('\n') : p.content;

            return (
              <div key={i} className="border border-zinc-800 rounded-lg overflow-hidden my-3 font-mono text-xs shadow-md">
                <div className="bg-zinc-900 px-4 py-2 flex justify-between items-center text-[10px] text-zinc-500 font-bold uppercase tracking-wider border-b border-zinc-800">
                  <span>{lang || 'KOD'}</span>
                  <span>Kopyala</span>
                </div>
                <pre className="p-4 bg-zinc-950 overflow-x-auto text-emerald-400">
                  <code>{code}</code>
                </pre>
              </div>
            );
          }
          return (
            <p key={i} className="leading-relaxed whitespace-pre-wrap text-zinc-200">
              {p.content}
            </p>
          );
        })}
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#050505] relative animate-fade-in" id="chat_view_canvas">
      
      {/* High-Tech Siber-Canlı Üst Durum ve Ses Kontrol Paneli */}
      <div className="border-b border-white/10 bg-black/95 px-4 md:px-8 py-3.5 flex flex-wrap gap-4 items-center justify-between z-20 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <div className="space-y-0.5">
            <span className="text-[9px] uppercase tracking-[0.2em] text-white/45 font-mono font-bold leading-none block">YAPAY ZEKA AKTİF SİNYAL PORTALİ</span>
            <span className="text-xs uppercase font-serif tracking-tight text-white font-semibold">
              Karakter: <span className="text-cyan-400 font-bold font-sans">{userProfile.selectedVoice.toUpperCase()}</span>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Otomatik Metin Seslendirme Togglesi (Auto-Speech) */}
          <button
            onClick={toggleAutoSpeak}
            className={`flex items-center gap-2 px-3.5 py-1.5 border transition-all cursor-pointer font-bold text-[10px] tracking-widest uppercase rounded-none ${
              autoSpeak 
                ? 'bg-[#0E201B] border-emerald-500 text-emerald-300 shadow-md shadow-emerald-950/25' 
                : 'bg-[#080808] border-white/10 text-zinc-400 hover:text-white hover:border-white/20'
            }`}
            id="btn_toggle_auto_speak"
            title="Gelen yapay zeka cevaplarını otomatik seslendir"
          >
            {autoSpeak ? (
              <>
                <Volume2 className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                <span className="flex items-center gap-1.5">
                  OTOMATİK SESLANDİRME: <span className="text-emerald-300 font-black">AÇIK</span>
                </span>
              </>
            ) : (
              <>
                <VolumeX className="w-3.5 h-3.5 text-zinc-500" />
                <span>OTOMATİK SESLANDİRME: KAPALI</span>
              </>
            )}
          </button>

          {/* Hands-Free Görüntülü ve Sesli Sohbet Başlat */}
          <button
            onClick={onOpenVoip}
            className="flex items-center gap-2 px-3.5 py-1.5 bg-gradient-to-r from-cyan-650 to-blue-650 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-[10px] tracking-widest uppercase border border-cyan-400/30 hover:border-cyan-300 shadow-lg shadow-cyan-950/40 rounded-none cursor-pointer"
            id="btn_launch_live_voip_header"
            title="Mikrofon ve kamera tüneliyle canlı konuşmaya başla"
          >
            <Mic className="w-3.5 h-3.5" />
            <span>SESLİ SOHBET (VOIP)</span>
          </button>
        </div>
      </div>
      
      {/* Active dialog Feed */}
      <div className="flex-grow overflow-y-auto px-4 md:px-8 py-6 space-y-6">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto space-y-5 px-4">
            <Logo variant="circle" size="xl" showText={false} className="justify-center" />
            <div>
              <h2 className="text-xl font-black uppercase tracking-tight text-white italic">BENİM AI</h2>
            </div>
          </div>
        ) : (
          messages.map((m) => {
            const isUser = m.sender === 'user';
            return (
              <div
                key={m.id}
                className={`flex gap-3 max-w-3xl ${isUser ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}
                id={`message_card_${m.id}`}
              >
                {/* Profile Circle icon */}
                <div className={`w-8 h-8 rounded-none shrink-0 flex items-center justify-center font-bold text-[10px] uppercase font-mono tracking-widest ${
                  isUser 
                    ? 'bg-white/10 text-white border border-white/25' 
                    : 'bg-cyan-600/20 text-cyan-400 border border-cyan-400/35'
                }`}>
                  {isUser ? 'SEN' : 'AI'}
                </div>

                <div className="space-y-1.5 min-w-0 flex-1">
                  {/* Speech balloon content */}
                  <div className={`p-4 rounded-none relative border ${
                    isUser
                      ? 'bg-white/10 border-white/20 text-white'
                      : 'bg-white/5 border-white/10 border-l-2 border-l-cyan-400 text-white'
                    }`}
                  >
                    {/* Render attachment if message was image-based */}
                    {m.imageUrl && (
                      <div className="mb-3 max-w-sm rounded-none border border-white/10 bg-black">
                        <SafeImage 
                          src={m.imageUrl} 
                          alt="Görsel ek" 
                          className="max-h-60 object-contain w-full"
                        />
                      </div>
                    )}

                    {/* Render attachment if message has video results */}
                    {m.videoUrl && (
                      <div className="mb-3 max-w-md rounded-none border border-white/10 bg-black relative aspect-video overflow-hidden">
                        <video
                          src={m.videoUrl} 
                          controls
                          loop
                          playsInline
                          className="w-full h-full object-cover max-h-80"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    )}

                    {renderMessageContent(m.text)}
                  </div>

                  {/* Message Actions */}
                  {!isUser && (
                    <div className="flex items-center gap-3 px-1">
                      <button
                        onClick={() => handleReadLatest(m.id, m.text)}
                        className={`flex items-center gap-1.5 text-[9px] uppercase tracking-widest transition-all ${
                          activeSpeechId === m.id
                            ? 'text-cyan-400 font-black'
                            : 'text-zinc-500 hover:text-cyan-300 font-bold'
                        }`}
                        id={`btn_voice_playback_${m.id}`}
                      >
                        {activeSpeechId === m.id ? (
                          <>
                            <VolumeX className="w-3.5 h-3.5 text-cyan-400 animate-bounce" />
                            <span>Sustur</span>
                          </>
                        ) : (
                          <>
                            <Volume2 className="w-3.5 h-3.5" />
                            <span>Seslendir</span>
                          </>
                        )}
                      </button>
                      
                      <span className="text-[8px] text-zinc-650 tracking-widest font-mono uppercase">
                        Sinyal: {userProfile.selectedVoice.toUpperCase()}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}

        {isGenerating && (
          <div className="flex gap-3 max-w-xs mr-auto">
            <div className="w-8 h-8 rounded-none bg-cyan-500/10 border border-cyan-400/30 flex items-center justify-center">
              <RefreshCw className="w-4 h-4 text-cyan-400 animate-spin" />
            </div>
            <div className="bg-white/5 border border-white/10 border-l-2 border-l-purple-400 p-4 rounded-none">
              <span className="text-zinc-400 text-xs font-mono uppercase tracking-widest animate-pulse">Sinyal işleniyor...</span>
            </div>
          </div>
        )}

        <div ref={messageEndRef} />
      </div>
      {isCameraActive && (
        <div className="absolute inset-0 bg-black/95 z-50 flex flex-col justify-between p-6">
          <div className="flex justify-between items-center">
            <span className="text-xs text-white tracking-widest font-mono flex items-center gap-2">
              <Video className="w-4 h-4 text-cyan-400 animate-pulse" />
              CANLI KAMERA (SORU ÇÖZ & GÖRSEL ANALİZ)
            </span>
            <button 
              onClick={stopCamera} 
              className="bg-[#0A0A0A] text-zinc-400 p-2.5 rounded-none border border-white/10 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="max-h-[60vh] max-w-xl mx-auto rounded-none overflow-hidden border border-white/10 bg-black shadow-2xl relative w-full flex items-center justify-center">
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              className="w-full object-cover aspect-video bg-black transform -scale-x-100"
            />
          </div>

          <div className="flex flex-col items-center gap-3">
            <button
              onClick={captureFrame}
              className="w-16 h-16 rounded-full bg-cyan-400 hover:bg-cyan-300 flex items-center justify-center shadow-lg shadow-cyan-950/50 active:scale-95 transition-all text-black border-2 border-white"
            >
              <Camera className="w-8 h-8" />
            </button>
            <p className="text-[10px] text-white/40 font-mono uppercase tracking-widest">[ FOTOĞRAF ÇEK VE ANALİZE GÖNDER ]</p>
          </div>
        </div>
      )}

      {/* Input Tray Area */}
      <div className="p-6 bg-gradient-to-t from-[#050505] to-transparent space-y-3 shrink-0">
        
        {/* Attachment and capture review bar */}
        {attachedImage && (
          <div className="flex items-center justify-between bg-[#0A0A0A] border border-white/10 p-3 rounded-none max-w-md mx-auto">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-black border border-white/10 rounded-none overflow-hidden">
                <img 
                  src={`data:${attachedImage.mimeType};base64,${attachedImage.base64Data}`} 
                  alt="Ektedir" 
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div>
                <span className="text-xs text-cyan-400 font-bold block uppercase tracking-wider">GÖRSEL EKLENDİ</span>
                <span className="text-[9px] text-zinc-500 block uppercase tracking-wide">Yapay zeka analizine hazır</span>
              </div>
            </div>
            <button 
              onClick={() => setAttachedImage(null)} 
              className="bg-black p-2 rounded-none border border-white/10 text-zinc-400 hover:text-red-400"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Input Controls */}
        <div className="max-w-4xl mx-auto bg-white/5 border border-white/10 p-2 flex items-center gap-2 rounded-none">
          {/* File input activator */}
          <div className="flex gap-1 shrink-0 relative">
            <button
              onClick={handleToggleCamera}
              className="text-white/40 hover:text-cyan-400 p-2.5 transition-colors"
              title="Kamerayı Aç"
              id="btn_open_camera"
            >
              <Camera className="w-5 h-5" />
            </button>

            <label className="text-white/40 hover:text-purple-400 p-2.5 transition-colors cursor-pointer">
              <Paperclip className="w-5 h-5" />
              <input 
                type="file" 
                accept="image/*" 
                onChange={handleFileChange} 
                className="hidden" 
              />
            </label>

            {/* Floating Action Dropdown Button */}
            <button
              type="button"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className={`p-2.5 transition-colors cursor-pointer ${
                isMenuOpen ? 'text-cyan-400 font-bold scale-105' : 'text-white/40 hover:text-cyan-400'
              }`}
              id="btn_open_quick_menu"
              title="Hızlı Eylemler"
            >
              <MoreHorizontal className="w-5 h-5" />
            </button>

            {/* Quick Actions Panel */}
            {isMenuOpen && (
              <div 
                className="absolute left-0 bottom-14 bg-black border border-white/10 p-2 w-56 flex flex-col gap-1 z-50 shadow-2xl animate-fade-in"
                id="quick_actions_dropdown"
              >
                <div className="px-2.5 py-1.5 border-b border-white/5 text-[8px] text-white/30 font-mono uppercase tracking-widest leading-none mb-1">
                  MİKRO SÜREÇ MENÜSÜ
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false);
                    handleToggleCamera();
                  }}
                  className="flex items-center gap-2 text-left text-[10px] font-bold uppercase tracking-wider text-zinc-300 hover:text-white hover:bg-white/5 px-2 py-2 transition-all rounded-none"
                >
                  <Camera className="w-4 h-4 text-cyan-400" />
                  <span>Kamerayla Çek</span>
                </button>

                <label className="flex items-center gap-2 text-left text-[10px] font-bold uppercase tracking-wider text-zinc-300 hover:text-white hover:bg-white/5 px-2 py-2 cursor-pointer transition-all rounded-none">
                  <Paperclip className="w-4 h-4 text-purple-400" />
                  <span>Dosya Gönder</span>
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={(e) => {
                      setIsMenuOpen(false);
                      handleFileChange(e);
                    }} 
                    className="hidden" 
                  />
                </label>

                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false);
                    setInputText(prev => prev ? `${prev} görsel oluştur` : 'görsel oluştur');
                    addDiagLog("[KOLAYLIK] Görsel oluştur komutu eklendi.");
                  }}
                  className="flex items-center gap-2 text-left text-[10px] font-bold uppercase tracking-wider text-zinc-300 hover:text-white hover:bg-white/5 px-2 py-2 transition-all rounded-none border-t border-white/5"
                >
                  <Sparkles className="w-4 h-4 text-yellow-400 animate-pulse" />
                  <span>Görsel Oluştur</span>
                </button>
              </div>
            )}
          </div>

          {/* Text Input Block */}
          <div className="flex-1 relative flex items-center min-w-0">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              className="w-full bg-transparent border-none focus:outline-none focus:ring-0 text-xs font-semibold text-zinc-100 placeholder-white/20 py-2.5 pr-10"
              placeholder={attachedImage ? "Ekli görsel hakkında bir soru yazın..." : "Mesaj yazın veya bir komut girin..."}
            />
            {/* Transcription Mic Trigger inside Input */}
            <button
              onClick={handleStartDictation}
              className={`absolute right-1 p-2 transition-all ${
                isDictating 
                  ? 'text-red-400 animate-pulse' 
                  : 'text-white/30 hover:text-cyan-400'
              }`}
              title="Sesle Konuş (STT)"
              id="btn_mic_input"
            >
              {isDictating ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
          </div>

          <button
            onClick={handleSend}
            disabled={!inputText.trim() && !attachedImage}
            className="px-5 py-2.5 bg-white text-black text-xs font-black uppercase tracking-widest hover:bg-cyan-400 disabled:bg-white/5 disabled:text-white/20 transition-all rounded-none shrink-0"
            id="btn_send_message"
          >
            <span>Gönder</span>
          </button>

          {/* Glowing Moon Logo button for VOIP session */}
          <button
            onClick={onOpenVoip}
            className="p-1 px-1.5 bg-gradient-to-tr from-cyan-950/40 to-blue-900/10 border border-cyan-500/30 hover:border-cyan-400 transition-all rounded-none hover:scale-105 shrink-0 flex items-center justify-center relative group"
            title="Canlı Akış ve Sesli Sohbet (Eller Serbest)"
            type="button"
            id="btn_trigger_voip"
          >
            <div className="absolute inset-0 bg-cyan-400/5 group-hover:animate-ping rounded-none pointer-events-none" />
            <Logo variant="circle" size="xs" />
          </button>
        </div>
      </div>
    </div>
  );
}
