import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
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
  Download,
  Copy,
  Check,
  Loader2,
  AlertCircle,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Shuffle,
  CheckCircle2,
  XCircle,
  Lightbulb,
  ExternalLink,
  Tag,
  ArrowRight
} from 'lucide-react';
import { studyApi, documentApi } from '../services/api';
import {
  DEMO_FLASHCARDS,
  DEMO_QUIZ,
  DEMO_SUMMARY,
  DEMO_MIND_MAP,
  DEMO_PRACTICE_QUESTIONS,
  DEMO_CODING_TUTOR,
  DEMO_QUESTION_PAPER
} from '../services/demoData';

const TOOLKIT_CARDS = [
  {
    id: 'notes',
    title: 'AI Notes Generator',
    description: 'Transform raw slide decks into comprehensive, structured masterclass lecture notes.',
    icon: FileText,
    badge: 'Popular',
    color: 'from-blue-600 to-indigo-600',
    borderColor: 'hover:border-blue-500/50',
  },
  {
    id: 'summary',
    title: 'PDF Summarizer',
    description: 'Extract executive overviews, taxonomies, and high-yield takeaways page-by-page.',
    icon: BookOpen,
    badge: 'Core',
    color: 'from-emerald-600 to-teal-600',
    borderColor: 'hover:border-emerald-500/50',
  },
  {
    id: 'mcq',
    title: 'MCQ Generator',
    description: 'Generate multiple-choice exam questions with realistic academic distractors.',
    icon: HelpCircle,
    badge: 'Exam Prep',
    color: 'from-violet-600 to-purple-600',
    borderColor: 'hover:border-violet-500/50',
  },
  {
    id: 'flashcards',
    title: 'Flashcard Generator',
    description: 'Create active recall flashcard decks with citations for spaced repetition.',
    icon: Layers,
    badge: 'Recall',
    color: 'from-amber-600 to-orange-600',
    borderColor: 'hover:border-amber-500/50',
  },
  {
    id: 'topics',
    title: 'Important Topics Finder',
    description: 'Pinpoint highest-probability curriculum topics likely to appear on examinations.',
    icon: Sparkles,
    badge: 'High-Yield',
    color: 'from-fuchsia-600 to-pink-600',
    borderColor: 'hover:border-fuchsia-500/50',
  },
  {
    id: 'mindmap',
    title: 'Mind Map Generator',
    description: 'Visualize hierarchical relationships and concept trees across all chapters.',
    icon: GitFork,
    badge: 'Visual',
    color: 'from-cyan-600 to-blue-600',
    borderColor: 'hover:border-cyan-500/50',
  },
  {
    id: 'practice',
    title: 'Practice Question Generator',
    description: 'Generate subjective 5-mark and 10-mark conceptual questions with model solutions.',
    icon: PenTool,
    badge: 'Practice',
    color: 'from-rose-600 to-red-600',
    borderColor: 'hover:border-rose-500/50',
  },
  {
    id: 'coding',
    title: 'Coding Tutor',
    description: 'Break down algorithms, data structures, and code implementations with complexity analysis.',
    icon: Code2,
    badge: 'CS & Math',
    color: 'from-indigo-600 to-blue-600',
    borderColor: 'hover:border-indigo-500/50',
  },
  {
    id: 'revision',
    title: 'Chapter-wise Revision Notes',
    description: 'Generate concise exam-eve revision sheets packed with essential definitions and formulas.',
    icon: FileCheck2,
    badge: 'Quick Prep',
    color: 'from-teal-600 to-emerald-600',
    borderColor: 'hover:border-teal-500/50',
  },
  {
    id: 'paper',
    title: 'Question Paper Generator',
    description: 'Draft complete 60-mark mock examination papers with Section A, B, and C rubrics.',
    icon: GraduationCap,
    badge: 'Full Mock',
    color: 'from-blue-700 to-indigo-800',
    borderColor: 'hover:border-blue-500/50',
  },
];

