import React, { useState, useEffect } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Files,
  MessageSquare,
  Sparkles,
  UploadCloud,
  ArrowRight,
  Clock,
  HardDrive,
  Cpu,
  FileText,
  HelpCircle,
  ExternalLink,
  BookOpen,
  CheckCircle2,
  Atom,
  GraduationCap,
  Layers,
  ClipboardList,
  CalendarDays,
  Timer,
  ChartNoAxesCombined,
  Brain,
  UserRound,
  CheckSquare,
  Lightbulb,
  Zap
} from 'lucide-react';
import StatsCard from '../components/StatsCard';
import DocumentCard from '../components/DocumentCard';
import { documentApi, dashboardApi, systemApi } from '../services/api';

export default function Dashboard() {
  const navigate = useNavigate();
  const { openUpload, refreshStats } = useOutletContext();
  const { user, isDemoMode } = useAuth();
  const [stats, setStats] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);

  // Sample upcoming study tasks state for study planner integration
  const [tasks, setTasks] = useState([
    { id: 1, text: 'Review Scaled Dot-Product Attention in CS101', due: 'Today', completed: false, badge: 'High Yield' },
    { id: 2, text: 'Practice 5 MCQs on Radiation Protection in CHE110', due: 'Tomorrow', completed: true, badge: 'Quiz' },
    { id: 3, text: 'Complete 25m Focus Pomodoro on Quantum Wave Functions', due: 'Nov 22', completed: false, badge: 'Focus' }
  ]);

  const toggleTask = (id) => {
    setTasks(tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
  };

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [statsData, docsData, sysHealth] = await Promise.all([
        dashboardApi.getStats().catch(() => null),
        documentApi.getDocuments().catch(() => []),
        systemApi.getHealth().catch(() => null),
      ]);
      setStats(statsData);
      setDocuments(docsData || []);
      setHealth(sysHealth);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  const handleDelete = async (docId) => {
    if (confirm('Are you sure you want to delete this study document?')) {
      try {
        await documentApi.deleteDocument(docId);
        await loadDashboardData();
        if (refreshStats) refreshStats();
      } catch (err) {
        alert('Failed to delete document: ' + (err.response?.data?.detail || err.message));
      }
    }
  };

  const totalDocs = stats?.total_documents ?? documents.length;
  const totalChunks = stats?.total_chunks ?? documents.reduce((acc, doc) => acc + (doc.total_chunks || 0), 0);
  const totalQuestions = stats?.total_questions ?? 0;
  const recentDocs = documents.slice(0, 4);
  const recentConvs = stats?.recent_conversations || [];

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-300 select-none">
      {/* Ultra-Modern Dark Welcome Hero */}
      <div className="relative overflow-hidden rounded-2xl border border-[#262626] bg-[#1A1A1A] p-6 sm:p-8 lg:p-9 shadow-sm">
        <div className="relative z-10 max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-[#141414] text-[#9A9A9A] border border-[#262626]">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            <span>StudyMind AI Workspace</span>
            {isDemoMode && (
              <span className="ml-1 px-1.5 py-0.2 rounded bg-white/10 text-white border border-white/20 text-[10px] font-mono">
                Demo Scholar
              </span>
            )}
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white tracking-[-0.03em] leading-tight">
            Welcome back,{' '}
            <span className="font-serif italic font-normal text-white">
              {user?.full_name?.split(' ')[0] || 'Scholar'}
            </span>
          </h1>

          <p className="text-sm text-[#9A9A9A] leading-relaxed max-w-2xl">
            Your personal learning space is active. Ask your AI tutor questions grounded in your course materials, generate exam flashcards, or take a timed practice test with exact page citations.
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-3">
            <button
              onClick={() => navigate('/chat')}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-white hover:bg-neutral-200 text-black font-semibold text-xs sm:text-sm shadow-sm transition active:scale-95"
            >
              <MessageSquare className="w-4 h-4 stroke-[2.5]" />
              <span>Ask AI Tutor</span>
            </button>

            <button
              onClick={openUpload}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#1F1F1F] hover:bg-[#282828] text-white border border-[#2E2E2E] font-medium text-xs sm:text-sm transition active:scale-95"
            >
              <UploadCloud className="w-4 h-4 text-[#9A9A9A]" />
              <span>Upload Document</span>
            </button>

            <button
              onClick={() => navigate('/study-tools')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#141414] hover:bg-[#202020] text-[#9A9A9A] hover:text-white border border-[#262626] font-medium text-xs sm:text-sm transition active:scale-95"
            >
              <Brain className="w-4 h-4 text-white" />
              <span>Study Toolkit (10 Tools)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Statistics Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatsCard
          title="Uploaded Documents"
          value={totalDocs}
          subtitle="Indexed for exact page citations"
          icon={Files}
        />
        <StatsCard
          title="Questions Asked"
          value={totalQuestions}
          subtitle="Grounded Q&A queries solved"
          icon={MessageSquare}
        />
        <StatsCard
          title="Indexed Sections"
          value={totalChunks}
          subtitle="Semantic 384-d vectors"
          icon={HardDrive}
        />
      </div>

      {/* Smart Learning Modules Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-white" />
            <h2 className="text-xs font-bold text-white uppercase tracking-wider">Learning Modules & Smart Workspace</h2>
          </div>
          <span className="text-xs text-[#9A9A9A] font-mono">Connected to RAG knowledge base</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { to: '/study-tools', title: 'Study Toolkit', desc: '10 Generators', icon: Brain, badge: 'Popular' },
            { to: '/exams', title: 'Exams & Quizzes', desc: 'Timed Evaluation', icon: ClipboardList, badge: 'Exam' },
            { to: '/flashcards', title: 'Flashcards', desc: 'Active Recall', icon: Layers, badge: 'Cards' },
            { to: '/planner', title: 'Study Planner', desc: 'Deadlines & Goals', icon: CalendarDays, badge: 'Plan' },
            { to: '/focus', title: 'Focus Pomodoro', desc: '40Hz Focus Audio', icon: Timer, badge: 'Focus' },
            { to: '/analytics', title: 'Analytics', desc: 'Progress & Mastery', icon: ChartNoAxesCombined, badge: 'Stats' },
          ].map((mod, idx) => {
            const Icon = mod.icon;
            return (
              <div
                key={idx}
                onClick={() => navigate(mod.to)}
                className="p-4 rounded-2xl border border-[#262626] bg-[#1A1A1A] hover:bg-[#242424] hover:border-[#3A3A3A] transition cursor-pointer group flex flex-col justify-between space-y-3 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded-xl bg-[#0D0D0D] border border-[#262626] flex items-center justify-center text-white shadow-sm group-hover:scale-105 transition-transform">
                    <Icon className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-[#0D0D0D] text-[#9A9A9A] border border-[#262626]">
                    {mod.badge}
                  </span>
                </div>
                <div>
                  <h3 className="text-xs font-bold text-white transition truncate">
                    {mod.title}
                  </h3>
                  <p className="text-[10px] text-[#9A9A9A] truncate pt-0.5">
                    {mod.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Two-Column Content Grid: Documents + Continue Learning */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Recent Documents + Upcoming Study Tasks (2 Cols) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Recent Documents Header */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Files className="w-4 h-4 text-white" />
                <h2 className="text-base font-bold text-white tracking-tight">Your Course Documents</h2>
              </div>
              <button
                onClick={() => navigate('/documents')}
                className="text-xs text-[#9A9A9A] hover:text-white inline-flex items-center gap-1 font-semibold transition"
              >
                <span>View all ({documents.length})</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {documents.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#262626] bg-[#141414] p-10 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-[#1A1A1A] text-white flex items-center justify-center mx-auto border border-[#262626]">
                  <FileText className="w-6 h-6 text-white" />
                </div>
                <p className="text-sm font-semibold text-white">No course documents uploaded yet</p>
                <p className="text-xs text-[#9A9A9A] max-w-sm mx-auto">
                  Upload your syllabus, lecture slides, or textbook PDF to ask questions with exact page citations.
                </p>
                <button
                  onClick={openUpload}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-white hover:bg-neutral-200 text-black shadow-sm transition active:scale-95"
                >
                  <UploadCloud className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Upload First Document</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {recentDocs.map((doc) => (
                  <DocumentCard
                    key={doc.id}
                    document={doc}
                    onDelete={handleDelete}
                    onChat={(d) => navigate(`/chat?doc=${d.id}`)}
                    onView={(d) => navigate(`/viewer?doc=${d.id}`)}
                    onStudy={(d) => navigate(`/study-tools?doc=${d.id}`)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Upcoming Study Tasks (From Planner) */}
          <div className="p-6 rounded-2xl border border-[#262626] bg-[#1A1A1A] space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckSquare className="w-4 h-4 text-white" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">Upcoming Study Tasks</h3>
              </div>
              <button
                onClick={() => navigate('/planner')}
                className="text-[11px] text-[#9A9A9A] hover:text-white font-medium transition"
              >
                Open Planner ↗
              </button>
            </div>

            <div className="space-y-2">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  onClick={() => toggleTask(task.id)}
                  className="flex items-center justify-between p-3 rounded-xl bg-[#0D0D0D] border border-[#262626] hover:border-[#3A3A3A] cursor-pointer transition select-none group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <input
                      type="checkbox"
                      checked={task.completed}
                      onChange={() => {}}
                      className="w-4 h-4 rounded border-[#262626] bg-[#141414] text-white focus:ring-0 cursor-pointer accent-white"
                    />
                    <span className={`text-xs truncate ${task.completed ? 'line-through text-[#666666]' : 'text-white'}`}>
                      {task.text}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#1A1A1A] text-[#9A9A9A] border border-[#262626]">
                      {task.due}
                    </span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#1F1F1F] text-white border border-[#2E2E2E]">
                      {task.badge}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Continue Learning + AI Recommendations (1 Col) */}
        <div className="space-y-6">
          {/* Continue Learning / Recent Discussions */}
          <div className="space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-white" />
                <h2 className="text-xs font-bold text-white uppercase tracking-wider">Continue Learning</h2>
              </div>
              <button
                onClick={() => navigate('/chat')}
                className="text-xs text-[#9A9A9A] hover:text-white inline-flex items-center gap-1 font-medium transition"
              >
                <span>All Chats</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="rounded-2xl border border-[#262626] bg-[#1A1A1A] p-4 space-y-2.5 shadow-sm">
              {recentConvs.length === 0 ? (
                <div className="py-6 text-center text-xs text-[#9A9A9A] space-y-2">
                  <HelpCircle className="w-6 h-6 mx-auto text-[#666666]" />
                  <p>No recent discussions yet.</p>
                  <p className="text-[11px] text-[#666666]">Ask a question to see citations and insights.</p>
                </div>
              ) : (
                recentConvs.slice(0, 3).map((conv) => (
                  <div
                    key={conv.id}
                    onClick={() => navigate(`/chat?conv=${conv.id}`)}
                    className="p-3 rounded-xl bg-[#0D0D0D] hover:bg-[#202020] border border-[#262626] hover:border-[#3A3A3A] transition cursor-pointer text-xs space-y-1 group"
                  >
                    <p className="font-semibold text-white line-clamp-1">
                      {conv.title || 'Study Discussion'}
                    </p>
                    <div className="flex items-center justify-between text-[11px] text-[#9A9A9A] pt-1 font-mono">
                      <span>{conv.created_at ? new Date(conv.created_at).toLocaleDateString() : 'Recent'}</span>
                      <span className="text-white flex items-center gap-1">
                        Resume <ExternalLink className="w-3 h-3" />
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* AI-Generated Study Recommendations */}
          <div className="rounded-2xl border border-[#262626] bg-[#1A1A1A] p-5 space-y-3 shadow-sm">
            <div className="flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-white" />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">AI Study Recommendations</h3>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="p-3 rounded-xl bg-[#0D0D0D] border border-[#262626] space-y-1">
                <span className="text-[10px] font-semibold uppercase text-white font-mono">Exam Focus</span>
                <p className="text-white font-medium leading-relaxed">
                  Scaled Dot-Product Attention appears frequently on modern AI exams.
                </p>
                <p className="text-[11px] text-[#9A9A9A]">
                  Review Page 14 in CS101 or generate a 5-mark practice question.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-[#0D0D0D] border border-[#262626] space-y-1">
                <span className="text-[10px] font-semibold uppercase text-emerald-400 font-mono">Active Recall</span>
                <p className="text-white font-medium leading-relaxed">
                  Radon-222 Mitigation protocols in CHE110.
                </p>
                <p className="text-[11px] text-[#9A9A9A]">
                  Flip through 3 unmastered flashcards to lock in memory retention.
                </p>
              </div>
            </div>
          </div>

          {/* Verifiable Study Guarantee */}
          <div className="rounded-2xl border border-[#262626] bg-[#141414] p-4 text-xs space-y-2">
            <h3 className="font-semibold text-white flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-white" />
              Verifiable RAG Guarantee
            </h3>
            <p className="text-[#9A9A9A] leading-relaxed text-[11px]">
              Every explanation is grounded in your uploaded documents. Check source pills below any answer to jump straight to that textbook page.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
