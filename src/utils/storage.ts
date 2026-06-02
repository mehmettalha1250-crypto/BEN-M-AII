/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { doc, getDoc, setDoc, deleteDoc, collection, getDocs, query, orderBy, where, addDoc } from 'firebase/firestore';
import { db, isFirebaseConnected, handleFirestoreError, OperationType } from '../firebase';
import { UserProfile, Chat, Message, Generation, DailyLimit } from '../types';

// Helper to determine active date key for checking daily limits (YYYY-MM-DD)
function getTodayDateString(): string {
  const d = new Date();
  return d.toISOString().split('T')[0];
}

// ----------------------------------------------------
// LocalStorage Fallback DB implementation
// ----------------------------------------------------
const LOCAL_PROFILE_KEY = 'nova_user_profile';
const LOCAL_CHATS_KEY = 'nova_chats';
const LOCAL_MESSAGES_KEY = 'nova_messages';
const LOCAL_GENERATIONS_KEY = 'nova_generations';
const LOCAL_LIMIT_KEY = 'nova_daily_limits';

// Standard pre-made visual assets to make the app's initial feed beautifully exciting
export const PREMADE_GALLERY: Generation[] = [
  {
    id: "pre_1",
    userId: "system",
    type: "image",
    prompt: "Siber-punk İstanbul manzarası, neon ışıklı Galata Kulesi, uçan arabalar ve holografik martılar, dijital sanat",
    url: "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=800&q=80",
    createdAt: Date.now() - 3600000 * 2
  },
  {
    id: "pre_2",
    userId: "system",
    type: "video",
    prompt: "Uzayda süzülen neon hologram kedi, derin kozmos ve parıldayan nebulalar",
    url: "https://assets.mixkit.co/videos/preview/mixkit-nebula-in-outer-space-42284-large.mp4",
    createdAt: Date.now() - 3600000 * 5
  },
  {
    id: "pre_3",
    userId: "system",
    type: "image",
    prompt: "Gür dağ zirvesinde altın saatte meditasyon yapan kadın, fotogerçekçi",
    url: "https://images.unsplash.com/photo-1545205597-3d9d02c29597?auto=format&fit=crop&w=800&q=80",
    createdAt: Date.now() - 3600000 * 12
  },
  {
    id: "pre_4",
    userId: "system",
    type: "video",
    prompt: "Matrix tarzı kod yağmurları ve siber güvenlik terminal akış döngüsü",
    url: "https://assets.mixkit.co/videos/preview/mixkit-digital-animation-of-screens-and-numbers-41913-large.mp4",
    createdAt: Date.now() - 3600000 * 24
  }
];

