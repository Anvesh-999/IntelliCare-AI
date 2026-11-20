import React, { useState, useEffect, useRef } from 'react';
import { 
  Sparkles, Send, ShieldAlert, BookOpen, CheckCircle2, 
  AlertTriangle, Lock, Unlock, Plus, Trash2, ChevronDown, 
  ChevronUp, ExternalLink, RefreshCw, MessageSquare, PhoneCall,
  Info, Cpu
} from 'lucide-react';

// Lightweight safe Markdown renderer for clinical notes & tables
const SimpleMarkdown = ({ content }) => {
  if (!content) return null;

  const lines = content.split('\n');
  return (
    <div className="space-y-2 text-xs leading-relaxed text-slate-200">
      {lines.map((line, idx) => {
        const trimmed = line.trim();

        // Headers
        if (trimmed.startsWith('### ')) {
          return (
            <h5 key={idx} className="font-bold text-sm text-medical-mint mt-3 mb-1 border-b border-white/5 pb-1">
              {trimmed.replace('### ', '')}
            </h5>
          );
        }
        if (trimmed.startsWith('## ')) {
          return (
            <h4 key={idx} className="font-bold text-base text-cyan-400 mt-4 mb-2">
              {trimmed.replace('## ', '')}
            </h4>
          );
        }
        if (trimmed.startsWith('# ')) {
          return (
            <h3 key={idx} className="font-extrabold text-lg text-white mt-4 mb-2">
              {trimmed.replace('# ', '')}
            </h3>
          );
        }

        // Bullet lists
        if (trimmed.startsWith('- ') || trimmed.startsWith('• ') || trimmed.startsWith('* ')) {
          const itemText = trimmed.replace(/^[-•*]\s+/, '');
          return (
            <div key={idx} className="flex items-start gap-2 ml-2">
              <span className="w-1.5 h-1.5 rounded-full bg-medical-teal shrink-0 mt-1.5" />
              <span>{renderInlineFormatting(itemText)}</span>
            </div>
          );
        }

        // Numbered lists
        const numMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
        if (numMatch) {
          return (
            <div key={idx} className="flex items-start gap-2 ml-2">
              <span className="font-bold text-medical-mint shrink-0">{numMatch[1]}.</span>
              <span>{renderInlineFormatting(numMatch[2])}</span>
            </div>
          );
        }

        // Empty lines
        if (trimmed === '') {
          return <div key={idx} className="h-1" />;
        }

        // Normal paragraph
        return <p key={idx}>{renderInlineFormatting(line)}</p>;
      })}
    </div>
  );
};

// Helper for inline **bold** and *italic*
const renderInlineFormatting = (text) => {
  const parts = [];
  const regex = /(\*\*.*?\*\*|\*.*?\*|`.*?`)/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith('**') && token.endsWith('**')) {
      parts.push(<strong key={match.index} className="font-bold text-slate-100">{token.slice(2, -2)}</strong>);
    } else if (token.startsWith('*') && token.endsWith('*')) {
      parts.push(<em key={match.index} className="italic text-slate-300">{token.slice(1, -1)}</em>);
    } else if (token.startsWith('`') && token.endsWith('`')) {
      parts.push(<code key={match.index} className="px-1 py-0.5 bg-slate-800 text-cyan-300 rounded text-[11px] font-mono">{token.slice(1, -1)}</code>);
    }
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }
  return parts.length > 0 ? parts : text;
};

