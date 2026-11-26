import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen,
  HelpCircle,
  Flame,
  Clock,
  RefreshCw,
  ArrowRight,
  Timer,
  MessageSquare,
} from 'lucide-react';
import { dashboardApi } from '../services/api';

export default function Analytics() {
  const navigate = useNavigate();
  const [period, setPeriod] = useState('7d');
  const [chartMetric, setChartMetric] = useState('queries'); // 'queries' | 'hours'
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadAnalytics = useCallback(async (activePeriod = period) => {
    try {
      setLoading(true);
      setError(null);
      const data = await dashboardApi.getAnalytics(activePeriod);
      setAnalytics(data);
    } catch (e) {
      setError(e.response?.data?.detail || e.message || 'Could not load learning analytics.');
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    loadAnalytics(period);
  }, [period]); // eslint-disable-line react-hooks/exhaustive-deps

  const weeklyActivity = analytics?.weekly_activity || [];
  const maxChartVal = Math.max(
    1,
    ...weeklyActivity.map((a) => (chartMetric === 'hours' ? Number(a.hours || 0) : Number(a.queries || 0)))
  );
  const subjectPerformance = analytics?.subject_performance || [];

  const streakDays = analytics?.study_streak_days ?? 0;
  const streakDelta = analytics?.streak_delta ?? 0;
  const mcqAcc = analytics?.mcq_accuracy_pct;
  const focusHours = analytics?.focus_hours ?? 0;

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-16 select-none animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 sm:p-6 rounded-2xl bg-[#141414] border border-[#262626]">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Academic Learning <span className="font-serif italic font-normal text-white">Analytics</span>
            </h1>
            <span className="text-[10px] font-semibold uppercase px-2.5 py-0.5 rounded-full bg-[#1A1A1A] text-emerald-400 border border-[#262626]">
              Real DB Data
            </span>
          </div>
          <p className="text-xs text-[#9A9A9A] mt-1">
            Live consistency, quiz accuracy, focus hours, and subject mastery computed directly from your activity.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 p-1 rounded-xl bg-[#0D0D0D] border border-[#262626] text-xs">
            {[
              { id: '7d', label: 'Last 7 Days' },
              { id: '30d', label: 'Last 30 Days' },
              { id: 'all', label: 'All Time' },
            ].map((btn) => (
              <button
                key={btn.id}
                type="button"
                onClick={() => setPeriod(btn.id)}
                className={`px-3 py-1.5 rounded-lg font-medium transition ${
                  period === btn.id
                    ? 'bg-white text-black font-semibold'
                    : 'text-[#9A9A9A] hover:text-white'
                }`}
              >
                {btn.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => loadAnalytics(period)}
            disabled={loading}
            title="Refresh metrics"
            className="p-2 rounded-xl bg-[#0D0D0D] border border-[#262626] text-[#9A9A9A] hover:text-white transition disabled:opacity-40"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-300 text-xs">
          {error}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 sm:gap-4">
        <div className="p-4 sm:p-5 rounded-2xl bg-[#141414] border border-[#262626] space-y-1">
          <div className="flex items-center justify-between text-xs text-[#9A9A9A]">
            <span>Study Streak</span>
            <Flame className={`w-4 h-4 ${streakDays > 0 ? 'text-amber-400' : 'text-[#666666]'}`} />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-white font-mono">
            {streakDays} {streakDays === 1 ? 'Day' : 'Days'}
          </div>
          <span className={`text-[11px] font-medium ${streakDelta >= 0 ? 'text-emerald-400' : 'text-[#9A9A9A]'}`}>
            {streakDelta > 0
              ? `+${streakDelta} active days vs last week`
              : `${analytics?.active_days_this_week ?? 0} active days this week`}
          </span>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-[#141414] border border-[#262626] space-y-1">
          <div className="flex items-center justify-between text-xs text-[#9A9A9A]">
            <span>Documents Indexed</span>
            <BookOpen className="w-4 h-4 text-white" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-white font-mono">
            {analytics?.total_documents ?? 0} Docs
          </div>
          <span className="text-[11px] text-[#9A9A9A] font-mono">
            {analytics?.total_chunks ?? 0} FAISS Chunks
          </span>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-[#141414] border border-[#262626] space-y-1">
          <div className="flex items-center justify-between text-xs text-[#9A9A9A]">
            <span>Questions & Quizzes</span>
            <HelpCircle className="w-4 h-4 text-white" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-white font-mono">
            {analytics?.total_questions_solved ?? 0} Solved
          </div>
          <span className={`text-[11px] font-medium ${mcqAcc !== null && mcqAcc !== undefined ? 'text-emerald-400' : 'text-[#9A9A9A]'}`}>
            {mcqAcc !== null && mcqAcc !== undefined
              ? `${mcqAcc}% Quiz & Recall Accuracy`
              : `${analytics?.chat_questions_count ?? 0} tutor prompts · 0 quizzes yet`}
          </span>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-[#141414] border border-[#262626] space-y-1">
          <div className="flex items-center justify-between text-xs text-[#9A9A9A]">
            <span>Focus Hours</span>
            <Clock className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-white font-mono">
            {focusHours} hrs
          </div>
          <span className="text-[11px] text-[#9A9A9A]">
            {analytics?.focus_sessions_count
              ? `${analytics.focus_sessions_count} sessions · ~${analytics.daily_avg_hours}h/day`
              : 'Complete a Focus timer to log hours'}
          </span>
        </div>
      </div>

      {/* Real Activity Bar Chart */}
      <div className="rounded-2xl border border-[#262626] bg-[#141414] p-5 sm:p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-white">Study Activity & Time Investment</h3>
            <p className="text-xs text-[#9A9A9A] mt-0.5">
              {chartMetric === 'queries'
                ? 'Daily questions asked in AI Tutor, quizzes, flashcards, and study tools.'
                : 'Daily timed Focus Mode hours recorded in your account.'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="inline-flex items-center p-0.5 rounded-lg bg-[#0D0D0D] border border-[#262626] text-[11px]">
              <button
                type="button"
                onClick={() => setChartMetric('queries')}
                className={`px-2.5 py-1 rounded-md font-medium transition ${
                  chartMetric === 'queries' ? 'bg-white text-black font-semibold' : 'text-[#9A9A9A] hover:text-white'
                }`}
              >
                Activity
              </button>
              <button
                type="button"
                onClick={() => setChartMetric('hours')}
                className={`px-2.5 py-1 rounded-md font-medium transition ${
                  chartMetric === 'hours' ? 'bg-white text-black font-semibold' : 'text-[#9A9A9A] hover:text-white'
                }`}
              >
                Focus Hrs
              </button>
            </div>
            <span className="text-xs font-mono text-white bg-[#0D0D0D] px-2.5 py-1 rounded-lg border border-[#262626]">
              {chartMetric === 'hours'
                ? `Total: ${focusHours}h`
                : `Total: ${analytics?.total_questions_solved ?? 0}`}
            </span>
          </div>
        </div>

        <div className="pt-2 pb-1">
          <div className="flex items-end gap-2.5 sm:gap-5 justify-between px-1">
            {weeklyActivity.map((item, idx) => {
              const rawVal = chartMetric === 'hours' ? Number(item.hours || 0) : Number(item.queries || 0);
              const heightPct = rawVal > 0 ? Math.max(8, Math.round((rawVal / maxChartVal) * 100)) : 0;
              return (
                <div key={idx} className="flex-1 flex flex-col items-center gap-2 group min-w-0">
                  <div className="text-[10px] font-mono text-[#9A9A9A] group-hover:text-white transition truncate">
                    {chartMetric === 'hours' ? `${rawVal}h` : rawVal}
                  </div>
                  <div className="w-full h-36 bg-[#0D0D0D] rounded-xl flex items-end overflow-hidden border border-[#262626] p-1">
                    {heightPct > 0 ? (
                      <div
                        className="w-full bg-white rounded-lg transition-all duration-500 group-hover:bg-neutral-300"
                        style={{ height: `${heightPct}%` }}
                      />
                    ) : (
                      <div className="w-full h-[2px] bg-[#262626] rounded-full" />
                    )}
                  </div>
                  <span className="text-[11px] font-medium text-[#9A9A9A] truncate">{item.day}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Real Subject Mastery Breakdown */}
      <div className="rounded-2xl border border-[#262626] bg-[#141414] p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <h3 className="text-base font-semibold text-white">Document & Subject-Wise Mastery</h3>
            <p className="text-xs text-[#9A9A9A] mt-0.5">
              Built from your uploaded documents, MCQ exam scores, and active recall flashcards.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate('/focus')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1A1A1A] hover:bg-[#242424] border border-[#262626] text-[11px] text-white transition"
            >
              <Timer className="w-3.5 h-3.5" />
              <span>Start Focus</span>
            </button>
            <button
              type="button"
              onClick={() => navigate('/exams')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-neutral-200 text-black text-[11px] font-semibold transition"
            >
              <span>Take Exam</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {subjectPerformance.length === 0 ? (
          <div className="p-6 rounded-xl bg-[#0D0D0D] border border-[#222222] text-center space-y-2">
            <p className="text-xs text-[#9A9A9A]">
              No documents or quiz attempts recorded yet. Upload a PDF or ask StudyMind AI to populate your mastery stats.
            </p>
            <button
              type="button"
              onClick={() => navigate('/chat')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white text-black text-xs font-semibold hover:bg-neutral-200 transition"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Go to AI Tutor</span>
            </button>
          </div>
        ) : (
          <div className="space-y-3 pt-1">
            {subjectPerformance.map((item, idx) => (
              <div key={idx} className="space-y-2 p-3.5 rounded-xl bg-[#0D0D0D] border border-[#262626]">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-semibold text-white truncate max-w-md">{item.subject}</span>
                  <div className="flex items-center gap-2 font-mono">
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                        item.has_quiz_data
                          ? item.accuracy >= 85
                            ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                            : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                          : 'bg-[#1A1A1A] text-[#9A9A9A] border-[#262626]'
                      }`}
                    >
                      {item.status}
                    </span>
                    {item.has_quiz_data ? (
                      <strong className="text-white">{item.accuracy}%</strong>
                    ) : item.document_id ? (
                      <button
                        type="button"
                        onClick={() => navigate(`/study-tools/mcq?doc=${item.document_id}`)}
                        className="text-[11px] font-sans font-semibold text-white hover:underline"
                      >
                        Quiz now →
                      </button>
                    ) : null}
                  </div>
                </div>

                {item.has_quiz_data && (
                  <div className="w-full h-2 bg-[#141414] rounded-full overflow-hidden border border-[#262626]">
                    <div
                      className="h-full bg-white transition-all duration-700"
                      style={{ width: `${item.accuracy}%` }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
