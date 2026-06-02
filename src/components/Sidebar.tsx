/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  MessageSquarePlus, 
  Trash2, 
  Sparkles, 
  Volume2, 
  ShieldAlert, 
  User, 
  Check, 
  X,
  Settings,
  ChevronDown,
  ChevronUp,
  LogOut,
  AppWindow,
  Compass,
  Video
} from 'lucide-react';
import { Chat, UserProfile } from '../types';
import { VOICES, speakText } from '../utils/speak';
import Logo from './Logo';

interface SidebarProps {
  chats: Chat[];
  activeChatId: string | null;
  onSelectChat: (id: string) => void;
  onNewChat: () => void;
  onDeleteChat: (id: string) => void;
  userProfile: UserProfile;
  onUpdateProfile: (p: UserProfile) => void;
  activeSection: 'chat' | 'studio' | 'video';
  onChangeSection: (section: 'chat' | 'studio' | 'video') => void;
  dailyImagesUsed: number;
  dailyVideosUsed: number;
  onSignOut?: () => void;
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({
  chats,
  activeChatId,
  onSelectChat,
  onNewChat,
  onDeleteChat,
  userProfile,
  onUpdateProfile,
  activeSection,
  onChangeSection,
  dailyImagesUsed,
  dailyVideosUsed,
  onSignOut,
  isOpen,
  onClose
}: SidebarProps) {
  const [name, setName] = useState(userProfile.displayName || '');
  const [bDate, setBDate] = useState(userProfile.birthdate || '2005-01-01');
  const [cMode, setCMode] = useState(userProfile.curseMode || false);
  const [vChoice, setVChoice] = useState(userProfile.selectedVoice || 'Selin');
  const [vRate, setVRate] = useState(() => typeof window !== 'undefined' ? parseFloat(window.localStorage.getItem('voice_rate') || '1.1') : 1.1);
  const [vPitch, setVPitch] = useState(() => typeof window !== 'undefined' ? parseFloat(window.localStorage.getItem('voice_pitch') || '1.0') : 1.0);
  const [isSaved, setIsSaved] = useState(false);
  const [isSettingsExpanded, setIsSettingsExpanded] = useState(false);

  // Sync state if userProfile prop changes
  useEffect(() => {
    setName(userProfile.displayName);
    setBDate(userProfile.birthdate);
    setCMode(userProfile.curseMode);
    setVChoice(userProfile.selectedVoice);
  }, [userProfile]);

  const calculateAge = (birthDateStr: string): number => {
    if (!birthDateStr) return 0;
    const today = new Date();
    const birthDate = new Date(birthDateStr);
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age >= 0 ? age : 0;
  };

  const handleSaveProfile = () => {
    const calculatedAge = calculateAge(bDate);
    const updated: UserProfile = {
      ...userProfile,
      displayName: name || 'Kullanıcı',
      birthdate: bDate,
      age: calculatedAge,
      curseMode: cMode,
      selectedVoice: vChoice
    };
    onUpdateProfile(updated);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop overlay for dismissing */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Drawer menu body container */}
      <aside 
        className="fixed top-0 bottom-0 left-0 w-80 bg-[#0A0A0A] border-r border-white/10 flex flex-col h-full text-zinc-100 font-sans z-50 animate-slide-in shadow-2xl" 
        id="sidebar_drawer_overlay"
      >
        {/* Header: Logo, Close trigger */}
        <div className="p-6 border-b border-white/10 flex items-center justify-between bg-[#080808]/50">
          <Logo variant="circle" size="sm" showText={true} />
          
          <button 
            onClick={onClose}
            className="p-1 px-2.5 bg-white/5 border border-white/10 text-zinc-400 hover:text-white rounded-none text-xs font-bold"
            id="btn_close_drawer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Dynamic Navigation Tabs inside the Menu */}
        <div className="p-4 border-b border-white/10 space-y-2.5">
          <span className="text-[9px] text-white/40 uppercase tracking-[0.2em] font-mono block px-1">PANEL NAVİGASYONU</span>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => {
                onChangeSection('chat');
                onClose();
              }}
              className={`flex items-center gap-3 w-full py-3 px-4 rounded-none text-xs font-bold uppercase tracking-widest transition-all ${
                activeSection === 'chat'
                  ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-400/30'
                  : 'text-zinc-400 border border-transparent hover:text-zinc-200 hover:bg-white/5'
              }`}
              id="btn_switch_chat"
            >
              <Compass className="w-4 h-4" />
              <span>💬 CANLI SOHBET</span>
            </button>
            <button
              onClick={() => {
                onChangeSection('studio');
                onClose();
              }}
              className={`flex items-center gap-3 w-full py-3 px-4 rounded-none text-xs font-bold uppercase tracking-widest transition-all ${
                activeSection === 'studio'
                  ? 'bg-purple-900/20 text-purple-400 border border-purple-400/30 font-extrabold'
                  : 'text-zinc-400 border border-transparent hover:text-zinc-200 hover:bg-white/5'
              }`}
              id="btn_switch_studio"
            >
              <Sparkles className="w-4 h-4" />
              <span>🎨 GÖRSEL STÜDYO</span>
            </button>
          </div>
        </div>

