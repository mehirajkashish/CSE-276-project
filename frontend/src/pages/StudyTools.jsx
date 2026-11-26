import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import {
  FileText,
  BookOpen,
  HelpCircle,
  Layers,
  Sparkles,
  GitFork,
  PenTool,
  Code2,
  FileCheck2,
  GraduationCap,
  Copy,
  Check,
  Loader2,
  AlertCircle,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Shuffle,
  CheckCircle2,
  XCircle,
  Download,
  ArrowLeft,
  ArrowRight,
  Cpu,
  Eye,
  EyeOff,
  MessageSquare,
  Printer,
  FolderOpen,
  ExternalLink,
} from 'lucide-react';
import RichMarkdown from '../components/RichMarkdown';
import { studyApi, documentApi, chatApi } from '../services/api';

const TOOLKIT_CARDS = [
  {
    id: 'notes',
    title: 'AI Notes Generator',
    description: 'Generate structured lecture notes with analogies, KaTeX math, tables, and page citations.',
    icon: FileText,
    badge: 'Popular',
  },
  {
    id: 'summary',
    title: 'PDF Summarizer',
    description: 'Synthesize executive overviews, unit breakdowns, and high-yield exam takeaways.',
    icon: BookOpen,
    badge: 'Core',
  },
  {
    id: 'mcq',
    title: 'MCQ Generator',
    description: 'Practice interactive exam MCQs with scoring, instant feedback, and explanations.',
    icon: HelpCircle,
    badge: 'Exam Prep',
  },
  {
    id: 'flashcards',
    title: 'Flashcard Generator',
    description: 'Flip, shuffle, and track active-recall flashcards mapped directly to your PDF.',
    icon: Layers,
    badge: 'Recall',
  },
  {
    id: 'topics',
    title: 'Important Topics Finder',
    description: 'Pinpoint highest-probability exam topics ranked by weight with concise takeaways.',
    icon: Sparkles,
    badge: 'High-Yield',
  },
  {
    id: 'mindmap',
    title: 'Mind Map Generator',
    description: 'Explore interactive concept branches and inspect each subtopic note.',
    icon: GitFork,
    badge: 'Visual',
  },
  {
    id: 'practice',
    title: 'Practice Question Generator',
    description: 'Write answers to 5/8/12-mark subjective problems and check step-by-step rubrics.',
    icon: PenTool,
    badge: 'Practice',
  },
  {
    id: 'coding',
    title: 'Coding Tutor',
    description: 'Get clean implementations, dry-runs, edge cases, and LaTeX Big-O analysis.',
    icon: Code2,
    badge: 'CS & Math',
  },
  {
    id: 'revision',
    title: 'Chapter Revision Notes',
    description: 'Interactive last-minute revision sheet with recall-toggle definitions & questions.',
    icon: FileCheck2,
    badge: 'Quick Prep',
  },
  {
    id: 'paper',
    title: 'Question Paper Generator',
    description: 'Draft complete 60-mark Section A/B/C mock exam papers with toggleable answer hints.',
    icon: GraduationCap,
    badge: 'Full Mock',
  },
];

const CODING_SUGGESTIONS = [
  'Binary Search & Two Pointers',
  'Linked List Reversal & Cycle Detection',
  'QuickSort vs MergeSort',
  'BFS & DFS Graph Traversal',
  'Dynamic Programming: Knapsack',
];

