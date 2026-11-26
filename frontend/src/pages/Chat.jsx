import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Send,
  Sparkles,
  Trash2,
  Filter,
  AlertCircle,
  Loader2,
  HelpCircle,
  Plus,
  MessageSquare,
  History,
  BookOpen,
  Mic,
  MicOff,
  Paperclip,
  UploadCloud,
  X,
  GraduationCap,
  Square,
  Pencil,
  Check,
  Search,
  Code2,
  FlaskConical,
  ClipboardList,
  Compass,
} from 'lucide-react';
import ChatBubble from '../components/ChatBubble';
import { chatApi, documentApi } from '../services/api';

const CHAT_MODES = [
  { id: 'learn', label: 'Learn Mode', hint: 'Clear concepts & examples', icon: Compass },
  { id: 'exam', label: 'Exam Mode', hint: 'Definitions, rubric & conclusions', icon: ClipboardList },
  { id: 'practice', label: 'Practice Mode', hint: 'Questions, evaluation & mistakes', icon: HelpCircle },
  { id: 'code', label: 'Code Mode', hint: 'Code walkthrough, debug & Big-O', icon: Code2 },
  { id: 'research', label: 'Research Mode', hint: 'Cross-PDF evidence & synthesis', icon: FlaskConical },
];

const EXPLANATION_LEVELS = [
  { id: 'beginner', label: 'Beginner', desc: 'Simple English & basic analogies' },
  { id: 'intermediate', label: 'Intermediate', desc: 'Detailed academic depth' },
  { id: 'advanced', label: 'Advanced', desc: 'Rigorous technical & mathematical depth' },
];

const QUICK_PROMPTS = [
  { label: 'Summarize Key Points', prompt: 'Provide a structured chapter summary of the main concepts in the study materials.' },
  { label: 'Step-by-Step Math', prompt: 'Walk through the core formulas and derivations step-by-step.' },
  { label: 'Practice & Quiz', prompt: 'Ask me a practice question to test my understanding and evaluate my answer.' },
  { label: 'Explain Concept Simply', prompt: 'Explain the foundational concept clearly with an everyday example.' },
];

