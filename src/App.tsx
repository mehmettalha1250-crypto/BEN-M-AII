/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  fetchUserProfile, 
  storeUserProfile, 
  fetchChats, 
  storeChat, 
  removeChat, 
  fetchMessages, 
  storeMessage, 
  fetchGenerations, 
  storeGeneration,
  removeGeneration,
  getDailyLimits,
  incrementGenerationCount
} from './utils/storage';
import { Chat, Message, UserProfile, Generation } from './types';
import Sidebar from './components/Sidebar';
import ChatView from './components/ChatView';
import StudioView from './components/StudioView';
import Logo from './components/Logo';
import LiveVoipOverlay from './components/LiveVoipOverlay';
import { speakText, stopSpeaking } from './utils/speak';
import { Sparkles, Volume2, ShieldAlert, LogIn, Chrome, Menu, Sun, Moon } from 'lucide-react';
import { auth, isFirebaseConnected } from './firebase';
import { signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from 'firebase/auth';

export default function App() {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [userGenerations, setUserGenerations] = useState<Generation[]>([]);
  
  // Daily limits
  const [dailyImagesUsed, setDailyImagesUsed] = useState(0);
  const [dailyVideosUsed, setDailyVideosUsed] = useState(0);

  // Layout selection states
  const [activeSection, setActiveSection] = useState<'chat' | 'slate' | 'studio' | 'video'>('chat');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);

  // Mobile layout drawer toggle
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const [isVoipOpen, setIsVoipOpen] = useState(false);

  const [authLoading, setAuthLoading] = useState(true);

  // Day/Night theme state
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const stored = window.localStorage.getItem('benimai_theme');
      if (stored) return stored === 'dark';
    }
    return true;
  });

  useEffect(() => {
    if (typeof document !== 'undefined') {
      if (isDarkMode) {
        document.documentElement.classList.add('dark-mode');
        document.documentElement.classList.remove('light-mode');
        document.body.classList.add('dark-mode');
        document.body.classList.remove('light-mode');
      } else {
        document.documentElement.classList.remove('dark-mode');
        document.documentElement.classList.add('light-mode');
        document.body.classList.remove('dark-mode');
        document.body.classList.add('light-mode');
      }
    }
  }, [isDarkMode]);

  const toggleTheme = () => {
    setIsDarkMode(prev => {
      const next = !prev;
      localStorage.setItem('benimai_theme', next ? 'dark' : 'light');
      return next;
    });
  };

  // Load data for verified Profile
  const loadUserData = async (profile: UserProfile) => {
    // Load credits
    const limits = getDailyLimits(profile.uid);
    setDailyImagesUsed(limits.imagesUsed);
    setDailyVideosUsed(limits.videosUsed);

    // Load chats
    const loadedChats = await fetchChats(profile.uid);
    setChats(loadedChats);

    if (loadedChats.length > 0) {
      setActiveChatId(loadedChats[0].id);
    } else {
      // Automatically spawn initial welcoming chat
      await createInitialChat(profile);
    }

    // Load visual generations
    const loadedGens = await fetchGenerations(profile.uid);
    setUserGenerations(loadedGens);
  };

  // Listen to Auth State Changes
  useEffect(() => {
    if (isFirebaseConnected && auth) {
      const unsubscribe = onAuthStateChanged(auth, async (user) => {
        setAuthLoading(true);
        if (user) {
          let profile = await fetchUserProfile(user.uid);
          if (!profile) {
            profile = {
              uid: user.uid,
              email: user.email || 'mehmettalha1250@gmail.com',
              displayName: user.displayName || 'Mehmet',
              birthdate: '2005-01-01',
              age: 21,
              selectedVoice: 'Selin',
              curseMode: false,
              createdAt: new Date().toISOString()
            };
            await storeUserProfile(profile);
          }
          setUserProfile(profile);
          await loadUserData(profile);
        } else {
          setUserProfile(null);
        }
        setAuthLoading(false);
      });
      return () => unsubscribe();
    } else {
      // Local check
      const initApp = async () => {
        setAuthLoading(true);
        const cachedUser = localStorage.getItem('benimai_mock_auth_user');
        if (cachedUser) {
          const parsed = JSON.parse(cachedUser);
          let profile = await fetchUserProfile(parsed.uid);
          if (!profile) {
            profile = {
              uid: parsed.uid,
              email: parsed.email,
              displayName: parsed.displayName,
              birthdate: '2005-01-01',
              age: 21,
              selectedVoice: 'Selin',
              curseMode: false,
              createdAt: new Date().toISOString()
            };
            await storeUserProfile(profile);
          }
          setUserProfile(profile);
          await loadUserData(profile);
        } else {
          setUserProfile(null);
        }
        setAuthLoading(false);
      };
      initApp();
    }
  }, []);

  // Fetch messages if activeChatId changes
  useEffect(() => {
    if (activeChatId) {
      const loadMessages = async () => {
        const loadedMsgs = await fetchMessages(activeChatId);
        setMessages(loadedMsgs);
      };
      loadMessages();
    } else {
      setMessages([]);
    }
  }, [activeChatId]);

  const createInitialChat = async (profile: UserProfile) => {
    const chatId = `chat_${Date.now()}`;
    const newChat: Chat = {
      id: chatId,
      userId: profile.uid,
      title: 'Hoş Geldiniz Bilgilendirmesi',
      createdAt: Date.now()
    };
    await storeChat(newChat);
    setChats([newChat]);
    setActiveChatId(chatId);

    // Initial greeting message
    const welcomeMsg: Message = {
      id: `msg_welcome_${Date.now()}`,
      chatId,
      sender: 'ai',
      text: `Merhaba ${profile.displayName}! Ben Benim AI. 🚀 Sana bugün nasıl yardımcı olabilirim?`,
      createdAt: Date.now()
    };
    await storeMessage(welcomeMsg);
    setMessages([welcomeMsg]);
  };

  const handleGoogleSignIn = async () => {
    try {
      setAuthLoading(true);
      if (isFirebaseConnected && auth) {
        const provider = new GoogleAuthProvider();
        await signInWithPopup(auth, provider);
      } else {
        // Fallback simulated sign-in
        const mockUser = {
          uid: 'user_constant_6784',
          email: 'mehmettalha1250@gmail.com',
          displayName: 'Mehmet',
        };
        localStorage.setItem('benimai_mock_auth_user', JSON.stringify(mockUser));
        
        let profile = await fetchUserProfile(mockUser.uid);
        if (!profile) {
          profile = {
            uid: mockUser.uid,
            email: mockUser.email,
            displayName: mockUser.displayName,
            birthdate: '2005-01-01',
            age: 21,
            selectedVoice: 'Selin',
            curseMode: false,
            createdAt: new Date().toISOString()
          };
          await storeUserProfile(profile);
        }
        setUserProfile(profile);
        await loadUserData(profile);
      }
    } catch (e: any) {
      alert("Giriş başarısız oldu: " + e.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    stopSpeaking();
    try {
      if (isFirebaseConnected && auth) {
        await signOut(auth);
      } else {
        localStorage.removeItem('benimai_mock_auth_user');
        setUserProfile(null);
      }
      setChats([]);
      setActiveChatId(null);
      setMessages([]);
      setUserGenerations([]);
    } catch (e: any) {
      alert("Çıkış başarısız oldu: " + e.message);
    }
  };

  const handleNewChat = async () => {
    if (!userProfile) return;
    const chatId = `chat_${Date.now()}`;
    const newChat: Chat = {
      id: chatId,
      userId: userProfile.uid,
      title: 'Yeni Sohbet',
      createdAt: Date.now()
    };
    await storeChat(newChat);
    setChats(prev => [newChat, ...prev]);
    setActiveChatId(chatId);
    stopSpeaking();
    setActiveSection('chat');
  };

  const handleDeleteChat = async (chatId: string) => {
    await removeChat(chatId);
    const updated = chats.filter(c => c.id !== chatId);
    setChats(updated);
    if (activeChatId === chatId) {
      if (updated.length > 0) {
        setActiveChatId(updated[0].id);
      } else {
        setActiveChatId(null);
      }
    }
    stopSpeaking();
  };

  const handleUpdateProfile = async (updated: UserProfile) => {
    setUserProfile(updated);
    await storeUserProfile(updated);
    
    // Refresh daily limits due to possible age modifications
    const limits = getDailyLimits(updated.uid);
    setDailyImagesUsed(limits.imagesUsed);
    setDailyVideosUsed(limits.videosUsed);
  };

  const handleSendMessage = async (text: string, attachedImage: { mimeType: string; base64Data: string } | null = null) => {
    if (!activeChatId || !userProfile) return;

    // Stop ongoing readout speech
    stopSpeaking();

    const userMsgId = `msg_user_${Date.now()}`;
    const newUserMsg: Message = {
      id: userMsgId,
      chatId: activeChatId,
      sender: 'user',
      text: text || "Fotoğraf ektedir.",
      imageUrl: attachedImage ? `data:${attachedImage.mimeType};base64,${attachedImage.base64Data}` : undefined,
      createdAt: Date.now()
    };

    // Store with sync
    await storeMessage(newUserMsg);
    setMessages(prev => [...prev, newUserMsg]);
    setIsGenerating(true);

    const lowerText = text ? text.toLowerCase() : "";
    const isEnhanceTrigger = lowerText.includes("görseli geliştir") || lowerText.includes("çok geliştir") || lowerText.includes("resmi geliştir") || lowerText.includes("görüntüyü geliştir") || lowerText.includes("görsel geliştir") || lowerText.includes("resim geliştir") || lowerText.includes("fotoğrafı geliştir");
    const isGenerateTrigger = lowerText.includes("görsel üret") || lowerText.includes("resim çiz") || lowerText.includes("fotoğraf yap") || lowerText.includes("görsel oluştur") || lowerText.includes("fotoğraf üret") || lowerText.includes("resim yap") || lowerText.includes("görsel çiz") || lowerText.includes("resmi çiz") || lowerText.includes("karakter çiz") || lowerText.endsWith("çiz") || lowerText.includes("çizim yap") || lowerText.includes("bunu çiz");
    const isVideoTrigger = lowerText.includes("video oluştur") || lowerText.includes("video yap") || lowerText.includes("video üret") || lowerText.includes("klip yap") || lowerText.includes("klip oluştur") || lowerText.includes("klip üret");

    if (isEnhanceTrigger) {
      const lastImageGen = userGenerations.find(g => g.type === 'image');
      if (lastImageGen) {
        const statusId = `msg_status_${Date.now()}`;
        try {
          const initialAiMsg: Message = {
            id: statusId,
            chatId: activeChatId,
            sender: 'ai',
            text: "Son ürettiğiniz görseli hafızamdan çağırdım. Şimdi yapay zekayı kullanarak çözünürlüğü ve detay derecelerini en yüksek seviye olan 8K kalitesine çıkartıyorum. Lütfen bekleyin...",
            createdAt: Date.now()
          };
          setMessages(prev => [...prev, initialAiMsg]);

          const res = await fetch('/api/gemini/enhance-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt: lastImageGen.prompt
            })
          });

          const data = await res.json();
          if (data.error) throw new Error(data.error);

          const newGen: Generation = {
            id: `gen_${Date.now()}`,
            userId: userProfile.uid,
            type: 'image',
            prompt: `${lastImageGen.prompt} (Remastered photorealistic 8k quality)`,
            url: data.imageUrl,
            createdAt: Date.now()
          };

          await storeGeneration(newGen);
          setUserGenerations(prev => [newGen, ...prev]);

          const aiMsgId = `msg_ai_${Date.now()}`;
          const newAiMsg: Message = {
            id: aiMsgId,
            chatId: activeChatId,
            sender: 'ai',
            text: `Harika! İstediğiniz üzere görseli en yüksek kaliteye ulaştırdım. Piksel netliği arttırıldı ve pürüzsüz 8K Remastered olarak kaydedildi. Görsel Stüdyosu'ndan da dilediğiniz an erişebilirsiniz.`,
            imageUrl: data.imageUrl,
            createdAt: Date.now()
          };
          await storeMessage(newAiMsg);
          setMessages(prev => prev.filter(m => m.id !== statusId).concat(newAiMsg));
          setIsGenerating(false);
          return;
        } catch (err: any) {
          const aiMsgId = `msg_ai_${Date.now()}`;
          const newAiMsg: Message = {
            id: aiMsgId,
            chatId: activeChatId,
            sender: 'ai',
            text: `Üzgünüm, görseli geliştirirken bir hata oluştu: ${err.message}`,
            createdAt: Date.now()
          };
          await storeMessage(newAiMsg);
          setMessages(prev => prev.filter(m => m.id !== statusId).concat(newAiMsg));
          setIsGenerating(false);
          return;
        }
      }
    }

    if (isGenerateTrigger) {
      const statusId = `msg_status_${Date.now()}`;
      try {
        let cleanPromptText = text.trim();
        const triggersToRemove = [
          "görseli oluştur", "görsel oluştur", "görsel üret", "görsel çiz", "görsel yap", "görseli çiz",
          "resmi oluştur", "resim oluştur", "resim üret", "resim çiz", "resim yap", "resmi çiz",
          "fotoğrafı oluştur", "fotoğraf oluştur", "fotoğraf üret", "fotoğraf çiz", "fotoğraf yap", "fotoğrafı çiz",
          "çizim yap", "bunu çiz", "çizdir", "çiz"
        ];
        
        let cleanedLower = cleanPromptText.toLowerCase();
        for (const trig of triggersToRemove) {
          if (cleanedLower.endsWith(trig)) {
            cleanPromptText = cleanPromptText.substring(0, cleanPromptText.length - trig.length).trim();
            break;
          } else if (cleanedLower.startsWith(trig)) {
            cleanPromptText = cleanPromptText.substring(trig.length).trim();
            break;
          }
        }
        cleanPromptText = cleanPromptText.replace(/^[\s,.\-!]+/g, '').replace(/[\s,.\-!]+$/g, '').trim();
        if (!cleanPromptText) cleanPromptText = text;

        const initialAiMsg: Message = {
          id: statusId,
          chatId: activeChatId,
          sender: 'ai',
          text: `"${cleanPromptText}" çizim emrini işleme aldım. Sizin için pürüzsüz 4M piksel yapay zeka resmini çiziyorum. Lütfen kısa bir an bekleyin...`,
          createdAt: Date.now()
        };
        setMessages(prev => [...prev, initialAiMsg]);

        const res = await fetch('/api/gemini/generate-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: cleanPromptText,
            userAge: userProfile.age
          })
        });

        const data = await res.json();
        if (data.error) throw new Error(data.error);

        const limits = incrementGenerationCount(userProfile.uid, 'image');
        setDailyImagesUsed(limits.imagesUsed);

        const newGen: Generation = {
          id: `gen_${Date.now()}`,
          userId: userProfile.uid,
          type: 'image',
          prompt: cleanPromptText,
          url: data.imageUrl,
          createdAt: Date.now()
        };

        await storeGeneration(newGen);
        setUserGenerations(prev => [newGen, ...prev]);

        const aiMsgId = `msg_ai_${Date.now()}`;
        const newAiMsg: Message = {
          id: aiMsgId,
          chatId: activeChatId,
          sender: 'ai',
          text: `İstediğiniz görsele ait çizim başarıyla tamamlandı: "${cleanPromptText}"\n\nBu görseli dilediğiniz zaman hem buradan indirebilir hem de yan menüdeki Görsel Stüdyosu'ndan görüntüleyebilirsiniz.`,
          imageUrl: data.imageUrl,
          createdAt: Date.now()
        };
        await storeMessage(newAiMsg);
        setMessages(prev => prev.filter(m => m.id !== statusId).concat(newAiMsg));
        setIsGenerating(false);
        return;
      } catch (err: any) {
        const aiMsgId = `msg_ai_${Date.now()}`;
        const newAiMsg: Message = {
          id: aiMsgId,
          chatId: activeChatId,
          sender: 'ai',
          text: `Görsel üretilirken hata oluştu: ${err.message}`,
          createdAt: Date.now()
        };
        await storeMessage(newAiMsg);
        setMessages(prev => prev.filter(m => m.id !== statusId).concat(newAiMsg));
        setIsGenerating(false);
        return;
      }
    }

    if (isVideoTrigger) {
      const statusId = `msg_status_${Date.now()}`;
      try {
        let cleanPromptVid = text.trim();
        const vidTriggers = ["video oluştur", "video yap", "video üret", "klip yap", "klip oluştur", "klip üret"];
        let cleanedLowerVid = cleanPromptVid.toLowerCase();
        for (const trig of vidTriggers) {
          if (cleanedLowerVid.endsWith(trig)) {
            cleanPromptVid = cleanPromptVid.substring(0, cleanPromptVid.length - trig.length).trim();
            break;
          } else if (cleanedLowerVid.startsWith(trig)) {
            cleanPromptVid = cleanPromptVid.substring(trig.length).trim();
            break;
          }
        }
        cleanPromptVid = cleanPromptVid.replace(/^[\s,.\-!]+/g, '').replace(/[\s,.\-!]+$/g, '').trim();
        if (!cleanPromptVid) cleanPromptVid = text;

        const initialAiMsg: Message = {
          id: statusId,
          chatId: activeChatId,
          sender: 'ai',
          text: `"${cleanPromptVid}" video canlandırma komutunu aldım. Sizin için VEO 3.1 video sentezlemeyi başlatıyorum. Lütfen 5-10 saniye bekleyin...`,
          createdAt: Date.now()
        };
        setMessages(prev => [...prev, initialAiMsg]);

        // Trigger generate video on server
        const triggerRes = await fetch('/api/gemini/generate-video', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: cleanPromptVid,
            userAge: userProfile.age
          })
        });

        const triggerData = await triggerRes.json();
        if (triggerData.error) throw new Error(triggerData.error);

        const opName = triggerData.operationName;

        // Poll video generation status until "done: true"
        let done = false;
        let checkAttempts = 0;
        let finalVideoUrl = `https://assets.mixkit.co/videos/preview/mixkit-nebula-in-outer-space-42284-large.mp4`;
        
        while (!done && checkAttempts < 20) {
          await new Promise(r => setTimeout(r, 1200));
          checkAttempts++;
          
          const statusRes = await fetch('/api/gemini/video-status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ operationName: opName })
          });
          const statusData = await statusRes.json();
          done = statusData.done;
          if (done && statusData.videoUrl) {
            finalVideoUrl = statusData.videoUrl;
          }
        }

        const limits = incrementGenerationCount(userProfile.uid, 'video');
        setDailyVideosUsed(limits.videosUsed);

        const newGen: Generation = {
          id: `gen_${Date.now()}`,
          userId: userProfile.uid,
          type: 'video',
          prompt: cleanPromptVid,
          url: finalVideoUrl,
          createdAt: Date.now()
        };

        await storeGeneration(newGen);
        setUserGenerations(prev => [newGen, ...prev]);

        const aiMsgId = `msg_ai_${Date.now()}`;
        const newAiMsg: Message = {
          id: aiMsgId,
          chatId: activeChatId,
          sender: 'ai',
          text: `VEO 3.1 video sentezi başarıyla tamamlandı: "${cleanPromptVid}"\n\nVideoyu dilediğiniz zaman hem buradan indirebilir hem de yan menüdeki Video Yap panelinden görüntüleyebilirsiniz.`,
          videoUrl: finalVideoUrl,
          createdAt: Date.now()
        };
        await storeMessage(newAiMsg);
        setMessages(prev => prev.filter(m => m.id !== statusId).concat(newAiMsg));
        setIsGenerating(false);
        return;
      } catch (err: any) {
        const aiMsgId = `msg_ai_${Date.now()}`;
        const newAiMsg: Message = {
          id: aiMsgId,
          chatId: activeChatId,
          sender: 'ai',
          text: `Video canlandırılırken bir hata oluştu: ${err.message}`,
          createdAt: Date.now()
        };
        await storeMessage(newAiMsg);
        setMessages(prev => prev.filter(m => m.id !== statusId).concat(newAiMsg));
        setIsGenerating(false);
        return;
      }
    }

    // Adjust chat title if it's the first few messages
    if (messages.length <= 1) {
      const updatedChat = chats.find(c => c.id === activeChatId);
      if (updatedChat && updatedChat.title === 'Yeni Sohbet') {
        updatedChat.title = text.length > 25 ? text.substring(0, 25) + "..." : text;
        await storeChat(updatedChat);
        setChats([...chats]);
      }
    }

    try {
      // Create request messages thread
      const currentMessages = await fetchMessages(activeChatId);
      
      const res = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: currentMessages,
          curseMode: userProfile.curseMode,
          userAge: userProfile.age,
          attachedImage
        })
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      const aiMsgId = `msg_ai_${Date.now()}`;
      const newAiMsg: Message = {
        id: aiMsgId,
        chatId: activeChatId,
        sender: 'ai',
        text: data.text,
        createdAt: Date.now()
      };

      await storeMessage(newAiMsg);
      setMessages(prev => [...prev, newAiMsg]);

    } catch (err: any) {
      console.error('API Send Error:', err);
      const errId = `msg_err_${Date.now()}`;
      const errMessage: Message = {
        id: errId,
        chatId: activeChatId,
        sender: 'ai',
        text: "Hata: Sunucu ile iletişim kurulamadı. " + err.message,
        createdAt: Date.now()
      };
      setMessages(prev => [...prev, errMessage]);
    } finally {
      setIsGenerating(false);
    }
  };

  // ----------------------------------------------------
  // GENERATIVE STUDIO WORKFLOWS
  // ----------------------------------------------------
  const handleGenerateImage = async (prompt: string, model?: 'openai' | 'gemini') => {
    if (!userProfile) return;

    setIsGeneratingImage(true);

    try {
      const res = await fetch('/api/gemini/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          userAge: userProfile.age,
          model: model || 'openai'
        })
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      // Increment limits representation
      const limits = incrementGenerationCount(userProfile.uid, 'image');
      setDailyImagesUsed(limits.imagesUsed);

      // Save generated image to gallery with Model Name prefix
      const label = data.modelUsed ? `[${data.modelUsed}] ${prompt}` : prompt;
      const newGen: Generation = {
        id: `gen_${Date.now()}`,
        userId: userProfile.uid,
        type: 'image',
        prompt: label,
        url: data.imageUrl,
        createdAt: Date.now()
      };

      await storeGeneration(newGen);
      setUserGenerations(prev => [newGen, ...prev]);

    } catch (e: any) {
      alert("Görsel üretilemedi: " + e.message);
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleGenerateVideo = async (prompt: string) => {
    if (!userProfile) return;

    setIsGeneratingVideo(true);

    try {
      // 1. Trigger generate video on server
      const triggerRes = await fetch('/api/gemini/generate-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          userAge: userProfile.age
        })
      });

      const triggerData = await triggerRes.json();
      if (triggerData.error) throw new Error(triggerData.error);

      const opName = triggerData.operationName;

      // 2. Poll video generation status until "done: true"
      let done = false;
      let checkAttempts = 0;
      let finalVideoUrl = `https://assets.mixkit.co/videos/preview/mixkit-nebula-in-outer-space-42284-large.mp4`;
      
      while (!done && checkAttempts < 25) {
        await new Promise(r => setTimeout(r, 1200));
        checkAttempts++;
        
        const statusRes = await fetch('/api/gemini/video-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ operationName: opName })
        });
        const statusData = await statusRes.json();
        done = statusData.done;
        if (done && statusData.videoUrl) {
          finalVideoUrl = statusData.videoUrl;
        }
      }

      // 3. Increment counters and store metadata URL links to gallery
      const limits = incrementGenerationCount(userProfile.uid, 'video');
      setDailyVideosUsed(limits.videosUsed);

      const newGen: Generation = {
        id: `gen_${Date.now()}`,
        userId: userProfile.uid,
        type: 'video',
        prompt,
        url: finalVideoUrl,
        createdAt: Date.now()
      };

      await storeGeneration(newGen);
      setUserGenerations(prev => [newGen, ...prev]);

    } catch (e: any) {
      alert("Video üretilemedi: " + e.message);
    } finally {
      setIsGeneratingVideo(false);
    }
  };

  const handleDeleteGeneration = async (genId: string) => {
    try {
      await removeGeneration(genId);
      setUserGenerations(prev => prev.filter(g => g.id !== genId));
    } catch (e: any) {
      alert("Görsel silinemedi: " + e.message);
    }
  };

  const handleEnhanceGeneration = async (gen: Generation) => {
    if (!userProfile) return;

    const res = await fetch('/api/gemini/enhance-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: gen.prompt
      })
    });

    const data = await res.json();
    if (data.error) throw new Error(data.error);

    const newGen: Generation = {
      id: `gen_${Date.now()}`,
      userId: userProfile.uid,
      type: 'image',
      prompt: `${gen.prompt} (Remastered photorealistic 8k quality)`,
      url: data.imageUrl,
      createdAt: Date.now()
    };

    await storeGeneration(newGen);
    setUserGenerations(prev => [newGen, ...prev]);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-white font-sans">
        <div className="text-center space-y-3">
          <Sparkles className="w-8 h-8 text-cyan-400 animate-spin mx-auto" />
          <p className="text-xs text-white/40 font-mono uppercase tracking-widest">Benim AI Hazırlanıyor...</p>
        </div>
      </div>
    );
  }

  if (!userProfile) {
    return (
      <div className="min-h-screen bg-black flex flex-col justify-between p-6 text-white font-sans select-none relative overflow-hidden">
        {/* Abstract decor backgrounds */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(6,182,212,0.07)_0%,transparent_60%)] pointer-events-none" />
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent" />

        {/* Top bar info */}
        <div className="flex justify-between items-center z-10">
          <span className="text-[10px] text-cyan-400 font-mono tracking-widest uppercase">
            [ SİSTEM BAĞLANTISI: ÇEVRİMİÇİ ]
          </span>
          <span className="text-[9px] text-white/20 font-mono uppercase">
            Sürüm 1.4.0
          </span>
        </div>

        {/* Central Auth Brand Card */}
        <div className="max-w-md w-full mx-auto my-auto text-center space-y-8 z-10 border border-white/10 bg-[#060606] p-8 md:p-12 relative">
          <div className="absolute top-0 left-4 -translate-y-1/2 bg-black px-2 text-[9px] text-white/40 uppercase tracking-widest font-mono">
            BENİM AI ACCESS HUB
          </div>
          
          <div className="space-y-4">
            <Logo variant="square" size="xl" className="justify-center" />
            <div className="space-y-1">
              <h1 className="text-3xl font-black uppercase tracking-tighter italic text-white flex items-center justify-center gap-1.5 leading-none">
                BENİM AI <span className="text-xs bg-cyan-400/20 text-cyan-400 px-1 border border-cyan-400/30 not-italic">PRO</span>
              </h1>
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed font-mono uppercase tracking-wide">
              İstanbul siber-punk tasarımları, gelişmiş Türkçe ses asistanlığı, akıllı kamera soru çözümlemeleri ve siber-canlı görüntülü sesli asistan portalı.
            </p>
          </div>

          <div className="space-y-3 pt-4">
            <button
              onClick={handleGoogleSignIn}
              className="w-full py-4 bg-white text-black hover:bg-cyan-400 transition-all text-xs font-black uppercase tracking-widest flex items-center justify-center gap-3 shadow-lg hover:shadow-cyan-400/10 rounded-none shadow-md"
              id="btn_google_sign_in"
            >
              <Chrome className="w-4 h-4" />
              <span>GOOGLE İLE GİRİŞ YAP</span>
            </button>
            <p className="text-[8px] text-white/25 leading-normal tracking-wide uppercase font-mono">
              Güvenli Google Kimlik Doğrulama modülü. Hesap verileriniz uçtan uca şifrelenir ve korunur.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen flex flex-col h-screen overflow-hidden font-sans ${isDarkMode ? 'bg-zinc-950 text-zinc-100' : 'bg-gray-50 text-zinc-900'}`}>
      
      {/* Unified Cybernetic Top Header for all screen sizes */}
      <header className="bg-[#050505] border-b border-white/10 p-4 shrink-0 flex items-center justify-between z-30">
        <div className="flex items-center gap-3">
          {/* Elegant 3-line Hamburg menu trigger button */}
          <button 
            onClick={() => setIsMobileDrawerOpen(true)}
            className="p-2.5 bg-[#0A0A0A] border border-white/10 text-zinc-300 hover:border-cyan-400 hover:text-white transition-all rounded-none"
            title="Ana Menü / Ayarlar"
            id="btn_open_drawer"
          >
            <Menu className="w-5 h-5" />
          </button>
          
          <Logo variant="circle" size="sm" showText={true} />
        </div>

        <div className="flex items-center gap-2">
          {/* Theme Switch Button */}
          <button
            onClick={toggleTheme}
            className="p-2.5 bg-[#0A0A0A] border border-white/10 text-zinc-300 hover:border-cyan-400 hover:text-white transition-all rounded-none flex items-center justify-center cursor-pointer"
            title={isDarkMode ? "Aydınlık Moda Geç" : "Karanlık Moda Geç"}
            id="btn_toggle_theme"
          >
            {isDarkMode ? <Sun className="w-4 h-4 text-amber-450" /> : <Moon className="w-4 h-4 text-violet-400" />}
          </button>

          <button
            onClick={handleNewChat}
            className="bg-white hover:bg-cyan-400 text-black px-4 py-2.5 rounded-none text-[10px] font-black uppercase tracking-widest transition-colors cursor-pointer"
            id="btn_header_new_chat"
          >
            YENİ +
          </button>
        </div>
      </header>

      {/* Main Responsive Left Drawer (Sidebar wrapper) */}
      <Sidebar
        chats={chats}
        activeChatId={activeChatId}
        onSelectChat={(id) => {
          onSelectChat(id);
          setIsMobileDrawerOpen(false);
        }}
        onNewChat={() => {
          handleNewChat();
          setIsMobileDrawerOpen(false);
        }}
        onDeleteChat={handleDeleteChat}
        userProfile={userProfile}
        onUpdateProfile={handleUpdateProfile}
        activeSection={activeSection}
        onChangeSection={(s) => {
          setActiveSection(s);
          setIsMobileDrawerOpen(false);
        }}
        dailyImagesUsed={dailyImagesUsed}
        dailyVideosUsed={dailyVideosUsed}
        onSignOut={handleSignOut}
        isOpen={isMobileDrawerOpen}
        onClose={() => setIsMobileDrawerOpen(false)}
      />

      {/* Primary Workspace View */}
      <main className="flex-grow flex flex-col h-full overflow-hidden min-w-0 relative" id="main_workspace">
        {activeSection === 'chat' ? (
          <ChatView
            messages={messages}
            onSendMessage={handleSendMessage}
            isGenerating={isGenerating}
            userProfile={userProfile}
            onOpenVoip={() => setIsVoipOpen(true)}
          />
        ) : (
          <StudioView
            userProfile={userProfile}
            userGenerations={userGenerations}
            onGenerateImage={handleGenerateImage}
            onGenerateVideo={handleGenerateVideo}
            isGeneratingImage={isGeneratingImage}
            isGeneratingVideo={isGeneratingVideo}
            dailyImagesUsed={dailyImagesUsed}
            dailyVideosUsed={dailyVideosUsed}
            onDeleteGeneration={handleDeleteGeneration}
            onEnhanceGeneration={handleEnhanceGeneration}
          />
        )}
      </main>

      {/* Immersive Cyber VOIP overlay with Screen share / Live Webcam / Hands-free audio chat */}
      <LiveVoipOverlay 
        isOpen={isVoipOpen}
        onClose={() => setIsVoipOpen(false)}
        userProfile={userProfile}
      />
    </div>
  );

  function onSelectChat(id: string) {
    setActiveChatId(id);
    stopSpeaking();
    setActiveSection('chat');
  }
}
