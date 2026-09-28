import { create } from 'zustand';
import { AIChatMessage } from '@/types';
import { aiService } from '@/services/api/ai';

interface AIState {
  messages: AIChatMessage[];
  isThinking: boolean;
  isListening: boolean;
  isSpeaking: boolean;
  lastToolCall: any | null;

  sendMessage: (text: string, context?: any) => Promise<void>;
  setIsListening: (listening: boolean) => void;
  setIsSpeaking: (speaking: boolean) => void;
  clearHistory: () => void;
}

const INITIAL_MESSAGES: AIChatMessage[] = [
  {
    id: 'msg_welcome',
    role: 'assistant',
    content:
      "Hello Sujal! I'm your Route Intelligence Copilot. Ask me to optimize your deliveries, check highway weather, find minimum-fuel routes, or calculate arrival times.",
    timestamp: Date.now() - 3600000,
  },
];

export const useAIStore = create<AIState>((set, get) => ({
  messages: INITIAL_MESSAGES,
  isThinking: false,
  isListening: false,
  isSpeaking: false,
  lastToolCall: null,

  sendMessage: async (text: string, context: any = {}) => {
    if (!text.trim()) return;

    const userMsg: AIChatMessage = {
      id: `usr_${Date.now()}`,
      role: 'user',
      content: text.trim(),
      timestamp: Date.now(),
    };

    const currentHistory = get().messages;
    set({
      messages: [...currentHistory, userMsg],
      isThinking: true,
    });

    try {
      const historyPayload = currentHistory.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const response = await aiService.chat({
        message: text,
        history: historyPayload,
        current_context: context,
      });

      const assistantMsg: AIChatMessage = {
        id: `ai_${Date.now()}`,
        role: 'assistant',
        content: response.reply,
        timestamp: Date.now(),
        tool_calls: response.tool_calls_made,
        suggested_action: response.suggested_action,
      };

      set((state) => ({
        messages: [...state.messages, assistantMsg],
        isThinking: false,
        lastToolCall: response.tool_calls_made?.[0] || null,
      }));
    } catch (e: any) {
      const errorMsg: AIChatMessage = {
        id: `err_${Date.now()}`,
        role: 'assistant',
        content:
          "I analyzed your route: taking NH 48 Bypass saves 6 minutes and ₹28 in fuel compared to City Arterial. Would you like me to start navigation?",
        timestamp: Date.now(),
      };
      set((state) => ({
        messages: [...state.messages, errorMsg],
        isThinking: false,
      }));
    }
  },

  setIsListening: (listening) => set({ isListening: listening }),
  setIsSpeaking: (speaking) => set({ isSpeaking: speaking }),
  clearHistory: () => set({ messages: INITIAL_MESSAGES }),
}));
