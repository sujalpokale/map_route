"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Sparkles,
  Mic,
  MicOff,
  Send,
  X,
  Bot,
  User,
  Wrench,
  Volume2,
  CornerDownLeft,
} from "lucide-react";
import { sendAIChat } from "@/lib/api";

interface AIAssistantDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateTab?: (tab: string) => void;
}

interface MessageItem {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolCalls?: { tool: string; input: any; output: any }[];
}

export default function AIAssistantDrawer({ isOpen, onClose, onNavigateTab }: AIAssistantDrawerProps) {
  const [messages, setMessages] = useState<MessageItem[]>([
    {
      id: "init-1",
      role: "assistant",
      content:
        "Hi! I'm your Google Maps Route Assistant. Ask me to compare routes, check live traffic or weather hazards, calculate fuel costs, or sequence multi-stop delivery tours.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const quickPrompts = [
    "Fastest route to Mumbai",
    "Compare fuel costs for electric van",
    "Will weather cause delays today?",
    "Optimize multi-stop delivery",
  ];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleSend = async (textToSend?: string) => {
    const text = textToSend || input;
    if (!text.trim() || loading) return;

    const userMsg: MessageItem = {
      id: Date.now().toString(),
      role: "user",
      content: text,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const historyPayload = messages.map((m) => ({ role: m.role, content: m.content }));
      const response = await sendAIChat(text, historyPayload);

      const assistantMsg: MessageItem = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: response.reply,
        toolCalls: response.tool_calls_made,
      };
      setMessages((prev) => [...prev, assistantMsg]);

      // Voice read-back if speech synthesis is supported
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        const plainText = response.reply.replace(/[*_#`]/g, "").slice(0, 200);
        const utterance = new SpeechSynthesisUtterance(plainText);
        window.speechSynthesis.speak(utterance);
      }

      if (response.suggested_action?.type === "navigate" && response.suggested_action.tab && onNavigateTab) {
        onNavigateTab(response.suggested_action.tab);
      }
    } catch (e: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "assistant",
          content: `⚠️ Error executing assistant query: ${e.message || "Failed to reach backend."}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Web Speech API Voice Recognition
  const toggleSpeechRecognition = () => {
    if (typeof window === "undefined") return;
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in this browser. Please use Google Chrome or Edge.");
      return;
    }

    if (isListening) {
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = "en-IN";
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      recognition.onerror = () => setIsListening(false);

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInput(transcript);
        handleSend(transcript);
      };

      recognition.start();
    } catch (e) {
      console.warn("Speech recognition error", e);
      setIsListening(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-[1100] w-full max-w-md flex flex-col bg-white border-l border-[#dadce0] shadow-2xl animate-in slide-in-from-right duration-300">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#dadce0] bg-[#f8f9fa]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#1a73e8] via-[#8ab4f8] to-[#9333ea] flex items-center justify-center text-white font-bold shadow-sm">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#202124]">Gemini Route Assistant</h3>
            <span className="text-[11px] text-[#188038] font-medium flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#188038] animate-pulse" /> Live Grounded Tools Active
            </span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-full text-[#5f6368] hover:text-[#202124] hover:bg-[#e8eaed] transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Message History */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-[#f8f9fa]">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex gap-2.5 text-xs leading-relaxed ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {m.role === "assistant" && (
              <div className="w-7 h-7 rounded-full bg-white border border-[#dadce0] flex items-center justify-center shrink-0 mt-0.5 text-[#1a73e8] shadow-xs">
                <Sparkles className="w-3.5 h-3.5" />
              </div>
            )}

            <div
              className={`max-w-[85%] rounded-2xl p-3.5 space-y-1.5 ${
                m.role === "user"
                  ? "bg-[#1a73e8] text-white font-medium rounded-tr-xs shadow-xs"
                  : "bg-white border border-[#dadce0] text-[#202124] rounded-tl-xs shadow-xs"
              }`}
            >
              {/* Tool call execution badge if any */}
              {m.toolCalls && m.toolCalls.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-1 pb-1.5 border-b border-[#e8eaed]">
                  {m.toolCalls.map((tc, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-[#e8f0fe] text-[#1a73e8] border border-[#d2e3fc]"
                    >
                      <Wrench className="w-2.5 h-2.5" /> {tc.tool}()
                    </span>
                  ))}
                </div>
              )}

              <div className="whitespace-pre-wrap">{m.content}</div>
            </div>

            {m.role === "user" && (
              <div className="w-7 h-7 rounded-full bg-[#e8f0fe] border border-[#d2e3fc] flex items-center justify-center shrink-0 mt-0.5 text-[#1a73e8]">
                <User className="w-3.5 h-3.5" />
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-2.5 text-xs text-[#5f6368]">
            <div className="w-7 h-7 rounded-full bg-white border border-[#dadce0] flex items-center justify-center text-[#1a73e8] shadow-xs">
              <Sparkles className="w-3.5 h-3.5 animate-spin" />
            </div>
            <div className="p-2.5 px-3.5 rounded-2xl bg-white border border-[#dadce0] flex items-center gap-2 shadow-xs">
              <span className="w-2 h-2 rounded-full bg-[#1a73e8] animate-ping" />
              Analyzing routes & synthesizing recommendations...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Prompts Chips */}
      <div className="px-4 py-2 border-t border-[#e8eaed] bg-white flex gap-1.5 overflow-x-auto no-scrollbar">
        {quickPrompts.map((qp, i) => (
          <button
            key={i}
            onClick={() => handleSend(qp)}
            className="text-[11px] whitespace-nowrap px-3 py-1.5 rounded-full bg-[#f1f3f4] hover:bg-[#e8eaed] border border-[#dadce0] text-[#3c4043] font-medium transition-colors"
          >
            {qp}
          </button>
        ))}
      </div>

      {/* Input Area */}
      <div className="p-3.5 border-t border-[#dadce0] bg-white flex items-center gap-2">
        {/* Voice Recognition Button */}
        <button
          type="button"
          onClick={toggleSpeechRecognition}
          className={`p-2.5 rounded-xl border transition-all ${
            isListening
              ? "bg-[#d93025] text-white border-[#d93025] animate-pulse shadow-sm"
              : "bg-[#f1f3f4] hover:bg-[#e8eaed] text-[#5f6368] border-[#dadce0]"
          }`}
          title="Voice Command"
        >
          {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        </button>

        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder={isListening ? "Listening... Speak now..." : "Ask Gemini route intelligence..."}
          className="flex-1 bg-[#f8f9fa] border border-[#dadce0] rounded-xl px-3.5 py-2.5 text-xs text-[#202124] placeholder-[#80868b] focus:outline-none focus:border-[#1a73e8] focus:bg-white transition-colors"
        />

        <button
          type="button"
          onClick={() => handleSend()}
          disabled={!input.trim() || loading}
          className="p-2.5 rounded-xl bg-[#1a73e8] hover:bg-[#1557b0] disabled:opacity-40 text-white font-bold transition-colors shadow-xs"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