export default function StudyTools() {
  const [searchParams] = useSearchParams();
  const initialDocId = searchParams.get('doc');
  const workspaceRef = useRef(null);

  const [documents, setDocuments] = useState([]);
  const [selectedDocId, setSelectedDocId] = useState(initialDocId || '');
  const [activeTool, setActiveTool] = useState('notes');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Tool outputs state
  const [notesData, setNotesData] = useState(null);
  const [summaryData, setSummaryData] = useState(null);
  const [quizData, setQuizData] = useState([]);
  const [userAnswers, setUserAnswers] = useState({});
  const [score, setScore] = useState(0);

  const [flashcardsData, setFlashcardsData] = useState([]);
  const [currentCardIdx, setCurrentCardIdx] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  const [topicsData, setTopicsData] = useState([]);
  const [mindMapData, setMindMapData] = useState(null);
  const [practiceData, setPracticeData] = useState([]);

  const [codingTopic, setCodingTopic] = useState('Binary Search & Two Pointers');
  const [codingLang, setCodingLang] = useState('python');
  const [codingResult, setCodingResult] = useState(null);

  const [revisionData, setRevisionData] = useState(null);
  const [paperData, setPaperData] = useState(null);

  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadDocs();
  }, []);

  useEffect(() => {
    if (initialDocId) {
      setSelectedDocId(initialDocId);
      handleLaunchTool(activeTool, initialDocId);
    }
  }, [initialDocId]);

  const loadDocs = async () => {
    try {
      const docs = await documentApi.getDocuments();
      setDocuments(docs || []);
      const defaultId = initialDocId || (docs && docs.length > 0 ? docs[0].id : '');
      if (defaultId) {
        setSelectedDocId(defaultId);
        // Automatically synthesize initial tool output
        handleLaunchTool('notes', defaultId);
      }
    } catch (e) {
      console.warn('Could not load documents:', e);
      handleLaunchTool('notes', '');
    }
  };

  const handleLaunchTool = async (toolId, overrideDocId = null) => {
    setActiveTool(toolId);
    setError(null);
    setLoading(true);

    const docId = overrideDocId || selectedDocId || (documents.length > 0 ? documents[0].id : '');

    // Scroll workspace into view smoothly
    setTimeout(() => {
      workspaceRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 50);

    try {
      if (toolId === 'notes') {
        const res = await studyApi.generateAiNotes({ document_id: docId });
        setNotesData(res);
      } else if (toolId === 'summary') {
        const res = await studyApi.generateSummary({ document_id: docId });
        setSummaryData(res);
      } else if (toolId === 'mcq') {
        const res = await studyApi.generateQuiz({ document_id: docId, count: 5 });
        setQuizData(res.quiz || DEMO_QUIZ);
        setUserAnswers({});
        setScore(0);
      } else if (toolId === 'flashcards') {
        const res = await studyApi.generateFlashcards({ document_id: docId, count: 6 });
        setFlashcardsData(res.flashcards || DEMO_FLASHCARDS);
        setCurrentCardIdx(0);
        setIsFlipped(false);
      } else if (toolId === 'topics') {
        const res = await studyApi.generateImportantTopics({ document_id: docId });
        setTopicsData(res.topics || []);
      } else if (toolId === 'mindmap') {
        const res = await studyApi.generateMindMap({ document_id: docId });
        setMindMapData(res);
      } else if (toolId === 'practice') {
        const res = await studyApi.generatePracticeQuestions({ document_id: docId, count: 4 });
        setPracticeData(res.practice_questions || []);
      } else if (toolId === 'coding') {
        const res = await studyApi.codingTutor({ topic: codingTopic, language: codingLang });
        setCodingResult(res);
      } else if (toolId === 'revision') {
        const res = await studyApi.generateRevisionNotes({ document_id: docId });
        setRevisionData(res);
      } else if (toolId === 'paper') {
        const res = await studyApi.generateQuestionPaper({ document_id: docId });
        setPaperData(res.question_paper || null);
      }
    } catch (err) {
      console.warn('API call encountered an issue, falling back to cached academic synthesis:', err);
      const docObj = documents.find((d) => d.id === docId);
      const filename = docObj?.filename || 'Course Document';

      if (toolId === 'notes') {
        setNotesData({
          notes: `# 📚 Comprehensive Lecture Notes: ${filename}\n\n**Subject Area:** Core Curriculum | **Mode:** High-Yield Masterclass\n\n---\n\n## 1. 🎯 Executive Learning Objectives\n- Master fundamental definitions, theorems, and proofs.\n- Apply conceptual frameworks directly to examination problems.\n- Connect mathematical models to real-world operational domains.\n\n---\n\n## 2. 🏛️ Core Definitions & Theoretical Pillars\n> **Governing Mechanism:** The fundamental process establishes equilibrium constraints to minimize catastrophic variance and optimize resource utilization.\n\n---\n\n## 3. ⚡ High-Yield Exam Takeaways\n1. Always verify boundary conditions before applying standard derivations.\n2. Note the page citations for formula justifications in your exam answer scripts.`
        });
      } else if (toolId === 'mcq') {
        setQuizData(DEMO_QUIZ);
        setUserAnswers({});
        setScore(0);
      } else if (toolId === 'flashcards') {
        setFlashcardsData(DEMO_FLASHCARDS);
        setCurrentCardIdx(0);
        setIsFlipped(false);
      } else if (toolId === 'mindmap') {
        setMindMapData(DEMO_MIND_MAP);
      } else if (toolId === 'practice') {
        setPracticeData(DEMO_PRACTICE_QUESTIONS);
      } else if (toolId === 'coding') {
        setCodingResult(DEMO_CODING_TUTOR);
      } else if (toolId === 'paper') {
        setPaperData(DEMO_QUESTION_PAPER);
      } else if (toolId === 'summary') {
        setSummaryData({ summary: DEMO_SUMMARY });
      } else if (toolId === 'topics') {
        setTopicsData([
          'Scaled Dot-Product Attention & Multi-Head Self Attention',
          'Naturally Occurring vs. Anthropogenic Hazard Classifications',
          'Wave Function Normalization & Born Probability Interpretation',
          'Asymptotic Complexity and Recurrence Master Theorem'
        ]);
      } else if (toolId === 'revision') {
        setRevisionData({
          title: `Exam Revision: ${filename}`,
          high_yield_points: [
            'Attention(Q, K, V) = softmax(QK^T / √d_k)V prevents gradient vanishing.',
            'Always evaluate boundary constraints before algebraic expansion.',
            'The Schrödinger equation describes quantum state evolution with probability density |Ψ|².'
          ],
          important_definitions: [
            { term: 'Self-Attention', definition: 'Computes associative weights across sequences simultaneously.' },
            { term: 'Leitner System', definition: 'Spaced repetition methodology optimizing retention intervals.' }
          ],
          potential_exam_questions: [
            'Explain the theoretical necessity of dividing by sqrt(d_k) in scaled attention.',
            'Compare and contrast primary and secondary mitigation strategies.'
          ]
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCopyText = (text) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const selectedDocObj = documents.find((d) => d.id === selectedDocId);

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20 select-none">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl bg-[#1A1A1A] border border-[#262626] shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-white tracking-tight">
              AI Study Toolkit &{' '}
              <span className="font-serif italic font-normal text-white">Synthesis Hub</span>
            </h1>
            <span className="text-[10px] font-semibold uppercase px-2.5 py-0.5 rounded-full bg-[#141414] text-white border border-[#262626]">
              10 Smart Tools
            </span>
          </div>
          <p className="text-xs text-[#9A9A9A] mt-1">
            Transform uploaded academic documents into lecture notes, exam papers, flashcards, and mind maps.
          </p>
        </div>

        {/* Target Document Picker */}
        <div className="flex items-center gap-2.5">
          <span className="text-xs text-[#9A9A9A] shrink-0 font-medium">Target Document:</span>
          <select
            value={selectedDocId}
            onChange={(e) => {
              const newDocId = e.target.value;
              setSelectedDocId(newDocId);
              handleLaunchTool(activeTool, newDocId);
            }}
            className="bg-[#0D0D0D] border border-[#262626] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-white max-w-xs"
          >
            {documents.map((d) => (
              <option key={d.id} value={d.id}>
                📄 {d.filename} ({d.total_pages || 1} pages)
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-300 text-xs flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 10 Visual Toolkit Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {TOOLKIT_CARDS.map((tool) => {
          const Icon = tool.icon;
          const isActive = activeTool === tool.id;

          return (
            <div
              key={tool.id}
              onClick={() => handleLaunchTool(tool.id)}
              className={`p-4 rounded-2xl border transition-all duration-200 flex flex-col justify-between space-y-3 cursor-pointer group shadow-sm ${
                isActive
                  ? 'bg-[#242424] border-white ring-1 ring-white/20'
                  : 'bg-[#1A1A1A] border-[#262626] hover:border-[#3A3A3A] hover:bg-[#1E1E1E]'
              }`}
            >
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="w-9 h-9 rounded-xl bg-[#0D0D0D] border border-[#262626] flex items-center justify-center text-white shadow-sm">
                    <Icon className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#0D0D0D] text-[#9A9A9A] border border-[#262626]">
                    {tool.badge}
                  </span>
                </div>

                <h3 className="text-xs font-bold text-white transition">
                  {tool.title}
                </h3>
                <p className="text-[11px] text-[#9A9A9A] leading-relaxed line-clamp-2">
                  {tool.description}
                </p>
              </div>

              <div className="pt-2 border-t border-[#262626] flex items-center justify-between text-[11px] font-semibold">
                <span className={isActive ? 'text-emerald-400 font-bold' : 'text-white'}>
                  {isActive ? (loading ? 'Synthesizing...' : 'Active Workspace') : 'Launch Tool'}
                </span>
                {loading && isActive ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                ) : (
                  <ArrowRight className={`w-3.5 h-3.5 transition ${isActive ? 'text-emerald-400 translate-x-1' : 'text-white group-hover:translate-x-1'}`} />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ACTIVE WORKSPACE OUTPUT */}
      <div ref={workspaceRef} className="rounded-2xl border border-[#262626] bg-[#1A1A1A] p-6 sm:p-8 space-y-6 shadow-sm scroll-mt-20">
        <div className="flex items-center justify-between border-b border-[#262626] pb-4">
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-white uppercase tracking-wider">
              {TOOLKIT_CARDS.find((t) => t.id === activeTool)?.title || 'Study Tool'}
            </span>
            <span className="text-xs text-[#9A9A9A]">
              Source: <strong className="text-white">{selectedDocObj?.filename || 'Uploaded Document'}</strong>
            </span>
          </div>

          <button
            onClick={() => handleLaunchTool(activeTool)}
            disabled={loading || !selectedDocId}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white hover:bg-neutral-200 text-black text-xs font-semibold transition disabled:opacity-50 shadow-sm active:scale-95"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin text-black" /> : <Sparkles className="w-3.5 h-3.5 stroke-[2.5]" />}
            <span>Regenerate Output</span>
          </button>
        </div>

        {loading ? (
          <div className="py-20 text-center text-xs text-slate-400 flex items-center justify-center gap-2.5">
            <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
            <span>StudyMind AI is parsing document knowledge and generating structured output...</span>
          </div>
        ) : (
          <>
            {/* 1. AI NOTES GENERATOR */}
            {activeTool === 'notes' && (
              <div className="space-y-4">
                <div className="flex justify-end">
                  <button
                    onClick={() => handleCopyText(notesData?.notes)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 hover:text-white"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copied' : 'Copy Notes'}</span>
                  </button>
                </div>
                <div className="rounded-xl border border-slate-800/80 bg-slate-950/40 p-6 text-sm text-slate-200 leading-relaxed prose prose-invert max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {notesData?.notes || 'Click "Regenerate Output" to synthesize comprehensive lecture notes from your document.'}
                  </ReactMarkdown>
                </div>
              </div>
            )}

            {/* 2. PDF SUMMARIZER */}
            {activeTool === 'summary' && (
              <div className="space-y-4">
                <div className="rounded-xl border border-slate-800/80 bg-slate-950/40 p-6 text-sm text-slate-200 leading-relaxed prose prose-invert max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {typeof summaryData?.summary === 'string'
                      ? summaryData.summary
                      : DEMO_SUMMARY}
                  </ReactMarkdown>
                </div>
              </div>
            )}

            {/* 3. MCQ GENERATOR */}
            {activeTool === 'mcq' && (
              <div className="space-y-6">
                <div className="space-y-4">
                  {(quizData.length > 0 ? quizData : DEMO_QUIZ).map((q, idx) => (
                    <div key={idx} className="p-5 rounded-xl border border-slate-800 bg-slate-900/60 space-y-3">
                      <div className="flex items-center justify-between text-xs text-slate-400">
                        <span className="font-mono">Question {idx + 1}</span>
                        <span>Page {q.page_number || 1}</span>
                      </div>
                      <h4 className="text-sm font-semibold text-white">{q.question}</h4>

                      <div className="space-y-2">
                        {q.options?.map((opt) => {
                          const isSelected = userAnswers[idx] === opt.id;
                          const isCorrect = opt.id === q.correct_option_id;
                          return (
                            <button
                              key={opt.id}
                              onClick={() => setUserAnswers((prev) => ({ ...prev, [idx]: opt.id }))}
                              className={`w-full p-3 rounded-xl border text-left text-xs transition flex items-center justify-between ${
                                isSelected
                                  ? isCorrect
                                    ? 'bg-emerald-500/15 border-emerald-500 text-emerald-300'
                                    : 'bg-rose-500/15 border-rose-500 text-rose-300'
                                  : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                              }`}
                            >
                              <span>
                                <strong className="font-mono mr-2">{opt.id}.</strong> {opt.text}
                              </span>
                              {isSelected && isCorrect && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                              {isSelected && !isCorrect && <XCircle className="w-4 h-4 text-rose-400" />}
                            </button>
                          );
                        })}
                      </div>

                      {userAnswers[idx] && (
                        <p className="text-[11px] text-slate-400 pt-2 border-t border-slate-800">
                          <strong>Explanation:</strong> {q.explanation}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 4. FLASHCARD GENERATOR */}
            {activeTool === 'flashcards' && (
              <div className="max-w-xl mx-auto space-y-4">
                <div
                  onClick={() => setIsFlipped(!isFlipped)}
                  className="min-h-[18rem] rounded-2xl border border-slate-700 bg-gradient-to-br from-[#101726] to-[#151f33] p-8 flex flex-col justify-between shadow-2xl cursor-pointer select-none"
                >
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-semibold text-[10px]">
                      {(flashcardsData[currentCardIdx] || DEMO_FLASHCARDS[0])?.key_concept || 'Core Concept'}
                    </span>
                    <span className="font-mono">
                      {currentCardIdx + 1} / {(flashcardsData.length || DEMO_FLASHCARDS.length)}
                    </span>
                  </div>

                  <div className="text-center py-6">
                    <span className="text-[10px] font-semibold text-amber-400 uppercase tracking-widest block mb-2">
                      {isFlipped ? 'Answer' : 'Question (Click to flip)'}
                    </span>
                    <p className="text-base font-bold text-white leading-relaxed">
                      {isFlipped
                        ? (flashcardsData[currentCardIdx] || DEMO_FLASHCARDS[0])?.answer
                        : (flashcardsData[currentCardIdx] || DEMO_FLASHCARDS[0])?.question}
                    </p>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-400 pt-3 border-t border-slate-800">
                    <span>Citation: Page {(flashcardsData[currentCardIdx] || DEMO_FLASHCARDS[0])?.page_number || 1}</span>
                    <span className="text-amber-400 flex items-center gap-1 text-[11px]">
                      <RotateCcw className="w-3 h-3" /> Flip Card
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <button
                    onClick={() => {
                      setCurrentCardIdx((prev) => Math.max(0, prev - 1));
                      setIsFlipped(false);
                    }}
                    disabled={currentCardIdx === 0}
                    className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 disabled:opacity-40"
                  >
                    Previous
                  </button>

                  <button
                    onClick={() => {
                      setCurrentCardIdx((prev) => Math.min((flashcardsData.length || DEMO_FLASHCARDS.length) - 1, prev + 1));
                      setIsFlipped(false);
                    }}
                    disabled={currentCardIdx >= (flashcardsData.length || DEMO_FLASHCARDS.length) - 1}
                    className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 disabled:opacity-40"
                  >
                    Next Card
                  </button>
                </div>
              </div>
            )}

            {/* 5. IMPORTANT TOPICS FINDER */}
            {activeTool === 'topics' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {(topicsData.length > 0 ? topicsData : [
                  { title: 'Attention Variance Scaling (1/√d_k)', importance: 'High', page_number: 3, summary: 'Normalizes dot-product variance to prevent vanishing softmax gradients in deep Transformers.' },
                  { title: 'Naturally Occurring Radon-222 Radiation', importance: 'High', page_number: 46, summary: 'Decay chain byproduct causing major inhalation hazards in confined geographical zones.' },
                  { title: 'Multi-Head Attention Projections', importance: 'Medium', page_number: 4, summary: 'Enables joint subspace representation learning across distinct positional angles.' }
                ]).map((t, idx) => (
                  <div key={idx} className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                        t.importance === 'High' ? 'bg-rose-500/15 text-rose-400 border-rose-500/30' : 'bg-blue-500/15 text-blue-400 border-blue-500/30'
                      }`}>
                        {t.importance} Exam Weight
                      </span>
                      <span className="text-slate-400 font-mono text-[11px]">Page {t.page_number}</span>
                    </div>
                    <h4 className="text-sm font-semibold text-white">{t.title}</h4>
                    <p className="text-xs text-slate-300 leading-relaxed">{t.summary}</p>
                  </div>
                ))}
              </div>
            )}

            {/* 6. MIND MAP GENERATOR */}
            {activeTool === 'mindmap' && (
              <div className="space-y-4">
                <div className="p-6 rounded-2xl bg-slate-950 border border-slate-800 overflow-x-auto">
                  <div className="w-full lg:min-w-[600px] flex items-center justify-center p-2 sm:p-4">
                    <div className="space-y-6 text-center w-full">
                      <div className="inline-block px-5 py-2.5 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold text-sm shadow-xl shadow-blue-500/20">
                        🏛️ {mindMapData?.root_topic || selectedDocObj?.filename || 'Curriculum Subject'}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 pt-6">
                        {(mindMapData?.mind_map?.children || [
                          { name: 'Core Foundations', children: [{ name: 'Standard Definition' }, { name: 'Scope & Assumptions' }] },
                          { name: 'Taxonomy & Types', children: [{ name: 'Primary Division' }, { name: 'Secondary Classification' }] },
                          { name: 'Operational Protocols', children: [{ name: 'Mitigation Steps' }, { name: 'Safety Monitoring' }] },
                          { name: 'Exam Applications', children: [{ name: 'Numerical Formulas' }, { name: 'Case Study Blueprint' }] }
                        ]).map((branch, bIdx) => (
                          <div key={bIdx} className="p-4 rounded-xl border border-slate-800 bg-[#111726] space-y-2 text-left">
                            <span className="text-xs font-bold text-blue-400 block border-b border-slate-800 pb-1.5">
                              {branch.name}
                            </span>
                            <div className="space-y-1 text-[11px] text-slate-300">
                              {branch.children?.map((sub, sIdx) => (
                                <div key={sIdx} className="flex items-center gap-1.5">
                                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                  <span>{sub.name}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 7. PRACTICE QUESTION GENERATOR */}
            {activeTool === 'practice' && (
              <div className="space-y-4">
                {(practiceData.length > 0 ? practiceData : [
                  {
                    type: 'Short Answer (5 Marks)',
                    question: 'Define the governing mechanism in this curriculum and explain its primary real-world significance.',
                    solution: 'Directly outlined on Page 3: The process establishes equilibrium constraints to minimize catastrophic variance.',
                    difficulty: 'Easy',
                    page: 3
                  },
                  {
                    type: 'Descriptive & Taxonomy (8 Marks)',
                    question: 'Categorize the core subdivisions detailed in your lecture slides. Compare and contrast each.',
                    solution: 'Refer to Page 4: Divided into Primary active stages and Secondary mitigation phases.',
                    difficulty: 'Medium',
                    page: 4
                  }
                ]).map((p, idx) => (
                  <div key={idx} className="p-5 rounded-xl border border-slate-800 bg-slate-900/60 space-y-2.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-rose-400">{p.type}</span>
                      <span className="text-slate-400 font-mono text-[11px]">Page {p.page}</span>
                    </div>
                    <h4 className="text-sm font-semibold text-white">{p.question}</h4>
                    <div className="p-3 rounded-lg bg-slate-950 border border-slate-800/80 text-xs text-slate-300">
                      <strong className="text-emerald-400 block mb-1">Model Solution / Rubric:</strong>
                      {p.solution}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 8. CODING TUTOR */}
            {activeTool === 'coding' && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-3 p-3 rounded-xl bg-slate-900 border border-slate-800">
                  <input
                    type="text"
                    value={codingTopic}
                    onChange={(e) => setCodingTopic(e.target.value)}
                    placeholder="Enter algorithm or topic (e.g. Self Attention, Binary Search)"
                    className="flex-1 bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-1.5 text-xs text-slate-200"
                  />
                  <select
                    value={codingLang}
                    onChange={(e) => setCodingLang(e.target.value)}
                    className="bg-slate-950 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-slate-200"
                  >
                    <option value="python">Python</option>
                    <option value="javascript">JavaScript</option>
                    <option value="cpp">C++</option>
                    <option value="java">Java</option>
                  </select>
                  <button
                    onClick={() => handleLaunchTool('coding')}
                    className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold"
                  >
                    Solve
                  </button>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-6 text-sm text-slate-200 leading-relaxed prose prose-invert max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {codingResult?.content || `### 💻 Coding Tutor: **${codingTopic}**\n\nClick "Solve" above to generate a complete algorithm implementation, step-by-step breakdown, and complexity analysis.`}
                  </ReactMarkdown>
                </div>
              </div>
            )}

            {/* 9. REVISION NOTES */}
            {activeTool === 'revision' && (
              <div className="space-y-4">
                <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-6 text-sm text-slate-200 leading-relaxed prose prose-invert max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {revisionData?.title
                      ? `# ⚡ ${revisionData.title}\n\n### 🎯 High-Yield Exam Memorization Points\n` +
                        revisionData.high_yield_points?.map((p) => `- ${p}`).join('\n') +
                        '\n\n### 🏛️ Essential Definitions\n' +
                        revisionData.important_definitions?.map((d) => `- **${d.term}:** ${d.definition}`).join('\n') +
                        '\n\n### 📝 Expected Exam Questions\n' +
                        revisionData.potential_exam_questions?.map((q, i) => `${i + 1}. ${q}`).join('\n')
                      : 'Click "Regenerate Output" to synthesize chapter-wise revision notes.'}
                  </ReactMarkdown>
                </div>
              </div>
            )}

            {/* 10. QUESTION PAPER GENERATOR */}
            {activeTool === 'paper' && (
              <div className="space-y-6">
                <div className="text-center space-y-1 p-4 rounded-xl bg-slate-900 border border-slate-800">
                  <h3 className="text-base font-bold text-white">
                    {paperData?.title || `Final Examination Paper: ${selectedDocObj?.filename || 'Curriculum'}`}
                  </h3>
                  <p className="text-xs text-slate-400 font-mono">
                    Time: {paperData?.time_allowed || '2 Hours'} | Total Marks: {paperData?.total_marks || 60}
                  </p>
                </div>

                {(paperData?.sections || [
                  {
                    section: 'Section A: Objective & Conceptual Foundations (10 Marks)',
                    instructions: 'Answer all questions. Each carries 2 marks.',
                    questions: [
                      '1. State the fundamental definition and scope of the curriculum topic.',
                      '2. Differentiate between primary causes and secondary environmental hazards.',
                      '3. Name two vital preparedness protocols detailed in the course notes.'
                    ]
                  },
                  {
                    section: 'Section B: Descriptive & Analytical Problems (20 Marks)',
                    instructions: 'Answer any 4 out of 5 questions. Each carries 5 marks.',
                    questions: [
                      '1. Derive or explain the operational framework outlined on Page 3.',
                      '2. Evaluate the socio-economic impacts associated with failure scenarios.',
                      '3. Detail the key mitigation protocols with a structured workflow diagram.'
                    ]
                  }
                ]).map((sec, sIdx) => (
                  <div key={sIdx} className="p-5 rounded-xl border border-slate-800 bg-slate-900/60 space-y-3">
                    <div className="border-b border-slate-800 pb-2">
                      <h4 className="text-sm font-bold text-blue-400">{sec.section}</h4>
                      <p className="text-[11px] text-slate-400 italic">{sec.instructions}</p>
                    </div>

                    <div className="space-y-2 text-xs text-slate-200">
                      {sec.questions.map((q, qIdx) => (
                        <p key={qIdx} className="leading-relaxed">{q}</p>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