export async function storeUserProfile(profile: UserProfile): Promise<void> {
  if (isFirebaseConnected && db) {
    const path = `users/${profile.uid}`;
    try {
      // Conforms to exact creation schema on firestore.rules
      await setDoc(doc(db, 'users', profile.uid), {
        uid: profile.uid,
        email: profile.email,
        displayName: profile.displayName || "Kullanıcı",
        birthdate: profile.birthdate,
        age: profile.age,
        selectedVoice: profile.selectedVoice || 'Selin',
        curseMode: profile.curseMode || false,
        createdAt: new Date(profile.createdAt)
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, path);
    }
  } else {
    localStorage.setItem(LOCAL_PROFILE_KEY, JSON.stringify(profile));
  }
}

export async function fetchUserProfile(uid: string): Promise<UserProfile | null> {
  if (isFirebaseConnected && db) {
    const path = `users/${uid}`;
    try {
      const snap = await getDoc(doc(db, 'users', uid));
      if (snap.exists()) {
        const d = snap.data();
        return {
          uid: d.uid,
          email: d.email,
          displayName: d.displayName,
          birthdate: d.birthdate,
          age: d.age,
          selectedVoice: d.selectedVoice,
          curseMode: d.curseMode,
          createdAt: d.createdAt?.toDate?.()?.toISOString() || new Date().toISOString()
        };
      }
    } catch (e) {
      handleFirestoreError(e, OperationType.GET, path);
    }
  } else {
    const cached = localStorage.getItem(LOCAL_PROFILE_KEY);
    if (cached) return JSON.parse(cached);
  }
  return null;
}

export async function fetchChats(userId: string): Promise<Chat[]> {
  if (isFirebaseConnected && db) {
    const path = 'chats';
    try {
      const q = query(
        collection(db, 'chats'),
        where('userId', '==', userId),
        orderBy('createdAt', 'desc')
      );
      const snap = await getDocs(q);
      const list: Chat[] = [];
      snap.forEach(docSnap => {
        const data = docSnap.data();
        list.push({
          id: data.id,
          userId: data.userId,
          title: data.title,
          createdAt: data.createdAt?.toDate?.()?.getTime() || Date.now()
        });
      });
      return list;
    } catch (e) {
      handleFirestoreError(e, OperationType.LIST, path);
    }
  }

  // Local fallback
  const cached = localStorage.getItem(LOCAL_CHATS_KEY);
  if (cached) {
    const all: Chat[] = JSON.parse(cached);
    return all.filter(c => c.userId === userId).sort((a, b) => b.createdAt - a.createdAt);
  }
  return [];
}

export async function storeChat(chat: Chat): Promise<void> {
  if (isFirebaseConnected && db) {
    const path = `chats/${chat.id}`;
    try {
      await setDoc(doc(db, 'chats', chat.id), {
        id: chat.id,
        userId: chat.userId,
        title: chat.title,
        createdAt: new Date(chat.createdAt)
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, path);
    }
  } else {
    const cached = localStorage.getItem(LOCAL_CHATS_KEY);
    const list: Chat[] = cached ? JSON.parse(cached) : [];
    const index = list.findIndex(c => c.id === chat.id);
    if (index >= 0) list[index] = chat;
    else list.push(chat);
    localStorage.setItem(LOCAL_CHATS_KEY, JSON.stringify(list));
  }
}

export async function removeChat(chatId: string): Promise<void> {
  if (isFirebaseConnected && db) {
    const path = `chats/${chatId}`;
    try {
      await deleteDoc(doc(db, 'chats', chatId));
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, path);
    }
  } else {
    const cached = localStorage.getItem(LOCAL_CHATS_KEY);
    if (cached) {
      const list: Chat[] = JSON.parse(cached);
      const updated = list.filter(c => c.id !== chatId);
      localStorage.setItem(LOCAL_CHATS_KEY, JSON.stringify(updated));
    }
    // Also prune orphaned messages
    const cachedMsgs = localStorage.getItem(LOCAL_MESSAGES_KEY);
    if (cachedMsgs) {
      const allMsgs: Message[] = JSON.parse(cachedMsgs);
      const pruned = allMsgs.filter(m => m.chatId !== chatId);
      localStorage.setItem(LOCAL_MESSAGES_KEY, JSON.stringify(pruned));
    }
  }
}

export async function fetchMessages(chatId: string): Promise<Message[]> {
  if (isFirebaseConnected && db) {
    const path = `chats/${chatId}/messages`;
    try {
      const q = query(
        collection(db, 'chats', chatId, 'messages'),
        orderBy('createdAt', 'asc')
      );
      const snap = await getDocs(q);
      const list: Message[] = [];
      snap.forEach(docSnap => {
        const data = docSnap.data();
        list.push({
          id: data.id,
          chatId,
          sender: data.sender,
          text: data.text,
          imageUrl: data.imageUrl,
          audioUrl: data.audioUrl,
          createdAt: data.createdAt?.toDate?.()?.getTime() || Date.now()
        });
      });
      return list;
    } catch (e) {
      handleFirestoreError(e, OperationType.LIST, path);
    }
  }

  // Local fallback
  const cached = localStorage.getItem(LOCAL_MESSAGES_KEY);
  if (cached) {
    const allMsgs: Message[] = JSON.parse(cached);
    return allMsgs.filter(m => m.chatId === chatId).sort((a, b) => a.createdAt - b.createdAt);
  }
  return [];
}

export async function storeMessage(msg: Message): Promise<void> {
  if (isFirebaseConnected && db) {
    const path = `chats/${msg.chatId}/messages/${msg.id}`;
    try {
      await setDoc(doc(db, 'chats', msg.chatId, 'messages', msg.id), {
        id: msg.id,
        sender: msg.sender,
        text: msg.text,
        imageUrl: msg.imageUrl || null,
        audioUrl: msg.audioUrl || null,
        createdAt: new Date(msg.createdAt)
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, path);
    }
  } else {
    const cached = localStorage.getItem(LOCAL_MESSAGES_KEY);
    const list: Message[] = cached ? JSON.parse(cached) : [];
    list.push(msg);
    localStorage.setItem(LOCAL_MESSAGES_KEY, JSON.stringify(list));
  }
}

export async function fetchGenerations(userId: string): Promise<Generation[]> {
  if (isFirebaseConnected && db) {
    const path = 'generations';
    try {
      const q = query(
        collection(db, 'generations'),
        where('userId', '==', userId),
        orderBy('createdAt', 'desc')
      );
      const snap = await getDocs(q);
      const list: Generation[] = [];
      snap.forEach(docSnap => {
        const data = docSnap.data();
        list.push({
          id: data.id,
          userId: data.userId,
          type: data.type,
          prompt: data.prompt,
          url: data.url,
          createdAt: data.createdAt?.toDate?.()?.getTime() || Date.now()
        });
      });
      return list;
    } catch (e) {
      handleFirestoreError(e, OperationType.LIST, path);
    }
  }

  // Local fallback
  const cached = localStorage.getItem(LOCAL_GENERATIONS_KEY);
  const list: Generation[] = cached ? JSON.parse(cached) : [];
  return list.filter(g => g.userId === userId).sort((a,b) => b.createdAt - a.createdAt);
}

export async function storeGeneration(gen: Generation): Promise<void> {
  if (isFirebaseConnected && db) {
    const path = `generations/${gen.id}`;
    try {
      await setDoc(doc(db, 'generations', gen.id), {
        id: gen.id,
        userId: gen.userId,
        type: gen.type,
        prompt: gen.prompt,
        url: gen.url,
        createdAt: new Date(gen.createdAt)
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, path);
    }
  } else {
    const cached = localStorage.getItem(LOCAL_GENERATIONS_KEY);
    const list: Generation[] = cached ? JSON.parse(cached) : [];
    list.unshift(gen);
    localStorage.setItem(LOCAL_GENERATIONS_KEY, JSON.stringify(list));
  }
}

export async function removeGeneration(genId: string): Promise<void> {
  if (isFirebaseConnected && db) {
    const path = `generations/${genId}`;
    try {
      await deleteDoc(doc(db, 'generations', genId));
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, path);
    }
  } else {
    const cached = localStorage.getItem(LOCAL_GENERATIONS_KEY);
    if (cached) {
      const list: Generation[] = JSON.parse(cached);
      const updated = list.filter(g => g.id !== genId);
      localStorage.setItem(LOCAL_GENERATIONS_KEY, JSON.stringify(updated));
    }
  }
}

// ----------------------------------------------------
// DAILY CREDIT LIMIT MANAGERS (25 Image & 5 Video)
// ----------------------------------------------------
export function getDailyLimits(userId: string): DailyLimit {
  const today = getTodayDateString();
  const cached = localStorage.getItem(`${LOCAL_LIMIT_KEY}_${userId}`);
  
  if (cached) {
    const parsed: DailyLimit = JSON.parse(cached);
    if (parsed.lastResetDate === today) {
      return parsed;
    }
  }

  // Initialize new daily counter
  const fresh: DailyLimit = {
    imagesUsed: 0,
    videosUsed: 0,
    lastResetDate: today
  };
  localStorage.setItem(`${LOCAL_LIMIT_KEY}_${userId}`, JSON.stringify(fresh));
  return fresh;
}

export function incrementGenerationCount(userId: string, type: 'image' | 'video'): DailyLimit {
  const current = getDailyLimits(userId);
  if (type === 'image') {
    current.imagesUsed += 1;
  } else {
    current.videosUsed += 1;
  }
  localStorage.setItem(`${LOCAL_LIMIT_KEY}_${userId}`, JSON.stringify(current));
  return current;
}