export const ClinicalChatAssistant = ({ token, apiBase }) => {
  const [conversations, setConversations] = useState([]);
  const [activeConvId, setActiveConvId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [chatQuery, setChatQuery] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [useRAG, setUseRAG] = useState(true);
  const [consentGiven, setConsentGiven] = useState(false);
  const [activeEmergency, setActiveEmergency] = useState(false);
  const [expandedCitations, setExpandedCitations] = useState({});
  const [loadingThreads, setLoadingThreads] = useState(false);

  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isSending]);

  // Load patient conversation threads
  const loadConversations = async () => {
    setLoadingThreads(true);
    try {
      const res = await fetch(`${apiBase}/patients/conversations`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setConversations(data.conversations || []);
        if (data.conversations && data.conversations.length > 0 && !activeConvId) {
          selectConversation(data.conversations[0].conversationId);
        }
      }
    } catch (err) {
      console.error('Failed to load conversations:', err);
    } finally {
      setLoadingThreads(false);
    }
  };

  useEffect(() => {
    if (token) {
      loadConversations();
    }
  }, [token]);

  // Switch to a specific conversation thread
  const selectConversation = async (convId) => {
    setActiveConvId(convId);
    setActiveEmergency(false);
    try {
      const res = await fetch(`${apiBase}/patients/conversations/${convId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success && data.conversation) {
        setMessages(data.conversation.messages || []);
        setConsentGiven(data.conversation.consentGiven || false);
        
        // Check if last message was emergency
        const lastMsg = data.conversation.messages?.[data.conversation.messages.length - 1];
        if (lastMsg && (lastMsg.message.includes('EMERGENCY MEDICAL ADVISORY') || lastMsg.message.includes('🚨'))) {
          setActiveEmergency(true);
        }
      }
    } catch (err) {
      console.error('Failed to fetch conversation thread:', err);
    }
  };

  // Start a new consultation thread
  const handleStartNewConversation = () => {
    setActiveConvId(null);
    setMessages([]);
    setActiveEmergency(false);
    setConsentGiven(false);
  };

  // Delete a conversation thread
  const handleDeleteConversation = async (convId, e) => {
    e.stopPropagation();
    if (!window.confirm('Delete this consultation thread?')) return;

    try {
      const res = await fetch(`${apiBase}/patients/conversations/${convId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setConversations(prev => prev.filter(c => c.conversationId !== convId));
        if (activeConvId === convId) {
          handleStartNewConversation();
        }
      }
    } catch (err) {
      console.error('Failed to delete conversation:', err);
    }
  };

  // Toggle patient consent for medical record inclusion
  const handleToggleConsent = async () => {
    const nextConsent = !consentGiven;
    setConsentGiven(nextConsent);

    if (activeConvId) {
      try {
        await fetch(`${apiBase}/patients/chat/consent`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            conversationId: activeConvId,
            consentGiven: nextConsent
          })
        });
      } catch (err) {
        console.error('Failed to update consent status:', err);
      }
    }
  };

  // Send message
  const handleSendMessage = async (e) => {
    e?.preventDefault();
    if (!chatQuery.trim() || isSending) return;

    const userText = chatQuery.trim();
    setChatQuery('');
    setActiveEmergency(false);

    // Optimistically append patient message
    const optimisticMessage = {
      sender: 'patient',
      message: userText,
      timestamp: new Date().toISOString()
    };
    setMessages(prev => [...prev, optimisticMessage]);
    setIsSending(true);

    try {
      const res = await fetch(`${apiBase}/patients/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          message: userText,
          query: userText,
          conversation_id: activeConvId,
          use_rag: useRAG,
          consent_given: consentGiven
        })
      });
      const data = await res.json();

      if (data.success) {
        if (!activeConvId && data.conversationId) {
          setActiveConvId(data.conversationId);
          loadConversations();
        }

        setMessages(data.chatHistory || [
          ...messages,
          optimisticMessage,
          {
            sender: 'ai',
            message: data.response,
            citations: data.citations || [],
            disclaimer: data.disclaimer,
            timestamp: new Date().toISOString()
          }
        ]);

        // Emergency detection check
        if (data.response && (data.response.includes('EMERGENCY MEDICAL ADVISORY') || data.response.includes('🚨'))) {
          setActiveEmergency(true);
        }
      } else {
        setMessages(prev => [
          ...prev,
          {
            sender: 'ai',
            message: data.message || "An error occurred while consulting the medical assistant. Please try again.",
            timestamp: new Date().toISOString()
          }
        ]);
      }
    } catch (err) {
      setMessages(prev => [
        ...prev,
        {
          sender: 'ai',
          message: "Unable to reach the clinical AI service. Please ensure the backend and AI microservice containers are running.",
          timestamp: new Date().toISOString()
        }
      ]);
    } finally {
      setIsSending(false);
    }
  };

  const toggleCitationExpand = (idx) => {
    setExpandedCitations(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  // Quick suggestion prompts
  const quickPrompts = [
    "Check Aspirin & Warfarin interaction",
    "Explain what elevated total cholesterol means",
    "What are normal fasting blood sugar ranges?",
    "Review my active prescriptions"
  ];

  return (
    <div className="flex h-[620px] rounded-2xl glass-panel border border-white/10 overflow-hidden shadow-2xl animate-fade-in bg-slate-950/80 backdrop-blur-xl">
      {/* 1. Conversations Sidebar */}
      <div className="w-64 border-r border-white/5 bg-slate-900/60 flex flex-col shrink-0">
        <div className="p-3 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
            <MessageSquare className="w-4 h-4 text-medical-teal" />
            <span>Consultations</span>
          </div>
          <button
            onClick={handleStartNewConversation}
            className="p-1.5 hover:bg-white/5 rounded-lg text-medical-mint hover:text-white transition flex items-center gap-1 text-xs font-semibold"
            title="Start new consultation"
          >
            <Plus className="w-4 h-4" />
            <span>New</span>
          </button>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
          {conversations.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-500">
              No previous threads. Click New to start.
            </div>
          ) : (
            conversations.map(conv => {
              const isActive = conv.conversationId === activeConvId;
              return (
                <div
                  key={conv.conversationId}
                  onClick={() => selectConversation(conv.conversationId)}
                  className={`p-2.5 rounded-xl cursor-pointer transition text-xs flex flex-col gap-1 border group relative ${
                    isActive 
                      ? 'bg-medical-teal/15 border-medical-teal/30 text-white' 
                      : 'hover:bg-white/5 border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold truncate max-w-[170px]">
                      {conv.title || 'Consultation Thread'}
                    </span>
                    <button
                      onClick={(e) => handleDeleteConversation(conv.conversationId, e)}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:text-rose-400 text-slate-500 transition"
                      title="Delete thread"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-500">
                    <span>{conv.messageCount || 0} msgs</span>
                    {conv.consentGiven && (
                      <span className="text-medical-mint flex items-center gap-0.5">
                        <Lock className="w-2.5 h-2.5" /> Consent
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 2. Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-950/40">
        {/* Header & Controls Bar */}
        <div className="px-5 py-3 border-b border-white/5 bg-slate-900/50 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-medical-teal/15 flex items-center justify-center text-medical-mint border border-medical-teal/30">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-slate-200 flex items-center gap-2">
                IntelliCare Clinical Assistant
                <span className="text-[10px] font-normal px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  LLM v2.0
                </span>
              </h4>
              <p className="text-[11px] text-slate-500">
                Institutional clinical reasoning with evidence-grounded retrieval
              </p>
            </div>
          </div>

          {/* Toggles */}
          <div className="flex items-center gap-2 text-xs">
            {/* RAG Toggle */}
            <button
              onClick={() => setUseRAG(!useRAG)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border transition font-medium ${
                useRAG 
                  ? 'bg-cyan-500/15 border-cyan-500/30 text-cyan-300' 
                  : 'bg-white/5 border-white/10 text-slate-400 hover:text-slate-200'
              }`}
              title="Toggle Clinical Reference Mode (RAG evidence retrieval from institutional guidelines)"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Reference Mode</span>
              <span className={`w-2 h-2 rounded-full ${useRAG ? 'bg-cyan-400 animate-pulse' : 'bg-slate-600'}`} />
            </button>

            {/* Medical Record Consent Toggle */}
            <button
              onClick={handleToggleConsent}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border transition font-medium ${
                consentGiven 
                  ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300' 
                  : 'bg-white/5 border-white/10 text-slate-400 hover:text-slate-200'
              }`}
              title="Explicitly grant or withhold permission to include your personal health records in context"
            >
              {consentGiven ? <Lock className="w-3.5 h-3.5 text-emerald-400" /> : <Unlock className="w-3.5 h-3.5" />}
              <span>Record Consent</span>
              <span className={`w-2 h-2 rounded-full ${consentGiven ? 'bg-emerald-400' : 'bg-slate-600'}`} />
            </button>
          </div>
        </div>

        {/* Emergency Alert Banner (Triggered upon detecting acute conditions) */}
        {activeEmergency && (
          <div className="bg-rose-950/80 border-b border-rose-500/40 p-3 px-5 flex items-center justify-between text-xs text-rose-200 animate-pulse">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
              <div>
                <strong className="font-bold text-rose-100">Critical Clinical Alert:</strong>
                <span className="ml-1 text-rose-300">Potential acute emergency detected. Do not wait.</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <a
                href="tel:911"
                className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-lg transition flex items-center gap-1"
              >
                <PhoneCall className="w-3.5 h-3.5" /> Call 911
              </a>
              <a
                href="tel:988"
                className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-lg transition border border-white/10"
              >
                988 Lifeline
              </a>
            </div>
          </div>
        )}

        {/* Messages Scroll Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <div className="w-12 h-12 rounded-2xl bg-medical-teal/10 border border-medical-teal/20 flex items-center justify-center text-medical-mint mb-3">
                <Sparkles className="w-6 h-6 animate-pulse" />
              </div>
              <h4 className="font-bold text-sm text-slate-200 mb-1">
                Welcome to IntelliCare AI
              </h4>
              <p className="text-xs text-slate-400 max-w-md mb-6 leading-relaxed">
                Ask healthcare questions, verify drug-drug interactions, interpret laboratory results, or review evidence-based guidelines.
              </p>

              {/* Quick Starter Pills */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 w-full max-w-lg">
                {quickPrompts.map((prompt, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setChatQuery(prompt);
                    }}
                    className="p-2.5 px-3 text-left rounded-xl bg-white/5 hover:bg-medical-teal/10 border border-white/5 hover:border-medical-teal/30 text-xs text-slate-300 hover:text-white transition flex items-center justify-between group"
                  >
                    <span>{prompt}</span>
                    <span className="text-slate-500 group-hover:text-medical-mint transition">→</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg, index) => {
              const isAI = msg.sender === 'ai';
              const hasCitations = msg.citations && msg.citations.length > 0;
              const hasTools = msg.tools_called && msg.tools_called.length > 0;
              const isExpanded = expandedCitations[index];

              return (
                <div
                  key={index}
                  className={`flex gap-3 max-w-[88%] ${isAI ? 'self-start' : 'self-end flex-row-reverse'}`}
                >
                  {/* Avatar */}
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 border text-xs font-bold ${
                    isAI 
                      ? 'bg-medical-teal/15 border-medical-teal/30 text-medical-mint shadow-sm' 
                      : 'bg-indigo-600/20 border-indigo-500/30 text-indigo-300'
                  }`}>
                    {isAI ? 'AI' : 'P'}
                  </div>

                  {/* Bubble Content */}
                  <div className={`p-3.5 rounded-2xl border text-xs space-y-2 shadow-sm ${
                    isAI 
                      ? 'bg-slate-900/90 border-white/10 text-slate-200' 
                      : 'bg-gradient-to-r from-medical-teal/20 to-medical-mint/20 border-medical-teal/30 text-slate-100'
                  }`}>
                    {/* Tool Badges */}
                    {hasTools && (
                      <div className="flex flex-wrap gap-1 mb-1.5">
                        {msg.tools_called.map((tool, tIdx) => (
                          <span
                            key={tIdx}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-500/15 border border-purple-500/25 text-[10px] text-purple-300 font-mono"
                          >
                            <Cpu className="w-2.5 h-2.5" />
                            {tool.tool_name || 'Tool Executed'} ({tool.execution_time_ms || 0}ms)
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Formatted Message Text */}
                    <SimpleMarkdown content={msg.message} />

                    {/* Verified Citations Drawer */}
                    {hasCitations && (
                      <div className="mt-3 pt-2.5 border-t border-white/10">
                        <button
                          onClick={() => toggleCitationExpand(index)}
                          className="flex items-center justify-between w-full py-1 text-[11px] font-semibold text-cyan-400 hover:text-cyan-300 transition"
                        >
                          <span className="flex items-center gap-1.5">
                            <BookOpen className="w-3.5 h-3.5" />
                            <span>{msg.citations.length} Verified Evidence Source{msg.citations.length > 1 ? 's' : ''}</span>
                          </span>
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>

                        {isExpanded && (
                          <div className="mt-2 space-y-2 pl-2 border-l-2 border-cyan-500/30">
                            {msg.citations.map((cite, cIdx) => (
                              <div key={cIdx} className="p-2 rounded-lg bg-cyan-950/30 border border-cyan-500/20 text-[11px] space-y-1">
                                <div className="flex items-center justify-between text-cyan-200 font-semibold">
                                  <span>{cite.title || 'Clinical Reference'}</span>
                                  {cite.relevance_score && (
                                    <span className="text-[10px] text-cyan-400 font-mono">
                                      Match: {Math.round(cite.relevance_score * 100)}%
                                    </span>
                                  )}
                                </div>
                                <p className="text-slate-400 italic">
                                  "{cite.excerpt}"
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Clinical Disclaimer */}
                    {isAI && (
                      <div className="pt-2 text-[10px] text-slate-500 border-t border-white/5 flex items-center gap-1">
                        <Info className="w-3 h-3 text-slate-600 shrink-0" />
                        <span>Educational health assistance only. Consult a licensed clinician for medical diagnoses.</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}

          {/* Sending Indicator */}
          {isSending && (
            <div className="flex gap-3 self-start max-w-[85%] items-center animate-fade-in">
              <div className="w-7 h-7 rounded-full bg-medical-teal/15 border border-medical-teal/30 text-medical-mint flex items-center justify-center text-xs font-bold">
                AI
              </div>
              <div className="flex items-center gap-2 py-2 px-3 bg-slate-900 border border-white/10 rounded-2xl text-xs text-slate-400">
                <RefreshCw className="w-3.5 h-3.5 text-medical-teal animate-spin" />
                <span>Consulting institutional medical knowledge...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* 3. Input Form Area */}
        <form onSubmit={handleSendMessage} className="p-3 border-t border-white/5 bg-slate-900/60 flex gap-2 shrink-0">
          <input
            type="text"
            value={chatQuery}
            onChange={(e) => setChatQuery(e.target.value)}
            placeholder={
              consentGiven 
                ? "Ask a question (your health profile is included securely)..." 
                : "Ask general health questions (toggle Consent to include your records)..."
            }
            disabled={isSending}
            className="flex-1 bg-slate-950/90 border border-white/10 rounded-xl px-4 py-2 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-medical-teal transition"
          />
          <button
            type="submit"
            disabled={isSending || !chatQuery.trim()}
            className="px-4 py-2 bg-gradient-to-tr from-medical-teal to-medical-mint hover:opacity-90 disabled:opacity-50 text-white rounded-xl flex items-center justify-center gap-1.5 transition text-xs font-bold shrink-0 shadow-lg shadow-medical-teal/10"
          >
            <Send className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Send</span>
          </button>
        </form>
      </div>
    </div>
  );
};

export default ClinicalChatAssistant;
