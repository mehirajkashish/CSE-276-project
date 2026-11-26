/**
 * Chat.jsx — StudyMind AI Minimal Chatbot
 * Monochrome Obsidian UI matching the overall StudyMind AI workspace,
 * with Full Screen mode, SSE streaming, multi-provider models, RAG & web search.
 */
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Sparkles, Trash2, AlertCircle, Loader2, HelpCircle,
  Plus, MessageSquare, BookOpen, Mic, MicOff, Paperclip,
  UploadCloud, X, GraduationCap, Square, Pencil, Check,
  Search, Code2, FlaskConical, ClipboardList, Compass,
  FileText, PanelLeft, Pin, PinOff, ChevronDown, ArrowUp,
  Cpu, Globe, Maximize2, Minimize2,
} from 'lucide-react';
import ChatBubble from '../components/ChatBubble';
import { chatApi, documentApi } from '../services/api';

/* ─── constants ────────────────────────────────────────────── */
const CHAT_MODES = [
  { id: 'learn',    label: 'Learn',    hint: 'Clear concepts & examples',        icon: Compass },
  { id: 'exam',     label: 'Exam',     hint: 'Definitions & key exam points',    icon: ClipboardList },
  { id: 'practice', label: 'Practice', hint: 'Questions & interactive practice', icon: HelpCircle },
  { id: 'code',     label: 'Code',     hint: 'Code walkthrough, debug & Big-O',  icon: Code2 },
  { id: 'writing',  label: 'Writing',  hint: 'Emails, essays, summaries & prose', icon: Pencil },
  { id: 'research', label: 'Research', hint: 'Cross-PDF & web synthesis',        icon: FlaskConical },
];

const EXPLANATION_LEVELS = [
  { id: 'beginner',     label: 'Beginner',     desc: 'Simple & intuitive explanations' },
  { id: 'intermediate', label: 'Intermediate', desc: 'Balanced academic & practical depth' },
  { id: 'advanced',     label: 'Advanced',     desc: 'Rigorous technical & theoretical depth' },
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
  { label: 'Summarize study notes', prompt: 'Provide a crisp, structured summary of the key concepts in my documents.' },
  { label: 'Step-by-step math',     prompt: 'Solve or derive the core formulas step-by-step and verify the result.' },
  { label: 'Debug or write code',   prompt: 'Explain cleanly, write bug-free code, and break down time and space complexity.' },
  { label: 'Test me with a quiz',   prompt: 'Ask me a focused practice question and evaluate my answer with feedback.' },
];

