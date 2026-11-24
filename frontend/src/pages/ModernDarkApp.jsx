import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  GraduationCap,
  MessageSquare,
  BookOpen,
  Brain,
  ClipboardList,
  Layers,
  ArrowUpRight,
  ArrowRight,
  Check,
  Sparkles,
  ShieldCheck,
  Zap,
  Lock,
  Sun,
  Moon,
  LogIn,
  UserPlus,
  LogOut,
  FileText
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';

// StudyMind AI specialized academic tools catalog (10 tools)
const STUDYMIND_TOOLS = [
  {
    id: 'tool-notes',
    category: 'Summary & Notes',
    tag: 'STUDY ACCELERATOR',
    title: 'AI Masterclass Notes Generator',
    subtitle: 'Transforms raw lecture slides and textbooks into structured masterclass notes.',
    price: 'Free with Account',
    description:
      'Synthesizes multi-chapter textbooks and slide decks into high-yield, structured lecture notes with conceptual hierarchies, KaTeX mathematical proofs, bold takeaway bullets, and exact page citations.',
    specs: [
      'Grounded in your uploaded syllabus PDFs',
      'KaTeX LaTeX mathematical equation rendering',
      'Chapter-by-chapter concept taxonomies',
      'Direct export to Markdown & PDF'
    ],
    previewGradient: 'from-[#1A2338] via-[#101726] to-[#0A0E18]',
    accentColor: '#4F8CFF'
  },
  {
    id: 'tool-formulas',
    category: 'Summary & Notes',
    tag: 'CORE ENGINE',
    title: 'Formula & Theorem Cheat Sheet',
    subtitle: 'Extracts every mathematical equation, theorem, lemma, and formula.',
    price: 'Free with Account',
    description:
      'Identifies every symbol, variable declaration, derivation step, and SI unit across your technical PDF curriculum, formatting them into an instant pre-exam reference sheet.',
    specs: [
      'Automatic variable symbol definitions',
      'Step-by-step formula derivations',
      'Instant LaTeX KaTeX rendering',
      'One-click clipboard export'
    ],
    previewGradient: 'from-[#142A28] via-[#0D1C1B] to-[#060D0C]',
    accentColor: '#10B981'
  },
  {
    id: 'tool-mcq',
    category: 'Exams & Practice',
    tag: 'EVALUATION ENGINE',
    title: 'Adaptive MCQ & Quiz Generator',
    subtitle: 'Generates rigorous university-standard multiple-choice questions.',
    price: 'Free with Account',
    description:
      'Generates 5-to-50 question assessments grounded strictly in your study materials with multi-option distractors, negative marking options, and verified page citations.',
    specs: [
      'Bloom taxonomy difficulty tuning (Easy to Advanced)',
      'Detailed rationale for every correct and incorrect answer',
      'Direct page reference citation for fact checking',
      'Instant performance scorecards'
    ],
    previewGradient: 'from-[#2D1B36] via-[#1A0E20] to-[#0D0710]',
    accentColor: '#A855F7'
  },
  {
    id: 'tool-flashcards',
    category: 'Active Recall',
    tag: 'SPACED REPETITION',
    title: 'Active Recall Leitner Flashcards',
    subtitle: 'Extracts core key concepts and creates interactive digital flashcard decks.',
    price: 'Free with Account',
    description:
      'Implements spaced repetition active recall algorithms (Leitner 5-box system) so you can test memory retention on terms, dates, proofs, and definitions before exams.',
    specs: [
      'Interactive 3D flip card animations',
      'Spaced repetition mastery scoring',
      'Automatic front-back Q&A extraction',
      'Continuous retention tracking'
    ],
    previewGradient: 'from-[#382618] via-[#21160C] to-[#0D0804]',
    accentColor: '#F59E0B'
  },
  {
    id: 'tool-eli5',
    category: 'Summary & Notes',
    tag: 'PEDAGOGICAL AI',
    title: 'ELI5 Real-World Analogy Explainer',
    subtitle: 'Breaks down dense academic theory into intuitive everyday analogies.',
    price: 'Free with Account',
    description:
      'Takes complex concepts like eigenvalue decomposition or backpropagation and translates them into simple, clear intuitive analogies without sacrificing technical accuracy.',
    specs: [
      'Real-world physical mental models',
      'Zero academic jargon mode',
      'Step-by-step intuition bridges',
      'Follow-up interactive clarification'
    ],
    previewGradient: 'from-[#182838] via-[#0E1721] to-[#060B10]',
    accentColor: '#38BDF8'
  },
  {
    id: 'tool-exam-questions',
    category: 'Exams & Practice',
    tag: 'EXAM PREPARATION',
    title: 'Exam Practice Question Bank',
    subtitle: 'Predicts high-probability university mid-term and final examination questions.',
    price: 'Free with Account',
    description:
      'Analyzes repeated course themes, professor lecture highlights, and chapter summaries to formulate likely long-form questions, short notes, and numerical problems.',
    specs: [
      '5-mark, 10-mark, and 15-mark question tiers',
      'Model answer keys with grading schemes',
      'Past paper style formatting',
      'Topic frequency weighting'
    ],
    previewGradient: 'from-[#38181E] via-[#210D11] to-[#0D0406]',
    accentColor: '#F43F5E'
  },
  {
    id: 'tool-hinglish',
    category: 'Summary & Notes',
    tag: 'BILINGUAL AI',
    title: 'Bilingual Hinglish Concept Tutor',
    subtitle: 'Explains complex syllabus topics in natural conversational Hindi-English.',
    price: 'Free with Account',
    description:
      'Bridges language gaps by explaining rigorous engineering and medical concepts in fluid Hinglish dialogue, making complex ideas instantly graspable.',
    specs: [
      'Natural college conversational tone',
      'Preserves official English technical terminology',
      'Instant clarification on confusing paragraphs',
      'Real-world Indian university context'
    ],
    previewGradient: 'from-[#1A3828] via-[#0E2117] to-[#060D09]',
    accentColor: '#34D399'
  },
  {
    id: 'tool-planner',
    category: 'Summary & Notes',
    tag: 'STUDY STRATEGY',
    title: 'AI Exam Readiness & Study Planner',
    subtitle: 'Generates day-by-day customized study schedules aligned to your exam dates.',
    price: 'Free with Account',
    description:
      'Breaks down massive multi-hundred page PDF syllabi into manageable daily study tasks, spacing revision and practice tests logically up to your exam day.',
    specs: [
      'Custom exam date deadline countdown',
      'Day-by-day task breakdown with checkboxes',
      'Buffers for revision and self-testing',
      'Real-time completion analytics'
    ],
    previewGradient: 'from-[#2A1838] via-[#180D21] to-[#0A050E]',
    accentColor: '#C084FC'
  },
  {
    id: 'tool-proof',
    category: 'Summary & Notes',
    tag: 'DEEP THEORY',
    title: 'Step-by-Step Rigorous Derivation Tutor',
    subtitle: 'Walks through multi-step mathematical and algorithmic proofs line by line.',
    price: 'Free with Account',
    description:
      'Unpacks skipped mathematical steps, unexplained transitions, and intermediate algebra in dense course proofs with meticulous side-by-side justification.',
    specs: [
      'Full intermediate algebraic expansion',
      'Line-by-line axiom justification',
      'KaTeX LaTeX formatting for every step',
      'Highlight of crucial exam traps'
    ],
    previewGradient: 'from-[#383318] via-[#211E0C] to-[#0D0B04]',
    accentColor: '#EAB308'
  },
  {
    id: 'tool-code',
    category: 'Code & Logic',
    tag: 'COMPUTATION',
    title: 'Algorithm & Code Dry-Run Visualizer',
    subtitle: 'Explains code snippets, pseudocode, time complexity, and memory traces.',
    price: 'Free with Account',
    description:
      'Converts pseudocode and algorithms from lecture slides into commented implementations with Big-O complexity proofs and line-by-line variable state tracking tables.',
    specs: [
      'Big-O time and space complexity derivation',
      'Step-by-step dry run trace tables',
      'Multi-language code translation (Python, C++, Java)',
      'Edge-case analysis'
    ],
    previewGradient: 'from-[#2E1824] via-[#1B0C15] to-[#0B0408]',
    accentColor: '#EC4899'
  }
];