function downloadMarkdown(filename, content) {
  if (!content) return;
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function StudyTools() {
  const { toolId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const initialDocId = searchParams.get('doc') || '';
  const activeToolMeta = useMemo(
    () => TOOLKIT_CARDS.find((t) => t.id === toolId) || null,
    [toolId]
  );

  /* ── Shared document, model & loading state ── */
  const [documents, setDocuments] = useState([]);
  const [docsLoaded, setDocsLoaded] = useState(false);
  const [selectedDocId, setSelectedDocId] = useState(initialDocId);
  const [availableModels, setAvailableModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [focusTopic, setFocusTopic] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [aiMeta, setAiMeta] = useState({ aiGenerated: null, modelUsed: null });
  const [copied, setCopied] = useState(false);

  /* ── Tool-specific interactive state ── */
  const [notesDepth, setNotesDepth] = useState('comprehensive');
  const [notesData, setNotesData] = useState(null);

  const [summaryStyle, setSummaryStyle] = useState('detailed');
  const [summaryData, setSummaryData] = useState(null);

  const [quizCount, setQuizCount] = useState(5);
  const [quizData, setQuizData] = useState([]);
  const [userAnswers, setUserAnswers] = useState({});
  const [revealAllQuiz, setRevealAllQuiz] = useState(false);

  const [flashcardCount, setFlashcardCount] = useState(6);
  const [flashcardsData, setFlashcardsData] = useState([]);
  const [currentCardIdx, setCurrentCardIdx] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [cardMastery, setCardMastery] = useState({}); // { idx: 'known' | 'review' }

  const [topicsData, setTopicsData] = useState([]);
  const [topicFilter, setTopicFilter] = useState('All');

  const [mindMapData, setMindMapData] = useState(null);
  const [collapsedBranches, setCollapsedBranches] = useState({});
  const [selectedNode, setSelectedNode] = useState(null);

  const [practiceData, setPracticeData] = useState([]);
  const [practiceDiffFilter, setPracticeDiffFilter] = useState('All');
  const [practiceDrafts, setPracticeDrafts] = useState({});
  const [practiceRevealed, setPracticeRevealed] = useState({});

  const [codingTopic, setCodingTopic] = useState('Binary Search & Two Pointers');
  const [codingLang, setCodingLang] = useState('python');
  const [codingResult, setCodingResult] = useState(null);

  const [revisionData, setRevisionData] = useState(null);
  const [revisionTab, setRevisionTab] = useState('points');
  const [hiddenDefs, setHiddenDefs] = useState(false);
  const [revealedDefIndices, setRevealedDefIndices] = useState({});

  const [paperData, setPaperData] = useState(null);
  const [showPaperHints, setShowPaperHints] = useState(false);

  /* ── Load documents & live configured AI models once ── */
  useEffect(() => {
    let active = true;
    (async () => {
      const [docs, modelsRes] = await Promise.all([
        documentApi.getDocuments().catch(() => []),
        chatApi.getModels().catch(() => null),
      ]);
      if (!active) return;
      const list = docs || [];
      setDocuments(list);
      setDocsLoaded(true);

      if (modelsRes?.configured && Array.isArray(modelsRes.models) && modelsRes.models.length > 0) {
        setAvailableModels(modelsRes.models);
        setSelectedModel(modelsRes.default_model || modelsRes.models[0].id);
      }

      if (!initialDocId && list.length > 0) {
        setSelectedDocId(list[0].id);
      }
    })();
    return () => { active = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (initialDocId && initialDocId !== selectedDocId) {
      setSelectedDocId(initialDocId);
    }
  }, [initialDocId]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Run the active tool against backend AI ── */
  const runTool = useCallback(async (override = {}) => {
    if (!toolId || !activeToolMeta) return;
    const docId = override.docId ?? selectedDocId;
    const model = override.model ?? (selectedModel || null);
    const focus = (override.focus ?? focusTopic).trim() || null;

    if (toolId !== 'coding' && !docId) {
      setError('Upload or select a PDF document first to run this tool.');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      let res = null;
      if (toolId === 'notes') {
        res = await studyApi.generateAiNotes({
          document_id: docId,
          depth: override.depth ?? notesDepth,
          focus,
          model,
        });
        setNotesData(res);
      } else if (toolId === 'summary') {
        res = await studyApi.generateSummary({
          document_id: docId,
          style: override.style ?? summaryStyle,
          focus,
          model,
        });
        setSummaryData(res);
      } else if (toolId === 'mcq') {
        res = await studyApi.generateQuiz({
          document_id: docId,
          count: override.count ?? quizCount,
          focus,
          model,
        });
        setQuizData(res.quiz || []);
        setUserAnswers({});
        setRevealAllQuiz(false);
      } else if (toolId === 'flashcards') {
        res = await studyApi.generateFlashcards({
          document_id: docId,
          count: override.count ?? flashcardCount,
          focus,
          model,
        });
        setFlashcardsData(res.flashcards || []);
        setCurrentCardIdx(0);
        setIsFlipped(false);
        setCardMastery({});
      } else if (toolId === 'topics') {
        res = await studyApi.generateImportantTopics({ document_id: docId, model });
        setTopicsData(res.topics || []);
        setTopicFilter('All');
      } else if (toolId === 'mindmap') {
        res = await studyApi.generateMindMap({ document_id: docId, model });
        setMindMapData(res);
        setCollapsedBranches({});
        setSelectedNode(null);
      } else if (toolId === 'practice') {
        res = await studyApi.generatePracticeQuestions({
          document_id: docId,
          count: 5,
          focus,
          model,
        });
        setPracticeData(res.practice_questions || []);
        setPracticeDrafts({});
        setPracticeRevealed({});
      } else if (toolId === 'coding') {
        res = await studyApi.codingTutor({
          topic: override.codingTopic ?? codingTopic,
          language: override.codingLang ?? codingLang,
          document_id: docId || null,
          model,
        });
        setCodingResult(res);
      } else if (toolId === 'revision') {
        res = await studyApi.generateRevisionNotes({ document_id: docId, focus, model });
        setRevisionData(res);
        setRevealedDefIndices({});
      } else if (toolId === 'paper') {
        res = await studyApi.generateQuestionPaper({ document_id: docId, focus, model });
        setPaperData(res.question_paper || null);
      }

      if (res) {
        setAiMeta({
          aiGenerated: res.ai_generated ?? null,
          modelUsed: res.model_used || null,
        });
      }
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Failed to synthesize study output.');
    } finally {
      setLoading(false);
    }
  }, [
    toolId, activeToolMeta, selectedDocId, selectedModel, focusTopic,
    notesDepth, summaryStyle, quizCount, flashcardCount, codingTopic, codingLang,
  ]);

  /* ── Auto-generate when opening a dedicated tool page once docs load ── */
  useEffect(() => {
    if (!toolId || !activeToolMeta || !docsLoaded) return;
    if (toolId === 'coding' || selectedDocId) {
      runTool();
    }
  }, [toolId, docsLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Keyboard shortcuts inside Flashcards tool ── */
  useEffect(() => {
    if (toolId !== 'flashcards' || flashcardsData.length === 0) return;
    const onKey = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target?.tagName)) return;
      if (e.code === 'Space') {
        e.preventDefault();
        setIsFlipped((f) => !f);
      } else if (e.key === 'ArrowRight') {
        setCurrentCardIdx((i) => Math.min(flashcardsData.length - 1, i + 1));
        setIsFlipped(false);
      } else if (e.key === 'ArrowLeft') {
        setCurrentCardIdx((i) => Math.max(0, i - 1));
        setIsFlipped(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toolId, flashcardsData.length]);

  const handleCopy = (text) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const openToolPage = (id) => {
    const base = window.location.pathname.includes('/workspace/') ? '/workspace/study-tools' : '/study-tools';
    const qs = selectedDocId ? `?doc=${encodeURIComponent(selectedDocId)}` : '';
    navigate(`${base}/${id}${qs}`);
  };

  const backToHub = () => {
    const base = window.location.pathname.includes('/workspace/') ? '/workspace/study-tools' : '/study-tools';
    const qs = selectedDocId ? `?doc=${encodeURIComponent(selectedDocId)}` : '';
    navigate(`${base}${qs}`);
  };

  const handleDocChange = (newDocId) => {
    setSelectedDocId(newDocId);
    if (toolId) {
      setSearchParams(newDocId ? { doc: newDocId } : {});
      if (newDocId || toolId === 'coding') {
        runTool({ docId: newDocId });
      }
    }
  };

  const selectedDocObj = documents.find((d) => d.id === selectedDocId);

  /* ═══════════════════════════════════════════════════════════════ */
  /* 1. TOOLKIT DIRECTORY HUB (/study-tools)                        */
  /* ═══════════════════════════════════════════════════════════════ */
  if (!toolId || !activeToolMeta) {
    return (
      <div className="max-w-6xl mx-auto space-y-6 pb-20 animate-fade-in-up">
        {/* Minimal Obsidian Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 sm:p-6 rounded-2xl bg-[#141414] border border-[#262626]">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                AI Study Toolkit
              </h1>
              <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-[#1A1A1A] text-[#9A9A9A] border border-[#262626]">
                10 Dedicated Tools
              </span>
            </div>
            <p className="text-xs text-[#9A9A9A]">
              Pick a study tool below to open its dedicated AI-powered workspace with math rendering and interactive practice.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <span className="text-xs text-[#9A9A9A] shrink-0">Document:</span>
            {documents.length > 0 ? (
              <select
                value={selectedDocId}
                onChange={(e) => setSelectedDocId(e.target.value)}
                className="bg-[#0D0D0D] border border-[#262626] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#3A3A3A] max-w-xs"
              >
                {documents.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.filename} ({d.total_pages || 1} pages)
                  </option>
                ))}
              </select>
            ) : (
              <button
                type="button"
                onClick={() => navigate('/documents')}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-white text-black hover:bg-neutral-200 transition"
              >
                <FolderOpen className="w-3.5 h-3.5" />
                Upload PDF
              </button>
            )}
          </div>
        </div>

        {/* 10 Minimal Tool Cards — Click Opens Dedicated Page */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
          {TOOLKIT_CARDS.map((tool) => {
            const Icon = tool.icon;
            return (
              <button
                key={tool.id}
                type="button"
                onClick={() => openToolPage(tool.id)}
                className="p-4 rounded-2xl text-left border border-[#262626] bg-[#141414] hover:bg-[#1A1A1A] hover:border-white/40 transition-all duration-150 flex flex-col justify-between space-y-4 group active:scale-[0.99]"
              >
                <div className="space-y-2.5 w-full">
                  <div className="flex items-center justify-between">
                    <div className="w-9 h-9 rounded-xl bg-[#0D0D0D] border border-[#262626] group-hover:border-[#3A3A3A] flex items-center justify-center text-white transition">
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#0D0D0D] text-[#9A9A9A] border border-[#222222]">
                      {tool.badge}
                    </span>
                  </div>

                  <h3 className="text-xs font-bold text-white">{tool.title}</h3>
                  <p className="text-[11px] text-[#9A9A9A] leading-relaxed line-clamp-2">
                    {tool.description}
                  </p>
                </div>

                <div className="pt-2.5 border-t border-[#222222] w-full flex items-center justify-between text-[11px] font-semibold text-[#9A9A9A] group-hover:text-white transition">
                  <span>Open Page</span>
                  <div className="flex items-center gap-1.5">
                    <span
                      role="button"
                      tabIndex={0}
                      title="Open in new browser tab"
                      onClick={(e) => {
                        e.stopPropagation();
                        const qs = selectedDocId ? `?doc=${encodeURIComponent(selectedDocId)}` : '';
                        const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');
                        window.open(`${base}/study-tools/${tool.id}${qs}`, '_blank', 'noopener,noreferrer');
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.stopPropagation();
                          const qs = selectedDocId ? `?doc=${encodeURIComponent(selectedDocId)}` : '';
                          const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');
                          window.open(`${base}/study-tools/${tool.id}${qs}`, '_blank', 'noopener,noreferrer');
                        }
                      }}
                      className="p-1 rounded-md hover:bg-[#262626] text-[#666666] hover:text-white transition"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════════════ */
  /* 2. DEDICATED STANDALONE TOOL PAGE (/study-tools/:toolId)       */
  /* ═══════════════════════════════════════════════════════════════ */
  const ActiveIcon = activeToolMeta.icon;

  // Derived interactive stats for MCQ & Flashcards
  const mcqAnsweredCount = Object.keys(userAnswers).length;
  const mcqScore = quizData.reduce(
    (acc, q, idx) => (userAnswers[idx] && userAnswers[idx] === q.correct_option_id ? acc + 1 : acc),
    0
  );
  const activeCard = flashcardsData[currentCardIdx] || null;
  const knownCount = Object.values(cardMastery).filter((v) => v === 'known').length;

  const filteredTopics = topicsData.filter((t) =>
    topicFilter === 'All' ? true : (t.importance || '').toLowerCase() === topicFilter.toLowerCase()
  );
  const filteredPractice = practiceData.filter((p) =>
    practiceDiffFilter === 'All' ? true : (p.difficulty || '').toLowerCase() === practiceDiffFilter.toLowerCase()
  );

  const buildRevisionMarkdown = () => {
    if (!revisionData?.title) return '';
    return [
      `# ${revisionData.title}`,
      '\n## High-Yield Memorization Points',
      ...(revisionData.high_yield_points || []).map((p) => `- ${p}`),
      '\n## Essential Definitions',
      ...(revisionData.important_definitions || []).map((d) => `- **${d.term}:** ${d.definition}`),
      '\n## Expected Exam Questions',
      ...(revisionData.potential_exam_questions || []).map((q, i) => `${i + 1}. ${q}`),
    ].join('\n');
  };

  return (
    <div className="max-w-5xl mx-auto space-y-5 pb-20 animate-fade-in-up">
      {/* ── Dedicated Tool Header ── */}
      <div className="rounded-2xl border border-[#262626] bg-[#141414] p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={backToHub}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#1A1A1A] hover:bg-[#242424] border border-[#262626] text-xs font-medium text-[#9A9A9A] hover:text-white transition shrink-0"
              title="Back to all 10 study tools"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>All Tools</span>
            </button>

            <div className="w-9 h-9 rounded-xl bg-white text-black flex items-center justify-center shrink-0">
              <ActiveIcon className="w-4 h-4 stroke-[2.3]" />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base sm:text-lg font-bold text-white truncate">
                  {activeToolMeta.title}
                </h1>
                {aiMeta.aiGenerated === true && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-400">
                    <Cpu className="w-2.5 h-2.5" />
                    {aiMeta.modelUsed || 'AI Grounded'}
                  </span>
                )}
                {aiMeta.aiGenerated === false && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/25 text-amber-300">
                    Local Fallback
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[#9A9A9A] truncate">
                {activeToolMeta.description}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => navigate(selectedDocId ? `/chat?doc=${selectedDocId}` : '/chat')}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#1A1A1A] hover:bg-[#242424] border border-[#262626] text-xs font-medium text-[#E5E5E5] hover:text-white transition"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Ask AI Tutor</span>
            </button>
            <button
              type="button"
              onClick={() => runTool()}
              disabled={loading || (toolId !== 'coding' && !selectedDocId)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white hover:bg-neutral-200 text-black text-xs font-semibold transition disabled:opacity-40 active:scale-95"
            >
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 stroke-[2.3]" />}
              <span>{loading ? 'Generating…' : 'Regenerate'}</span>
            </button>
          </div>
        </div>

        {/* ── Controls Row: Document, Model & Optional Topic Focus ── */}
        <div className="pt-3 border-t border-[#222222] grid grid-cols-1 md:grid-cols-12 gap-2.5">
          <div className="md:col-span-4">
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#666666] mb-1">
              Target Document
            </label>
            <select
              value={selectedDocId}
              onChange={(e) => handleDocChange(e.target.value)}
              className="w-full bg-[#0D0D0D] border border-[#262626] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#3A3A3A]"
            >
              {toolId === 'coding' && <option value="">General CS (No PDF filter)</option>}
              {documents.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.filename} ({d.total_pages || 1} pages)
                </option>
              ))}
            </select>
          </div>

          {availableModels.length > 0 && (
            <div className="md:col-span-3">
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#666666] mb-1">
                AI Model
              </label>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="w-full bg-[#0D0D0D] border border-[#262626] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#3A3A3A]"
              >
                {availableModels.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label} ({m.badge})
                  </option>
                ))}
              </select>
            </div>
          )}

          {toolId !== 'topics' && toolId !== 'mindmap' && toolId !== 'coding' && (
            <div className={availableModels.length > 0 ? 'md:col-span-5' : 'md:col-span-8'}>
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#666666] mb-1">
                Focus Topic / Chapter (Optional)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={focusTopic}
                  onChange={(e) => setFocusTopic(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') runTool(); }}
                  placeholder="e.g. Linked Lists, Unit 2, Time Complexity…"
                  className="flex-1 bg-[#0D0D0D] border border-[#262626] rounded-xl px-3 py-2 text-xs text-white placeholder-[#666666] focus:outline-none focus:border-[#3A3A3A]"
                />
                {focusTopic && (
                  <button
                    type="button"
                    onClick={() => runTool()}
                    disabled={loading}
                    className="px-3 py-2 rounded-xl bg-[#1F1F1F] hover:bg-[#2A2A2A] border border-[#2E2E2E] text-xs font-medium text-white transition"
                  >
                    Apply
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-300 text-xs flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ── Dedicated Tool Workspace ── */}
      <div className="rounded-2xl border border-[#262626] bg-[#141414] p-5 sm:p-7 space-y-5">
        {loading ? (
          <div className="py-24 flex flex-col items-center gap-3 text-center">
            <div className="w-10 h-10 rounded-xl bg-[#1A1A1A] border border-[#262626] flex items-center justify-center">
              <Loader2 className="w-4 h-4 animate-spin text-white" />
            </div>
            <p className="text-xs font-medium text-white">Synthesizing with AI…</p>
            <p className="text-[11px] text-[#666666]">
              Reading {selectedDocObj?.filename || 'your request'} and formatting equations, code & citations
            </p>
          </div>
        ) : (
          <>
            {/* 1. AI NOTES GENERATOR */}
            {toolId === 'notes' && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#222222]">
                  <div className="inline-flex items-center p-0.5 rounded-lg bg-[#0D0D0D] border border-[#222222]">
                    {['brief', 'comprehensive', 'deep exam'].map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => { setNotesDepth(d); runTool({ depth: d }); }}
                        className={`px-3 py-1 rounded-md text-[11px] font-medium capitalize transition ${
                          notesDepth === d ? 'bg-white text-black font-semibold' : 'text-[#9A9A9A] hover:text-white'
                        }`}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleCopy(notesData?.notes)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1A1A1A] border border-[#262626] text-xs text-[#E5E5E5] hover:text-white transition"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copied ? 'Copied' : 'Copy'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => downloadMarkdown(`${selectedDocObj?.filename || 'notes'}-study-notes.md`, notesData?.notes)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1A1A1A] border border-[#262626] text-xs text-[#E5E5E5] hover:text-white transition"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download .md</span>
                    </button>
                  </div>
                </div>
                <div className="rounded-xl border border-[#222222] bg-[#0D0D0D] p-5 sm:p-6">
                  <RichMarkdown content={notesData?.notes || 'Select a document and click **Regenerate** to build structured lecture notes.'} />
                </div>
              </div>
            )}

            {/* 2. PDF SUMMARIZER */}
            {toolId === 'summary' && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#222222]">
                  <div className="inline-flex items-center p-0.5 rounded-lg bg-[#0D0D0D] border border-[#222222]">
                    {['brief', 'detailed', 'bulleted'].map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => { setSummaryStyle(st); runTool({ style: st }); }}
                        className={`px-3 py-1 rounded-md text-[11px] font-medium capitalize transition ${
                          summaryStyle === st ? 'bg-white text-black font-semibold' : 'text-[#9A9A9A] hover:text-white'
                        }`}
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleCopy(summaryData?.summary)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1A1A1A] border border-[#262626] text-xs text-[#E5E5E5] hover:text-white transition"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copied ? 'Copied' : 'Copy'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => downloadMarkdown(`${selectedDocObj?.filename || 'document'}-summary.md`, summaryData?.summary)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1A1A1A] border border-[#262626] text-xs text-[#E5E5E5] hover:text-white transition"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download .md</span>
                    </button>
                  </div>
                </div>
                <div className="rounded-xl border border-[#222222] bg-[#0D0D0D] p-5 sm:p-6">
                  <RichMarkdown content={summaryData?.summary || 'Select a document and click **Regenerate** to summarize it.'} />
                </div>
              </div>
            )}

            {/* 3. MCQ GENERATOR */}
            {toolId === 'mcq' && (
              <div className="space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-[#0D0D0D] border border-[#222222]">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-xs font-semibold text-white">
                      Score: <span className="font-mono">{mcqScore} / {quizData.length}</span>
                    </span>
                    <span className="text-[11px] text-[#9A9A9A]">
                      Answered: {mcqAnsweredCount}/{quizData.length}
                    </span>
                    <div className="inline-flex items-center p-0.5 rounded-lg bg-[#141414] border border-[#262626]">
                      {[5, 8, 10].map((cnt) => (
                        <button
                          key={cnt}
                          type="button"
                          onClick={() => { setQuizCount(cnt); runTool({ count: cnt }); }}
                          className={`px-2.5 py-0.5 rounded-md text-[11px] font-mono transition ${
                            quizCount === cnt ? 'bg-white text-black font-semibold' : 'text-[#9A9A9A] hover:text-white'
                          }`}
                        >
                          {cnt} Qs
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setRevealAllQuiz((v) => !v)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1A1A1A] border border-[#262626] text-xs text-[#E5E5E5] hover:text-white transition"
                    >
                      {revealAllQuiz ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      <span>{revealAllQuiz ? 'Hide Answers' : 'Reveal Answers'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => { setUserAnswers({}); setRevealAllQuiz(false); }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1A1A1A] border border-[#262626] text-xs text-[#E5E5E5] hover:text-white transition"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Reset</span>
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  {quizData.map((q, idx) => {
                    const picked = userAnswers[idx];
                    const showOutcome = Boolean(picked) || revealAllQuiz;
                    return (
                      <div key={idx} className="p-4 sm:p-5 rounded-xl border border-[#262626] bg-[#0D0D0D] space-y-3">
                        <div className="flex items-center justify-between text-[11px] text-[#9A9A9A]">
                          <span className="font-mono font-semibold text-white">Question {idx + 1}</span>
                          <span className="font-mono">Page {q.page_number || 1}</span>
                        </div>
                        <div className="text-sm font-medium text-white">
                          <RichMarkdown content={q.question} />
                        </div>
                        <div className="space-y-2">
                          {q.options?.map((opt) => {
                            const isSelected = picked === opt.id;
                            const isCorrect = opt.id === q.correct_option_id;
                            let cls = 'bg-[#141414] border-[#262626] text-[#E5E5E5] hover:border-[#3A3A3A]';
                            if (showOutcome) {
                              if (isCorrect) cls = 'bg-emerald-500/15 border-emerald-500/50 text-emerald-200';
                              else if (isSelected) cls = 'bg-rose-500/15 border-rose-500/50 text-rose-200';
                            }
                            return (
                              <button
                                key={opt.id}
                                type="button"
                                onClick={() => setUserAnswers((prev) => ({ ...prev, [idx]: opt.id }))}
                                className={`w-full p-3 rounded-xl border text-left text-xs transition flex items-center justify-between gap-2 ${cls}`}
                              >
                                <span className="flex items-start gap-2">
                                  <strong className="font-mono shrink-0">{opt.id}.</strong>
                                  <span><RichMarkdown content={opt.text} className="inline [&>p]:m-0" /></span>
                                </span>
                                {showOutcome && isCorrect && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
                                {showOutcome && isSelected && !isCorrect && <XCircle className="w-4 h-4 text-rose-400 shrink-0" />}
                              </button>
                            );
                          })}
                        </div>
                        {showOutcome && q.explanation && (
                          <div className="pt-2.5 border-t border-[#222222] text-xs text-[#9A9A9A]">
                            <strong className="text-white">Explanation:</strong>{' '}
                            <RichMarkdown content={q.explanation} className="[&>p]:inline" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 4. FLASHCARD GENERATOR */}
            {toolId === 'flashcards' && (
              <div className="max-w-2xl mx-auto space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-[#9A9A9A]">
                      Mastered: <strong className="text-white font-mono">{knownCount} / {flashcardsData.length}</strong>
                    </span>
                    <div className="inline-flex items-center p-0.5 rounded-lg bg-[#0D0D0D] border border-[#222222]">
                      {[6, 10, 12].map((cnt) => (
                        <button
                          key={cnt}
                          type="button"
                          onClick={() => { setFlashcardCount(cnt); runTool({ count: cnt }); }}
                          className={`px-2 py-0.5 rounded-md text-[11px] font-mono transition ${
                            flashcardCount === cnt ? 'bg-white text-black font-semibold' : 'text-[#9A9A9A] hover:text-white'
                          }`}
                        >
                          {cnt}
                        </button>
                      ))}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const shuffled = [...flashcardsData].sort(() => Math.random() - 0.5);
                      setFlashcardsData(shuffled);
                      setCurrentCardIdx(0);
                      setIsFlipped(false);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1A1A1A] border border-[#262626] text-xs text-[#E5E5E5] hover:text-white transition"
                  >
                    <Shuffle className="w-3.5 h-3.5" />
                    <span>Shuffle</span>
                  </button>
                </div>

                {activeCard ? (
                  <>
                    <div
                      onClick={() => setIsFlipped((f) => !f)}
                      className="min-h-[19rem] rounded-2xl border border-[#2E2E2E] bg-[#0D0D0D] hover:border-white/35 p-6 sm:p-8 flex flex-col justify-between cursor-pointer select-none transition"
                    >
                      <div className="flex items-center justify-between text-xs text-[#9A9A9A]">
                        <span className="px-2.5 py-0.5 rounded-full bg-[#1A1A1A] text-white border border-[#262626] font-medium text-[10px]">
                          {activeCard.key_concept || 'Concept'}
                        </span>
                        <span className="font-mono">
                          {currentCardIdx + 1} / {flashcardsData.length}
                        </span>
                      </div>

                      <div className="py-6 text-center">
                        <span className="text-[10px] font-semibold uppercase tracking-widest text-[#666666] block mb-3">
                          {isFlipped ? 'Answer (Click or Space to flip)' : 'Question (Click or Space to reveal)'}
                        </span>
                        <div className="text-base sm:text-lg font-semibold text-white leading-relaxed">
                          <RichMarkdown content={isFlipped ? activeCard.answer : activeCard.question} />
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-xs text-[#9A9A9A] pt-3 border-t border-[#222222]">
                        <span className="font-mono">Page {activeCard.page_number || 1}</span>
                        <span className="inline-flex items-center gap-1 text-[11px] text-white">
                          <RotateCcw className="w-3 h-3" /> Flip Card
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => { setCurrentCardIdx((i) => Math.max(0, i - 1)); setIsFlipped(false); }}
                          disabled={currentCardIdx === 0}
                          className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-[#1A1A1A] border border-[#262626] text-xs text-white disabled:opacity-40"
                        >
                          <ChevronLeft className="w-3.5 h-3.5" /> Prev
                        </button>
                        <button
                          type="button"
                          onClick={() => { setCurrentCardIdx((i) => Math.min(flashcardsData.length - 1, i + 1)); setIsFlipped(false); }}
                          disabled={currentCardIdx >= flashcardsData.length - 1}
                          className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-[#1A1A1A] border border-[#262626] text-xs text-white disabled:opacity-40"
                        >
                          Next <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setCardMastery((m) => ({ ...m, [currentCardIdx]: 'review' }));
                            if (currentCardIdx < flashcardsData.length - 1) {
                              setCurrentCardIdx((i) => i + 1);
                              setIsFlipped(false);
                            }
                          }}
                          className={`px-3 py-2 rounded-xl border text-xs font-medium transition ${
                            cardMastery[currentCardIdx] === 'review'
                              ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                              : 'bg-[#1A1A1A] border-[#262626] text-[#9A9A9A] hover:text-white'
                          }`}
                        >
                          Needs Review
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setCardMastery((m) => ({ ...m, [currentCardIdx]: 'known' }));
                            if (currentCardIdx < flashcardsData.length - 1) {
                              setCurrentCardIdx((i) => i + 1);
                              setIsFlipped(false);
                            }
                          }}
                          className={`px-3 py-2 rounded-xl border text-xs font-semibold transition ${
                            cardMastery[currentCardIdx] === 'known'
                              ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                              : 'bg-white text-black border-white hover:bg-neutral-200'
                          }`}
                        >
                          Got It
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-[#9A9A9A] text-center py-8">No flashcards generated yet.</p>
                )}
              </div>
            )}

            {/* 5. IMPORTANT TOPICS FINDER */}
            {toolId === 'topics' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="inline-flex items-center p-0.5 rounded-lg bg-[#0D0D0D] border border-[#222222]">
                    {['All', 'High', 'Medium'].map((lvl) => (
                      <button
                        key={lvl}
                        type="button"
                        onClick={() => setTopicFilter(lvl)}
                        className={`px-3 py-1 rounded-md text-[11px] font-medium transition ${
                          topicFilter === lvl ? 'bg-white text-black font-semibold' : 'text-[#9A9A9A] hover:text-white'
                        }`}
                      >
                        {lvl}
                      </button>
                    ))}
                  </div>
                  <span className="text-xs text-[#9A9A9A] font-mono">{filteredTopics.length} topics</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {filteredTopics.map((t, idx) => (
                    <div key={idx} className="p-4 rounded-xl border border-[#262626] bg-[#0D0D0D] flex flex-col justify-between gap-3">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className={`px-2 py-0.5 rounded-full font-semibold border ${
                            t.importance === 'High'
                              ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                              : 'bg-[#1A1A1A] text-[#E5E5E5] border-[#262626]'
                          }`}>
                            {t.importance} Priority
                          </span>
                          <span className="text-[#9A9A9A] font-mono">Page {t.page_number}</span>
                        </div>
                        <h4 className="text-sm font-bold text-white">{t.title}</h4>
                        <div className="text-xs text-[#9A9A9A]">
                          <RichMarkdown content={t.summary} />
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => navigate(`/viewer?doc=${selectedDocId}&page=${t.page_number || 1}`)}
                        className="text-left text-[11px] font-medium text-white hover:underline pt-2 border-t border-[#222222]"
                      >
                        Jump to Page {t.page_number || 1} in Reader →
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 6. MIND MAP GENERATOR */}
            {toolId === 'mindmap' && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="inline-block px-4 py-2 rounded-xl bg-white text-black font-bold text-xs sm:text-sm">
                    {mindMapData?.root_topic || selectedDocObj?.filename || 'Curriculum Subject'}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setCollapsedBranches({})}
                      className="px-3 py-1.5 rounded-lg bg-[#1A1A1A] border border-[#262626] text-[11px] text-[#E5E5E5] hover:text-white"
                    >
                      Expand All
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const all = {};
                        (mindMapData?.mind_map?.children || []).forEach((b, i) => { all[b.id || i] = true; });
                        setCollapsedBranches(all);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-[#1A1A1A] border border-[#262626] text-[11px] text-[#E5E5E5] hover:text-white"
                    >
                      Collapse All
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {(mindMapData?.mind_map?.children || []).map((branch, bIdx) => {
                    const key = branch.id || bIdx;
                    const isCollapsed = Boolean(collapsedBranches[key]);
                    return (
                      <div key={key} className="p-4 rounded-xl border border-[#262626] bg-[#0D0D0D] space-y-2.5">
                        <button
                          type="button"
                          onClick={() => setCollapsedBranches((prev) => ({ ...prev, [key]: !prev[key] }))}
                          className="w-full flex items-center justify-between text-left pb-2 border-b border-[#222222]"
                        >
                          <span className="text-xs font-bold text-white">{branch.name}</span>
                          <ChevronDown className={`w-3.5 h-3.5 text-[#9A9A9A] transition-transform ${isCollapsed ? '-rotate-90' : ''}`} />
                        </button>
                        {!isCollapsed && (
                          <div className="space-y-1.5">
                            {branch.children?.map((sub, sIdx) => {
                              const isPicked = selectedNode?.name === sub.name;
                              return (
                                <button
                                  key={sub.id || sIdx}
                                  type="button"
                                  onClick={() => setSelectedNode(sub)}
                                  className={`w-full text-left px-2.5 py-2 rounded-lg text-xs transition border ${
                                    isPicked
                                      ? 'bg-[#242424] border-white/40 text-white'
                                      : 'bg-[#141414] border-[#222222] text-[#D4D4D4] hover:border-[#3A3A3A] hover:text-white'
                                  }`}
                                >
                                  <div className="font-medium">{sub.name}</div>
                                  {sub.note && <div className="text-[11px] text-[#9A9A9A] mt-0.5 line-clamp-2">{sub.note}</div>}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {selectedNode && (
                  <div className="p-4 rounded-xl border border-[#3A3A3A] bg-[#0D0D0D] flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in-up">
                    <div className="space-y-1">
                      <div className="text-xs font-bold text-white">{selectedNode.name}</div>
                      {selectedNode.note && <p className="text-xs text-[#9A9A9A]">{selectedNode.note}</p>}
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate(selectedDocId ? `/chat?doc=${selectedDocId}` : '/chat')}
                      className="px-3 py-1.5 rounded-lg bg-white text-black text-xs font-semibold hover:bg-neutral-200 shrink-0"
                    >
                      Explore in AI Tutor →
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* 7. PRACTICE QUESTION GENERATOR */}
            {toolId === 'practice' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="inline-flex items-center p-0.5 rounded-lg bg-[#0D0D0D] border border-[#222222]">
                    {['All', 'Easy', 'Medium', 'Hard'].map((diff) => (
                      <button
                        key={diff}
                        type="button"
                        onClick={() => setPracticeDiffFilter(diff)}
                        className={`px-3 py-1 rounded-md text-[11px] font-medium transition ${
                          practiceDiffFilter === diff ? 'bg-white text-black font-semibold' : 'text-[#9A9A9A] hover:text-white'
                        }`}
                      >
                        {diff}
                      </button>
                    ))}
                  </div>
                  <span className="text-xs text-[#9A9A9A] font-mono">{filteredPractice.length} problems</span>
                </div>

                {filteredPractice.map((p, idx) => {
                  const revealed = Boolean(practiceRevealed[idx]);
                  return (
                    <div key={idx} className="p-4 sm:p-5 rounded-xl border border-[#262626] bg-[#0D0D0D] space-y-3">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-semibold text-white">{p.type} · <span className="text-[#9A9A9A]">{p.difficulty}</span></span>
                        <span className="text-[#9A9A9A] font-mono">Page {p.page || 1}</span>
                      </div>
                      <div className="text-sm font-semibold text-white">
                        <RichMarkdown content={p.question} />
                      </div>
                      <textarea
                        rows={3}
                        value={practiceDrafts[idx] || ''}
                        onChange={(e) => setPracticeDrafts((d) => ({ ...d, [idx]: e.target.value }))}
                        placeholder="Write your practice answer here before checking the rubric…"
                        className="w-full rounded-xl bg-[#141414] border border-[#262626] p-3 text-xs text-white placeholder-[#666666] focus:outline-none focus:border-[#3A3A3A]"
                      />
                      <div className="flex items-center justify-end">
                        <button
                          type="button"
                          onClick={() => setPracticeRevealed((r) => ({ ...r, [idx]: !r[idx] }))}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1A1A1A] border border-[#262626] text-xs font-medium text-white hover:bg-[#242424] transition"
                        >
                          {revealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          <span>{revealed ? 'Hide Model Solution' : 'Check Model Solution'}</span>
                        </button>
                      </div>
                      {revealed && (
                        <div className="p-4 rounded-xl bg-[#141414] border border-emerald-500/30 animate-fade-in-up">
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-400 block mb-1.5">
                            Model Solution & Rubric
                          </span>
                          <RichMarkdown content={p.solution} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* 8. CODING TUTOR */}
            {toolId === 'coding' && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  {CODING_SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => { setCodingTopic(s); runTool({ codingTopic: s }); }}
                      className="px-2.5 py-1 rounded-lg bg-[#0D0D0D] border border-[#262626] text-[11px] text-[#9A9A9A] hover:text-white hover:border-[#3A3A3A] transition"
                    >
                      {s}
                    </button>
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-2.5 p-3 rounded-xl bg-[#0D0D0D] border border-[#262626]">
                  <input
                    type="text"
                    value={codingTopic}
                    onChange={(e) => setCodingTopic(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') runTool(); }}
                    placeholder="Enter algorithm, data structure, or problem…"
                    className="flex-1 min-w-[200px] bg-[#141414] border border-[#262626] rounded-lg px-3 py-2 text-xs text-white placeholder-[#666666] focus:outline-none focus:border-[#3A3A3A]"
                  />
                  <select
                    value={codingLang}
                    onChange={(e) => setCodingLang(e.target.value)}
                    className="bg-[#141414] border border-[#262626] rounded-lg px-3 py-2 text-xs text-white"
                  >
                    <option value="python">Python</option>
                    <option value="cpp">C++</option>
                    <option value="java">Java</option>
                    <option value="javascript">JavaScript</option>
                    <option value="sql">SQL</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => runTool()}
                    disabled={loading || !codingTopic.trim()}
                    className="px-4 py-2 rounded-lg bg-white hover:bg-neutral-200 text-black text-xs font-semibold transition disabled:opacity-40"
                  >
                    Solve & Explain
                  </button>
                </div>

                <div className="rounded-xl border border-[#222222] bg-[#0D0D0D] p-5 sm:p-6">
                  <RichMarkdown content={codingResult?.content || `Enter an algorithm or topic above and click **Solve & Explain**.`} />
                </div>
              </div>
            )}

            {/* 9. REVISION NOTES */}
            {toolId === 'revision' && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#222222]">
                  <div className="inline-flex items-center p-0.5 rounded-lg bg-[#0D0D0D] border border-[#222222]">
                    {[
                      { id: 'points', label: 'Key Points' },
                      { id: 'defs', label: 'Definitions' },
                      { id: 'questions', label: 'Exam Questions' },
                    ].map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setRevisionTab(t.id)}
                        className={`px-3 py-1 rounded-md text-[11px] font-medium transition ${
                          revisionTab === t.id ? 'bg-white text-black font-semibold' : 'text-[#9A9A9A] hover:text-white'
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    {revisionTab === 'defs' && (
                      <button
                        type="button"
                        onClick={() => { setHiddenDefs((h) => !h); setRevealedDefIndices({}); }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1A1A1A] border border-[#262626] text-xs text-white transition"
                      >
                        {hiddenDefs ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                        <span>{hiddenDefs ? 'Show All' : 'Self-Test Blur'}</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleCopy(buildRevisionMarkdown())}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1A1A1A] border border-[#262626] text-xs text-[#E5E5E5] hover:text-white"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copied ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                </div>

                {revisionData?.title && (
                  <h3 className="text-sm font-bold text-white">{revisionData.title}</h3>
                )}

                {revisionTab === 'points' && (
                  <div className="space-y-2">
                    {(revisionData?.high_yield_points || []).map((pt, i) => (
                      <div key={i} className="p-3.5 rounded-xl bg-[#0D0D0D] border border-[#222222] text-xs text-[#E5E5E5] flex items-start gap-2.5">
                        <span className="font-mono text-[#666666] mt-0.5">{i + 1}.</span>
                        <div className="flex-1"><RichMarkdown content={pt} className="[&>p]:m-0" /></div>
                      </div>
                    ))}
                  </div>
                )}

                {revisionTab === 'defs' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {(revisionData?.important_definitions || []).map((d, i) => {
                      const isBlurred = hiddenDefs && !revealedDefIndices[i];
                      return (
                        <div
                          key={i}
                          onClick={() => isBlurred && setRevealedDefIndices((r) => ({ ...r, [i]: true }))}
                          className={`p-4 rounded-xl bg-[#0D0D0D] border border-[#262626] space-y-1.5 ${isBlurred ? 'cursor-pointer hover:border-white/30' : ''}`}
                        >
                          <div className="text-xs font-bold text-white">{d.term}</div>
                          <div className={`text-xs text-[#9A9A9A] transition ${isBlurred ? 'blur-sm select-none' : ''}`}>
                            <RichMarkdown content={d.definition} className="[&>p]:m-0" />
                          </div>
                          {isBlurred && <span className="text-[10px] text-white/70 block">Click to reveal</span>}
                        </div>
                      );
                    })}
                  </div>
                )}

                {revisionTab === 'questions' && (
                  <div className="space-y-2">
                    {(revisionData?.potential_exam_questions || []).map((q, i) => (
                      <div key={i} className="p-3.5 rounded-xl bg-[#0D0D0D] border border-[#222222] text-xs text-white flex items-start gap-2.5">
                        <span className="font-mono text-[#9A9A9A] shrink-0">Q{i + 1}.</span>
                        <div className="flex-1"><RichMarkdown content={q} className="[&>p]:m-0" /></div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 10. QUESTION PAPER GENERATOR */}
            {toolId === 'paper' && (
              <div className="space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#222222]">
                  <button
                    type="button"
                    onClick={() => setShowPaperHints((v) => !v)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1A1A1A] border border-[#262626] text-xs text-white hover:bg-[#242424] transition"
                  >
                    {showPaperHints ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    <span>{showPaperHints ? 'Hide Answer Hints' : 'Show Answer Hints'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1A1A1A] border border-[#262626] text-xs text-[#E5E5E5] hover:text-white transition"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print Paper</span>
                  </button>
                </div>

                {paperData ? (
                  <>
                    <div className="text-center space-y-1 p-4 rounded-xl bg-[#0D0D0D] border border-[#262626]">
                      <h3 className="text-base font-bold text-white">{paperData.title}</h3>
                      <p className="text-xs text-[#9A9A9A] font-mono">
                        Time: {paperData.time_allowed || '2 Hours'} · Total Marks: {paperData.total_marks || 60}
                      </p>
                    </div>
                    {(paperData.sections || []).map((sec, sIdx) => (
                      <div key={sIdx} className="p-4 sm:p-5 rounded-xl border border-[#262626] bg-[#0D0D0D] space-y-3">
                        <div className="border-b border-[#222222] pb-2">
                          <h4 className="text-sm font-bold text-white">{sec.section}</h4>
                          <p className="text-[11px] text-[#9A9A9A] italic">{sec.instructions}</p>
                        </div>
                        <div className="space-y-3 text-xs text-[#E5E5E5]">
                          {sec.questions?.map((q, qIdx) => (
                            <div key={qIdx} className="space-y-1.5">
                              <RichMarkdown content={q} className="[&>p]:m-0" />
                              {showPaperHints && sec.answer_hints?.[qIdx] && (
                                <div className="pl-3 border-l-2 border-emerald-500/40 text-[11px] text-emerald-300">
                                  <RichMarkdown content={sec.answer_hints[qIdx]} className="[&>p]:m-0" />
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </>
                ) : (
                  <p className="text-xs text-[#9A9A9A] text-center py-8">Select a document and click **Regenerate** to draft a mock exam paper.</p>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
