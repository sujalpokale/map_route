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
        "Hello! I am your AI Route Intelligence Assistant. I can analyze multi-factor route scores, calculate true vehicle fuel costs, optimize multi-stop deliveries, or verify weather hazards. How can I assist your journey today?",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const quickPrompts = [
    "Find the fastest route to Mumbai",
    "Which route will use less fuel to Hinjawadi?",
    "How much will a 45 km trip cost in a diesel van?",
    "Is rain expected on my route today?",
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
    <div className="fixed inset-y-0 right-0 z-[1100] w-full max-w-lg flex flex-col bg-slate-900/95 backdrop-blur-xl border-l border-white/10 shadow-2xl animate-in slide-in-from-right duration-300">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-slate-900/80">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-500 flex items-center justify-center text-slate-950 font-bold shadow-lg shadow-cyan-500/20">
            <Sparkles className="w-4 h-4 text-slate-950" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-100">AI Transportation Assistant</h3>
            <span className="text-[11px] text-emerald-400 font-medium flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Grounded Tool Calling Active
            </span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-white/10 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Message History */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex gap-3 text-xs leading-relaxed ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {m.role === "assistant" && (
              <div className="w-7 h-7 rounded-lg bg-slate-800 border border-white/10 flex items-center justify-center shrink-0 mt-0.5 text-cyan-400">
                <Bot className="w-4 h-4" />
              </div>
            )}

            <div
              className={`max-w-[85%] rounded-2xl p-3.5 space-y-2 ${
                m.role === "user"
                  ? "bg-cyan-500 text-slate-950 font-medium rounded-tr-sm"
                  : "bg-slate-800/80 border border-white/10 text-slate-200 rounded-tl-sm"
              }`}
            >
              {/* Tool call execution badge if any */}
              {m.toolCalls && m.toolCalls.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2 pb-2 border-b border-white/10">
                  {m.toolCalls.map((tc, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/30"
                    >
                      <Wrench className="w-2.5 h-2.5" /> {tc.tool}()
                    </span>
                  ))}
                </div>
              )}

              <div className="whitespace-pre-wrap">{m.content}</div>
            </div>

            {m.role === "user" && (
              <div className="w-7 h-7 rounded-lg bg-cyan-600/30 border border-cyan-500/40 flex items-center justify-center shrink-0 mt-0.5 text-cyan-300">
                <User className="w-4 h-4" />
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <div className="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center text-cyan-400">
              <Bot className="w-4 h-4 animate-spin" />
            </div>
            <div className="p-3 rounded-2xl bg-slate-800/60 border border-white/10 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
              Executing tools & synthesizing route scores...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Prompts Chips */}
      <div className="px-4 py-2 border-t border-white/5 flex gap-2 overflow-x-auto no-scrollbar">
        {quickPrompts.map((qp, i) => (
          <button
            key={i}
            onClick={() => handleSend(qp)}
            className="text-[11px] whitespace-nowrap px-3 py-1.5 rounded-full bg-slate-800/70 hover:bg-slate-800 border border-white/10 text-slate-300 hover:text-cyan-300 transition-colors"
          >
            {qp}
          </button>
        ))}
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-white/10 bg-slate-900/90 flex items-center gap-2">
        {/* Voice Recognition Button */}
        <button
          type="button"
          onClick={toggleSpeechRecognition}
          className={`p-3 rounded-xl border transition-all ${
            isListening
              ? "bg-rose-500 text-white border-rose-400 animate-pulse shadow-lg shadow-rose-500/30"
              : "bg-slate-800 hover:bg-slate-700 text-slate-300 border-white/10"
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
          placeholder={isListening ? "Listening... Speak now..." : "Ask route intelligence or query tools..."}
          className="flex-1 bg-slate-800/80 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500/60 transition-colors"
        />

        <button
          type="button"
          onClick={() => handleSend()}
          disabled={!input.trim() || loading}
          className="p-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 text-slate-950 font-bold transition-colors shadow-lg shadow-cyan-500/20"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
