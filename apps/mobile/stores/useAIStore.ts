import { create } from 'zustand';
import { AIChatMessage } from '@/types';
import { aiService } from '@/services/api/ai';
import { aiRouteService, RouteIntent } from '@/services/api/aiRoute';
import { useRouteStore } from './useRouteStore';

interface AIState {
  messages: AIChatMessage[];
  isThinking: boolean;
  isListening: boolean;
  isSpeaking: boolean;
  lastToolCall: any | null;
  routeIntent: RouteIntent | null;

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
  routeIntent: null,

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

      const routeLike = /\b(to|from|visit|destination|navigate|route|go|going|head(?:ing)?|travel(?:ling|ing)?|driv(?:e|ing)|directions|avoid\s+tolls?|avoid\s+highways?|add\s+.+\s+stop)\b/i.test(text);
      let routePlan = null;
      let routeError: unknown = null;
      try {
        const current = context?.current_location;
        routePlan = await aiRouteService.plan(
          text,
          current && typeof current.lat === 'number' && typeof current.lng === 'number' ? current : null,
          { route_intent: get().routeIntent, ...(context || {}) },
        );
      } catch (error) {
        routeError = error;
        routePlan = null;
      }

      if (routePlan && routePlan.status !== 'not_route_request') {
        if (routePlan.intent) set({ routeIntent: routePlan.intent });
        if (routePlan.status === 'route_ready' && routePlan.route && routePlan.resolved_locations) {
          const { route, resolved_locations: resolved } = routePlan;
          const best = route.routes.find((candidate) => candidate.id === route.best_route_id) || route.routes[0];
          useRouteStore.setState({
            origin: resolved.origin,
            destination: resolved.destination,
            waypoints: resolved.waypoints,
            candidateRoutes: route.routes,
            selectedRouteId: best?.id || null,
            metadata: { ...(route.metadata || {}), avoid_features: routePlan.intent.avoid },
          });
          const trafficLabel = route.metadata?.traffic_available ? best.traffic_level : 'Unavailable';
          const reply = `Route found: ${resolved.origin.address || resolved.origin.name || 'Start'} to ${resolved.destination.address || resolved.destination.name || 'Destination'}. ${best.distance_km} km, ${best.duration_min} min${trafficLabel === 'Unavailable' ? '; live traffic unavailable' : `; traffic ${trafficLabel.toLowerCase()}`}.`;
          const assistantMsg: AIChatMessage = {
            id: `ai_${Date.now()}`,
            role: 'assistant',
            content: reply,
            timestamp: Date.now(),
            tool_calls: [
              { tool: 'parse_route_intent', parameters: { preference: routePlan.intent.route_preference } },
              { tool: 'geocode_locations', parameters: { count: resolved.waypoints.length + 2 } },
              { tool: 'calculate_road_route', parameters: { alternatives: route.routes.length } },
            ],
            suggested_action: routePlan.navigation?.ready ? { type: 'NAVIGATE', payload: { routeId: best.id } } : undefined,
          };
          set((state) => ({ messages: [...state.messages, assistantMsg], isThinking: false, lastToolCall: assistantMsg.tool_calls?.[0] || null }));
          return;
        }

        const assistantMsg: AIChatMessage = {
          id: `ai_${Date.now()}`,
          role: 'assistant',
          content: routePlan.message || 'Please clarify the locations before I calculate a route.',
          timestamp: Date.now(),
        };
        set((state) => ({ messages: [...state.messages, assistantMsg], isThinking: false }));
        return;
      }

      if (routeLike && !routePlan) {
        throw routeError instanceof Error
          ? routeError
          : new Error('The route service is unavailable. You can still enter a destination manually.');
      }

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
        content: e instanceof Error ? e.message : 'The assistant is unavailable. You can still plan a route manually.',
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
  clearHistory: () => set({ messages: INITIAL_MESSAGES, routeIntent: null }),
}));
