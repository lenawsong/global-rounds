import { nanoid } from 'nanoid';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ChatRole = 'user' | 'assistant';

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string;
  status?: 'pending' | 'error' | 'success';
};

type ChatState = {
  messages: ChatMessage[];
  addMessage: (message: Omit<ChatMessage, 'id' | 'createdAt'> & Partial<Pick<ChatMessage, 'id'>>) => string;
  updateMessage: (id: string, updates: Partial<ChatMessage>) => void;
  reset: () => void;
};

export const useChatStore = create<ChatState>()(
  persist(
    (set) => ({
      messages: [],
      addMessage: (message) => {
        const id = message.id ?? nanoid();
        const entry: ChatMessage = {
          id,
          role: message.role,
          content: message.content,
          createdAt: new Date().toISOString(),
          status: message.status ?? 'pending'
        };
        set((state) => ({
          messages: [...state.messages, entry]
        }));
        return id;
      },
      updateMessage: (id, updates) =>
        set((state) => ({
          messages: state.messages.map((message) =>
            message.id === id ? { ...message, ...updates } : message
          )
        })),
      reset: () => set({ messages: [] })
    }),
    { name: 'nh-dashboard-chat' }
  )
);