export default function Chat() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const preselectedDocId = searchParams.get('doc');
  const urlConvId = searchParams.get('conv');
  const isNewQuery = searchParams.get('new');

  const [conversations, setConversations] = useState([]);
  const [threadSearch, setThreadSearch] = useState('');
  const [activeConversationId, setActiveConversationId] = useState(urlConvId || null);
  const [renamingConvId, setRenamingConvId] = useState(null);
  const [renameDraft, setRenameDraft] = useState('');

  const [messages, setMessages] = useState([]);
  const [inputQuestion, setInputQuestion] = useState('');
  const [documents, setDocuments] = useState([]);
  const [selectedDocIds, setSelectedDocIds] = useState(preselectedDocId ? [preselectedDocId] : []);
  const [loading, setLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(true);

  const [tutorLevel, setTutorLevel] = useState('intermediate');
  const [chatMode, setChatMode] = useState('learn');

  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);

  const [isUploadingChatFile, setIsUploadingChatFile] = useState(false);
  const [uploadProgressText, setUploadProgressText] = useState('');
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const fileInputRef = useRef(null);

  const abortControllerRef = useRef(null);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    loadInitialData();
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  useEffect(() => {
    if (preselectedDocId) {
      setSelectedDocIds([preselectedDocId]);
    }
  }, [preselectedDocId]);

  useEffect(() => {
    if (isNewQuery) {
      handleNewConversation();
    }
  }, [isNewQuery]);

  useEffect(() => {
    if (activeConversationId && !isStreaming) {
      loadConversationMessages(activeConversationId);
    }
  }, [activeConversationId]);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-US';
      recognition.onstart = () => setIsListening(true);
      recognition.onresult = (event) => {
        const transcript = Array.from(event.results).map((r) => r[0].transcript).join('');
        setInputQuestion(transcript);
      };
      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);
      recognitionRef.current = recognition;
    }
    return () => recognitionRef.current?.abort();
  }, []);

  const toggleVoiceListening = () => {
    if (!('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
      alert('Speech recognition is not supported in this browser. Please use Chrome or Edge.');
      return;
    }
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current?.start();
      } catch (err) {
        console.warn('Could not start speech recognition:', err);
      }
    }
  };

  const loadInitialData = async () => {
    try {
      setInitialLoading(true);
      const [docs, convs] = await Promise.all([
        documentApi.getDocuments().catch(() => []),
        chatApi.getConversations().catch(() => []),
      ]);
      setDocuments(docs || []);
      setConversations(convs || []);

      if (urlConvId) {
        setActiveConversationId(urlConvId);
      } else if (convs && convs.length > 0 && !isNewQuery) {
        setActiveConversationId(convs[0].id);
      } else {
        setMessages([]);
      }
    } catch (err) {
      console.error('Failed to load initial chat data:', err);
    } finally {
      setInitialLoading(false);
    }
  };

  const loadConversationMessages = async (convId) => {
    try {
      setLoading(true);
      const res = await chatApi.getConversationMessages(convId);
      const msgsList = res?.messages || (Array.isArray(res) ? res : []);
      setMessages(msgsList);
    } catch (err) {
      console.error('Failed to load conversation messages:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleNewConversation = () => {
    abortControllerRef.current?.abort();
    setIsStreaming(false);
    setLoading(false);
    setActiveConversationId(null);
    setMessages([]);
    setError(null);
    setSearchParams({});
  };

  const handleSelectConversation = (convId) => {
    if (isStreaming) abortControllerRef.current?.abort();
    setActiveConversationId(convId);
    setSearchParams({ conv: convId });
    setError(null);
  };

  const startRenameConversation = (e, conv) => {
    e.stopPropagation();
    setRenamingConvId(conv.id);
    setRenameDraft(conv.title || '');
  };

  const submitRenameConversation = async (e, convId) => {
    if (e) e.stopPropagation();
    const cleaned = renameDraft.trim();
    if (!cleaned) {
      setRenamingConvId(null);
      return;
    }
    try {
      const updated = await chatApi.renameConversation(convId, cleaned);
      setConversations((prev) =>
        prev.map((c) => (c.id === convId ? { ...c, title: updated.title || cleaned } : c))
      );
    } catch (err) {
      setError('Failed to rename thread: ' + (err.response?.data?.detail || err.message));
    } finally {
      setRenamingConvId(null);
    }
  };

  const handleDeleteConversation = async (e, convId) => {
    e.stopPropagation();
    if (!window.confirm('Delete this conversation thread?')) return;
    try {
      await chatApi.deleteConversation(convId);
      const updated = conversations.filter((c) => c.id !== convId);
      setConversations(updated);
      if (activeConversationId === convId) {
        if (updated.length > 0) {
          setActiveConversationId(updated[0].id);
        } else {
          handleNewConversation();
        }
      }
    } catch (err) {
      setError('Failed to delete conversation: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleStopGeneration = () => {
    abortControllerRef.current?.abort();
  };

  const handleToggleDocumentFilter = (docId) => {
    if (docId === 'all') {
      setSelectedDocIds([]);
      return;
    }
    setSelectedDocIds((prev) =>
      prev.includes(docId) ? prev.filter((id) => id !== docId) : [...prev, docId]
    );
  };

  const streamQuestionTurn = async ({
    questionText,
    replaceFromIndex = null,
    replaceFromMessageId = null,
  }) => {
    const trimmed = (questionText || '').trim();
    if (!trimmed || loading || isStreaming) return;

    setError(null);
    const tempUserId = `temp-u-${Date.now()}`;
    const tempAsstId = `temp-a-${Date.now()}`;
    const nowIso = new Date().toISOString();

    const optimisticUser = {
      id: tempUserId,
      role: 'user',
      content: trimmed,
      timestamp: nowIso,
    };
    const optimisticAssistant = {
      id: tempAsstId,
      role: 'assistant',
      content: '',
      sources: [],
      isStreaming: true,
      mode: chatMode,
      explanation_level: tutorLevel,
      timestamp: nowIso,
    };

    setMessages((prev) => {
      const base = Array.isArray(prev) ? prev : [];
      const sliced = replaceFromIndex !== null ? base.slice(0, replaceFromIndex) : base;
      return [...sliced, optimisticUser, optimisticAssistant];
    });

    if (replaceFromIndex === null) {
      setInputQuestion('');
    }
    setIsStreaming(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    let resolvedConvId = activeConversationId;
    let resolvedAsstId = tempAsstId;

    try {
      await chatApi.streamMessage({
        question: trimmed,
        conversation_id: activeConversationId,
        document_ids: selectedDocIds,
        top_k: chatMode === 'research' ? 6 : 4,
        mode: chatMode,
        explanation_level: tutorLevel,
        replace_from_message_id: replaceFromMessageId,
        signal: controller.signal,
        onMeta: (meta) => {
          if (meta.conversation_id) {
            resolvedConvId = meta.conversation_id;
          }
          if (meta.message_id) {
            resolvedAsstId = meta.message_id;
          }
          setMessages((prev) =>
            prev.map((m) => {
              if (m.id === tempUserId && meta.user_message_id) {
                return { ...m, id: meta.user_message_id };
              }
              if (m.id === tempAsstId || m.id === resolvedAsstId) {
                return {
                  ...m,
                  id: meta.message_id || m.id,
                  sources: meta.sources || [],
                  not_found_in_docs: Boolean(meta.not_found_in_docs),
                  mode: meta.mode || m.mode,
                  explanation_level: meta.explanation_level || m.explanation_level,
                };
              }
              return m;
            })
          );
        },
        onChunk: (_delta, fullText) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === resolvedAsstId || m.id === tempAsstId
                ? { ...m, content: fullText, isStreaming: true }
                : m
            )
          );
        },
        onDone: (done) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === resolvedAsstId || m.id === tempAsstId
                ? {
                    ...m,
                    id: done.message_id || m.id,
                    content: done.answer || m.content,
                    model_used: done.model_used,
                    isStreaming: false,
                  }
                : m
            )
          );
        },
      });

      if (resolvedConvId && resolvedConvId !== activeConversationId) {
        setActiveConversationId(resolvedConvId);
        setSearchParams({ conv: resolvedConvId });
      }
      const updatedConvs = await chatApi.getConversations().catch(() => null);
      if (updatedConvs) setConversations(updatedConvs);
    } catch (err) {
      if (err.name === 'AbortError') {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === resolvedAsstId || m.id === tempAsstId
              ? {
                  ...m,
                  content: m.content
                    ? `${m.content}\n\n*(Generation stopped)*`
                    : '*(Generation stopped before any tokens arrived)*',
                  isStreaming: false,
                }
              : m
          )
        );
      } else {
        const msg = err.response?.data?.detail || err.message || 'Network or streaming timeout error.';
        setError(msg);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === resolvedAsstId || m.id === tempAsstId
              ? {
                  ...m,
                  content: m.content
                    ? `${m.content}\n\n> **Warning — Stream Interrupted:** ${msg}`
                    : `> **Warning — Error Generating Response:** ${msg}`,
                  isStreaming: false,
                }
              : m
          )
        );
      }
    } finally {
      abortControllerRef.current = null;
      setIsStreaming(false);
    }
  };

  const handleSendMessage = (customQuestion = null) => {
    const q = customQuestion ?? inputQuestion;
    streamQuestionTurn({ questionText: q });
  };

  const handleContextualAction = async (actionType, refMessage) => {
    if (loading || isStreaming) return;
    setError(null);
    setLoading(true);
    try {
      const res = await chatApi.runContextualAction({
        action_type: actionType,
        conversation_id: activeConversationId,
        message_id: refMessage?.id || null,
        document_ids: selectedDocIds,
        explanation_level: actionType === 'explain_simpler' ? 'beginner' : tutorLevel,
        mode: chatMode,
      });

      const actionLabels = {
        explain_simpler: 'Explain this simpler',
        example: 'Give a worked example',
        summarize: 'Summarize key takeaways',
        mcqs: 'Generate practice MCQs',
        flashcards: 'Create flashcards',
        practice_questions: 'Give practice questions',
      };

      const nowIso = new Date().toISOString();
      const userActionMsg = {
        id: res.user_message_id || `act-u-${Date.now()}`,
        role: 'user',
        content: actionLabels[actionType] || actionType,
        timestamp: nowIso,
      };
      const asstActionMsg = {
        id: res.message_id || `act-a-${Date.now()}`,
        role: 'assistant',
        content: res.answer,
        sources: res.sources || [],
        mode: res.mode,
        explanation_level: res.explanation_level,
        model_used: res.model_used,
        timestamp: nowIso,
      };
      setMessages((prev) => [...(Array.isArray(prev) ? prev : []), userActionMsg, asstActionMsg]);

      if (res.conversation_id && res.conversation_id !== activeConversationId) {
        setActiveConversationId(res.conversation_id);
        setSearchParams({ conv: res.conversation_id });
      }
      const updatedConvs = await chatApi.getConversations().catch(() => null);
      if (updatedConvs) setConversations(updatedConvs);
    } catch (err) {
      setError('Action failed: ' + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerateMessage = (msgIdx) => {
    if (loading || isStreaming) return;
    const safeList = Array.isArray(messages) ? messages : [];
    const targetAsst = safeList[msgIdx];
    let priorUserIdx = -1;
    for (let i = msgIdx - 1; i >= 0; i--) {
      if (safeList[i]?.role === 'user') {
        priorUserIdx = i;
        break;
      }
    }
    if (priorUserIdx === -1) return;
    const priorUser = safeList[priorUserIdx];
    const priorText = priorUser.content || priorUser.message || '';
    const cutId = priorUser.id && !String(priorUser.id).startsWith('temp-')
      ? priorUser.id
      : targetAsst?.id || null;

    streamQuestionTurn({
      questionText: priorText,
      replaceFromIndex: priorUserIdx,
      replaceFromMessageId: cutId,
    });
  };

  const handleEditUserMessage = (msgIdx, updatedText) => {
    if (loading || isStreaming) return;
    const safeList = Array.isArray(messages) ? messages : [];
    const targetUser = safeList[msgIdx];
    const cutId = targetUser?.id && !String(targetUser.id).startsWith('temp-') ? targetUser.id : null;
    streamQuestionTurn({
      questionText: updatedText,
      replaceFromIndex: msgIdx,
      replaceFromMessageId: cutId,
    });
  };

  const handleFeedback = async (messageId, feedbackVal) => {
    try {
      await chatApi.setMessageFeedback(messageId, feedbackVal);
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, feedback: feedbackVal } : m))
      );
    } catch (err) {
      console.warn('Could not save feedback:', err);
    }
  };

  const handleChatFileUpload = async (file) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setError('Only PDF documents are supported.');
      return;
    }

    setIsUploadingChatFile(true);
    setUploadProgressText(`Uploading and indexing "${file.name}"...`);
    try {
      const uploadRes = await documentApi.uploadDocuments([file]);
      const uploadedDoc = (uploadRes.documents || [])[0];
      const refreshedDocs = await documentApi.getDocuments();
      setDocuments(refreshedDocs || []);

      if (uploadedDoc) {
        setSelectedDocIds([uploadedDoc.id]);
      }

      setMessages((prev) => [
        ...(Array.isArray(prev) ? prev : []),
        {
          id: `sys-${Date.now()}`,
          role: 'system',
          content: `Indexed "${file.name}" (${uploadedDoc?.total_pages ?? uploadedDoc?.page_count ?? 1} pages, ${uploadedDoc?.total_chunks ?? uploadedDoc?.chunk_count ?? 1} chunks). Ready for cited RAG queries.`,
          timestamp: new Date().toISOString(),
        },
      ]);
    } catch (err) {
      setError('File upload failed: ' + (err.response?.data?.detail || err.message));
    } finally {
      setIsUploadingChatFile(false);
      setUploadProgressText('');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleNavigateToDoc = (docId, pageNumber) => {
    navigate(`/viewer?doc=${docId}&page=${pageNumber}`);
  };

  const filteredConversations = useMemo(() => {
    const q = threadSearch.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) => (c.title || '').toLowerCase().includes(q));
  }, [conversations, threadSearch]);

  const activeModeObj = CHAT_MODES.find((m) => m.id === chatMode) || CHAT_MODES[0];
  const safeMessages = Array.isArray(messages) ? messages : [];

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setIsDraggingOver(true);
      }}
      onDragLeave={() => setIsDraggingOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDraggingOver(false);
        if (e.dataTransfer.files?.length > 0) {
          handleChatFileUpload(e.dataTransfer.files[0]);
        }
      }}
      className="flex h-[calc(100vh-7.5rem)] max-w-7xl mx-auto gap-4 relative"
    >
      {isDraggingOver && (
        <div className="absolute inset-0 z-50 bg-[#4F8CFF]/15 backdrop-blur-sm border-2 border-dashed border-[#4F8CFF] rounded-2xl flex flex-col items-center justify-center pointer-events-none">
          <UploadCloud className="w-16 h-16 text-[#4F8CFF] animate-bounce mb-3" />
          <h3 className="text-lg font-bold text-[#F1F5FC]">Drop your study PDF here</h3>
          <p className="text-xs text-[#8A9BB8] mt-1">StudyMind will extract, chunk, and index it into FAISS</p>
        </div>
      )}

      <input
        type="file"
        ref={fileInputRef}
        accept=".pdf,application/pdf"
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length > 0) {
            handleChatFileUpload(e.target.files[0]);
            e.target.value = '';
          }
        }}
      />

      {/* Collapsible Conversation Memory Sidebar */}
      <aside
        className={`${
          showHistoryDrawer ? 'w-64 sm:w-72' : 'w-0 hidden md:block md:w-0 border-0'
        } transition-all duration-300 overflow-hidden flex flex-col bg-[#0C1424] border border-[#1E2E4A] rounded-2xl shadow-xl shrink-0 select-none`}
      >
        <div className="p-3 border-b border-[#1E2E4A] flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-[#4F8CFF]" />
            <span className="text-xs font-bold text-[#F1F5FC] uppercase tracking-wider">
              Study Threads
            </span>
          </div>
          <button
            type="button"
            onClick={handleNewConversation}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#4F8CFF] hover:bg-[#3B7BFA] text-white text-xs font-semibold transition shadow-sm active:scale-95"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>New</span>
          </button>
        </div>

        <div className="p-2 border-b border-[#1E2E4A]/70">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#64748B] absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={threadSearch}
              onChange={(e) => setThreadSearch(e.target.value)}
              placeholder="Search conversations..."
              className="w-full pl-8 pr-2.5 py-1.5 rounded-lg bg-[#080D18] border border-[#1E2E4A] text-xs text-[#F1F5FC] placeholder-[#64748B] focus:outline-none focus:border-[#4F8CFF]"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-none">
          {filteredConversations.length === 0 ? (
            <div className="py-10 text-center text-xs text-[#64748B] px-3">
              <MessageSquare className="w-6 h-6 mx-auto mb-2 text-[#4F8CFF]/50" />
              <p>No conversations found.</p>
              <p className="text-[11px] mt-1 text-[#8A9BB8]">Start asking a question to create a thread.</p>
            </div>
          ) : (
            filteredConversations.map((c) => {
              const isActive = c.id === activeConversationId;
              const isRenaming = renamingConvId === c.id;
              return (
                <div
                  key={c.id}
                  onClick={() => !isRenaming && handleSelectConversation(c.id)}
                  className={`group flex items-center justify-between gap-1.5 p-2.5 rounded-xl cursor-pointer text-xs transition ${
                    isActive
                      ? 'bg-[#16243B] text-[#F1F5FC] border border-[#4F8CFF]/40 font-medium shadow-sm'
                      : 'text-[#8A9BB8] hover:text-[#F1F5FC] hover:bg-[#111C2E] border border-transparent'
                  }`}
                >
                  {isRenaming ? (
                    <div className="flex items-center gap-1 w-full" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="text"
                        autoFocus
                        value={renameDraft}
                        onChange={(e) => setRenameDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') submitRenameConversation(e, c.id);
                          if (e.key === 'Escape') setRenamingConvId(null);
                        }}
                        className="flex-1 min-w-0 px-2 py-1 rounded-md bg-[#080D18] border border-[#4F8CFF] text-xs text-[#F1F5FC] focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={(e) => submitRenameConversation(e, c.id)}
                        className="p-1 text-emerald-400 hover:bg-[#080D18] rounded"
                        title="Save title"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setRenamingConvId(null);
                        }}
                        className="p-1 text-[#8A9BB8] hover:text-[#F1F5FC] rounded"
                        title="Cancel"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 min-w-0">
                        <MessageSquare
                          className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-[#4F8CFF]' : 'text-[#64748B]'}`}
                        />
                        <span className="truncate">{c.title || 'Untitled Thread'}</span>
                      </div>
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition shrink-0">
                        <button
                          type="button"
                          onClick={(e) => startRenameConversation(e, c)}
                          className="p-1 hover:text-[#4F8CFF] rounded transition"
                          title="Rename conversation"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleDeleteConversation(e, c.id)}
                          className="p-1 hover:text-rose-400 rounded transition"
                          title="Delete conversation"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })
          )}
        </div>
      </aside>

      {/* Main Conversational AI Workspace */}
      <div className="flex-1 flex flex-col bg-[#080D18] border border-[#1E2E4A] rounded-2xl shadow-2xl overflow-hidden min-w-0">
        {/* Top Controls Bar */}
        <div className="p-3 border-b border-[#1E2E4A] flex flex-wrap items-center justify-between gap-2.5 bg-[#0C1424]">
          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            <button
              type="button"
              onClick={() => setShowHistoryDrawer(!showHistoryDrawer)}
              className="p-1.5 rounded-lg text-[#8A9BB8] hover:text-[#F1F5FC] hover:bg-[#111C2E] border border-transparent hover:border-[#1E2E4A] transition shrink-0"
              title={showHistoryDrawer ? 'Hide threads drawer' : 'Show threads drawer'}
            >
              <History className="w-4 h-4 text-[#4F8CFF]" />
            </button>

            {/* Multi-document scope pills */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <Filter className="w-3.5 h-3.5 text-[#64748B] shrink-0" />
              <button
                type="button"
                onClick={() => handleToggleDocumentFilter('all')}
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition ${
                  selectedDocIds.length === 0
                    ? 'bg-[#4F8CFF]/20 text-[#F1F5FC] border border-[#4F8CFF]/50'
                    : 'bg-[#111C2E] text-[#8A9BB8] border border-[#1E2E4A] hover:text-[#F1F5FC]'
                }`}
              >
                All PDFs ({documents.length})
              </button>
              {documents.slice(0, 4).map((doc) => {
                const selected = selectedDocIds.includes(doc.id);
                return (
                  <button
                    key={doc.id}
                    type="button"
                    onClick={() => handleToggleDocumentFilter(doc.id)}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-medium max-w-[160px] truncate transition ${
                      selected
                        ? 'bg-[#8B7CFF]/20 text-[#F1F5FC] border border-[#8B7CFF]/60'
                        : 'bg-[#111C2E] text-[#8A9BB8] border border-[#1E2E4A] hover:text-[#F1F5FC]'
                    }`}
                    title={`${doc.filename} (${doc.total_chunks || 0} chunks)`}
                  >
                    {doc.filename}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[#111C2E] hover:bg-[#16243B] text-[#F1F5FC] border border-[#1E2E4A] transition active:scale-95"
              title="Upload PDF directly into AI Chat"
            >
              <Paperclip className="w-3.5 h-3.5 text-[#4F8CFF]" />
              <span className="hidden sm:inline">Attach PDF</span>
            </button>

            <button
              type="button"
              onClick={handleNewConversation}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[#111C2E] hover:bg-[#16243B] text-[#F1F5FC] border border-[#1E2E4A] transition active:scale-95"
              title="Start a fresh study conversation"
            >
              <Plus className="w-3.5 h-3.5 text-[#8B7CFF]" />
              <span className="hidden sm:inline">New Chat</span>
            </button>
          </div>
        </div>

        {/* Upload Status Banner */}
        {isUploadingChatFile && (
          <div className="bg-[#111C2E] border-b border-[#4F8CFF]/30 p-2.5 px-4 flex items-center justify-between text-xs text-[#F1F5FC]">
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-[#4F8CFF]" />
              <span>{uploadProgressText}</span>
            </div>
            <span className="text-[11px] text-[#8A9BB8] font-mono">Indexing chunks into FAISS...</span>
          </div>
        )}

        {/* Messages Scroll Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 bg-[#080D18]">
          {initialLoading ? (
            <div className="py-24 text-center text-xs text-[#8A9BB8] flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-[#4F8CFF]" />
              <span>Loading study workspace...</span>
            </div>
          ) : safeMessages.length === 0 ? (
            <div className="py-10 px-4 max-w-2xl mx-auto text-center space-y-6">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#4F8CFF] to-[#8B7CFF] flex items-center justify-center text-white mx-auto shadow-lg shadow-[#4F8CFF]/25">
                <GraduationCap className="w-7 h-7 stroke-[2.2]" />
              </div>

              <div>
                <h2 className="text-2xl sm:text-3xl font-bold text-[#F1F5FC] tracking-tight">
                  Your Personal AI Study{' '}
                  <span className="font-serif italic font-normal text-[#4F8CFF]">Tutor</span>
                </h2>
                <p className="text-xs sm:text-sm text-[#8A9BB8] mt-2 leading-relaxed max-w-lg mx-auto">
                  Switch seamlessly between Learn, Exam, Practice, Code, and Research modes. Grounded in your uploaded PDFs with clickable page citations and live streaming.
                </p>
              </div>

              {documents.length === 0 && (
                <div className="p-4 rounded-xl bg-[#111C2E] border border-[#1E2E4A] text-xs text-[#F1F5FC] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-left">
                  <div className="flex items-center gap-2.5">
                    <Sparkles className="w-4 h-4 text-[#4F8CFF] shrink-0" />
                    <span className="text-[#8A9BB8]">
                      <strong className="text-[#F1F5FC]">Attach Course Notes:</strong> Ask any academic question now or drop PDFs for multi-document hybrid RAG citations.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3.5 py-1.5 rounded-lg bg-[#4F8CFF] hover:bg-[#3B7BFA] text-white font-semibold shrink-0 flex items-center gap-1.5 transition text-xs shadow-sm"
                  >
                    <Paperclip className="w-3.5 h-3.5" />
                    <span>Attach PDF</span>
                  </button>
                </div>
              )}

              <div className="text-left space-y-2.5 pt-1">
                <span className="text-[11px] font-semibold text-[#8A9BB8] uppercase tracking-wider flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-[#8B7CFF]" />
                  Suggested Study Prompts
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {QUICK_PROMPTS.map((item, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSendMessage(item.prompt)}
                      className="p-3.5 text-left rounded-2xl bg-[#111C2E] hover:bg-[#16243B] border border-[#1E2E4A] hover:border-[#4F8CFF]/50 text-xs transition group shadow-sm"
                    >
                      <div className="font-semibold text-[#F1F5FC] group-hover:text-[#4F8CFF] transition">
                        {item.label}
                      </div>
                      <p className="text-[11px] text-[#8A9BB8] mt-1 line-clamp-1">"{item.prompt}"</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            safeMessages.map((msg, index) => (
              <ChatBubble
                key={msg.id || index}
                message={msg}
                disabledActions={loading || isStreaming}
                onNavigateToDoc={handleNavigateToDoc}
                onContextualAction={(actionType, mObj) => handleContextualAction(actionType, mObj)}
                onRegenerate={() => handleRegenerateMessage(index)}
                onEditUserMessage={(newTxt) => handleEditUserMessage(index, newTxt)}
                onFeedback={(msgId, val) => handleFeedback(msgId, val)}
              />
            ))
          )}

          {loading && !isStreaming && (
            <div className="py-3 px-4 rounded-xl bg-[#111C2E] border border-[#4F8CFF]/30 max-w-4xl mx-auto flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#4F8CFF] to-[#8B7CFF] flex items-center justify-center text-white shrink-0">
                <Loader2 className="w-4 h-4 animate-spin" />
              </div>
              <div className="space-y-0.5 text-xs">
                <p className="font-semibold text-[#F1F5FC]">StudyMind AI is generating your study action...</p>
                <p className="text-[11px] text-[#8A9BB8]">
                  Hybrid retrieval • Reranking • Grounding check
                </p>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Bottom Smart Controls + Composer */}
        <div className="p-3 sm:p-4 border-t border-[#1E2E4A] bg-[#0C1424] space-y-2.5">
          {error && (
            <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-200 text-xs flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{error}</span>
              </div>
              <button type="button" onClick={() => setError(null)} className="text-[#8A9BB8] hover:text-[#F1F5FC]">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Smart Chat Mode Selector + Understanding Level Selector directly above input */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2 px-0.5">
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-0.5">
              {CHAT_MODES.map((md) => {
                const Icon = md.icon;
                const active = chatMode === md.id;
                return (
                  <button
                    key={md.id}
                    type="button"
                    onClick={() => setChatMode(md.id)}
                    title={md.hint}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition shrink-0 ${
                      active
                        ? 'bg-[#4F8CFF] text-white shadow-sm shadow-[#4F8CFF]/30'
                        : 'bg-[#111C2E] hover:bg-[#16243B] text-[#8A9BB8] hover:text-[#F1F5FC] border border-[#1E2E4A]'
                    }`}
                  >
                    <Icon className="w-3 h-3" />
                    <span>{md.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
              <span className="text-[11px] font-semibold text-[#64748B] mr-1 shrink-0">Level:</span>
              {EXPLANATION_LEVELS.map((lvl) => {
                const active = tutorLevel === lvl.id;
                return (
                  <button
                    key={lvl.id}
                    type="button"
                    onClick={() => setTutorLevel(lvl.id)}
                    title={lvl.desc}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition shrink-0 ${
                      active
                        ? 'bg-[#8B7CFF]/25 text-[#F1F5FC] border border-[#8B7CFF]'
                        : 'bg-[#111C2E] hover:bg-[#16243B] text-[#8A9BB8] hover:text-[#F1F5FC] border border-[#1E2E4A]'
                    }`}
                  >
                    {lvl.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Input Composer */}
          <div className="relative flex items-end gap-2 bg-[#111C2E] border border-[#1E2E4A] focus-within:border-[#4F8CFF] rounded-2xl p-2 transition shadow-xl">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-2 text-[#8A9BB8] hover:text-[#4F8CFF] hover:bg-[#080D18] rounded-xl transition shrink-0"
              title="Attach PDF Document"
            >
              <Paperclip className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={toggleVoiceListening}
              className={`p-2 rounded-xl transition shrink-0 ${
                isListening
                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 animate-pulse'
                  : 'text-[#8A9BB8] hover:text-[#4F8CFF] hover:bg-[#080D18]'
              }`}
              title={isListening ? 'Listening... click to stop' : 'Voice Input'}
            >
              {isListening ? <MicOff className="w-4 h-4 text-rose-400" /> : <Mic className="w-4 h-4" />}
            </button>

            <textarea
              rows={2}
              value={inputQuestion}
              onChange={(e) => setInputQuestion(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                isListening
                  ? 'Listening to your voice...'
                  : `${activeModeObj.label}: ${activeModeObj.hint}... (Enter to send)`
              }
              disabled={loading}
              className="flex-1 bg-transparent border-0 text-sm text-[#F1F5FC] placeholder-[#64748B] focus:outline-none resize-none p-1.5"
            />

            {isStreaming ? (
              <button
                type="button"
                onClick={handleStopGeneration}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-semibold transition shadow-sm shrink-0"
                title="Stop generation"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>Stop</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleSendMessage()}
                disabled={loading || !inputQuestion.trim()}
                className="p-2.5 rounded-xl bg-[#4F8CFF] hover:bg-[#3B7BFA] disabled:bg-[#16243B] text-white disabled:text-[#64748B] transition shadow-sm active:scale-95 shrink-0"
                title="Send message"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4 stroke-[2.3]" />}
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#8A9BB8] px-1 font-mono">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#4F8CFF]" />
              {selectedDocIds.length > 0
                ? `Searching ${selectedDocIds.length} selected PDF(s)`
                : `Searching all uploaded PDFs (${documents.length})`}
            </span>
            <span>
              {activeModeObj.label} • {tutorLevel} • SSE Streaming active
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
