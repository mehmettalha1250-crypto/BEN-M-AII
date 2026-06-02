/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  birthdate: string;
  age: number;
  selectedVoice: string; // 'Ali' | 'Can' | 'Selin' | 'Ebru'
  curseMode: boolean;
  createdAt: string;
}

export interface Chat {
  id: string;
  userId: string;
  title: string;
  createdAt: number;
}

export interface Message {
  id: string;
  chatId: string;
  sender: 'user' | 'ai';
  text: string;
  imageUrl?: string;
  videoUrl?: string;
  audioUrl?: string;
  createdAt: number;
}

export interface Generation {
  id: string;
  userId: string;
  type: 'image' | 'video';
  prompt: string;
  url: string;
  createdAt: number;
}

export interface DailyLimit {
  imagesUsed: number;
  videosUsed: number;
  lastResetDate: string; // YYYY-MM-DD
}