        {/* Scrollable Conversation block */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          
          {/* New Chat Command Button */}
          <button
            onClick={() => {
              onNewChat();
              onClose();
            }}
            className="w-full py-3.5 px-4 bg-white text-black font-black uppercase tracking-widest text-xs flex items-center justify-between hover:bg-cyan-400 transition-colors rounded-none"
            id="btn_new_chat_drawer"
          >
            <span>YENİ SOHBET +</span>
            <MessageSquarePlus className="w-4 h-4 text-black" />
          </button>

          <div className="space-y-2">
            <p className="text-[9px] text-white/40 uppercase tracking-[0.2em] px-1 mb-2 font-mono">GÖRÜŞME GEÇMİŞİ</p>
            {chats.length === 0 ? (
              <div className="text-center py-6 text-zinc-650 text-[10px] font-mono uppercase tracking-wider">
                [ SOHBET GEÇMİŞİ BOŞ ]
              </div>
            ) : (
              chats.map((c) => {
                const isActive = c.id === activeChatId;
                return (
                  <div
                    key={c.id}
                    className={`group flex items-center justify-between p-3 rounded-none border cursor-pointer text-xs transition-all ${
                      isActive
                        ? 'bg-white/5 text-cyan-400 border-white/10'
                        : 'text-zinc-400 border-transparent hover:text-white hover:bg-white/5'
                    }`}
                    onClick={() => {
                      onSelectChat(c.id);
                      onClose();
                    }}
                    id={`chat_item_${c.id}`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-cyan-400' : 'bg-transparent'}`} />
                      <span className="truncate font-mono uppercase tracking-wide">{c.title}</span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteChat(c.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-red-400 p-1 rounded transition-all"
                      id={`btn_delete_chat_${c.id}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Collapsible Settings Panel & Profile Controls at the bottom */}
        <div className="border-t border-white/10 bg-[#080808] shrink-0">
          
          {/* Collapse Trigger Button */}
          <button
            onClick={() => setIsSettingsExpanded(!isSettingsExpanded)}
            className="w-full p-4 flex items-center justify-between text-zinc-300 hover:text-white hover:bg-white/5 transition-all text-xs font-black uppercase tracking-widest border-b border-white/5"
            id="btn_toggle_drawer_settings"
          >
            <span className="flex items-center gap-2">
              <Settings className="w-4 h-4 text-cyan-400" />
              <span>⚙️ AYARLAR VE PROFİL</span>
            </span>
            {isSettingsExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {/* Form container body */}
          {isSettingsExpanded && (
            <div className="p-5 space-y-3.5 max-h-[350px] overflow-y-auto animate-fade-in text-left">
              {/* Display Name */}
              <div>
                <label className="text-[9px] text-white/40 uppercase tracking-[0.15em] block mb-1 font-semibold">Kullanıcı Adı (Telsiz Kodu)</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-[#050505] border border-white/10 p-2.5 rounded-none text-xs font-semibold text-white focus:outline-none focus:border-cyan-400/80 placeholder-white/20"
                  placeholder="Kullanıcı adı"
                />
              </div>

              {/* Birthdate */}
              <div>
                <label className="text-[9px] text-white/40 uppercase tracking-[0.15em] block mb-1 font-semibold font-mono">DOĞUM TARİHİ (YAŞ)</label>
                <input
                  type="date"
                  value={bDate}
                  onChange={(e) => setBDate(e.target.value)}
                  className="w-full bg-[#050505] border border-white/10 p-2.5 rounded-none text-xs font-semibold text-white focus:outline-none focus:border-cyan-400/80"
                />
              </div>

              {/* Voice select grid */}
              <div className="space-y-1.5">
                <label className="text-[9px] text-white/40 uppercase tracking-[0.15em] block font-semibold font-mono">SES KARAKTERİ SEÇİMİ (DENEMEK İÇİN TIKLAYIN)</label>
                <div className="grid grid-cols-2 gap-2">
                  {VOICES.map((v) => {
                    const isSelected = vChoice === v.id;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => {
                          setVChoice(v.id);
                          // Immediately preview the character's voice
                          let greeting = "Merhaba! Yeni sesimi nasıl buldun?";
                          if (v.id === 'Ali') {
                            greeting = "Merhaba, ben Ali. Can ile tamamen farklı, karizmatik ve bilge siber erkek asistan sesiyim.";
                          } else if (v.id === 'Can') {
                            greeting = "Merhaba, ben Can. Dinamik ve hızlı tempolu siber erkek asistan sesiyim.";
                          } else if (v.id === 'Selin') {
                            greeting = "Merhaba, ben Selin. Güler yüzlü, enerjik ve parlak siber kız asistan sesiyim.";
                          } else if (v.id === 'Ebru') {
                            greeting = "Merhaba, ben Ebru. Yumuşak, cana yakın ve tatlı siber kız asistan sesiyim.";
                          }
                          speakText(greeting, v.id);
                        }}
                        className={`p-3 border text-left transition-all relative flex flex-col justify-between cursor-pointer group rounded-none h-20 ${
                          isSelected 
                            ? 'bg-cyan-950/40 border-cyan-400 text-cyan-400 shadow-md shadow-cyan-950/20' 
                            : 'bg-[#050505] border-white/10 text-white/75 hover:border-white/20 hover:bg-[#0c0c0c]'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className={`text-[11px] font-black uppercase tracking-wider ${isSelected ? 'text-cyan-400' : 'text-white'}`}>{v.name}</span>
                          <span className={`text-[8px] px-1 py-0.2 font-mono uppercase font-bold leading-none ${v.gender === 'female' ? 'bg-pink-500/20 text-pink-400 border border-pink-500/10' : 'bg-blue-500/20 text-blue-400 border border-blue-500/10'}`}>
                            {v.gender === 'female' ? 'KIZ / KADIN' : 'ERKEK'}
                          </span>
                        </div>
                        <span className="text-[8px] text-white/45 line-clamp-2 leading-tight uppercase font-mono mt-1 group-hover:text-white/60 transition-colors">
                          {v.id === 'Ali' ? 'Karizmatik & Bilge Siber Erkek' : v.id === 'Can' ? 'Canlı & Genç Siber Erkek' : v.id === 'Selin' ? 'Güler Yüzlü & Parlak Kiz' : 'Yumuşak & Tatli Kiz Asistan'}
                        </span>
                        {isSelected && (
                          <div className="absolute bottom-1 right-1 w-1.5 h-1.5 bg-cyan-400 rounded-none shadow-sm shadow-cyan-400"></div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Advanced Voice Modulation Panel */}
              <div className="space-y-3 pt-3 border-t border-white/10">
                <div className="flex justify-between items-center">
                  <span className="text-[9px] text-white/40 uppercase tracking-[0.15em] font-semibold font-mono">OKUMA HIZI (TEMPO)</span>
                  <span className="text-[9px] text-cyan-400 font-mono font-bold">{vRate.toFixed(2)}x</span>
                </div>
                <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
                  {[0.75, 1.0, 1.25, 1.5, 1.75].map((rate) => {
                    const isSelected = Math.abs(vRate - rate) < 0.1;
                    return (
                      <button
                        key={rate}
                        type="button"
                        onClick={() => {
                          if (typeof window !== 'undefined') {
                            window.localStorage.setItem('voice_rate', rate.toString());
                            setVRate(rate);
                            speakText(`${rate} hızında okuma ayarlandı.`, vChoice);
                          }
                        }}
                        className={`text-[9px] px-2.5 py-1.5 border font-mono transition-all rounded-none shrink-0 cursor-pointer ${
                          isSelected 
                            ? 'bg-cyan-950/40 border-cyan-400 text-cyan-400 font-bold' 
                            : 'bg-[#050505] border-white/10 text-white/50 hover:text-white hover:border-white/25'
                        }`}
                      >
                        {rate.toFixed(2)}x
                      </button>
                    );
                  })}
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-[9px] text-white/40 uppercase tracking-[0.15em] font-semibold font-mono">SES KALINLIĞI (PITCH)</span>
                  <span className="text-[9px] text-cyan-400 font-mono font-bold">{vPitch.toFixed(2)}</span>
                </div>
                <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
                  {[0.5, 0.75, 1.0, 1.25, 1.5].map((pitch) => {
                    const isSelected = Math.abs(vPitch - pitch) < 0.1;
                    return (
                      <button
                        key={pitch}
                        type="button"
                        onClick={() => {
                          if (typeof window !== 'undefined') {
                            window.localStorage.setItem('voice_pitch', pitch.toString());
                            setVPitch(pitch);
                            speakText("Ses tonu ayarlandı.", vChoice);
                          }
                        }}
                        className={`text-[9px] px-2.5 py-1.5 border font-mono transition-all rounded-none shrink-0 cursor-pointer ${
                          isSelected 
                            ? 'bg-cyan-950/40 border-cyan-400 text-cyan-400 font-bold' 
                            : 'bg-[#050505] border-white/10 text-white/50 hover:text-white hover:border-white/25'
                        }`}
                      >
                        {pitch === 0.5 ? '0.50 (Tok)' : pitch === 1.5 ? '1.50 (İnce)' : pitch.toFixed(2)}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Save button */}
              <button
                onClick={handleSaveProfile}
                className={`w-full py-3 px-4 text-xs font-black uppercase tracking-widest transition-all rounded-none border ${
                  isSaved
                    ? 'bg-cyan-950/20 border-cyan-400 text-cyan-400'
                    : 'bg-white text-black border-transparent hover:bg-cyan-400 hover:text-black active:scale-95'
                }`}
                id="btn_save_profile_drawer"
              >
                {isSaved ? (
                  <span className="flex items-center justify-center gap-1.5 text-cyan-400">
                    <Check className="w-3.5 h-3.5" />
                    <span>KAYDEDİLDİ</span>
                  </span>
                ) : (
                  <span>KAYDET ({userProfile.age} YAŞ)</span>
                )}
              </button>

              {/* Secure Log Out button */}
              {onSignOut && (
                <button
                  onClick={onSignOut}
                  className="w-full py-2.5 px-4 text-xs font-black uppercase tracking-widest bg-transparent border border-red-500/20 text-red-400 hover:bg-red-950/20 hover:border-red-500 transition-all rounded-none flex items-center justify-center gap-2"
                  id="btn_signout_profile_drawer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>GÜVENLİ ÇIKIŞ YAP</span>
                </button>
              )}
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
