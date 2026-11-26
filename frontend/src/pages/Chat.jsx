/**
 * Chat.jsx — StudyMind AI Premium Chatbot
 * ChatGPT-inspired glassmorphism interface.
 * All logic preserved: SSE streaming, RAG, contextual actions, voice, PDF upload.
 */
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import {
  Send, Sparkles, Trash2, AlertCircle, Loader2, HelpCircle,
  Plus, MessageSquare, BookOpen, Mic, MicOff, Paperclip,
  UploadCloud, X, GraduationCap, Square, Pencil, Check,
  Search, Code2, FlaskConical, ClipboardList, Compass,
  FileText, PanelLeft, Settings, UserRound, Pin, PinOff,
  ChevronDown, ArrowUp, Cpu, Globe,
} from 'lucide-react';
import ChatBubble from '../components/ChatBubble';
import { chatApi, documentApi } from '../services/api';
import { useAuth } from '../context/AuthContext';

/* ─── constants ────────────────────────────────────────────── */
const CHAT_MODES = [
  { id: 'learn',    label: 'Learn',    hint: 'Clear concepts & examples',        icon: Compass },
  { id: 'exam',     label: 'Exam',     hint: 'Definitions & key exam points',    icon: ClipboardList },
  { id: 'practice', label: 'Practice', hint: 'Questions & interactive practice', icon: HelpCircle },
  { id: 'code',     label: 'Code',     hint: 'Code walkthrough, debug & Big-O',  icon: Code2 },
  { id: 'research', label: 'Research', hint: 'Cross-PDF synthesis & evidence',   icon: FlaskConical },
];

const EXPLANATION_LEVELS = [
  { id: 'beginner',     label: 'Beginner',      desc: 'Simple English & basic analogies' },
  { id: 'intermediate', label: 'Intermediate',   desc: 'Detailed academic depth' },
  { id: 'advanced',     label: 'Advanced',       desc: 'Rigorous technical depth' },
];

const CHAT_MODELS = [
  { id: 'gemini-flash-lite-latest',      label: 'Flash-Lite Latest',    badge: 'Fast',     desc: 'Fast & reliable default for study & chat' },
  { id: 'gemini-3.1-flash-lite',         label: 'Gemini 3.1 Flash-Lite', badge: 'Speed',   desc: 'Lightweight 3.1 model for crisp answers' },
  { id: 'gemini-3.1-flash-lite-preview', label: 'Gemini 3.1 Lite Prev', badge: 'Preview',  desc: 'Latest 3.1 Flash-Lite preview release' },
  { id: 'gemini-flash-latest',           label: 'Gemini Flash Latest',  badge: 'Balanced', desc: 'Richer multi-step reasoning & synthesis' },
  { id: 'gemini-3-flash-preview',        label: 'Gemini 3 Flash',       badge: 'Next-Gen', desc: 'Next-gen preview for deeper analysis' },
  { id: 'gemini-pro-latest',             label: 'Gemini Pro Latest',    badge: 'Deep',     desc: 'Complex proofs & code (subject to quota)' },
];

const CHAT_LANGUAGES = [
  { id: 'auto',     label: 'Auto (Any)',    native: 'Matches your language', speech: '' },
  { id: 'en',       label: 'English',       native: 'English',               speech: 'en-US' },
  { id: 'hinglish', label: 'Hinglish',      native: 'Hindi + English mix',   speech: 'en-IN' },
  { id: 'hi',       label: 'Hindi',         native: 'हिंदी',                  speech: 'hi-IN' },
  { id: 'bn',       label: 'Bengali',       native: 'বাংলা',                  speech: 'bn-IN' },
  { id: 'ta',       label: 'Tamil',         native: 'தமிழ்',                  speech: 'ta-IN' },
  { id: 'mr',       label: 'Marathi',       native: 'मराठी',                  speech: 'mr-IN' },
  { id: 'ur',       label: 'Urdu',          native: 'اردو',                   speech: 'ur-PK' },
  { id: 'es',       label: 'Spanish',       native: 'Español',               speech: 'es-ES' },
  { id: 'fr',       label: 'French',        native: 'Français',              speech: 'fr-FR' },
  { id: 'de',       label: 'German',        native: 'Deutsch',               speech: 'de-DE' },
  { id: 'ar',       label: 'Arabic',        native: 'العربية',                speech: 'ar-SA' },
  { id: 'pt',       label: 'Portuguese',    native: 'Português',             speech: 'pt-BR' },
  { id: 'ja',       label: 'Japanese',      native: '日本語',                 speech: 'ja-JP' },
];

const QUICK_PROMPTS = [
  { emoji: '📋', label: 'Summarize key points',    prompt: 'Provide a structured summary of the main concepts in my study materials.' },
  { emoji: '🧮', label: 'Walk through math',        prompt: 'Walk through the core formulas and derivations step-by-step with examples.' },
  { emoji: '🎯', label: 'Quiz me',                  prompt: 'Ask me a practice question to test my understanding and evaluate my answer.' },
  { emoji: '💡', label: 'Explain a concept',        prompt: 'Explain the foundational concept clearly with an everyday real-world example.' },
];

/* ─── small style helpers ───────────────────────────────────── */
const glass = {
  background: 'rgba(17,28,46,0.72)',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  border: '1px solid rgba(255,255,255,0.08)',
};

const glassElevated = {
  background: 'rgba(23,36,58,0.80)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  border: '1px solid rgba(255,255,255,0.09)',
  boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
};