export default function ModernDarkApp() {
  const navigate = useNavigate();
  const { toggleTheme, isDark } = useTheme();
  const { user, isAuthenticated, logout } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState('All Tools');

  // Unified action handler: requires authentication for any workspace function
  const handleAction = (protectedPath, mode = 'signup') => {
    if (isAuthenticated) {
      navigate(protectedPath);
    } else {
      navigate(`/login?mode=${mode}`);
    }
  };

  const filteredTools = STUDYMIND_TOOLS.filter((t) => {
    if (selectedCategory === 'All Tools') return true;
    return t.category === selectedCategory;
  });

  return (
    <div className="min-h-screen bg-[#0D0D0D] text-white flex flex-col select-none font-sans overflow-x-hidden">
      {/* ------------------------------------------------------------- */}
      {/* TOP NAVIGATION BAR (Clean SaaS Header, Matches Screenshot)     */}
      {/* ------------------------------------------------------------- */}
      <header className="sticky top-0 z-50 flex items-center justify-between px-4 sm:px-8 py-3.5 bg-[#141414]/95 backdrop-blur-md border-b border-[#222222]">
        {/* Left: Brand Identity */}
        <div
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="flex items-center gap-3 cursor-pointer group"
        >
          <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-black font-black text-sm shadow-md group-hover:scale-105 transition-transform shrink-0">
            <GraduationCap className="w-4 h-4 text-current stroke-[2.5]" />
          </div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm sm:text-base tracking-tight text-white">
              StudyMind
            </span>
            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-white text-black">
              AI
            </span>
          </div>
          <span className="text-[10px] text-[#9A9A9A] font-mono px-2 py-0.5 rounded-full bg-[#1A1A1A] border border-[#262626]">
            Overview
          </span>
        </div>

        {/* Right: Theme Toggle, Log In, Sign Up */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            className="p-1.5 px-2.5 rounded-lg text-[#9A9A9A] hover:text-white hover:bg-[#1A1A1A] border border-[#262626] transition flex items-center gap-1.5 text-xs active:scale-95"
            title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {isDark ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-[#0F172A]" />}
            <span className="hidden sm:inline font-medium">{isDark ? 'Light Mode' : 'Dark Mode'}</span>
          </button>

          {isAuthenticated ? (
            <>
              <button
                onClick={() => navigate('/dashboard')}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-white hover:bg-neutral-200 text-black font-semibold text-xs transition shadow-sm active:scale-95"
              >
                <span>Open Workspace</span>
                <ArrowUpRight className="w-3.5 h-3.5 stroke-[2.5]" />
              </button>

              <button
                onClick={logout}
                className="p-1.5 rounded-lg text-[#9A9A9A] hover:text-rose-400 hover:bg-[#1A1A1A] border border-[#262626] transition active:scale-95"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </>
          ) : (
            <>
              {/* Log In Button */}
              <button
                onClick={() => navigate('/login?mode=login')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[#9A9A9A] hover:text-white hover:bg-[#1A1A1A] border border-[#262626] text-xs font-semibold transition active:scale-95"
                title="Sign in to your account"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Log In</span>
              </button>

              {/* Sign Up Button (High-Contrast Primary Pill) */}
              <button
                onClick={() => navigate('/login?mode=signup')}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-white hover:bg-neutral-200 text-black font-semibold text-xs transition shadow-sm active:scale-95"
                title="Create a free scholar account"
              >
                <UserPlus className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Sign Up</span>
              </button>
            </>
          )}
        </div>
      </header>

      {/* ------------------------------------------------------------- */}
      {/* MAIN LANDING BODY (Presentation Only, No In-Page Functions)     */}
      {/* ------------------------------------------------------------- */}
      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 space-y-28">
        {/* 1. Centered Hero Block */}
        <section className="text-center space-y-6 max-w-3xl mx-auto">
          {/* Eyebrow Pill Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-medium bg-[#1A1A1A] border border-[#2C2C2C] text-[#9A9A9A]">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            <span>AI-POWERED ACADEMIC COMPANION</span>
          </div>

          {/* Headline */}
          <h1 className="text-4xl sm:text-6xl font-bold tracking-[-0.03em] leading-[1.08] text-white">
            Master Complex{' '}
            <span className="font-serif italic font-normal text-white">
              Syllabus
            </span>
            <br />
            With Absolute{' '}
            <span className="font-serif italic font-normal text-white">
              Clarity
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-sm sm:text-base text-[#9A9A9A] leading-relaxed max-w-xl mx-auto">
            Your personal AI learning space. Grounded directly in your uploaded textbooks,
            lecture slides, and notes with exact page citations, active recall flashcards, and
            zero hallucinations.
          </p>

          {/* Call to Action Buttons */}
          <div className="pt-4 flex items-center justify-center gap-3">
            <button
              onClick={() => handleAction('/chat', 'login')}
              className="px-6 py-3 rounded-lg bg-white hover:bg-neutral-200 text-black font-semibold text-sm transition shadow-lg flex items-center gap-2 active:scale-95"
            >
              <span>Launch AI Tutor</span>
              <ArrowUpRight className="w-4 h-4 stroke-[2.5]" />
            </button>

            <button
              onClick={() => handleAction('/study-tools', 'signup')}
              className="px-6 py-3 rounded-lg bg-[#1F1F1F] hover:bg-[#282828] border border-[#2E2E2E] text-white font-medium text-sm transition active:scale-95 flex items-center gap-2"
            >
              <span>Explore Study Toolkit</span>
              <Lock className="w-3.5 h-3.5 text-[#9A9A9A]" />
            </button>
          </div>
        </section>

        {/* 2. Featured Course Modules Row */}
        <section className="space-y-6">
          <div className="flex items-center justify-between pb-2 border-b border-[#222222]">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-white" />
              <h2 className="text-lg font-bold tracking-tight text-white">
                Featured Course Modules
              </h2>
            </div>
            <button
              onClick={() => handleAction('/study-tools', 'signup')}
              className="text-xs font-semibold text-[#9A9A9A] hover:text-white flex items-center gap-1 transition"
            >
              <span>Explore all 10 tools</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {STUDYMIND_TOOLS.slice(0, 2).map((item) => (
              <div
                key={item.id}
                onClick={() => handleAction('/study-tools', 'signup')}
                className="group relative rounded-2xl bg-[#141414] border border-[#222222] hover:border-[#3A3A3A] p-6 space-y-4 transition-all duration-300 hover:shadow-2xl cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-400 font-semibold">
                    {item.tag}
                  </span>
                  <div className="flex items-center gap-1 text-[11px] text-[#9A9A9A] group-hover:text-white transition">
                    <span>Unlock with Sign In</span>
                    <Lock className="w-3 h-3 text-[#666666] group-hover:text-white transition" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <h3 className="text-base font-bold text-white group-hover:text-white transition">
                    {item.title}
                  </h3>
                  <p className="text-xs text-[#9A9A9A] leading-relaxed">
                    {item.subtitle}
                  </p>
                </div>

                <ul className="space-y-1.5 pt-2 border-t border-[#222222] text-xs text-[#9A9A9A]">
                  {item.specs.slice(0, 3).map((spec, sIdx) => (
                    <li key={sIdx} className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>{spec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* 3. Core Architecture Bento Grid */}
        <section className="space-y-6">
          <div className="flex items-center gap-2 pb-2 border-b border-[#222222]">
            <span className="w-2 h-2 rounded-full bg-white" />
            <h2 className="text-lg font-bold tracking-tight text-white">
              Grounded AI Architecture
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Card 1: Vector Search Grounding */}
            <div className="p-6 rounded-2xl bg-[#141414] border border-[#262626] flex flex-col justify-between space-y-6">
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 font-mono mb-2">
                  <ShieldCheck className="w-4 h-4" />
                  <span>FAISS VECTOR GROUNDING</span>
                </div>
                <h3 className="text-base font-bold text-white">
                  Zero Hallucination Retrieval
                </h3>
                <p className="text-xs text-[#9A9A9A] mt-1.5 leading-relaxed">
                  Every answer cites the exact PDF page, chapter, and section so you can verify facts
                  directly from your course material.
                </p>
              </div>

              <div className="h-28 rounded-xl bg-[#0D0D0D] border border-[#262626] p-3 flex flex-col justify-between font-mono text-[10px] text-[#9A9A9A]">
                <div className="flex items-center justify-between">
                  <span>SEMANTIC_DENSE_INDEX</span>
                  <span className="text-emerald-400 font-bold">100% GROUNDED</span>
                </div>
                <div className="space-y-1">
                  <div className="h-1.5 w-3/4 bg-white/20 rounded" />
                  <div className="h-1.5 w-1/2 bg-white/10 rounded" />
                </div>
                <div className="flex justify-between text-white text-[11px]">
                  <span>Lecture_Notes_04.pdf</span>
                  <span className="text-amber-400">Page 18</span>
                </div>
              </div>
            </div>

            {/* Card 2: Active Recall */}
            <div className="p-6 rounded-2xl bg-[#141414] border border-[#262626] flex flex-col justify-between space-y-6">
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold text-amber-400 font-mono mb-2">
                  <Layers className="w-4 h-4" />
                  <span>SPACED REPETITION</span>
                </div>
                <h3 className="text-base font-bold text-white">
                  Active Recall Leitner System
                </h3>
                <p className="text-xs text-[#9A9A9A] mt-1.5 leading-relaxed">
                  Dynamic digital flashcards generated directly from course slide definitions.
                  Retain formulas and concepts through active recall.
                </p>
              </div>

              <div className="h-28 rounded-xl bg-gradient-to-tr from-[#141414] to-[#242424] border border-[#2E2E2E] flex items-center justify-center">
                <div className="px-4 py-2 rounded-xl bg-white/5 border border-white/20 backdrop-blur-md flex items-center gap-2 text-white shadow-xl text-xs font-semibold">
                  <Layers className="w-4 h-4 text-amber-400" />
                  <span>Leitner 5-Box Mastery</span>
                </div>
              </div>
            </div>

            {/* Card 3: Autonomous Tutor */}
            <div className="p-6 rounded-2xl bg-[#141414] border border-[#262626] flex flex-col justify-between space-y-6">
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold text-purple-400 font-mono mb-2">
                  <Brain className="w-4 h-4" />
                  <span>AI ACADEMIC TUTOR</span>
                </div>
                <h3 className="text-base font-bold text-white">
                  Multi-Level Explanations
                </h3>
                <p className="text-xs text-[#9A9A9A] mt-1.5 leading-relaxed">
                  Toggle between beginner ELI5 analogies, rigorous mathematical proofs, or conversational
                  Hinglish explanations.
                </p>
              </div>

              <button
                onClick={() => handleAction('/chat', 'login')}
                className="w-full py-2.5 bg-white hover:bg-neutral-200 text-black font-semibold text-xs rounded-lg transition shadow-md flex items-center justify-center gap-2 active:scale-95"
              >
                <span>Start Session With AI Tutor</span>
                <ArrowUpRight className="w-3.5 h-3.5 stroke-[2.5]" />
              </button>
            </div>
          </div>
        </section>

        {/* 4. Complete 10 Tools Preview Showcase */}
        <section className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#222222]">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-white" />
                <h2 className="text-lg font-bold tracking-tight text-white">
                  Curated AI Study Toolkit (10 Academic Tools)
                </h2>
              </div>
              <p className="text-xs text-[#9A9A9A] mt-1">
                Engineered specifically for university scholars studying dense technical coursework.
              </p>
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-1">
              {['All Tools', 'Summary & Notes', 'Exams & Practice', 'Active Recall', 'Code & Logic'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1 rounded-full text-xs transition whitespace-nowrap ${
                    selectedCategory === cat
                      ? 'bg-white text-black font-semibold shadow-sm'
                      : 'bg-[#1A1A1A] hover:bg-[#242424] border border-[#262626] text-[#9A9A9A] hover:text-white'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredTools.map((tool) => (
              <div
                key={tool.id}
                onClick={() => handleAction('/study-tools', 'signup')}
                className="p-5 rounded-2xl bg-[#141414] border border-[#222222] hover:border-[#3A3A3A] flex flex-col justify-between space-y-4 transition-all duration-300 hover:shadow-xl cursor-pointer group"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-[#9A9A9A]">
                      {tool.category}
                    </span>
                    <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                      <Lock className="w-3 h-3" />
                      Sign In to Use
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-white group-hover:text-white transition">
                    {tool.title}
                  </h3>
                  <p className="text-xs text-[#9A9A9A] leading-relaxed line-clamp-2">
                    {tool.subtitle}
                  </p>
                </div>

                <div className="pt-3 border-t border-[#222222] flex items-center justify-between text-xs text-[#9A9A9A]">
                  <span className="font-mono text-[11px] text-white font-semibold">
                    {tool.price}
                  </span>
                  <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-white group-hover:translate-x-0.5 transition-transform">
                    <span>Unlock Tool</span>
                    <ArrowRight className="w-3 h-3" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 5. Bottom Call to Action Section */}
        <section className="p-8 sm:p-12 rounded-3xl bg-gradient-to-br from-[#141414] to-[#1C1C1C] border border-[#2A2A2A] text-center space-y-6 shadow-2xl relative overflow-hidden">
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:24px_24px]" />

          <div className="max-w-2xl mx-auto space-y-3 relative z-10">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-white/10 text-white border border-white/20">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Get Started in 30 Seconds</span>
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
              Ready to Master Your Coursework?
            </h2>
            <p className="text-xs sm:text-sm text-[#9A9A9A] leading-relaxed">
              Create your free scholar account today. Upload textbooks, lecture slides, and notes to
              begin asking questions with 100% verified citations.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2 relative z-10">
            <button
              onClick={() => navigate('/login?mode=signup')}
              className="w-full sm:w-auto px-7 py-3 rounded-xl bg-white hover:bg-neutral-200 text-black font-semibold text-sm transition shadow-lg flex items-center justify-center gap-2 active:scale-95"
            >
              <UserPlus className="w-4 h-4 stroke-[2.5]" />
              <span>Create Free Account</span>
            </button>

            <button
              onClick={() => navigate('/login?mode=login')}
              className="w-full sm:w-auto px-7 py-3 rounded-xl bg-[#1A1A1A] hover:bg-[#242424] border border-[#2E2E2E] text-white font-medium text-sm transition active:scale-95 flex items-center justify-center gap-2"
            >
              <LogIn className="w-4 h-4" />
              <span>Sign In to Existing Account</span>
            </button>
          </div>
        </section>

        {/* 6. Minimal Footer */}
        <footer className="pt-8 pb-12 border-t border-[#222222] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#666666]">
          <div className="flex items-center gap-2 text-white font-medium">
            <GraduationCap className="w-4 h-4 text-white" />
            <span>StudyMind AI · College-Level RAG Academic Learning Space</span>
          </div>
          <div className="flex items-center gap-4 text-[11px] text-[#9A9A9A] font-mono">
            <span>FAISS Vector Engine</span>
            <span>•</span>
            <span>Gemini LLM</span>
            <span>•</span>
            <span>Zero Hallucinations</span>
          </div>
        </footer>
      </main>
    </div>
  );
}
