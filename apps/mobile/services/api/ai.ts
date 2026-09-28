import { apiClient } from './client';

export interface AIChatPayload {
  message: string;
  history?: { role: string; content: string }[];
  current_context?: Record<string, any>;
}

export interface AIChatResult {
  reply: string;
  tool_calls_made: {
    tool: string;
    parameters: Record<string, any>;
    result?: any;
  }[];
  suggested_action?: {
    type: 'NAVIGATE' | 'SELECT_ROUTE' | 'OPTIMIZE_STOPS' | 'ADD_STOP';
    payload: any;
  };
}

export const aiService = {
  async chat(payload: AIChatPayload): Promise<AIChatResult> {
    const response = await apiClient.post<AIChatResult>('/ai/chat', payload);
    if (response.data) {
      return response.data;
    }
    return {
      reply: "I'm having trouble connecting to the Route Intelligence Engine. Please check your network connection.",
      tool_calls_made: [],
    };
  },
};