/* ─── Sidebar link helper ───────────────────────────────────── */
function SidebarLink({ to, icon: Icon, label, onClick }) {
  const navigate = useNavigate();
  const loc = useLocation();
  const isActive = loc.pathname === to;
  return (
    <button
      onClick={() => { navigate(to); if (onClick) onClick(); }}
      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all"
      style={{
        color: isActive ? '#F1F5FC' : '#94A3B8',
        background: isActive ? 'rgba(79,140,255,0.12)' : 'transparent',
        border: isActive ? '1px solid rgba(79,140,255,0.2)' : '1px solid transparent',
      }}
      onMouseEnter={(e) => { if (!isActive) { e.currentTarget.style.color='#F1F5FC'; e.currentTarget.style.background='rgba(255,255,255,0.04)'; }}}
      onMouseLeave={(e) => { if (!isActive) { e.currentTarget.style.color='#94A3B8'; e.currentTarget.style.background='transparent'; }}}
    >
      <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-[#4F8CFF]' : ''}`} />
      {label}
    </button>
  );
}

function getInitials(name) {
  if (!name) return 'U';
  return name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase();
}

/* ─── Extracted Sidebar Content (prevents focus loss on re-render) ─ */
function ChatSidebarContent({
  onClose,
  onNewConversation,
  threadSearch,
  setThreadSearch,
  filteredConvs,
  activeConversationId,
  renamingConvId,
  setRenamingConvId,
  renameDraft,
  setRenameDraft,
  pinnedIds,
  onSelectConversation,
  onTogglePin,
  onStartRename,
  onSubmitRename,
  onDelete,
  documents,
  docListOpen,
  setDocListOpen,
  selectedDocIds,
  onToggleDoc,
  user,
  onCloseMobile,
}) {
  const renderConvItem = (c) => {
    const isActive   = c.id === activeConversationId;
    const isRenaming = renamingConvId === c.id;
    const isPinned   = pinnedIds.includes(c.id);
    return (
      <div
        key={c.id}
        onClick={() => !isRenaming && onSelectConversation(c.id)}
        className="group flex items-center gap-1.5 px-3 py-2 rounded-xl cursor-pointer text-xs transition-all"
        style={{
          color: isActive ? '#F1F5FC' : '#94A3B8',
          background: isActive ? 'rgba(79,140,255,0.12)' : 'transparent',
          border: isActive ? '1px solid rgba(79,140,255,0.22)' : '1px solid transparent',
        }}
        onMouseEnter={(e) => { if (!isActive) { e.currentTarget.style.background='rgba(255,255,255,0.04)'; e.currentTarget.style.color='#F1F5FC'; }}}
        onMouseLeave={(e) => { if (!isActive) { e.currentTarget.style.background='transparent'; e.currentTarget.style.color='#94A3B8'; }}}
      >
        {isRenaming ? (
          <div className="flex items-center gap-1 w-full" onClick={(e) => e.stopPropagation()}>
            <input
              autoFocus value={renameDraft}
              onChange={(e) => setRenameDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') onSubmitRename(e, c.id); if (e.key === 'Escape') setRenamingConvId(null); }}
              className="flex-1 min-w-0 px-2 py-0.5 rounded-lg text-xs text-[#F1F5FC] focus:outline-none"
              style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(79,140,255,0.5)' }}
            />
            <button onClick={(e) => onSubmitRename(e, c.id)} className="p-1 text-emerald-400 rounded hover:bg-white/5 transition"><Check className="w-3 h-3" /></button>
            <button onClick={(e) => { e.stopPropagation(); setRenamingConvId(null); }} className="p-1 text-[#94A3B8] rounded hover:bg-white/5 transition"><X className="w-3 h-3" /></button>
          </div>
        ) : (
          <>
            <MessageSquare className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-[#4F8CFF]' : 'text-[#64748B]'}`} />
            <span className="flex-1 truncate">{c.title || 'Untitled'}</span>
            <div className="flex items-center gap-0 sm:opacity-0 sm:group-hover:opacity-100 transition shrink-0">
              <button onClick={(e) => onTogglePin(e, c.id)} title={isPinned ? 'Unpin' : 'Pin'} className="p-1 rounded-md hover:text-[#8B7CFF] transition">
                {isPinned ? <PinOff className="w-2.5 h-2.5" /> : <Pin className="w-2.5 h-2.5" />}
              </button>
              <button onClick={(e) => onStartRename(e, c)} title="Rename" className="p-1 rounded-md hover:text-[#4F8CFF] transition"><Pencil className="w-2.5 h-2.5" /></button>
              <button onClick={(e) => onDelete(e, c.id)} title="Delete" className="p-1 rounded-md hover:text-rose-400 transition"><Trash2 className="w-2.5 h-2.5" /></button>
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* Logo + Close */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: 'linear-gradient(135deg,#4F8CFF,#8B7CFF)' }}>
            <GraduationCap className="w-4 h-4 text-white" />
          </div>
          <span className="text-sm font-semibold text-[#F1F5FC]">
            StudyMind <span className="font-serif italic font-normal">AI</span>
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-[#94A3B8] hover:text-[#F1F5FC] transition"
          style={{ background: 'rgba(255,255,255,0.04)' }}
          title="Close sidebar"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* New chat */}
      <div className="px-3 py-3">
        <button
          onClick={onNewConversation}
          className="w-full flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-sm font-medium transition"
          style={{ background: 'rgba(79,140,255,0.1)', border: '1px solid rgba(79,140,255,0.22)', color: '#F1F5FC' }}
          onMouseEnter={(e) => { e.currentTarget.style.background='rgba(79,140,255,0.18)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background='rgba(79,140,255,0.1)'; }}
        >
          <Plus className="w-4 h-4 text-[#4F8CFF]" />
          New conversation
        </button>
      </div>

      {/* Search */}
      <div className="px-3 pb-2">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text" value={threadSearch}
            onChange={(e) => setThreadSearch(e.target.value)}
            placeholder="Search conversations…"
            className="w-full pl-9 pr-8 py-2 rounded-xl text-xs text-[#F1F5FC] placeholder-[#64748B] focus:outline-none transition"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
            onFocus={(e) => e.currentTarget.style.borderColor='rgba(79,140,255,0.4)'}
            onBlur={(e) => e.currentTarget.style.borderColor='rgba(255,255,255,0.07)'}
          />
          {threadSearch && (
            <button
              type="button"
              onClick={() => setThreadSearch('')}
              aria-label="Clear search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-[#F1F5FC] transition"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Conversations list */}
      <div className="flex-1 overflow-y-auto px-2 py-1 space-y-0.5 scrollbar-thin">
        {/* Pinned */}
        {filteredConvs.pinned.length > 0 && (
          <>
            <p className="px-3 pt-1 pb-0.5 text-[10px] font-semibold uppercase tracking-widest text-[#64748B]">Pinned</p>
            {filteredConvs.pinned.map(renderConvItem)}
          </>
        )}
        {/* Recent */}
        {filteredConvs.pinned.length > 0 && filteredConvs.unpinned.length > 0 && (
          <p className="px-3 pt-2 pb-0.5 text-[10px] font-semibold uppercase tracking-widest text-[#64748B]">Recent</p>
        )}
        {filteredConvs.unpinned.length === 0 && filteredConvs.pinned.length === 0 ? (
          <div className="py-12 text-center space-y-2">
            <MessageSquare className="w-6 h-6 mx-auto text-[#4F8CFF]/35" />
            <p className="text-xs text-[#64748B]">
              {threadSearch.trim() ? 'No matching conversations' : 'No conversations yet'}
            </p>
          </div>
        ) : (
          filteredConvs.unpinned.map(renderConvItem)
        )}
      </div>

      {/* Uploaded PDFs quick list */}
      {documents.length > 0 && (
        <div className="px-3 py-3 border-t border-white/[0.06]">
          <button
            onClick={() => setDocListOpen((v) => !v)}
            className="w-full flex items-center justify-between text-[10px] font-semibold uppercase tracking-widest text-[#64748B] mb-1 hover:text-[#94A3B8] transition"
          >
            <span>Study PDFs ({documents.length})</span>
            <ChevronDown className={`w-3 h-3 transition-transform ${docListOpen ? 'rotate-180' : ''}`} />
          </button>
          {docListOpen && (
            <div className="space-y-0.5 max-h-36 overflow-y-auto scrollbar-thin">
              <button
                onClick={() => onToggleDoc('all')}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11px] text-left transition"
                style={{ color: selectedDocIds.length === 0 ? '#F1F5FC' : '#94A3B8', background: selectedDocIds.length === 0 ? 'rgba(79,140,255,0.1)' : 'transparent' }}>
                <BookOpen className="w-3 h-3 shrink-0" />
                All documents
              </button>
              {documents.slice(0, 6).map((doc) => {
                const sel = selectedDocIds.includes(doc.id);
                return (
                  <button key={doc.id} onClick={() => onToggleDoc(doc.id)}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11px] text-left transition truncate"
                    style={{ color: sel ? '#F1F5FC' : '#94A3B8', background: sel ? 'rgba(139,124,255,0.12)' : 'transparent', border: sel ? '1px solid rgba(139,124,255,0.2)' : '1px solid transparent' }}>
                    <FileText className={`w-3 h-3 shrink-0 ${sel ? 'text-[#8B7CFF]' : ''}`} />
                    <span className="truncate">{doc.filename}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Bottom nav: Settings & Profile */}
      <div className="px-3 py-3 border-t border-white/[0.06] space-y-0.5">
        <SidebarLink to="/settings" icon={Settings} label="Settings" onClick={onCloseMobile} />
        <SidebarLink to="/profile"  icon={UserRound} label="My Profile" onClick={onCloseMobile} />

        {/* User chip */}
        {user && (
          <div className="flex items-center gap-2.5 px-3 py-2 mt-1 rounded-xl"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-bold text-white shrink-0"
              style={{ background: 'linear-gradient(135deg,#4F8CFF,#8B7CFF)' }}>
              {getInitials(user.full_name)}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-[#F1F5FC] truncate">{user.full_name || 'Scholar'}</p>
              <p className="text-[10px] text-[#64748B] truncate">{user.email || ''}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Main component ────────────────────────────────────────── */
export default function Chat() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const preselectedDocId = searchParams.get('doc');
  const urlConvId        = searchParams.get('conv');
  const isNewQuery       = searchParams.get('new');

  /* ── UI state ── */
  const [sidebarOpen,     setSidebarOpen]     = useState(true);
  const [mobileSidebar,   setMobileSidebar]   = useState(false); // mobile overlay
  const [docListOpen,     setDocListOpen]     = useState(false);
  const [docScopeOpen,    setDocScopeOpen]    = useState(false);
  const [modelMenuOpen,   setModelMenuOpen]   = useState(false);
  const [langMenuOpen,    setLangMenuOpen]    = useState(false);
  const docScopeRef  = useRef(null);
  const modelMenuRef = useRef(null);
  const langMenuRef  = useRef(null);

  /* ── Conversation state ── */
  const [conversations,        setConversations]        = useState([]);
  const [pinnedIds,            setPinnedIds]            = useState(() => { try { return JSON.parse(localStorage.getItem('studymind_pinned') || '[]'); } catch { return []; } });
  const [threadSearch,         setThreadSearch]         = useState('');
  const [activeConversationId, setActiveConversationId] = useState(urlConvId || null);
  const [renamingConvId,       setRenamingConvId]       = useState(null);
  const [renameDraft,          setRenameDraft]          = useState('');

  /* ── Message / chat state ── */
  const [messages,       setMessages]       = useState([]);
  const [inputQuestion,  setInputQuestion]  = useState('');
  const [documents,      setDocuments]      = useState([]);
  const [selectedDocIds, setSelectedDocIds] = useState(preselectedDocId ? [preselectedDocId] : []);
  const [loading,        setLoading]        = useState(false);
  const [isStreaming,    setIsStreaming]     = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error,          setError]          = useState(null);

  /* ── Tutor controls ── */
  const [tutorLevel,    setTutorLevel]    = useState('intermediate');
  const [chatMode,      setChatMode]      = useState('learn');
  const [selectedModel, setSelectedModel] = useState(() => {
    const saved = localStorage.getItem('studymind_chat_model');
    return CHAT_MODELS.some((m) => m.id === saved) ? saved : 'gemini-flash-lite-latest';
  });
  const [selectedLanguage, setSelectedLanguage] = useState(() => {
    const saved = localStorage.getItem('studymind_chat_language');
    return CHAT_LANGUAGES.some((l) => l.id === saved) ? saved : 'auto';
  });

  /* ── Upload ── */
  const [isUploadingChatFile, setIsUploadingChatFile] = useState(false);
  const [uploadProgressText,  setUploadProgressText]  = useState('');
  const [isDraggingOver,      setIsDraggingOver]      = useState(false);

  /* ── Voice ── */
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);

  /* ── Refs ── */
  const abortControllerRef = useRef(null);
  const messagesEndRef     = useRef(null);
  const textareaRef        = useRef(null);
  const fileInputRef       = useRef(null);

  /* ── Persist pinned list ── */
  useEffect(() => {
    localStorage.setItem('studymind_pinned', JSON.stringify(pinnedIds));
  }, [pinnedIds]);

  useEffect(() => {
    localStorage.setItem('studymind_chat_model', selectedModel);
  }, [selectedModel]);

  useEffect(() => {
    localStorage.setItem('studymind_chat_language', selectedLanguage);
  }, [selectedLanguage]);

  useEffect(() => {
    const onDocClick = (e) => {
      if (docScopeRef.current && !docScopeRef.current.contains(e.target)) {
        setDocScopeOpen(false);
      }
      if (modelMenuRef.current && !modelMenuRef.current.contains(e.target)) {
        setModelMenuOpen(false);
      }
      if (langMenuRef.current && !langMenuRef.current.contains(e.target)) {
        setLangMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const togglePin = useCallback((e, convId) => {
    e.stopPropagation();
    setPinnedIds((prev) => prev.includes(convId) ? prev.filter((id) => id !== convId) : [...prev, convId]);
  }, []);

  /* ── Auto-resize textarea ── */
  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 180) + 'px';
  }, []);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  /* ── Effects ── */
  useEffect(() => { loadInitialData(); return () => abortControllerRef.current?.abort(); }, []); // eslint-disable-line
  useEffect(() => { scrollToBottom(); }, [messages, loading, scrollToBottom]);
  useEffect(() => { if (preselectedDocId) setSelectedDocIds([preselectedDocId]); }, [preselectedDocId]);
  useEffect(() => { if (isNewQuery) handleNewConversation(); }, [isNewQuery]); // eslint-disable-line
  useEffect(() => { if (activeConversationId && !isStreaming) loadConversationMessages(activeConversationId); }, [activeConversationId]); // eslint-disable-line

  /* ── Voice recognition ── */
  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    const r = new SR();
    const langMeta = CHAT_LANGUAGES.find((l) => l.id === selectedLanguage);
    r.continuous = false;
    r.interimResults = true;
    r.lang = langMeta?.speech || (typeof navigator !== 'undefined' && navigator.language) || 'en-US';
    r.onstart  = () => setIsListening(true);
    r.onresult = (e) => setInputQuestion(Array.from(e.results).map((x) => x[0].transcript).join(''));
    r.onerror  = () => setIsListening(false);
    r.onend    = () => setIsListening(false);
    recognitionRef.current = r;
    return () => recognitionRef.current?.abort();
  }, [selectedLanguage]);

  const toggleVoice = () => {
    if (!('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
      alert('Speech recognition not supported. Use Chrome or Edge.'); return;
    }
    if (isListening) { recognitionRef.current?.stop(); setIsListening(false); }
    else { try { recognitionRef.current?.start(); } catch (e) { console.warn(e); } }
  };

  /* ── Data loading ── */
  const loadInitialData = async () => {
    try {
      setInitialLoading(true);
      const [docs, convs] = await Promise.all([
        documentApi.getDocuments().catch(() => []),
        chatApi.getConversations().catch(() => []),
      ]);
      setDocuments(docs || []);
      setConversations(convs || []);
      if (urlConvId)                      setActiveConversationId(urlConvId);
      else if (convs?.length > 0 && !isNewQuery) setActiveConversationId(convs[0].id);
      else                                setMessages([]);
    } finally {
      setInitialLoading(false);
    }
  };

  const loadConversationMessages = async (convId) => {
    try {
      setLoading(true);
      const res  = await chatApi.getConversationMessages(convId);
      const list = res?.messages || (Array.isArray(res) ? res : []);
      setMessages(list);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  /* ── Conversation CRUD ── */
  const handleNewConversation = () => {
    abortControllerRef.current?.abort();
    setIsStreaming(false); setLoading(false);
    setActiveConversationId(null); setMessages([]); setError(null);
    setSearchParams({});
    setMobileSidebar(false);
  };

  const handleSelectConversation = (convId) => {
    if (isStreaming) abortControllerRef.current?.abort();
    setActiveConversationId(convId);
    setSearchParams({ conv: convId });
    setError(null);
    setMobileSidebar(false);
  };

  const startRename = (e, conv) => {
    e.stopPropagation();
    setRenamingConvId(conv.id); setRenameDraft(conv.title || '');
  };

  const submitRename = async (e, convId) => {
    if (e) e.stopPropagation();
    const cleaned = renameDraft.trim();
    if (!cleaned) { setRenamingConvId(null); return; }
    try {
      const updated = await chatApi.renameConversation(convId, cleaned);
      setConversations((prev) => prev.map((c) => c.id === convId ? { ...c, title: updated.title || cleaned } : c));
    } catch (err) {
      setError('Failed to rename: ' + (err.response?.data?.detail || err.message));
    } finally {
      setRenamingConvId(null);
    }
  };

  const handleDelete = async (e, convId) => {
    e.stopPropagation();
    if (!window.confirm('Delete this conversation?')) return;
    try {
      await chatApi.deleteConversation(convId);
      const updated = conversations.filter((c) => c.id !== convId);
      setConversations(updated);
      setPinnedIds((prev) => prev.filter((id) => id !== convId));
      if (activeConversationId === convId) {
        if (updated.length > 0) setActiveConversationId(updated[0].id);
        else handleNewConversation();
      }
    } catch (err) {
      setError('Failed to delete: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleStopGeneration = () => abortControllerRef.current?.abort();

  const handleToggleDoc = (docId) => {
    if (docId === 'all') { setSelectedDocIds([]); return; }
    setSelectedDocIds((prev) => prev.includes(docId) ? prev.filter((id) => id !== docId) : [...prev, docId]);
  };

  /* ── Streaming send ── */
  const streamQuestionTurn = async ({ questionText, replaceFromIndex = null, replaceFromMessageId = null }) => {
    const trimmed = (questionText || '').trim();
    if (!trimmed || loading || isStreaming) return;

    setError(null);
    const tempUId = `temp-u-${Date.now()}`;
    const tempAId = `temp-a-${Date.now()}`;
    const now     = new Date().toISOString();

    setMessages((prev) => {
      const base   = Array.isArray(prev) ? prev : [];
      const sliced = replaceFromIndex !== null ? base.slice(0, replaceFromIndex) : base;
      return [...sliced,
        { id: tempUId, role: 'user',      content: trimmed, timestamp: now },
        { id: tempAId, role: 'assistant', content: '', sources: [], isStreaming: true, mode: chatMode, explanation_level: tutorLevel, timestamp: now },
      ];
    });

    if (replaceFromIndex === null) { setInputQuestion(''); if (textareaRef.current) textareaRef.current.style.height = 'auto'; }
    setIsStreaming(true);

    const ctrl = new AbortController();
    abortControllerRef.current = ctrl;
    let resolvedConvId = activeConversationId;
    let resolvedAId    = tempAId;

    try {
      await chatApi.streamMessage({
        question: trimmed,
        conversation_id: activeConversationId,
        document_ids: selectedDocIds,
        top_k: chatMode === 'research' ? 6 : 4,
        mode: chatMode,
        explanation_level: tutorLevel,
        model: selectedModel,
        language: selectedLanguage,
        replace_from_message_id: replaceFromMessageId,
        signal: ctrl.signal,
        onMeta: (meta) => {
          if (meta.conversation_id) resolvedConvId = meta.conversation_id;
          if (meta.message_id)       resolvedAId    = meta.message_id;
          setMessages((prev) => prev.map((m) => {
            if (m.id === tempUId && meta.user_message_id) return { ...m, id: meta.user_message_id };
            if (m.id === tempAId || m.id === resolvedAId) return { ...m, id: meta.message_id || m.id, sources: meta.sources || [], not_found_in_docs: Boolean(meta.not_found_in_docs), mode: meta.mode || m.mode, explanation_level: meta.explanation_level || m.explanation_level };
            return m;
          }));
        },
        onChunk: (_delta, fullText) => {
          setMessages((prev) => prev.map((m) => (m.id === resolvedAId || m.id === tempAId ? { ...m, content: fullText, isStreaming: true } : m)));
        },
        onDone: (done) => {
          setMessages((prev) => prev.map((m) => (m.id === resolvedAId || m.id === tempAId ? { ...m, id: done.message_id || m.id, content: done.answer || m.content, model_used: done.model_used, isStreaming: false } : m)));
        },
      });
      if (resolvedConvId && resolvedConvId !== activeConversationId) {
        setActiveConversationId(resolvedConvId);
        setSearchParams({ conv: resolvedConvId });
      }
      const updated = await chatApi.getConversations().catch(() => null);
      if (updated) setConversations(updated);
    } catch (err) {
      if (err.name === 'AbortError') {
        setMessages((prev) => prev.map((m) => (m.id === resolvedAId || m.id === tempAId ? { ...m, content: m.content ? `${m.content}\n\n*(Generation stopped)*` : '*(Generation stopped)*', isStreaming: false } : m)));
      } else {
        const msg = err.response?.data?.detail || err.message || 'Network or streaming error.';
        setError(msg);
        setMessages((prev) => prev.map((m) => (m.id === resolvedAId || m.id === tempAId ? { ...m, content: m.content ? `${m.content}\n\n> **Error:** ${msg}` : `> **Error:** ${msg}`, isStreaming: false } : m)));
      }
    } finally {
      abortControllerRef.current = null;
      setIsStreaming(false);
    }
  };

  const handleSendMessage = (custom = null) => streamQuestionTurn({ questionText: custom ?? inputQuestion });

  const handleContextualAction = async (actionType, refMessage) => {
    if (loading || isStreaming) return;
    setError(null); setLoading(true);
    try {
      const res = await chatApi.runContextualAction({ action_type: actionType, conversation_id: activeConversationId, message_id: refMessage?.id || null, document_ids: selectedDocIds, explanation_level: actionType === 'explain_simpler' ? 'beginner' : tutorLevel, mode: chatMode, model: selectedModel, language: selectedLanguage });
      const labels = { explain_simpler: 'Explain simpler', example: 'Give a worked example', summarize: 'Summarize key takeaways', mcqs: 'Generate practice MCQs', flashcards: 'Create flashcards', practice_questions: 'Give practice questions' };
      const now = new Date().toISOString();
      setMessages((prev) => [...(Array.isArray(prev) ? prev : []),
        { id: res.user_message_id || `act-u-${Date.now()}`, role: 'user',      content: labels[actionType] || actionType, timestamp: now },
        { id: res.message_id      || `act-a-${Date.now()}`, role: 'assistant', content: res.answer, sources: res.sources || [], mode: res.mode, explanation_level: res.explanation_level, model_used: res.model_used, timestamp: now },
      ]);
      if (res.conversation_id && res.conversation_id !== activeConversationId) { setActiveConversationId(res.conversation_id); setSearchParams({ conv: res.conversation_id }); }
      const updated = await chatApi.getConversations().catch(() => null);
      if (updated) setConversations(updated);
    } catch (err) {
      setError('Action failed: ' + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerate = (msgIdx) => {
    if (loading || isStreaming) return;
    const safe = Array.isArray(messages) ? messages : [];
    const asst = safe[msgIdx];
    let userIdx = -1;
    for (let i = msgIdx - 1; i >= 0; i--) { if (safe[i]?.role === 'user') { userIdx = i; break; } }
    if (userIdx === -1) return;
    const userMsg = safe[userIdx];
    const text    = userMsg.content || userMsg.message || '';
    const cutId   = userMsg.id && !String(userMsg.id).startsWith('temp-') ? userMsg.id : asst?.id || null;
    streamQuestionTurn({ questionText: text, replaceFromIndex: userIdx, replaceFromMessageId: cutId });
  };

  const handleEditUser = (msgIdx, newText) => {
    if (loading || isStreaming) return;
    const safe = Array.isArray(messages) ? messages : [];
    const user = safe[msgIdx];
    const cutId = user?.id && !String(user.id).startsWith('temp-') ? user.id : null;
    streamQuestionTurn({ questionText: newText, replaceFromIndex: msgIdx, replaceFromMessageId: cutId });
  };

  const handleFeedback = async (messageId, val) => {
    try {
      await chatApi.setMessageFeedback(messageId, val);
      setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, feedback: val } : m)));
    } catch (e) { console.warn(e); }
  };

  const handleChatFileUpload = async (file) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.pdf')) { setError('Only PDF files are supported.'); return; }
    setIsUploadingChatFile(true);
    setUploadProgressText(`Uploading "${file.name}"…`);
    try {
      const res = await documentApi.uploadDocuments([file]);
      const doc = (res.documents || [])[0];
      const refreshed = await documentApi.getDocuments();
      setDocuments(refreshed || []);
      if (doc) setSelectedDocIds([doc.id]);
      setMessages((prev) => [...(Array.isArray(prev) ? prev : []),
        { id: `sys-${Date.now()}`, role: 'system', content: `✅ Indexed "${file.name}" — ${doc?.total_pages ?? 1} pages, ${doc?.total_chunks ?? 1} chunks. Ready for RAG queries.`, timestamp: new Date().toISOString() },
      ]);
    } catch (err) {
      setError('Upload failed: ' + (err.response?.data?.detail || err.message));
    } finally {
      setIsUploadingChatFile(false); setUploadProgressText('');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); }
  };

  const handleNavigateToDoc = (docId, page) => navigate(`/viewer?doc=${docId}&page=${page}`);

  /* ── Derived ── */
  const filteredConvs = useMemo(() => {
    const q = threadSearch.trim().toLowerCase();
    const list = q ? conversations.filter((c) => (c.title || '').toLowerCase().includes(q)) : conversations;
    if (!q) {
      const pinned   = list.filter((c) => pinnedIds.includes(c.id));
      const unpinned = list.filter((c) => !pinnedIds.includes(c.id));
      return { pinned, unpinned };
    }
    return { pinned: [], unpinned: list };
  }, [conversations, threadSearch, pinnedIds]);

  const activeModeObj  = CHAT_MODES.find((m) => m.id === chatMode) || CHAT_MODES[0];
  const activeModelObj = CHAT_MODELS.find((m) => m.id === selectedModel) || CHAT_MODELS[0];
  const activeLangObj  = CHAT_LANGUAGES.find((l) => l.id === selectedLanguage) || CHAT_LANGUAGES[0];
  const safeMessages   = Array.isArray(messages) ? messages : [];

  const sidebarProps = {
    onNewConversation: handleNewConversation,
    threadSearch,
    setThreadSearch,
    filteredConvs,
    activeConversationId,
    renamingConvId,
    setRenamingConvId,
    renameDraft,
    setRenameDraft,
    pinnedIds,
    onSelectConversation: handleSelectConversation,
    onTogglePin: togglePin,
    onStartRename: startRename,
    onSubmitRename: submitRename,
    onDelete: handleDelete,
    documents,
    docListOpen,
    setDocListOpen,
    selectedDocIds,
    onToggleDoc: handleToggleDoc,
    user,
    onCloseMobile: () => setMobileSidebar(false),
  };

  /* ─────────────────────────────────────────────────── */
  /* RENDER                                               */
  /* ─────────────────────────────────────────────────── */
  return (
    <div
      className="flex h-full max-w-screen-2xl mx-auto relative overflow-hidden rounded-none sm:rounded-2xl border-0 sm:border border-white/[0.06]"
      onDragOver={(e) => { e.preventDefault(); setIsDraggingOver(true); }}
      onDragLeave={() => setIsDraggingOver(false)}
      onDrop={(e) => { e.preventDefault(); setIsDraggingOver(false); if (e.dataTransfer.files?.length > 0) handleChatFileUpload(e.dataTransfer.files[0]); }}
    >
      {/* ── Hidden file input ── */}
      <input type="file" ref={fileInputRef} accept=".pdf,application/pdf" className="hidden"
        onChange={(e) => { if (e.target.files?.length > 0) { handleChatFileUpload(e.target.files[0]); e.target.value = ''; }}} />

      {/* ── Drag overlay ── */}
      {isDraggingOver && (
        <div className="absolute inset-0 z-50 rounded-2xl flex flex-col items-center justify-center pointer-events-none"
          style={{ background: 'rgba(79,140,255,0.07)', border: '2px dashed rgba(79,140,255,0.4)', backdropFilter: 'blur(8px)' }}>
          <UploadCloud className="w-12 h-12 text-[#4F8CFF] mb-3 animate-bounce" />
          <p className="text-base font-semibold text-[#F1F5FC]">Drop PDF to index</p>
          <p className="text-xs text-[#94A3B8] mt-1">Extracted, chunked & stored in FAISS</p>
        </div>
      )}

      {/* ══════════════ DESKTOP SIDEBAR ══════════════ */}
      <aside
        className="hidden md:flex flex-col flex-shrink-0 h-full overflow-hidden transition-all duration-300"
        style={{
          width: sidebarOpen ? '260px' : '0px',
          borderRight: sidebarOpen ? '1px solid rgba(255,255,255,0.06)' : 'none',
          background: '#0B1220',
        }}
      >
        <div className="min-w-[260px] h-full overflow-hidden">
          <ChatSidebarContent {...sidebarProps} onClose={() => setSidebarOpen(false)} />
        </div>
      </aside>

      {/* ══════════════ MOBILE SIDEBAR OVERLAY ══════════════ */}
      {mobileSidebar && (
        <>
          <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
            onClick={() => setMobileSidebar(false)} />
          <aside className="fixed left-0 top-0 bottom-0 z-50 w-72 h-full md:hidden"
            style={{ background: '#0B1220', borderRight: '1px solid rgba(255,255,255,0.08)' }}>
            <ChatSidebarContent {...sidebarProps} onClose={() => setMobileSidebar(false)} />
          </aside>
        </>
      )}

      {/* ══════════════ MAIN CHAT COLUMN ══════════════ */}
      <div className="flex-1 flex flex-col h-full min-w-0 relative overflow-hidden"
        style={{ background: '#080D18' }}>

        {/* Upload progress bar */}
        {isUploadingChatFile && (
          <div className="absolute top-0 inset-x-0 z-20 flex items-center gap-3 px-4 py-2.5 text-xs"
            style={{ background: 'rgba(17,28,46,0.95)', borderBottom: '1px solid rgba(79,140,255,0.3)', backdropFilter: 'blur(12px)' }}>
            <Loader2 className="w-4 h-4 animate-spin text-[#4F8CFF] shrink-0" />
            <span className="text-[#F1F5FC] font-medium flex-1">{uploadProgressText}</span>
            <span className="text-[#94A3B8]">Indexing into FAISS…</span>
          </div>
        )}

        {/* ── Scrollable messages area ── */}
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          <div className="max-w-3xl mx-auto px-3 sm:px-4 py-4 sm:py-5">

            {/* Top bar: sidebar toggle + mode pills */}
            <div className="flex items-center gap-2 mb-5">
              {/* Sidebar toggle */}
              <button
                onClick={() => { if (window.innerWidth < 768) setMobileSidebar(true); else setSidebarOpen((v) => !v); }}
                className="p-1.5 rounded-xl text-[#94A3B8] hover:text-[#F1F5FC] transition shrink-0"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                title="Toggle sidebar"
              >
                <PanelLeft className="w-4 h-4" />
              </button>

              {/* Mode selector pills */}
              <div className="flex items-center gap-1 overflow-x-auto scrollbar-none flex-1 min-w-0">
                {CHAT_MODES.map((md) => {
                  const Icon   = md.icon;
                  const active = chatMode === md.id;
                  return (
                    <button
                      key={md.id} onClick={() => setChatMode(md.id)} title={md.hint}
                      className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-[11px] sm:text-xs font-medium transition shrink-0"
                      style={active
                        ? { background: 'rgba(79,140,255,0.18)', border: '1px solid rgba(79,140,255,0.4)', color: '#F1F5FC' }
                        : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', color: '#94A3B8' }}
                      onMouseEnter={(e) => { if (!active) { e.currentTarget.style.color='#F1F5FC'; e.currentTarget.style.borderColor='rgba(255,255,255,0.12)'; }}}
                      onMouseLeave={(e) => { if (!active) { e.currentTarget.style.color='#94A3B8'; e.currentTarget.style.borderColor='rgba(255,255,255,0.07)'; }}}
                    >
                      <Icon className={`w-3.5 h-3.5 ${active ? 'text-[#4F8CFF]' : ''}`} />
                      <span>{md.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Attach PDF shortcut */}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-medium transition shrink-0"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#94A3B8' }}
                onMouseEnter={(e) => { e.currentTarget.style.color='#F1F5FC'; e.currentTarget.style.borderColor='rgba(255,255,255,0.14)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color='#94A3B8'; e.currentTarget.style.borderColor='rgba(255,255,255,0.08)'; }}
                title="Attach PDF"
              >
                <Paperclip className="w-3.5 h-3.5 text-[#4F8CFF]" />
                <span className="hidden sm:inline">Attach PDF</span>
              </button>
            </div>

            {/* ── Loading ── */}
            {initialLoading ? (
              <div className="py-32 flex flex-col items-center gap-5">
                <div className="w-11 h-11 rounded-2xl flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg,rgba(79,140,255,0.15),rgba(139,124,255,0.15))', border: '1px solid rgba(79,140,255,0.2)' }}>
                  <Loader2 className="w-5 h-5 animate-spin text-[#4F8CFF]" />
                </div>
                <p className="text-sm text-[#94A3B8]">Loading your workspace…</p>
              </div>

            ) : safeMessages.length === 0 ? (
              /* ── Empty / Welcome state ── */
              <div className="py-8 sm:py-16 text-center space-y-6 sm:space-y-8 max-w-xl mx-auto animate-fade-in-up">
                {/* Logo + heading */}
                <div className="space-y-5">
                  <div className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center shadow-xl shadow-[#4F8CFF]/15"
                    style={{ background: 'linear-gradient(135deg,#4F8CFF,#8B7CFF)' }}>
                    <GraduationCap className="w-7 h-7 text-white stroke-[2.2]" />
                  </div>
                  <div className="space-y-2">
                    <h1 className="text-2xl sm:text-3xl font-bold text-[#F1F5FC] tracking-tight">
                      What would you like to{' '}
                      <span className="font-serif italic font-normal text-[#4F8CFF]">learn</span>{' '}
                      today?
                    </h1>
                    <p className="text-sm text-[#94A3B8] leading-relaxed">
                      Switch learning modes, ground answers in your PDFs, and get cited explanations with one click.
                    </p>
                  </div>
                </div>

                {/* Upload hint */}
                {documents.length === 0 && (
                  <div className="flex items-center justify-between gap-4 px-4 py-3.5 rounded-2xl text-sm" style={glass}>
                    <div className="flex items-center gap-3 text-left">
                      <Sparkles className="w-4 h-4 text-[#4F8CFF] shrink-0" />
                      <span className="text-[#94A3B8] text-xs"><strong className="text-[#F1F5FC]">Tip:</strong> Attach a PDF for grounded, cited answers from your course notes.</span>
                    </div>
                    <button onClick={() => fileInputRef.current?.click()}
                      className="px-4 py-1.5 rounded-xl text-xs font-semibold text-white shrink-0 transition active:scale-95 hover:opacity-90"
                      style={{ background: '#4F8CFF' }}>
                      Upload
                    </button>
                  </div>
                )}

                {/* Suggested prompts grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
                  {QUICK_PROMPTS.map((item, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSendMessage(item.prompt)}
                      className="p-4 rounded-2xl text-left transition group"
                      style={glass}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor='rgba(79,140,255,0.35)'; e.currentTarget.style.background='rgba(17,28,46,0.9)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor='rgba(255,255,255,0.08)'; e.currentTarget.style.background='rgba(17,28,46,0.72)'; }}
                    >
                      <span className="text-xl block mb-2">{item.emoji}</span>
                      <p className="text-sm font-semibold text-[#F1F5FC] group-hover:text-[#4F8CFF] transition leading-tight">{item.label}</p>
                      <p className="text-[11px] text-[#94A3B8] mt-1 leading-relaxed line-clamp-2">"{item.prompt}"</p>
                    </button>
                  ))}
                </div>
              </div>

            ) : (
              /* ── Messages ── */
              <div className="space-y-1">
                {safeMessages.map((msg, index) => (
                  <ChatBubble
                    key={msg.id || index}
                    message={msg}
                    disabledActions={loading || isStreaming}
                    onNavigateToDoc={handleNavigateToDoc}
                    onContextualAction={(actionType, mObj) => handleContextualAction(actionType, mObj)}
                    onRegenerate={() => handleRegenerate(index)}
                    onEditUserMessage={(newTxt) => handleEditUser(index, newTxt)}
                    onFeedback={(msgId, val) => handleFeedback(msgId, val)}
                  />
                ))}

                {/* Non-streaming loading indicator */}
                {loading && !isStreaming && (
                  <div className="flex items-center gap-3 px-4 py-3 rounded-2xl w-fit" style={glass}>
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: 'linear-gradient(135deg,#4F8CFF,#8B7CFF)' }}>
                      <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
                    </div>
                    <span className="text-xs text-[#94A3B8]">Generating…</span>
                  </div>
                )}
              </div>
            )}

            <div ref={messagesEndRef} className="h-8" />
          </div>
        </div>

        {/* ══════════════ COMPOSER ══════════════ */}
        <div className="flex-shrink-0 px-3 sm:px-4 pb-3 sm:pb-4 pt-2">
          <div className="max-w-3xl mx-auto space-y-2">

            {/* Error banner */}
            {error && (
              <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl text-xs animate-fade-in-up"
                style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#FCA5A5' }}>
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{error}</span>
                </div>
                <button onClick={() => setError(null)} className="text-[#94A3B8] hover:text-[#F1F5FC] transition"><X className="w-3.5 h-3.5" /></button>
              </div>
            )}

            {/* Unified Glass Composer Capsule */}
            <div
              className={`relative rounded-[22px] transition-all duration-300 border focus-within:border-[#4F8CFF]/55 focus-within:shadow-[0_14px_52px_rgba(79,140,255,0.16)] ${
                isStreaming || loading ? 'composer-streaming-glow border-[#4F8CFF]/40' : 'border-white/[0.1]'
              }`}
              style={{
                background: 'rgba(19, 30, 50, 0.84)',
                backdropFilter: 'blur(24px)',
                WebkitBackdropFilter: 'blur(24px)',
                boxShadow: '0 10px 40px rgba(0, 0, 0, 0.45)',
              }}
            >
              {/* Animated Top Shimmer Bar while Generating */}
              {(isStreaming || loading) && (
                <div className="absolute top-0 inset-x-5 h-[2px] overflow-hidden rounded-full pointer-events-none">
                  <div
                    className="h-full w-1/2 animate-shimmer-slide rounded-full"
                    style={{ background: 'linear-gradient(90deg, transparent, #4F8CFF, #8B7CFF, transparent)' }}
                  />
                </div>
              )}

              {/* Selected PDF filter pills (only when narrowed to specific docs) */}
              {selectedDocIds.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 px-4 pt-3 pb-0.5 animate-fade-in-up">
                  {selectedDocIds.map((id) => {
                    const docObj = documents.find((d) => d.id === id);
                    if (!docObj) return null;
                    return (
                      <span
                        key={id}
                        className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-lg text-[11px] font-medium text-[#C4B5FD] transition-transform hover:scale-[1.02]"
                        style={{ background: 'rgba(139,124,255,0.14)', border: '1px solid rgba(139,124,255,0.28)' }}
                      >
                        <FileText className="w-3 h-3 text-[#8B7CFF] shrink-0" />
                        <span className="truncate max-w-[160px]">{docObj.filename}</span>
                        <button
                          type="button"
                          onClick={() => handleToggleDoc(id)}
                          className="p-0.5 rounded hover:bg-white/10 text-[#94A3B8] hover:text-white transition"
                          title="Remove filter"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}

              {/* Prompt Input */}
              <textarea
                ref={textareaRef}
                rows={1}
                value={inputQuestion}
                onChange={(e) => { setInputQuestion(e.target.value); autoResize(); }}
                onKeyDown={handleKeyDown}
                placeholder={isListening ? '🎤 Listening for your voice…' : `Ask in English, Hindi, Hinglish, or any language… (${activeModeObj.label})`}
                disabled={loading}
                className="w-full bg-transparent border-0 text-[14.5px] text-[#F1F5FC] placeholder-[#64748B] focus:outline-none resize-none px-4 pt-3.5 pb-2 leading-relaxed transition-colors"
                style={{ minHeight: '46px', maxHeight: '180px' }}
              />

              {/* Integrated Bottom Control Bar */}
              <div className="flex items-center justify-between gap-2 px-3 pb-2.5 pt-1">
                <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                  {/* Attach PDF */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingChatFile}
                    title="Attach PDF to knowledge base"
                    className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-xl text-xs font-medium text-[#94A3B8] hover:text-[#F1F5FC] hover:scale-[1.03] active:scale-95 transition-all duration-200 disabled:opacity-40"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
                  >
                    {isUploadingChatFile ? <Loader2 className="w-3.5 h-3.5 animate-spin text-[#4F8CFF]" /> : <Paperclip className="w-3.5 h-3.5 text-[#4F8CFF]" />}
                    <span className="hidden sm:inline text-[11px]">PDF</span>
                  </button>

                  {/* Voice input */}
                  <button
                    type="button"
                    onClick={toggleVoice}
                    title={isListening ? 'Stop listening' : 'Voice input'}
                    className={`inline-flex items-center justify-center w-8 h-8 rounded-xl hover:scale-[1.04] active:scale-95 transition-all duration-200 ${isListening ? 'animate-pulse' : ''}`}
                    style={{
                      background: isListening ? 'rgba(239,68,68,0.16)' : 'rgba(255,255,255,0.04)',
                      border: isListening ? '1px solid rgba(239,68,68,0.4)' : '1px solid rgba(255,255,255,0.07)',
                      color: isListening ? '#F87171' : '#94A3B8',
                    }}
                  >
                    {isListening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                  </button>

                  {/* Segmented Explanation Level Control */}
                  <div
                    className="inline-flex items-center p-0.5 rounded-xl"
                    style={{ background: 'rgba(8,13,24,0.55)', border: '1px solid rgba(255,255,255,0.07)' }}
                  >
                    {EXPLANATION_LEVELS.map((lvl) => {
                      const active = tutorLevel === lvl.id;
                      return (
                        <button
                          key={lvl.id}
                          type="button"
                          onClick={() => setTutorLevel(lvl.id)}
                          title={lvl.desc}
                          className="px-2 sm:px-2.5 py-1 rounded-[9px] text-[11px] font-medium transition-all duration-200 active:scale-95"
                          style={active
                            ? { background: 'rgba(139,124,255,0.22)', color: '#E9D5FF', boxShadow: '0 1px 6px rgba(139,124,255,0.2)' }
                            : { color: '#94A3B8' }}
                        >
                          {lvl.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Interactive AI Model Selector */}
                  <div className="relative" ref={modelMenuRef}>
                    <button
                      type="button"
                      onClick={() => { setModelMenuOpen((v) => !v); setDocScopeOpen(false); setLangMenuOpen(false); }}
                      title={`Active AI model: ${activeModelObj.label} — ${activeModelObj.desc}`}
                      className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-xl text-[11px] font-medium hover:scale-[1.02] active:scale-95 transition-all duration-200"
                      style={{
                        background: modelMenuOpen ? 'rgba(139,124,255,0.18)' : 'rgba(255,255,255,0.04)',
                        border: modelMenuOpen ? '1px solid rgba(139,124,255,0.4)' : '1px solid rgba(255,255,255,0.08)',
                        color: '#E2E8F0',
                      }}
                    >
                      <Cpu className="w-3.5 h-3.5 text-[#8B7CFF] shrink-0" />
                      <span className="truncate max-w-[96px] sm:max-w-none">{activeModelObj.label}</span>
                      <ChevronDown className={`w-3 h-3 text-[#94A3B8] transition-transform duration-200 ${modelMenuOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {modelMenuOpen && (
                      <div
                        className="absolute bottom-10 left-0 w-72 max-w-[calc(100vw-2rem)] rounded-2xl p-2 z-40 space-y-1 animate-composer-pop"
                        style={{
                          background: 'rgba(15, 24, 42, 0.97)',
                          backdropFilter: 'blur(22px)',
                          border: '1px solid rgba(255,255,255,0.1)',
                          boxShadow: '0 18px 50px rgba(0,0,0,0.68)',
                        }}
                      >
                        <div className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#64748B]">
                          Select Gemini Model
                        </div>
                        {CHAT_MODELS.map((m) => {
                          const isCurrent = selectedModel === m.id;
                          return (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => { setSelectedModel(m.id); setModelMenuOpen(false); }}
                              className="w-full flex items-start justify-between gap-2 px-2.5 py-2 rounded-xl text-left transition-all duration-150 hover:bg-white/[0.04]"
                              style={{
                                background: isCurrent ? 'rgba(139,124,255,0.14)' : 'transparent',
                                border: isCurrent ? '1px solid rgba(139,124,255,0.28)' : '1px solid transparent',
                              }}
                            >
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className={`text-xs font-semibold ${isCurrent ? 'text-[#F1F5FC]' : 'text-[#CBD5E1]'}`}>
                                    {m.label}
                                  </span>
                                  <span
                                    className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded-md"
                                    style={{
                                      background: isCurrent ? 'rgba(79,140,255,0.2)' : 'rgba(255,255,255,0.06)',
                                      color: isCurrent ? '#93C5FD' : '#94A3B8',
                                    }}
                                  >
                                    {m.badge}
                                  </span>
                                </div>
                                <p className="text-[11px] text-[#64748B] mt-0.5 leading-snug">{m.desc}</p>
                              </div>
                              {isCurrent && <Check className="w-3.5 h-3.5 text-[#8B7CFF] shrink-0 mt-0.5" />}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Interactive Language Selector */}
                  <div className="relative" ref={langMenuRef}>
                    <button
                      type="button"
                      onClick={() => { setLangMenuOpen((v) => !v); setModelMenuOpen(false); setDocScopeOpen(false); }}
                      title={`Reply language: ${activeLangObj.label} (${activeLangObj.native})`}
                      className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-xl text-[11px] font-medium hover:scale-[1.02] active:scale-95 transition-all duration-200"
                      style={{
                        background: langMenuOpen || selectedLanguage !== 'auto' ? 'rgba(56,189,248,0.14)' : 'rgba(255,255,255,0.04)',
                        border: langMenuOpen || selectedLanguage !== 'auto' ? '1px solid rgba(56,189,248,0.35)' : '1px solid rgba(255,255,255,0.08)',
                        color: langMenuOpen || selectedLanguage !== 'auto' ? '#BAE6FD' : '#E2E8F0',
                      }}
                    >
                      <Globe className="w-3.5 h-3.5 text-[#38BDF8] shrink-0" />
                      <span>{activeLangObj.label}</span>
                      <ChevronDown className={`w-3 h-3 text-[#94A3B8] transition-transform duration-200 ${langMenuOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {langMenuOpen && (
                      <div
                        className="absolute bottom-10 left-0 w-72 max-w-[calc(100vw-2rem)] rounded-2xl p-2 z-40 space-y-1 animate-composer-pop"
                        style={{
                          background: 'rgba(15, 24, 42, 0.97)',
                          backdropFilter: 'blur(22px)',
                          border: '1px solid rgba(255,255,255,0.1)',
                          boxShadow: '0 18px 50px rgba(0,0,0,0.68)',
                        }}
                      >
                        <div className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#64748B]">
                          Chat Language (Auto or Fixed)
                        </div>
                        <div className="max-h-60 overflow-y-auto grid grid-cols-1 gap-0.5 scrollbar-thin">
                          {CHAT_LANGUAGES.map((lang) => {
                            const isCurrent = selectedLanguage === lang.id;
                            return (
                              <button
                                key={lang.id}
                                type="button"
                                onClick={() => { setSelectedLanguage(lang.id); setLangMenuOpen(false); }}
                                className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl text-left transition-all duration-150 hover:bg-white/[0.04]"
                                style={{
                                  background: isCurrent ? 'rgba(56,189,248,0.14)' : 'transparent',
                                  border: isCurrent ? '1px solid rgba(56,189,248,0.28)' : '1px solid transparent',
                                }}
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className={`text-xs font-medium ${isCurrent ? 'text-[#F1F5FC]' : 'text-[#CBD5E1]'}`}>
                                    {lang.label}
                                  </span>
                                  <span className="text-[11px] text-[#64748B] truncate">{lang.native}</span>
                                </div>
                                {isCurrent && <Check className="w-3.5 h-3.5 text-[#38BDF8] shrink-0" />}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Interactive Document Scope Selector */}
                  <div className="relative" ref={docScopeRef}>
                    <button
                      type="button"
                      onClick={() => { setDocScopeOpen((v) => !v); setModelMenuOpen(false); setLangMenuOpen(false); }}
                      title="Choose which PDFs to search"
                      className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-xl text-[11px] font-medium hover:scale-[1.02] active:scale-95 transition-all duration-200"
                      style={{
                        background: selectedDocIds.length > 0 ? 'rgba(79,140,255,0.14)' : 'rgba(255,255,255,0.04)',
                        border: selectedDocIds.length > 0 ? '1px solid rgba(79,140,255,0.3)' : '1px solid rgba(255,255,255,0.07)',
                        color: selectedDocIds.length > 0 ? '#93C5FD' : '#94A3B8',
                      }}
                    >
                      <BookOpen className="w-3.5 h-3.5 text-[#4F8CFF] shrink-0" />
                      <span className="hidden xs:inline sm:inline">
                        {selectedDocIds.length > 0 ? `${selectedDocIds.length} PDF` : `All PDFs (${documents.length})`}
                      </span>
                      <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${docScopeOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {docScopeOpen && (
                      <div
                        className="absolute bottom-10 left-0 w-64 max-w-[calc(100vw-2rem)] rounded-2xl p-2 z-40 space-y-1 animate-composer-pop"
                        style={{
                          background: 'rgba(15, 24, 42, 0.97)',
                          backdropFilter: 'blur(22px)',
                          border: '1px solid rgba(255,255,255,0.1)',
                          boxShadow: '0 18px 50px rgba(0,0,0,0.68)',
                        }}
                      >
                        <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#64748B]">
                          Search Knowledge Scope
                        </div>
                        <button
                          type="button"
                          onClick={() => { handleToggleDoc('all'); setDocScopeOpen(false); }}
                          className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs transition"
                          style={{
                            color: selectedDocIds.length === 0 ? '#F1F5FC' : '#94A3B8',
                            background: selectedDocIds.length === 0 ? 'rgba(79,140,255,0.15)' : 'transparent',
                          }}
                        >
                          <span className="flex items-center gap-2">
                            <BookOpen className="w-3.5 h-3.5 text-[#4F8CFF]" />
                            All uploaded PDFs ({documents.length})
                          </span>
                          {selectedDocIds.length === 0 && <Check className="w-3.5 h-3.5 text-[#4F8CFF]" />}
                        </button>

                        {documents.length > 0 && (
                          <div className="max-h-44 overflow-y-auto space-y-0.5 pt-1 border-t border-white/[0.06] scrollbar-thin">
                            {documents.map((d) => {
                              const sel = selectedDocIds.includes(d.id);
                              return (
                                <button
                                  key={d.id}
                                  type="button"
                                  onClick={() => handleToggleDoc(d.id)}
                                  className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl text-xs text-left transition"
                                  style={{
                                    color: sel ? '#F1F5FC' : '#94A3B8',
                                    background: sel ? 'rgba(139,124,255,0.15)' : 'transparent',
                                  }}
                                >
                                  <span className="flex items-center gap-2 min-w-0">
                                    <FileText className={`w-3.5 h-3.5 shrink-0 ${sel ? 'text-[#8B7CFF]' : 'text-[#64748B]'}`} />
                                    <span className="truncate">{d.filename}</span>
                                  </span>
                                  {sel && <Check className="w-3.5 h-3.5 text-[#8B7CFF] shrink-0" />}
                                </button>
                              );
                            })}
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={() => { setDocScopeOpen(false); fileInputRef.current?.click(); }}
                          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs font-medium text-[#4F8CFF] hover:bg-white/[0.04] border-t border-white/[0.06] pt-2 transition"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Upload new PDF
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right: Char counter + Stop / Send */}
                <div className="flex items-center gap-2 shrink-0">
                  {inputQuestion.length > 120 && (
                    <span className="text-[10px] text-[#64748B] font-mono hidden sm:inline">
                      {inputQuestion.length}
                    </span>
                  )}

                  {isStreaming ? (
                    <button
                      type="button"
                      onClick={handleStopGeneration}
                      className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl text-xs font-semibold text-white transition active:scale-95"
                      style={{ background: '#EF4444', boxShadow: '0 4px 16px rgba(239,68,68,0.35)' }}
                    >
                      <Square className="w-3 h-3 fill-current" />
                      <span>Stop</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleSendMessage()}
                      disabled={loading || !inputQuestion.trim()}
                      title="Send message (Enter)"
                      className="inline-flex items-center justify-center w-9 h-9 rounded-xl text-white transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
                      style={inputQuestion.trim()
                        ? {
                            background: 'linear-gradient(135deg, #4F8CFF, #8B7CFF)',
                            boxShadow: '0 4px 18px rgba(79, 140, 255, 0.35)',
                          }
                        : { background: 'rgba(255,255,255,0.08)' }}
                    >
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUp className="w-4 h-4 stroke-[2.5]" />}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Footer hint */}
            <p className="text-center text-[11px] text-[#64748B]">
              <span className="hidden sm:inline">Enter to send · Shift+Enter for new line · </span>
              Drop a PDF anywhere to index
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
