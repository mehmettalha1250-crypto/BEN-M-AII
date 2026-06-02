/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Plus, 
  Sparkles, 
  Download, 
  Video, 
  Image as ImageIcon, 
  CheckCircle2, 
  Loader2,
  Clock,
  ExternalLink,
  Trash2,
  Volume2,
  VolumeX
} from 'lucide-react';
import { Generation, UserProfile } from '../types';
import { speakText, stopSpeaking } from '../utils/speak';

const StudioImageWithLoader = ({ src, alt, className, blur }: { src: string; alt: string; className: string; blur?: boolean }) => {
  const [loaded, setLoaded] = useState(false);
  return (
    <div className="relative w-full h-full bg-[#050505] flex items-center justify-center min-h-[200px] w-full">
      {!loaded && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#070707] z-10">
          <Loader2 className="w-6 h-6 text-cyan-400/80 animate-spin mb-1.5" />
          <span className="text-[10px] font-black tracking-widest text-cyan-400/80 uppercase font-mono">YÜKLENİYOR...</span>
        </div>
      )}
      <img
        src={src}
        alt={alt}
        className={`${className} transition-all duration-500 ${loaded ? 'opacity-100 scale-100' : 'opacity-0 scale-95'} ${blur ? 'blur-sm brightness-50' : ''}`}
        onLoad={() => setLoaded(true)}
        referrerPolicy="no-referrer"
      />
    </div>
  );
};

interface StudioViewProps {
  userProfile: UserProfile;
  userGenerations: Generation[];
  onGenerateImage: (prompt: string, model?: 'openai' | 'gemini') => Promise<void>;
  onGenerateVideo: (prompt: string) => Promise<void>;
  isGeneratingImage: boolean;
  isGeneratingVideo: boolean;
  dailyImagesUsed: number;
  dailyVideosUsed: number;
  onDeleteGeneration: (id: string) => void;
  onEnhanceGeneration: (g: Generation) => Promise<void>;
}

