import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Send,
  Sparkles,
  Trash2,
  FileText,
  Filter,
  CheckCircle2,
  AlertCircle,
  Loader2,
  HelpCircle,
  Plus,
  MessageSquare,
  History,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  BookOpen,
  Mic,
  MicOff,
  Paperclip,
  UploadCloud,
  FileUp,
  X,
  GraduationCap
} from 'lucide-react';
import ChatBubble from '../components/ChatBubble';
import { chatApi, documentApi } from '../services/api';

const QUICK_PROMPTS = [
  { label: 'Summarize Key Points', prompt: 'Provide a structured summary of the main points in the study materials.' },
  { label: 'Key Formulas & Concepts', prompt: 'List and explain the most important formulas, definitions, and concepts.' },
  { label: 'Quiz Me', prompt: 'Generate 3 exam practice questions based on the uploaded materials to test my understanding.' },
  { label: 'Explain Simply (ELI5)', prompt: 'Explain the core topic in simple, student-friendly terms with real-world analogies.' },
];

export default function Chat() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const preselectedDocId = searchParams.get('doc');
  const urlConvId = searchParams.get('conv');
  const isNewQuery = searchParams.get('new');

  const [conversations, setConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(urlConvId || null);
  const [messages, setMessages] = useState([]);
  const [inputQuestion, setInputQuestion] = useState('');
  const [documents, setDocuments] = useState([]);
  const [selectedDocId, setSelectedDocId] = useState(preselectedDocId || 'all');
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(true);

  // Voice Feature (Speech-to-Text) state
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);

  // File Upload in Chat state
  const [isUploadingChatFile, setIsUploadingChatFile] = useState(false);
  const [uploadProgressText, setUploadProgressText] = useState('');
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const fileInputRef = useRef(null);

  // AI Tutor Persona & Depth Controls
  const [tutorLevel, setTutorLevel] = useState('intermediate'); // beginner, intermediate, advanced
  const [tutorMode, setTutorMode] = useState('standard'); // standard, eli5, exam, hinglish, code

  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  useEffect(() => {
    if (preselectedDocId) {
      setSelectedDocId(preselectedDocId);
    }
  }, [preselectedDocId]);

  useEffect(() => {
    if (isNewQuery) {
      handleNewConversation();
    }
  }, [isNewQuery]);

  useEffect(() => {
    if (activeConversationId) {
      loadConversationMessages(activeConversationId);
    }
  }, [activeConversationId]);

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event) => {
        const transcript = Array.from(event.results)
          .map((result) => result[0].transcript)
          .join('');
        setInputQuestion(transcript);
      };

      recognition.onerror = (event) => {
        console.warn('Speech recognition error:', event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []);

  const toggleVoiceListening = () => {
    if (!('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
      alert('Speech recognition is not supported in this browser. Please use Google Chrome or Microsoft Edge.');
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current?.start();
      } catch (err) {
        console.warn('Could not start recognition:', err);
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

  // Fixed message loading: unwrap .messages from ConversationDetail
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
    setActiveConversationId(null);
    setMessages([]);
    setError(null);
    setSearchParams({});
  };

  const handleSelectConversation = (convId) => {
    setActiveConversationId(convId);
    setSearchParams({ conv: convId });
    setError(null);
  };

  const handleDeleteConversation = async (e, convId) => {
    e.stopPropagation();
    if (window.confirm('Delete this conversation thread?')) {
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
        alert('Failed to delete conversation: ' + (err.response?.data?.detail || err.message));
      }
    }
  };

  const handleSendMessage = async (customQuestion = null) => {
    const q = customQuestion || inputQuestion;
    if (!q || !q.trim() || loading) return;

    setError(null);
    const userMsg = {
      role: 'user',
      content: q.trim(),
      timestamp: new Date().toISOString()
    };

    setMessages((prev) => [...(Array.isArray(prev) ? prev : []), userMsg]);
    setInputQuestion('');
    setLoading(true);

    try {
      const docIds = selectedDocId === 'all' ? [] : [selectedDocId];
      let finalQuery = q.trim();
      if (!customQuestion) {
        const prefixes = [];
        if (tutorLevel === 'beginner') prefixes.push('[Level: Beginner / Foundational]');
        if (tutorLevel === 'advanced') prefixes.push('[Level: Advanced / Rigorous]');
        if (tutorMode === 'eli5') prefixes.push('[Style: Explain Like I am 5 with everyday analogy]');
        if (tutorMode === 'exam') prefixes.push('[Style: High-Yield Exam Oriented with marking tips]');
        if (tutorMode === 'hinglish') prefixes.push('[Style: Conversational Hindi-English Hinglish blend]');
        if (tutorMode === 'code') prefixes.push('[Style: Programming Code Implementation & Complexity]');
        if (prefixes.length > 0) {
          finalQuery = `${prefixes.join(' ')}\n\n${finalQuery}`;
        }
      }

      const response = await chatApi.sendMessage({
        question: finalQuery,
        conversation_id: activeConversationId,
        document_ids: docIds,
        top_k: 4
      });

      if (response.conversation_id && response.conversation_id !== activeConversationId) {
        setActiveConversationId(response.conversation_id);
        const updatedConvs = await chatApi.getConversations().catch(() => []);
        setConversations(updatedConvs || []);
      }

      const assistantMsg = {
        role: 'assistant',
        content: response.answer,
        sources: response.sources || [],
        timestamp: response.timestamp || new Date().toISOString()
      };

      setMessages((prev) => [...(Array.isArray(prev) ? prev : []), assistantMsg]);
    } catch (err) {
      const msg = err.response?.data?.detail || err.message || 'Failed to generate answer.';
      setError(msg);
      setMessages((prev) => [
        ...(Array.isArray(prev) ? prev : []),
        {
          role: 'assistant',
          content: `⚠️ **Error generating response:** ${msg}`,
          timestamp: new Date().toISOString()
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Direct File Upload in Chat
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
      const newDocs = uploadRes.documents || [];
      const uploadedDoc = newDocs[0];

      // Refresh documents list
      const refreshedDocs = await documentApi.getDocuments();
      setDocuments(refreshedDocs || []);

      if (uploadedDoc) {
        setSelectedDocId(uploadedDoc.id);
      }

      // Add friendly system message into chat
      const systemMsg = {
        role: 'system',
        content: `📄 Uploaded and indexed "${file.name}" (${uploadedDoc?.page_count || 1} pages, ${uploadedDoc?.chunk_count || 1} chunks). RAG vector index ready!`,
        timestamp: new Date().toISOString()
      };
      setMessages((prev) => [...(Array.isArray(prev) ? prev : []), systemMsg]);
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

  const selectedDocObj = documents.find((d) => d.id === selectedDocId);
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
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          handleChatFileUpload(e.dataTransfer.files[0]);
        }
      }}
      className="flex h-[calc(100vh-7.5rem)] max-w-7xl mx-auto gap-4 relative"
    >
      {/* Drag & Drop Visual Overlay */}
      {isDraggingOver && (
        <div className="absolute inset-0 z-50 bg-blue-600/20 backdrop-blur-sm border-2 border-dashed border-blue-400 rounded-2xl flex flex-col items-center justify-center pointer-events-none">
          <UploadCloud className="w-16 h-16 text-blue-400 animate-bounce mb-3" />
          <h3 className="text-lg font-bold text-white">Drop your PDF study material here</h3>
          <p className="text-xs text-blue-200 mt-1">StudyMind will extract, chunk, and index it into FAISS automatically</p>
        </div>
      )}

      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        accept=".pdf,application/pdf"
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            handleChatFileUpload(e.target.files[0]);
            e.target.value = '';
          }
        }}
      />

      {/* Collapsible Past Conversations Drawer */}
      <div
        className={`${
          showHistoryDrawer ? 'w-64 sm:w-72' : 'w-0 hidden md:block md:w-0'
        } transition-all duration-300 overflow-hidden flex flex-col bg-[#141414] border border-[#262626] rounded-2xl shadow-xl shrink-0 select-none`}
      >
        <div className="p-3 border-b border-[#222222] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-white" />
            <span className="text-xs font-bold text-white uppercase tracking-wider">
              Chat Threads
            </span>
          </div>
          <button
            onClick={handleNewConversation}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white hover:bg-neutral-200 text-black text-xs font-semibold transition shadow-sm active:scale-95"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>New</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-none">
          {conversations.length === 0 ? (
            <div className="py-8 text-center text-xs text-[#666666] px-3">
              <MessageSquare className="w-6 h-6 mx-auto mb-2 text-[#666666]" />
              <p>No saved threads yet.</p>
              <p className="text-[11px] mt-1">Start asking a question to create a thread.</p>
            </div>
          ) : (
            conversations.map((c) => {
              const isActive = c.id === activeConversationId;
              return (
                <div
                  key={c.id}
                  onClick={() => handleSelectConversation(c.id)}
                  className={`group flex items-center justify-between p-2.5 rounded-xl cursor-pointer text-xs transition ${
                    isActive
                      ? 'bg-[#242424] text-white border border-[#2E2E2E] font-medium'
                      : 'text-[#9A9A9A] hover:text-white hover:bg-[#1A1A1A] border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <MessageSquare className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-white' : 'text-[#666666]'}`} />
                    <span className="truncate font-medium">{c.title || 'Untitled Thread'}</span>
                  </div>
                  <button
                    onClick={(e) => handleDeleteConversation(e, c.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:text-rose-400 rounded transition"
                    title="Delete conversation"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Main Conversational Q&A Window */}
      <div className="flex-1 flex flex-col bg-[#0D0D0D] border border-[#262626] rounded-2xl shadow-2xl overflow-hidden min-w-0 select-none">
        {/* Top Controls Bar */}
        <div className="p-3 border-b border-[#222222] flex items-center justify-between gap-3 bg-[#141414]">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              onClick={() => setShowHistoryDrawer(!showHistoryDrawer)}
              className="p-1.5 rounded-lg text-[#9A9A9A] hover:text-white hover:bg-[#1A1A1A] transition shrink-0"
              title={showHistoryDrawer ? 'Hide threads drawer' : 'Show threads drawer'}
            >
              <History className="w-4 h-4 text-white" />
            </button>

            <div className="flex items-center gap-2 min-w-0">
              <Filter className="w-3.5 h-3.5 text-[#666666] shrink-0" />
              <select
                value={selectedDocId}
                onChange={(e) => setSelectedDocId(e.target.value)}
                className="text-xs font-semibold rounded-lg bg-[#1A1A1A] border border-[#262626] text-white px-2.5 py-1.5 focus:outline-none focus:border-white max-w-[200px] sm:max-w-xs truncate"
              >
                <option value="all">🔍 All Documents ({documents.length})</option>
                {documents.map((doc) => (
                  <option key={doc.id} value={doc.id}>
                    📄 {doc.filename} ({doc.total_chunks || doc.chunk_count || 0} chunks)
                  </option>
                ))}
              </select>
            </div>

            {selectedDocObj && (
              <span className="hidden lg:inline-flex text-[11px] text-white font-mono">
                {selectedDocObj.total_pages || selectedDocObj.page_count || 1} pages •{' '}
                {selectedDocObj.total_chunks || selectedDocObj.chunk_count || 0} chunks
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[#1F1F1F] hover:bg-[#282828] text-white border border-[#2E2E2E] transition active:scale-95"
              title="Upload PDF directly into AI Chat"
            >
              <Paperclip className="w-3.5 h-3.5 text-[#9A9A9A]" />
              <span className="hidden sm:inline">Attach PDF</span>
            </button>

            <button
              onClick={handleNewConversation}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[#1F1F1F] hover:bg-[#282828] text-white border border-[#2E2E2E] transition active:scale-95"
              title="Start a fresh question thread"
            >
              <Plus className="w-3.5 h-3.5 text-white" />
              <span className="hidden sm:inline">New Chat</span>
            </button>
          </div>
        </div>

        {/* Upload Status Banner */}
        {isUploadingChatFile && (
          <div className="bg-[#1A1A1A] border-b border-[#262626] p-2.5 px-4 flex items-center justify-between text-xs text-white animate-pulse">
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-white" />
              <span>{uploadProgressText}</span>
            </div>
            <span className="text-[11px] text-[#9A9A9A] font-mono">Indexing into FAISS...</span>
          </div>
        )}

        {/* Messages Scroll Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {initialLoading ? (
            <div className="py-24 text-center text-xs text-[#9A9A9A] flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-white" />
              <span>Loading messages...</span>
            </div>
          ) : safeMessages.length === 0 ? (
            <div className="py-12 px-4 max-w-2xl mx-auto text-center space-y-6">
              <div className="w-14 h-14 rounded-2xl bg-white flex items-center justify-center text-black mx-auto shadow-xl">
                <GraduationCap className="w-7 h-7 stroke-[2.5]" />
              </div>

              <div>
                <h2 className="text-3xl font-bold text-white tracking-tight">
                  What are you studying today?{' '}
                  <span className="font-serif italic font-normal text-white">👋</span>
                </h2>
                <p className="text-xs text-[#9A9A9A] mt-2 leading-relaxed max-w-lg mx-auto">
                  I'm your personal AI study companion. Ask me to break down tricky concepts, find formulas, test your understanding, or summarize key takeaways from your course notes.
                </p>
              </div>

              {documents.length === 0 && (
                <div className="p-4 rounded-xl bg-[#141414] border border-[#262626] text-xs text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-left">
                  <div className="flex items-center gap-2.5">
                    <Sparkles className="w-4 h-4 text-white shrink-0" />
                    <span className="text-[#9A9A9A]">
                      <strong className="text-white">AI Study Assistant Ready:</strong> Ask any academic question now, or attach your course slides anytime for page-by-page citations.
                    </span>
                  </div>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3.5 py-1.5 rounded-lg bg-white hover:bg-neutral-200 text-black font-semibold shrink-0 flex items-center gap-1.5 transition text-xs shadow-sm active:scale-95"
                  >
                    <Paperclip className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>Attach PDF</span>
                  </button>
                </div>
              )}

              <div className="text-left space-y-2 pt-2">
                <span className="text-xs font-semibold text-[#666666] uppercase tracking-wider flex items-center gap-1.5">
                  <HelpCircle className="w-3.5 h-3.5 text-[#9A9A9A]" />
                  Quick Suggested Questions
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {QUICK_PROMPTS.map((item, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSendMessage(item.prompt)}
                      className="p-3.5 text-left rounded-2xl bg-[#141414] hover:bg-[#1A1A1A] border border-[#262626] hover:border-[#3A3A3A] text-xs text-[#9A9A9A] hover:text-white transition group shadow-sm"
                    >
                      <div className="font-semibold text-white group-hover:text-white transition">{item.label}</div>
                      <p className="text-[11px] text-[#666666] mt-0.5 line-clamp-1">"{item.prompt}"</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            safeMessages.map((msg, index) => (
              <ChatBubble
                key={index}
                message={msg}
                onNavigateToDoc={handleNavigateToDoc}
                onPromptAction={(actionText) => handleSendMessage(actionText)}
              />
            ))
          )}

          {/* Loading Indicator */}
          {loading && (
            <div className="py-3 px-4 rounded-xl bg-[#141414] border border-[#262626] max-w-4xl mx-auto flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-black shrink-0">
                <Loader2 className="w-4 h-4 animate-spin text-black" />
              </div>
              <div className="space-y-0.5 text-xs">
                <p className="font-semibold text-white">StudyMind AI is searching vectors & generating response...</p>
                <p className="text-[11px] text-[#666666]">
                  FAISS Cosine Similarity • Page Grounding • Anti-hallucination verification
                </p>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar & Actions */}
        <div className="p-3 border-t border-[#222222] bg-[#0D0D0D] space-y-2">
          {error && (
            <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{error}</span>
              </div>
              <button onClick={() => setError(null)} className="text-[#9A9A9A] hover:text-white">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Tutor Persona & Explanation Controls */}
          <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-[11px] text-[#9A9A9A]">
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
              <span className="font-semibold text-[#666666] shrink-0">Depth:</span>
              {[
                { id: 'beginner', label: 'Beginner' },
                { id: 'intermediate', label: 'Undergrad' },
                { id: 'advanced', label: 'Rigorous Proof' },
              ].map((lvl) => (
                <button
                  key={lvl.id}
                  onClick={() => setTutorLevel(lvl.id)}
                  className={`px-2.5 py-0.5 rounded-full transition shrink-0 ${
                    tutorLevel === lvl.id
                      ? 'bg-white text-black font-semibold shadow-sm'
                      : 'bg-[#141414] hover:bg-[#1A1A1A] text-[#9A9A9A] hover:text-white border border-[#262626]'
                  }`}
                >
                  {lvl.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
              <span className="font-semibold text-[#666666] shrink-0">Mode:</span>
              {[
                { id: 'standard', label: 'Standard' },
                { id: 'eli5', label: 'ELI5' },
                { id: 'exam', label: 'Exam Rubric' },
                { id: 'hinglish', label: 'Hinglish' },
                { id: 'code', label: 'Code' },
              ].map((md) => (
                <button
                  key={md.id}
                  onClick={() => setTutorMode(md.id)}
                  className={`px-2.5 py-0.5 rounded-full transition shrink-0 ${
                    tutorMode === md.id
                      ? 'bg-white text-black font-semibold shadow-sm'
                      : 'bg-[#141414] hover:bg-[#1A1A1A] text-[#9A9A9A] hover:text-white border border-[#262626]'
                  }`}
                >
                  {md.label}
                </button>
              ))}
            </div>
          </div>

          {/* Quick Action Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px] scrollbar-none">
            {QUICK_PROMPTS.map((chip, idx) => (
              <button
                key={idx}
                onClick={() => handleSendMessage(chip.prompt)}
                className="whitespace-nowrap px-3 py-1 rounded-full bg-[#141414] border border-[#262626] text-[#9A9A9A] hover:text-white hover:border-[#3A3A3A] transition shrink-0"
              >
                {chip.label}
              </button>
            ))}
          </div>

          {/* Textarea + Voice + Attachment Bar */}
          <div className="relative flex items-end gap-2 bg-[#141414] border border-[#262626] focus-within:border-white rounded-xl p-2 transition shadow-xl">
            {/* Attachment Button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-2 text-[#9A9A9A] hover:text-white hover:bg-[#1A1A1A] rounded-lg transition shrink-0"
              title="Attach PDF Document"
            >
              <Paperclip className="w-4 h-4" />
            </button>

            {/* Voice Input Button */}
            <button
              type="button"
              onClick={toggleVoiceListening}
              className={`p-2 rounded-lg transition shrink-0 ${
                isListening
                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 animate-pulse'
                  : 'text-[#9A9A9A] hover:text-white hover:bg-[#1A1A1A]'
              }`}
              title={isListening ? 'Listening... click to stop' : 'Click to speak question (Voice Input)'}
            >
              {isListening ? <MicOff className="w-4 h-4 text-rose-400" /> : <Mic className="w-4 h-4" />}
            </button>

            {/* Input Box */}
            <textarea
              rows={2}
              value={inputQuestion}
              onChange={(e) => setInputQuestion(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                isListening
                  ? '🎙️ Listening to your voice... Speak now!'
                  : documents.length === 0
                  ? 'Type a question or attach a PDF to unlock grounded RAG citations...'
                  : selectedDocObj
                  ? `Ask about "${selectedDocObj.filename}" (Press Enter to send)...`
                  : 'Ask any question about your study materials (Press Enter to send)...'
              }
              disabled={loading}
              className="flex-1 bg-transparent border-0 text-sm text-white placeholder-[#666666] focus:outline-none resize-none p-1.5"
            />

            {/* Send Button */}
            <button
              onClick={() => handleSendMessage()}
              disabled={loading || !inputQuestion.trim()}
              className="p-2.5 rounded-lg bg-white hover:bg-neutral-200 disabled:bg-[#1F1F1F] text-black disabled:text-[#666666] transition shadow-sm active:scale-95 shrink-0"
              title="Send message"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin text-black" /> : <Send className="w-4 h-4 stroke-[2.5]" />}
            </button>
          </div>

          <div className="flex items-center justify-between text-[11px] text-[#666666] px-1 font-mono">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-white"></span>
              {selectedDocObj ? `Searching: ${selectedDocObj.filename}` : 'Searching all indexed documents'}
            </span>
            <span>🎙️ Voice input & 🔊 Text-to-Speech active • Shift + Enter for newline</span>
          </div>
        </div>
      </div>
    </div>
  );
}