/* ─── Extracted Minimal History Sidebar ──────────────────────── */
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
  isFullScreen,
}) {
  const renderConvItem = (c) => {
    const isActive   = c.id === activeConversationId;
    const isRenaming = renamingConvId === c.id;
    const isPinned   = pinnedIds.includes(c.id);
    return (
      <div
        key={c.id}
        onClick={() => !isRenaming && onSelectConversation(c.id)}
        className={`group flex items-center gap-2 px-2.5 py-2 rounded-xl cursor-pointer text-xs transition ${
          isActive
            ? 'bg-[#242424] text-white font-medium'
            : 'text-[#9A9A9A] hover:text-white hover:bg-[#1A1A1A]'
        }`}
      >
        {isRenaming ? (
          <div className="flex items-center gap-1 w-full" onClick={(e) => e.stopPropagation()}>
            <input
              autoFocus
              value={renameDraft}
              onChange={(e) => setRenameDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onSubmitRename(e, c.id);
                if (e.key === 'Escape') setRenamingConvId(null);
              }}
              className="flex-1 min-w-0 px-2 py-0.5 rounded-lg text-xs text-white bg-[#0D0D0D] border border-[#3A3A3A] focus:outline-none"
            />
            <button onClick={(e) => onSubmitRename(e, c.id)} className="p-1 text-emerald-400 rounded hover:bg-[#2A2A2A] transition"><Check className="w-3 h-3" /></button>
            <button onClick={(e) => { e.stopPropagation(); setRenamingConvId(null); }} className="p-1 text-[#9A9A9A] rounded hover:bg-[#2A2A2A] transition"><X className="w-3 h-3" /></button>
          </div>
        ) : (
          <>
            <MessageSquare className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-white' : 'text-[#666666]'}`} />
            <span className="flex-1 truncate">{c.title || 'Untitled'}</span>
            <div className="flex items-center gap-0 sm:opacity-0 sm:group-hover:opacity-100 transition shrink-0">
              <button onClick={(e) => onTogglePin(e, c.id)} title={isPinned ? 'Unpin' : 'Pin'} className="p-1 rounded hover:text-white transition">
                {isPinned ? <PinOff className="w-2.5 h-2.5" /> : <Pin className="w-2.5 h-2.5" />}
              </button>
              <button onClick={(e) => onStartRename(e, c)} title="Rename" className="p-1 rounded hover:text-white transition"><Pencil className="w-2.5 h-2.5" /></button>
              <button onClick={(e) => onDelete(e, c.id)} title="Delete" className="p-1 rounded hover:text-rose-400 transition"><Trash2 className="w-2.5 h-2.5" /></button>
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-[#141414]">
      {/* Minimal Header */}
      <div className="flex items-center justify-between px-3.5 h-12 border-b border-[#222222] shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          {isFullScreen && (
            <div className="w-6 h-6 rounded-md bg-white text-black flex items-center justify-center shrink-0">
              <GraduationCap className="w-3.5 h-3.5 stroke-[2.5]" />
            </div>
          )}
          <span className="text-xs font-semibold tracking-tight text-white truncate">
            {isFullScreen ? 'StudyMind AI' : 'Conversations'}
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-[#9A9A9A] hover:text-white hover:bg-[#1F1F1F] transition"
          title="Close history"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* New Chat Button */}
      <div className="p-3">
        <button
          onClick={onNewConversation}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-white hover:bg-neutral-200 text-black transition active:scale-[0.98]"
        >
          <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
          New chat
        </button>
      </div>

      {/* Search */}
      <div className="px-3 pb-2">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-[#666666] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={threadSearch}
            onChange={(e) => setThreadSearch(e.target.value)}
            placeholder="Search chats…"
            className="w-full pl-8 pr-7 py-1.5 rounded-lg text-xs text-white placeholder-[#666666] bg-[#0D0D0D] border border-[#262626] focus:outline-none focus:border-[#3A3A3A] transition"
          />
          {threadSearch && (
            <button
              type="button"
              onClick={() => setThreadSearch('')}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[#666666] hover:text-white transition"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto px-2 py-1 space-y-0.5 scrollbar-thin">
        {filteredConvs.pinned.length > 0 && (
          <>
            <p className="px-2.5 pt-1 pb-0.5 text-[10px] font-semibold uppercase tracking-widest text-[#666666]">Pinned</p>
            {filteredConvs.pinned.map(renderConvItem)}
          </>
        )}
        {filteredConvs.pinned.length > 0 && filteredConvs.unpinned.length > 0 && (
          <p className="px-2.5 pt-2 pb-0.5 text-[10px] font-semibold uppercase tracking-widest text-[#666666]">Recent</p>
        )}
        {filteredConvs.unpinned.length === 0 && filteredConvs.pinned.length === 0 ? (
          <div className="py-10 text-center space-y-1.5">
            <MessageSquare className="w-5 h-5 mx-auto text-[#444444]" />
            <p className="text-[11px] text-[#666666]">
              {threadSearch.trim() ? 'No matching chats' : 'No conversations yet'}
            </p>
          </div>
        ) : (
          filteredConvs.unpinned.map(renderConvItem)
        )}
      </div>

      {/* Uploaded PDFs Scope Drawer */}
      {documents.length > 0 && (
        <div className="px-3 py-2.5 border-t border-[#222222]">
          <button
            onClick={() => setDocListOpen((v) => !v)}
            className="w-full flex items-center justify-between text-[10px] font-semibold uppercase tracking-widest text-[#666666] hover:text-[#9A9A9A] transition"
          >
            <span>PDFs ({documents.length})</span>
            <ChevronDown className={`w-3 h-3 transition-transform ${docListOpen ? 'rotate-180' : ''}`} />
          </button>
          {docListOpen && (
            <div className="space-y-0.5 max-h-36 overflow-y-auto scrollbar-thin mt-1.5">
              <button
                onClick={() => onToggleDoc('all')}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[11px] text-left transition ${
                  selectedDocIds.length === 0 ? 'bg-[#242424] text-white' : 'text-[#9A9A9A] hover:text-white'
                }`}
              >
                <BookOpen className="w-3 h-3 shrink-0" />
                All documents
              </button>
              {documents.slice(0, 6).map((doc) => {
                const sel = selectedDocIds.includes(doc.id);
                return (
                  <button
                    key={doc.id}
                    onClick={() => onToggleDoc(doc.id)}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[11px] text-left transition truncate ${
                      sel ? 'bg-[#242424] text-white' : 'text-[#9A9A9A] hover:text-white'
                    }`}
                  >
                    <FileText className="w-3 h-3 shrink-0" />
                    <span className="truncate">{doc.filename}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Main component ────────────────────────────────────────── */
export default function Chat() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const preselectedDocId = searchParams.get('doc');
  const urlConvId        = searchParams.get('conv');
  const isNewQuery       = searchParams.get('new');

  /* ── UI state ── */
  const [isFullScreen,    setIsFullScreen]    = useState(false);
  const [sidebarOpen,     setSidebarOpen]     = useState(false);
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
  const [availableModels, setAvailableModels] = useState(CHAT_MODELS);
  const [llmConfigured,   setLlmConfigured]   = useState(true);
  const [webSearchAvail,  setWebSearchAvail]  = useState({ enabled: true, provider: 'Auto' });
  const [useWebSearch,    setUseWebSearch]    = useState(null); // null=auto | true=force web search
  const [selectedModel,   setSelectedModel]   = useState(() => {
    const saved = localStorage.getItem('studymind_chat_model');
    return saved || 'gemini-flash-lite-latest';
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
    const onKeyDownGlobal = (e) => {
      if (e.key === 'Escape' && isFullScreen) {
        setIsFullScreen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKeyDownGlobal);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKeyDownGlobal);
    };
  }, [isFullScreen]);

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
      const [docs, convs, modelsInfo] = await Promise.all([
        documentApi.getDocuments().catch(() => []),
        chatApi.getConversations().catch(() => []),
        chatApi.getModels().catch(() => null),
      ]);
      setDocuments(docs || []);
      setConversations(convs || []);
      if (modelsInfo) {
        setLlmConfigured(Boolean(modelsInfo.configured));
        if (modelsInfo.web_search) setWebSearchAvail(modelsInfo.web_search);
        if (Array.isArray(modelsInfo.models) && modelsInfo.models.length > 0) {
          setAvailableModels(modelsInfo.models);
          setSelectedModel((prev) =>
            modelsInfo.models.some((m) => m.id === prev)
              ? prev
              : (modelsInfo.default_model || modelsInfo.models[0].id)
          );
        } else if (modelsInfo.configured === false) {
          setAvailableModels([]);
        }
      }
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
        use_web_search: useWebSearch,
        replace_from_message_id: replaceFromMessageId,
        signal: ctrl.signal,
        onMeta: (meta) => {
          if (meta.conversation_id) resolvedConvId = meta.conversation_id;
          if (meta.message_id)       resolvedAId    = meta.message_id;
          setMessages((prev) => prev.map((m) => {
            if (m.id === tempUId && meta.user_message_id) return { ...m, id: meta.user_message_id };
            if (m.id === tempAId || m.id === resolvedAId) {
              return {
                ...m,
                id: meta.message_id || m.id,
                sources: meta.sources || [],
                web_sources: meta.web_sources || [],
                not_found_in_docs: Boolean(meta.not_found_in_docs),
                mode: meta.mode || m.mode,
                explanation_level: meta.explanation_level || m.explanation_level,
              };
            }
            return m;
          }));
        },
        onChunk: (_delta, fullText) => {
          setMessages((prev) => prev.map((m) => (m.id === resolvedAId || m.id === tempAId ? { ...m, content: fullText, isStreaming: true } : m)));
        },
        onDone: (done) => {
          setMessages((prev) => prev.map((m) => (m.id === resolvedAId || m.id === tempAId ? {
            ...m,
            id: done.message_id || m.id,
            content: done.answer || m.content,
            model_used: done.model_used,
            web_sources: done.web_sources || m.web_sources || [],
            follow_up_suggestions: done.follow_up_suggestions || [],
            isStreaming: false,
          } : m)));
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
  const activeModelObj = !llmConfigured
    ? { id: '', label: 'No Model Key', badge: 'Unconfigured', desc: 'Set GEMINI_API_KEY, OPENAI_API_KEY, or OLLAMA_BASE_URL on backend' }
    : (availableModels.find((m) => m.id === selectedModel) || availableModels[0] || CHAT_MODELS[0]);
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
    isFullScreen,
  };

  /* ─────────────────────────────────────────────────── */
  /* RENDER                                               */
  /* ─────────────────────────────────────────────────── */
  return (
    <div
      className={
        isFullScreen
          ? 'fixed inset-0 z-50 flex w-full h-[100dvh] bg-[#0D0D0D] text-white overflow-hidden animate-fade-in-up'
          : 'flex h-full w-full relative overflow-hidden bg-[#0D0D0D] text-white'
      }
      onDragOver={(e) => { e.preventDefault(); setIsDraggingOver(true); }}
      onDragLeave={() => setIsDraggingOver(false)}
      onDrop={(e) => { e.preventDefault(); setIsDraggingOver(false); if (e.dataTransfer.files?.length > 0) handleChatFileUpload(e.dataTransfer.files[0]); }}
    >
      {/* ── Hidden file input ── */}
      <input
        type="file"
        ref={fileInputRef}
        accept=".pdf,application/pdf"
        className="hidden"
        onChange={(e) => { if (e.target.files?.length > 0) { handleChatFileUpload(e.target.files[0]); e.target.value = ''; } }}
      />

      {/* ── Drag overlay ── */}
      {isDraggingOver && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center pointer-events-none bg-[#0D0D0D]/85 border-2 border-dashed border-white/40 backdrop-blur-sm">
          <UploadCloud className="w-10 h-10 text-white mb-2.5 animate-bounce" />
          <p className="text-sm font-semibold text-white">Drop PDF to index</p>
          <p className="text-xs text-[#9A9A9A] mt-1">Extracted, chunked & stored in FAISS</p>
        </div>
      )}

      {/* ══════════════ DESKTOP HISTORY DRAWER ══════════════ */}
      <aside
        className="hidden md:flex flex-col flex-shrink-0 h-full overflow-hidden transition-all duration-200 bg-[#141414]"
        style={{
          width: sidebarOpen ? '248px' : '0px',
          borderRight: sidebarOpen ? '1px solid #222222' : 'none',
        }}
      >
        <div className="min-w-[248px] h-full overflow-hidden">
          <ChatSidebarContent {...sidebarProps} onClose={() => setSidebarOpen(false)} />
        </div>
      </aside>

      {/* ══════════════ MOBILE HISTORY OVERLAY ══════════════ */}
      {mobileSidebar && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm md:hidden"
            onClick={() => setMobileSidebar(false)}
          />
          <aside className="fixed left-0 top-0 bottom-0 z-50 w-72 h-full md:hidden bg-[#141414] border-r border-[#222222]">
            <ChatSidebarContent {...sidebarProps} onClose={() => setMobileSidebar(false)} />
          </aside>
        </>
      )}

      {/* ══════════════ MAIN CHAT COLUMN ══════════════ */}
      <div className="flex-1 flex flex-col h-full min-w-0 relative overflow-hidden bg-[#0D0D0D]">
        {/* Upload progress bar */}
        {isUploadingChatFile && (
          <div className="absolute top-0 inset-x-0 z-30 flex items-center gap-3 px-4 py-2 text-xs bg-[#141414] border-b border-[#262626]">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-white shrink-0" />
            <span className="text-white font-medium flex-1 truncate">{uploadProgressText}</span>
            <span className="text-[#9A9A9A] shrink-0">Indexing…</span>
          </div>
        )}

        {/* ── Minimal Sticky Header Bar ── */}
        <div className="shrink-0 h-12 px-3 sm:px-5 border-b border-[#222222] bg-[#0D0D0D]/90 backdrop-blur-md flex items-center justify-between gap-2 z-20">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {/* History Drawer Toggle */}
            <button
              type="button"
              onClick={() => { if (window.innerWidth < 768) setMobileSidebar(true); else setSidebarOpen((v) => !v); }}
              className={`inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border text-xs font-medium transition shrink-0 ${
                sidebarOpen
                  ? 'bg-[#242424] border-[#3A3A3A] text-white'
                  : 'bg-[#141414] border-[#262626] text-[#9A9A9A] hover:text-white hover:bg-[#1A1A1A]'
              }`}
              title="Toggle conversation history"
            >
              <PanelLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">History</span>
            </button>

            {/* Minimal Mode Switcher */}
            <div className="flex items-center gap-1 overflow-x-auto scrollbar-none min-w-0 py-0.5">
              {CHAT_MODES.map((md) => {
                const Icon = md.icon;
                const active = chatMode === md.id;
                return (
                  <button
                    key={md.id}
                    type="button"
                    onClick={() => setChatMode(md.id)}
                    title={md.hint}
                    className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-[11px] font-medium transition shrink-0 ${
                      active
                        ? 'bg-white text-black font-semibold'
                        : 'text-[#9A9A9A] hover:text-white hover:bg-[#1A1A1A]'
                    }`}
                  >
                    <Icon className="w-3 h-3" />
                    <span>{md.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Minimal Actions: New Chat, Attach PDF, Full Screen Toggle */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleNewConversation}
              className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-xs font-medium bg-[#141414] hover:bg-[#1A1A1A] border border-[#262626] text-[#9A9A9A] hover:text-white transition"
              title="New chat"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden md:inline">New</span>
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-xs font-medium bg-[#141414] hover:bg-[#1A1A1A] border border-[#262626] text-[#9A9A9A] hover:text-white transition"
              title="Attach PDF"
            >
              <Paperclip className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">PDF</span>
            </button>

            <button
              type="button"
              onClick={() => setIsFullScreen((v) => !v)}
              className={`inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-xs font-medium border transition ${
                isFullScreen
                  ? 'bg-white text-black border-white hover:bg-neutral-200 font-semibold'
                  : 'bg-[#141414] hover:bg-[#1A1A1A] border-[#262626] text-[#9A9A9A] hover:text-white'
              }`}
              title={isFullScreen ? 'Exit full screen (Esc)' : 'Full screen mode'}
            >
              {isFullScreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{isFullScreen ? 'Exit' : 'Full Screen'}</span>
            </button>
          </div>
        </div>

        {/* ── Scrollable Messages Area ── */}
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          <div className={`${isFullScreen ? 'max-w-4xl' : 'max-w-3xl'} mx-auto px-3 sm:px-6 py-4 sm:py-6`}>
            {/* ── Loading ── */}
            {initialLoading ? (
              <div className="py-28 flex flex-col items-center gap-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#141414] border border-[#262626]">
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                </div>
                <p className="text-xs text-[#9A9A9A]">Loading workspace…</p>
              </div>

            ) : safeMessages.length === 0 ? (
              /* ── Minimal Empty / Welcome State ── */
              <div className="py-10 sm:py-20 text-center space-y-6 max-w-xl mx-auto animate-fade-in-up">
                <div className="space-y-3">
                  <div className="w-11 h-11 rounded-xl bg-white text-black mx-auto flex items-center justify-center shadow-md">
                    <GraduationCap className="w-6 h-6 stroke-[2.3]" />
                  </div>
                  <div className="space-y-1.5">
                    <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                      How can I help you today?
                    </h1>
                    <p className="text-xs sm:text-sm text-[#9A9A9A] leading-relaxed">
                      Ask anything — general knowledge, math, code, writing, or grounded Q&A from your PDFs.
                    </p>
                  </div>
                </div>

                {/* Upload hint */}
                {documents.length === 0 && (
                  <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl text-xs bg-[#141414] border border-[#222222]">
                    <div className="flex items-center gap-2.5 text-left min-w-0">
                      <Sparkles className="w-3.5 h-3.5 text-white shrink-0" />
                      <span className="text-[#9A9A9A] truncate">
                        Attach a PDF anytime for cited page references.
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3 py-1 rounded-lg text-xs font-semibold bg-white hover:bg-neutral-200 text-black shrink-0 transition active:scale-95"
                    >
                      Upload
                    </button>
                  </div>
                )}

                {/* Minimal Starter Prompts */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-left">
                  {QUICK_PROMPTS.map((item, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSendMessage(item.prompt)}
                      className="p-3.5 rounded-xl text-left bg-[#141414] hover:bg-[#1A1A1A] border border-[#222222] hover:border-[#3A3A3A] transition group"
                    >
                      <p className="text-xs font-semibold text-white group-hover:text-white transition leading-tight">
                        {item.label}
                      </p>
                      <p className="text-[11px] text-[#666666] group-hover:text-[#9A9A9A] mt-1 leading-relaxed line-clamp-2 transition">
                        {item.prompt}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

            ) : (
              /* ── Messages ── */
              <div className="space-y-1.5">
                {safeMessages.map((msg, index) => (
                  <ChatBubble
                    key={msg.id || index}
                    message={msg}
                    isLastMessage={index === safeMessages.length - 1}
                    disabledActions={loading || isStreaming}
                    onNavigateToDoc={handleNavigateToDoc}
                    onContextualAction={(actionType, mObj) => handleContextualAction(actionType, mObj)}
                    onRegenerate={() => handleRegenerate(index)}
                    onEditUserMessage={(newTxt) => handleEditUser(index, newTxt)}
                    onFeedback={(msgId, val) => handleFeedback(msgId, val)}
                    onFollowUpClick={(sug) => handleSendMessage(sug)}
                  />
                ))}

                {/* Non-streaming loading indicator aligned on the right */}
                {loading && !isStreaming && (
                  <div className="flex justify-end py-2 animate-msg-right">
                    <div className="flex flex-row-reverse items-start gap-2.5">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-white text-black shadow-sm animate-pulse ring-2 ring-white/25 shrink-0">
                        <GraduationCap className="w-4 h-4 stroke-[2.4]" />
                      </div>
                      <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl rounded-tr-sm bg-[#141414] border border-[#262626] reply-streaming-card">
                        <span className="flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-white animate-typing-dot-1" />
                          <span className="w-1.5 h-1.5 rounded-full bg-white animate-typing-dot-2" />
                          <span className="w-1.5 h-1.5 rounded-full bg-white animate-typing-dot-3" />
                        </span>
                        <span className="text-xs text-[#9A9A9A]">Thinking…</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div ref={messagesEndRef} className="h-6" />
          </div>
        </div>

        {/* ══════════════ MINIMAL COMPOSER ══════════════ */}
        <div className="flex-shrink-0 px-3 sm:px-6 pb-3 sm:pb-4 pt-2 bg-[#0D0D0D]">
          <div className={`${isFullScreen ? 'max-w-4xl' : 'max-w-3xl'} mx-auto space-y-2`}>
            {/* Error banner */}
            {error && (
              <div className="flex items-center justify-between gap-3 px-3.5 py-2 rounded-xl text-xs bg-[#1A1A1A] border border-rose-500/30 text-rose-300 animate-fade-in-up">
                <div className="flex items-center gap-2 min-w-0">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-400" />
                  <span className="truncate">{error}</span>
                </div>
                <button onClick={() => setError(null)} className="text-[#9A9A9A] hover:text-white transition shrink-0">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Minimal Obsidian Composer Capsule */}
            <div
              className={`relative rounded-2xl transition-all duration-200 bg-[#141414] border focus-within:border-[#3A3A3A] ${
                isStreaming || loading ? 'composer-streaming-glow border-white/25' : 'border-[#262626]'
              }`}
            >
              {/* Animated Top Shimmer Bar while Generating */}
              {(isStreaming || loading) && (
                <div className="absolute top-0 inset-x-4 h-[1.5px] overflow-hidden rounded-full pointer-events-none">
                  <div
                    className="h-full w-1/2 animate-shimmer-slide rounded-full"
                    style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.75), transparent)' }}
                  />
                </div>
              )}

              {/* Selected PDF filter pills */}
              {selectedDocIds.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 px-3.5 pt-2.5 pb-0.5 animate-fade-in-up">
                  {selectedDocIds.map((id) => {
                    const docObj = documents.find((d) => d.id === id);
                    if (!docObj) return null;
                    return (
                      <span
                        key={id}
                        className="inline-flex items-center gap-1.5 pl-2 pr-1 py-0.5 rounded-lg text-[11px] font-medium bg-[#1F1F1F] border border-[#2E2E2E] text-white"
                      >
                        <FileText className="w-3 h-3 text-[#9A9A9A] shrink-0" />
                        <span className="truncate max-w-[160px]">{docObj.filename}</span>
                        <button
                          type="button"
                          onClick={() => handleToggleDoc(id)}
                          className="p-0.5 rounded hover:bg-[#2A2A2A] text-[#9A9A9A] hover:text-white transition"
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
                placeholder={isListening ? 'Listening…' : `Message StudyMind AI (${activeModeObj.label})…`}
                disabled={loading}
                className="w-full bg-transparent border-0 text-sm text-white placeholder-[#666666] focus:outline-none resize-none px-4 pt-3 pb-1.5 leading-relaxed"
                style={{ minHeight: '44px', maxHeight: '180px' }}
              />

              {/* Compact Bottom Control Bar */}
              <div className="flex items-center justify-between gap-2 px-3 pb-2.5 pt-1">
                <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                  {/* Attach PDF */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingChatFile}
                    title="Attach PDF"
                    className="inline-flex items-center gap-1 h-7 px-2 rounded-lg text-[11px] font-medium bg-[#1A1A1A] border border-[#262626] text-[#9A9A9A] hover:text-white hover:border-[#3A3A3A] transition disabled:opacity-40"
                  >
                    {isUploadingChatFile ? <Loader2 className="w-3.5 h-3.5 animate-spin text-white" /> : <Paperclip className="w-3.5 h-3.5" />}
                    <span className="hidden sm:inline">PDF</span>
                  </button>

                  {/* Voice input */}
                  <button
                    type="button"
                    onClick={toggleVoice}
                    title={isListening ? 'Stop listening' : 'Voice input'}
                    className={`inline-flex items-center justify-center w-7 h-7 rounded-lg border transition ${
                      isListening
                        ? 'bg-rose-500/20 border-rose-500/40 text-rose-400 animate-pulse'
                        : 'bg-[#1A1A1A] border-[#262626] text-[#9A9A9A] hover:text-white hover:border-[#3A3A3A]'
                    }`}
                  >
                    {isListening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                  </button>

                  {/* Segmented Explanation Level */}
                  <div className="inline-flex items-center p-0.5 rounded-lg bg-[#0D0D0D] border border-[#222222]">
                    {EXPLANATION_LEVELS.map((lvl) => {
                      const active = tutorLevel === lvl.id;
                      return (
                        <button
                          key={lvl.id}
                          type="button"
                          onClick={() => setTutorLevel(lvl.id)}
                          title={lvl.desc}
                          className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition ${
                            active ? 'bg-[#242424] text-white' : 'text-[#666666] hover:text-[#9A9A9A]'
                          }`}
                        >
                          {lvl.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Model Selector */}
                  <div className="relative" ref={modelMenuRef}>
                    <button
                      type="button"
                      onClick={() => { setModelMenuOpen((v) => !v); setDocScopeOpen(false); setLangMenuOpen(false); }}
                      title={`Model: ${activeModelObj.label}`}
                      className="inline-flex items-center gap-1.5 h-7 px-2 rounded-lg text-[11px] font-medium bg-[#1A1A1A] border border-[#262626] text-[#E5E5E5] hover:border-[#3A3A3A] transition"
                    >
                      <Cpu className="w-3 h-3 text-[#9A9A9A] shrink-0" />
                      <span className="truncate max-w-[92px] sm:max-w-none">{activeModelObj.label}</span>
                      <ChevronDown className={`w-3 h-3 text-[#666666] transition-transform ${modelMenuOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {modelMenuOpen && (
                      <div className="absolute bottom-9 left-0 w-72 max-w-[calc(100vw-2rem)] rounded-xl p-1.5 z-40 space-y-0.5 bg-[#141414] border border-[#262626] shadow-2xl animate-composer-pop">
                        <div className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#666666]">
                          {llmConfigured ? 'Configured Models' : 'No LLM Configured'}
                        </div>
                        {!llmConfigured || availableModels.length === 0 ? (
                          <div className="px-2.5 py-2 rounded-lg text-xs text-rose-300 bg-rose-500/10 border border-rose-500/20">
                            No AI API key connected. Set <code>GEMINI_API_KEY</code>, <code>OPENAI_API_KEY</code>, or <code>OLLAMA_BASE_URL</code>.
                          </div>
                        ) : (
                          availableModels.map((m) => {
                            const isCurrent = selectedModel === m.id;
                            return (
                              <button
                                key={m.id}
                                type="button"
                                onClick={() => { setSelectedModel(m.id); setModelMenuOpen(false); }}
                                className={`w-full flex items-start justify-between gap-2 px-2.5 py-1.5 rounded-lg text-left transition ${
                                  isCurrent ? 'bg-[#242424] text-white' : 'text-[#9A9A9A] hover:bg-[#1A1A1A] hover:text-white'
                                }`}
                              >
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-xs font-medium text-white">{m.label}</span>
                                    <span className="text-[9px] font-mono uppercase px-1.5 py-0.2 rounded bg-[#1A1A1A] border border-[#262626] text-[#9A9A9A]">
                                      {m.badge}
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-[#666666] mt-0.5 leading-snug">{m.desc}</p>
                                </div>
                                {isCurrent && <Check className="w-3.5 h-3.5 text-white shrink-0 mt-0.5" />}
                              </button>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>

                  {/* Language Selector */}
                  <div className="relative" ref={langMenuRef}>
                    <button
                      type="button"
                      onClick={() => { setLangMenuOpen((v) => !v); setModelMenuOpen(false); setDocScopeOpen(false); }}
                      title={`Language: ${activeLangObj.label}`}
                      className={`inline-flex items-center gap-1 h-7 px-2 rounded-lg text-[11px] font-medium border transition ${
                        selectedLanguage !== 'auto'
                          ? 'bg-[#242424] border-[#3A3A3A] text-white'
                          : 'bg-[#1A1A1A] border-[#262626] text-[#9A9A9A] hover:text-white hover:border-[#3A3A3A]'
                      }`}
                    >
                      <Globe className="w-3 h-3 shrink-0" />
                      <span>{activeLangObj.label}</span>
                      <ChevronDown className={`w-3 h-3 text-[#666666] transition-transform ${langMenuOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {langMenuOpen && (
                      <div className="absolute bottom-9 left-0 w-64 max-w-[calc(100vw-2rem)] rounded-xl p-1.5 z-40 space-y-0.5 bg-[#141414] border border-[#262626] shadow-2xl animate-composer-pop">
                        <div className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#666666]">
                          Language
                        </div>
                        <div className="max-h-56 overflow-y-auto grid grid-cols-1 gap-0.5 scrollbar-thin">
                          {CHAT_LANGUAGES.map((lang) => {
                            const isCurrent = selectedLanguage === lang.id;
                            return (
                              <button
                                key={lang.id}
                                type="button"
                                onClick={() => { setSelectedLanguage(lang.id); setLangMenuOpen(false); }}
                                className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-left transition ${
                                  isCurrent ? 'bg-[#242424] text-white' : 'text-[#9A9A9A] hover:bg-[#1A1A1A] hover:text-white'
                                }`}
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="text-xs font-medium">{lang.label}</span>
                                  <span className="text-[11px] text-[#666666] truncate">{lang.native}</span>
                                </div>
                                {isCurrent && <Check className="w-3.5 h-3.5 text-white shrink-0" />}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Web Search Toggle */}
                  {webSearchAvail?.enabled && (
                    <button
                      type="button"
                      onClick={() => setUseWebSearch((prev) => (prev === true ? null : true))}
                      title={
                        useWebSearch === true
                          ? `Web search forced ON (${webSearchAvail.provider})`
                          : `Web search Auto (${webSearchAvail.provider}) — click to force web search`
                      }
                      className={`inline-flex items-center gap-1 h-7 px-2 rounded-lg text-[11px] font-medium border transition ${
                        useWebSearch === true
                          ? 'bg-white text-black border-white font-semibold'
                          : 'bg-[#1A1A1A] border-[#262626] text-[#9A9A9A] hover:text-white hover:border-[#3A3A3A]'
                      }`}
                    >
                      <Search className="w-3 h-3" />
                      <span className="hidden sm:inline">{useWebSearch === true ? 'Web On' : 'Web'}</span>
                    </button>
                  )}

                  {/* PDF Scope Selector */}
                  <div className="relative" ref={docScopeRef}>
                    <button
                      type="button"
                      onClick={() => { setDocScopeOpen((v) => !v); setModelMenuOpen(false); setLangMenuOpen(false); }}
                      title="Choose PDFs to reference"
                      className={`inline-flex items-center gap-1 h-7 px-2 rounded-lg text-[11px] font-medium border transition ${
                        selectedDocIds.length > 0
                          ? 'bg-[#242424] border-[#3A3A3A] text-white'
                          : 'bg-[#1A1A1A] border-[#262626] text-[#9A9A9A] hover:text-white hover:border-[#3A3A3A]'
                      }`}
                    >
                      <BookOpen className="w-3 h-3 shrink-0" />
                      <span className="hidden xs:inline sm:inline">
                        {selectedDocIds.length > 0 ? `${selectedDocIds.length} PDF` : `All PDFs (${documents.length})`}
                      </span>
                      <ChevronDown className={`w-3 h-3 text-[#666666] transition-transform ${docScopeOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {docScopeOpen && (
                      <div className="absolute bottom-9 left-0 w-64 max-w-[calc(100vw-2rem)] rounded-xl p-1.5 z-40 space-y-1 bg-[#141414] border border-[#262626] shadow-2xl animate-composer-pop">
                        <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#666666]">
                          PDF Context
                        </div>
                        <button
                          type="button"
                          onClick={() => { handleToggleDoc('all'); setDocScopeOpen(false); }}
                          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition ${
                            selectedDocIds.length === 0 ? 'bg-[#242424] text-white' : 'text-[#9A9A9A] hover:bg-[#1A1A1A] hover:text-white'
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            <BookOpen className="w-3.5 h-3.5" />
                            All uploaded PDFs ({documents.length})
                          </span>
                          {selectedDocIds.length === 0 && <Check className="w-3.5 h-3.5 text-white" />}
                        </button>

                        {documents.length > 0 && (
                          <div className="max-h-44 overflow-y-auto space-y-0.5 pt-1 border-t border-[#222222] scrollbar-thin">
                            {documents.map((d) => {
                              const sel = selectedDocIds.includes(d.id);
                              return (
                                <button
                                  key={d.id}
                                  type="button"
                                  onClick={() => handleToggleDoc(d.id)}
                                  className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-xs text-left transition ${
                                    sel ? 'bg-[#242424] text-white' : 'text-[#9A9A9A] hover:bg-[#1A1A1A] hover:text-white'
                                  }`}
                                >
                                  <span className="flex items-center gap-2 min-w-0">
                                    <FileText className="w-3.5 h-3.5 shrink-0" />
                                    <span className="truncate">{d.filename}</span>
                                  </span>
                                  {sel && <Check className="w-3.5 h-3.5 text-white shrink-0" />}
                                </button>
                              );
                            })}
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={() => { setDocScopeOpen(false); fileInputRef.current?.click(); }}
                          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-white hover:bg-[#1A1A1A] border-t border-[#222222] pt-2 transition"
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
                    <span className="text-[10px] text-[#666666] font-mono hidden sm:inline">
                      {inputQuestion.length}
                    </span>
                  )}

                  {isStreaming ? (
                    <button
                      type="button"
                      onClick={handleStopGeneration}
                      className="inline-flex items-center gap-1.5 h-8 px-3 rounded-xl text-xs font-semibold bg-white text-black hover:bg-neutral-200 transition active:scale-95"
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
                      className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-white hover:bg-neutral-200 text-black transition-all active:scale-95 disabled:bg-[#222222] disabled:text-[#666666] disabled:cursor-not-allowed"
                    >
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUp className="w-4 h-4 stroke-[2.5]" />}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Minimal Footer Hint */}
            <p className="text-center text-[10px] text-[#666666]">
              <span className="hidden sm:inline">Enter to send · Shift+Enter for new line · </span>
              {isFullScreen ? 'Press Esc to exit full screen' : 'Drop a PDF anywhere to index'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