export default function StudioView({
  userProfile,
  userGenerations,
  onGenerateImage,
  onGenerateVideo,
  isGeneratingImage,
  isGeneratingVideo,
  dailyImagesUsed,
  dailyVideosUsed,
  onDeleteGeneration,
  onEnhanceGeneration
}: StudioViewProps) {
  const [prompt, setPrompt] = useState('');
  const [mode, setMode] = useState<'image' | 'video'>('image');
  const [imageModel, setImageModel] = useState<'openai' | 'gemini'>('openai');
  const [statusMessage, setStatusMessage] = useState('');
  const [enhancingIds, setEnhancingIds] = useState<Record<string, boolean>>({});
  const [downloadSuccessId, setDownloadSuccessId] = useState<string | null>(null);

  // Sound/TTS narration states
  const [activeVoiceId, setActiveVoiceId] = useState<string | null>(null);

  const handleReadPromptAloud = (id: string, text: string) => {
    if (activeVoiceId === id) {
      stopSpeaking();
      setActiveVoiceId(null);
    } else {
      setActiveVoiceId(id);
      speakText(`Bu eserin açıklaması: ${text}`, userProfile.selectedVoice || 'Selin', () => {
        setActiveVoiceId(null);
      });
    }
  };

  const handleEnhance = async (g: Generation) => {
    setEnhancingIds(prev => ({ ...prev, [g.id]: true }));
    try {
      await onEnhanceGeneration(g);
    } catch (e: any) {
      alert("Hata: Çözünürlük arttırılamadı! " + e.message);
    } finally {
      setEnhancingIds(prev => ({ ...prev, [g.id]: false }));
    }
  };

  const isUnderage = userProfile.age < 18;

  // Visual messages to show while waiting for the model
  const mockStatusMessages = [
    "Karakterler çiziliyor...",
    "Kompozisyon ışıkları ayarlanıyor...",
    "İleri düzey yapay zeka pikselleri 4K kalitesinde işleniyor...",
    "Detaylar fotogerçekçi düzeye çıkartılıyor...",
    "Sanatsal dokular ve derinlik matrisi yükleniyor..."
  ];

  const triggerStatusUpdates = () => {
    let index = 0;
    setStatusMessage(mockStatusMessages[0]);
    const interval = setInterval(() => {
      index = (index + 1) % mockStatusMessages.length;
      setStatusMessage(mockStatusMessages[index]);
    }, 2200);
    return interval;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    const interval = triggerStatusUpdates();

    try {
      if (mode === 'image') {
        // IMAGE LIMITS ARE FULLY REMOVED AS REQUESTED (SINIRSIZ GÖRSEL)
        await onGenerateImage(prompt, imageModel);
      } else {
        await onGenerateVideo(prompt);
      }
      setPrompt('');
    } catch (err: any) {
      alert("Kuşak içi sunucu hatası: " + err.message);
    } finally {
      clearInterval(interval);
      setStatusMessage('');
    }
  };

  // ----------------------------------------------------
  // HIGH-QUALITY DIRECT DOWNLOAD UTILITY
  // ----------------------------------------------------
  const handleDownload = async (url: string, filename: string, id: string) => {
    try {
      const response = await fetch(url);
      const blob = response.ok ? await response.blob() : null;
      if (!blob) throw new Error("Fetch failed");
      const blobUrl = window.URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);

      setDownloadSuccessId(id);
      setTimeout(() => setDownloadSuccessId(null), 3500);
    } catch (e) {
      // In case CORS restrictions block local direct fetches, open in a new tab as fallback
      window.open(url, '_blank');
      setDownloadSuccessId(id);
      setTimeout(() => setDownloadSuccessId(null), 3500);
    }
  };

  // Only show user-made custom generations, removing PREMADE_GALLERY example photos entirely!
  const combinedGallery = userGenerations.filter(g => g.type === 'image');

  return (
    <div className="flex-grow overflow-y-auto px-4 md:px-8 py-6 bg-[#050505] text-white font-sans" id="studio_workshop_panel">
      
      {/* Workshop Header Banner */}
      <div className="bg-gradient-to-r from-[#0A0A0A] to-purple-950/20 border border-white/10 p-6 rounded-none relative overflow-hidden mb-6">
        <div className="relative z-10 max-w-xl space-y-2.5">
          <div className="inline-flex items-center gap-1.5 bg-cyan-500/10 border border-cyan-400/30 px-2.5 py-1 rounded-none text-[10px] text-cyan-400 font-bold tracking-widest uppercase">
            <Sparkles className="w-3.5 h-3.5" />
            <span>KREATİF SİNYAL JENERATÖRÜ</span>
          </div>
          <h2 className="text-xl md:text-2xl font-black uppercase tracking-tight italic text-white">HAYAL ET, BENİM AI ÜRETSİN</h2>
          <p className="text-zinc-400 text-xs leading-relaxed font-mono uppercase tracking-wide">
            [ SINIRSIZ GÖRSEL ÜRETİMİ • 4K ULTRA HD ] Dijital sanat tasarımları ve özel ultra ayrıntılı fotoğraflar geliştirmek için komut girin.
          </p>
        </div>
        <div className="absolute right-0 bottom-0 opacity-10 pointer-events-none transform translate-y-6">
          <Sparkles className="w-60 h-60 text-cyan-400" />
        </div>
      </div>

      {/* Generator Form block */}
      <div className="bg-[#0A0A0A] border border-white/10 p-5 rounded-none mb-8">
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Görsel Çizim Motoru Seçimi */}
          <div className="space-y-1.5">
            <span className="text-[9px] text-white/40 tracking-[0.2em] font-sans font-bold block uppercase">YAPAY ZEKA MODELİ</span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setImageModel('openai')}
                className={`py-2 px-3 text-[10px] font-bold font-mono uppercase tracking-wider transition-all border ${
                  imageModel === 'openai'
                    ? 'bg-cyan-500/10 text-cyan-400 border-cyan-400/50'
                    : 'bg-[#050505] text-zinc-500 border-white/10 hover:border-white/20 hover:text-zinc-300'
                }`}
              >
                DALL-E 3
              </button>
              <button
                type="button"
                onClick={() => setImageModel('gemini')}
                className={`py-2 px-3 text-[10px] font-bold font-mono uppercase tracking-wider transition-all border ${
                  imageModel === 'gemini'
                    ? 'bg-cyan-500/10 text-cyan-400 border-cyan-400/50'
                    : 'bg-[#050505] text-zinc-500 border-white/10 hover:border-white/20 hover:text-zinc-300'
                }`}
              >
                Imagen 3
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[9px] text-white/40 tracking-[0.2em] font-sans font-bold block uppercase">KREATİF GÖRSEL KOMUT VE TARİF METNİ</label>
            <div className="relative flex items-center">
              <input
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                maxLength={400}
                className="w-full bg-[#050505] border border-white/10 p-3.5 rounded-none text-xs font-semibold text-zinc-100 placeholder-white/20 focus:outline-none focus:border-cyan-400/80"
                placeholder="Örn: Siberpunk İstanbul manzarası, pembe neon bulutlar..."
              />
              <button
                type="submit"
                disabled={isGeneratingImage}
                className="absolute right-2 bg-white text-black hover:bg-cyan-400 hover:text-black p-2 px-4 rounded-none text-[10px] font-black tracking-widest uppercase transition-colors flex items-center gap-1.5 cursor-pointer"
                id="btn_submit_generation"
              >
                {isGeneratingImage ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-black" />
                ) : (
                  <>
                    <Sparkles className="w-3 h-3 text-black" />
                    <span>Üret</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>

        {/* Generator Status Loader overlays */}
        {isGeneratingImage && (
          <div className="mt-5 p-4 bg-[#050505] border border-white/10 rounded-none space-y-3.5">
            <div className="flex items-center gap-3">
              <Loader2 className="w-5 h-5 text-cyan-400 animate-spin shrink-0" />
              <div>
                <span className="text-xs font-bold text-white uppercase tracking-wider block">
                  YAPAY ZEKA GÖRSEL SİNYALİ ETKİN
                </span>
                <span className="text-[9px] text-white/40 block font-mono">İŞLEM SÜRÜYOR. YAPAY ZEKA GÖRSELİ ÇİZİYOR...</span>
              </div>
            </div>
            {/* Context status updates */}
            {statusMessage && (
              <div className="bg-[#050505] border border-white/10 p-2 text-[10px] text-cyan-400 rounded-none font-bold flex items-center gap-1.5 font-mono uppercase tracking-wide">
                <Clock className="w-3.5 h-3.5 animate-pulse" />
                <span>{statusMessage}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* AI Gallery Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-white/40 uppercase tracking-[0.2em]">YAPAY ZEKA SANAT GALERİSİ</span>
            <span className="text-[10px] bg-[#0A0A0A] border border-white/10 text-cyan-400 px-2.5 py-0.5 font-mono font-bold tracking-wider uppercase">
              {combinedGallery.length} ÖĞE KAYITLI
            </span>
          </div>
        </div>

        {combinedGallery.length === 0 && !isGeneratingImage ? (
          <div className="text-center py-12 border border-dashed border-white/10 bg-[#0A0A0A] rounded-none">
            <ImageIcon className="w-8 h-8 text-zinc-650 mx-auto mb-3 animate-pulse" />
            <p className="text-xs text-zinc-400 font-mono uppercase tracking-wider">[ GALERİNİZ BOŞ - İLK GÖRSELİNİZİ YUKARIDAN ÜRETEBİLİRSİNİZ ]</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Visual generator progress card placeholder instead of a black screen */}
            {isGeneratingImage && (
              <div 
                className="bg-[#0A0A0A] border border-cyan-500/30 rounded-none overflow-hidden relative flex flex-col justify-between animate-pulse"
                id="gallery_generating_placeholder"
              >
                <div className="aspect-video bg-black/85 w-full relative flex flex-col items-center justify-center p-4">
                  <Loader2 className="w-8 h-8 text-cyan-400 animate-spin mb-3" />
                  <span className="text-xs font-bold text-center text-cyan-400 uppercase tracking-widest leading-none">
                    GÖRSEL YÜKLENİYOR...
                  </span>
                  <span className="text-[8px] text-zinc-500 text-center uppercase tracking-wider block font-mono mt-2">
                    LÜTFEN BEKLEYİN, YAPAY ZEKA GÖRSELİ ÇİZİYOR
                  </span>
                </div>
                <div className="p-4 bg-[#0A0A0A] flex flex-col justify-between flex-grow border-t border-white/5">
                  <p className="text-zinc-500 text-xs font-semibold italic mb-4">
                    Komut işleniyor, yüksek kaliteli piksel ağları yapılandırılıyor...
                  </p>
                  <div className="flex items-center justify-between border-t border-white/5 pt-3">
                    <span className="text-[9px] text-cyan-400/50 font-mono font-bold uppercase tracking-wider">
                      AKILLI ÇİZİM PROSESİ
                    </span>
                  </div>
                </div>
              </div>
            )}

            {combinedGallery.map((g, index) => {
              const isVideo = g.type === 'video';
              const isDownloading = downloadSuccessId === g.id;
              return (
                <div 
                  key={`${g.id}_${index}`} 
                  className="bg-[#0A0A0A] border border-white/10 rounded-none overflow-hidden relative group/card flex flex-col justify-between"
                  id={`gallery_card_${g.id}`}
                >
                  {/* Image/Video media frame */}
                  <div className="aspect-video bg-black w-full relative flex items-center justify-center overflow-hidden">
                    {isVideo ? (
                      <video 
                        src={g.url} 
                        className="w-full h-full object-cover" 
                        controls 
                        loop 
                        muted
                        playsInline
                      />
                    ) : (
                      <div className="relative w-full h-full">
                        <StudioImageWithLoader 
                          src={g.url} 
                          alt={g.prompt} 
                          className="w-full h-full object-cover group-hover/card:scale-105 transition-all duration-500"
                          blur={enhancingIds[g.id]}
                        />
                        {enhancingIds[g.id] && (
                          <div className="absolute inset-0 bg-black/85 flex flex-col items-center justify-center p-3 animate-pulse">
                            <Loader2 className="w-8 h-8 text-purple-400 animate-spin mb-2" />
                            <span className="text-[10px] font-black uppercase text-purple-400 tracking-widest text-center">ÇÖZÜNÜRLÜK ARTTIRILIYOR...</span>
                            <span className="text-[8px] text-zinc-500 uppercase tracking-wider text-center font-mono mt-1">8K ULTRA NETLİK SİNYALİ OLUŞTURULUYOR</span>
                          </div>
                        )}
                      </div>
                    )}
                    {/* Category Pill Tag */}
                    <div className="absolute top-3 left-3 px-2 py-0.5 rounded-none text-[9px] font-mono font-bold uppercase tracking-widest border z-10 text-white bg-cyan-950/90 border-cyan-500/50 text-cyan-400">
                      {g.prompt.includes("photorealistic 8k quality") ? 'ÖZEL ÜRETİM • REMASTERED 8K' : 'ÖZEL ÜRETİM • 4K ULTRA HD'}
                    </div>
 
                    {/* Trash Bin Delete Trigger */}
                    <button
                      onClick={() => onDeleteGeneration(g.id)}
                      className="absolute top-3 right-3 bg-red-950/90 hover:bg-red-600 border border-red-500/50 p-1.5 text-red-400 hover:text-white transition-all z-25 rounded-none shadow-md cursor-pointer hover:scale-110 flex items-center justify-center"
                      title="Görseli Kalıcı Olarak Sil"
                      id={`btn_delete_gallery_${g.id}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
 
                  {/* Card footer description with download links */}
                  <div className="p-4 bg-[#0A0A0A] flex flex-col justify-between flex-grow border-t border-white/5">
                    <p className="text-zinc-300 text-xs font-medium leading-relaxed italic mb-4">
                      "{g.prompt}"
                    </p>
 
                    <div className="flex items-center justify-between border-t border-white/5 pt-3 flex-wrap gap-2">
                      <span className="text-[9px] text-white/30 font-bold uppercase tracking-wider font-mono">
                        {new Date(g.createdAt).toLocaleDateString('tr-TR')}
                      </span>
                      <div className="flex items-center gap-2">
                        {/* Prompt voice narration button (Bunların sesini ekle) */}
                        <button
                          onClick={() => handleReadPromptAloud(g.id, g.prompt)}
                          className={`inline-flex items-center gap-1.5 border p-2 px-3 rounded-none text-[10px] font-black tracking-widest uppercase transition-all cursor-pointer ${
                            activeVoiceId === g.id
                              ? 'bg-cyan-950 border-cyan-500 text-cyan-300'
                              : 'bg-[#050505] border-white/10 text-zinc-400 hover:text-white'
                          }`}
                          id={`btn_narrate_gallery_${g.id}`}
                          title="Açıklamayı siber seslendiriciye oku"
                        >
                          {activeVoiceId === g.id ? (
                            <>
                              <Volume2 className="w-3.5 h-3.5 text-cyan-300 animate-pulse" />
                              <span>SUSTUR</span>
                            </>
                          ) : (
                            <>
                              <Volume2 className="w-3.5 h-3.5" />
                              <span>SESLENDİR</span>
                            </>
                          )}
                        </button>

                        <button
                          onClick={() => handleDownload(g.url, isVideo ? 'nova_ai_video.mp4' : 'nova_ai_art.png', g.id)}
                          className={`inline-flex items-center gap-1.5 border p-2 px-3 rounded-none text-[10px] font-black tracking-widest uppercase transition-all ${
                            isDownloading 
                              ? 'bg-emerald-900 border-emerald-500 text-emerald-400' 
                              : 'bg-[#050505] border-white/10 text-cyan-400 hover:bg-white hover:text-black'
                          }`}
                          id={`btn_download_gallery_${g.id}`}
                        >
                          {isDownloading ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 animate-bounce" />
                              <span>İNDİRİLDİ</span>
                            </>
                          ) : (
                            <>
                              <Download className="w-3.5 h-3.5" />
                              <span>İNDİR</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
