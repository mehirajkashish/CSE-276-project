import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  ClipboardList,
  Clock,
  Award,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Bookmark,
  ChevronRight,
  ChevronLeft,
  RotateCcw,
  Sparkles,
  Loader2,
  BookOpen,
  HelpCircle,
  Play,
  FileCheck2,
  BarChart3,
  Lightbulb
} from 'lucide-react';
import { documentApi, studyApi } from '../services/api';
import { DEMO_QUIZ } from '../services/demoData';

export default function Exams() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const docFromUrl = searchParams.get('doc');

  const [documents, setDocuments] = useState([]);
  const [selectedDocId, setSelectedDocId] = useState(docFromUrl || '');
  const [difficulty, setDifficulty] = useState('medium');
  const [questionCount, setQuestionCount] = useState(5);
  const [timedMode, setTimedMode] = useState(true);
  const [negativeMarking, setNegativeMarking] = useState(false);

  // Exam in-progress state
  const [isExamActive, setIsExamActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [questions, setQuestions] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [userAnswers, setUserAnswers] = useState({});
  const [markedForReview, setMarkedForReview] = useState({});
  const [secondsRemaining, setSecondsRemaining] = useState(600);

  // Results state
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  useEffect(() => {
    loadDocuments();
  }, []);

  useEffect(() => {
    let timer = null;
    if (isExamActive && timedMode && !isSubmitted && secondsRemaining > 0) {
      timer = setInterval(() => {
        setSecondsRemaining((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            handleSubmitExam();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isExamActive, timedMode, isSubmitted, secondsRemaining]);

  const loadDocuments = async () => {
    try {
      const docs = await documentApi.getDocuments();
      setDocuments(docs || []);
      if (!selectedDocId && docs.length > 0) {
        setSelectedDocId(docs[0].id);
      }
    } catch (e) {
      console.warn('Could not load documents for exam:', e);
    }
  };

  const handleStartExam = async () => {
    if (!selectedDocId) {
      setError('Please select a target study document.');
      return;
    }

    setLoading(true);
    setError(null);
    setUserAnswers({});
    setMarkedForReview({});
    setCurrentIdx(0);
    setIsSubmitted(false);

    try {
      const res = await studyApi.generateQuiz({
        document_id: selectedDocId,
        count: questionCount,
        difficulty: difficulty,
      });

      const loadedQuestions = res.quiz || res.questions || DEMO_QUIZ;
      setQuestions(loadedQuestions);
      setSecondsRemaining(questionCount * 120);
      setIsExamActive(true);
    } catch (err) {
      console.warn('Backend quiz generation failed, loading verified test deck:', err);
      setQuestions(DEMO_QUIZ);
      setSecondsRemaining(questionCount * 120);
      setIsExamActive(true);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectOption = (optionId) => {
    if (isSubmitted) return;
    setUserAnswers((prev) => ({
      ...prev,
      [currentIdx]: optionId,
    }));
  };

  const toggleMarkReview = () => {
    setMarkedForReview((prev) => ({
      ...prev,
      [currentIdx]: !prev[currentIdx],
    }));
  };

  const handleSubmitExam = () => {
    setShowConfirmModal(false);
    setIsSubmitted(true);
  };

  const calculateScore = () => {
    let correct = 0;
    let incorrect = 0;
    let unattempted = 0;

    questions.forEach((q, idx) => {
      const answer = userAnswers[idx];
      if (!answer) {
        unattempted++;
      } else if (answer === q.correct_option_id) {
        correct++;
      } else {
        incorrect++;
      }
    });

    let rawScore = correct;
    if (negativeMarking) {
      rawScore = Math.max(0, correct - incorrect * 0.25);
    }

    const percentage = Math.round((correct / (questions.length || 1)) * 100);

    return {
      correct,
      incorrect,
      unattempted,
      rawScore,
      maxScore: questions.length,
      percentage,
    };
  };

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const scoreData = isSubmitted ? calculateScore() : null;

  return (
    <div className="max-w-6xl mx-auto space-y-6 select-none">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Interactive{' '}
              <span className="font-serif italic font-normal text-white">Examination Simulator</span>
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#1A1A1A] text-white border border-[#262626]">
              MCQ & Timed
            </span>
          </div>
          <p className="text-xs text-[#9A9A9A] mt-1">
            Test and evaluate syllabus comprehension with instant explanations and topic performance scoring.
          </p>
        </div>

        {isExamActive && !isSubmitted && timedMode && (
          <div className="flex items-center gap-3">
            <div
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl border font-mono text-xs font-bold transition shadow-sm ${
                secondsRemaining < 120
                  ? 'bg-rose-500/15 border-rose-500/40 text-rose-400 animate-pulse'
                  : 'bg-[#1A1A1A] border-[#262626] text-white'
              }`}
            >
              <Clock className="w-4 h-4 text-white" />
              <span>{formatTime(secondsRemaining)}</span>
            </div>

            <button
              onClick={() => setShowConfirmModal(true)}
              className="px-4 py-2 rounded-lg bg-white hover:bg-neutral-200 text-black text-xs font-semibold transition shadow-sm active:scale-95"
            >
              Finish Exam
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* SETUP VIEW (When Exam is NOT active) */}
      {!isExamActive && (
        <div className="rounded-2xl border border-[#262626] bg-[#1A1A1A] p-6 sm:p-8 space-y-6 shadow-sm">
          <h3 className="text-base font-bold text-white">Configure Examination Parameters</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#9A9A9A]">Target Study Document</label>
              <select
                value={selectedDocId}
                onChange={(e) => setSelectedDocId(e.target.value)}
                className="w-full bg-[#0D0D0D] border border-[#262626] rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-white"
              >
                {documents.map((d) => (
                  <option key={d.id} value={d.id}>
                    📄 {d.filename} ({d.total_pages || 1} pages)
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#9A9A9A]">Difficulty Level</label>
              <div className="grid grid-cols-3 gap-2">
                {['easy', 'medium', 'hard'].map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setDifficulty(lvl)}
                    className={`py-2 text-xs font-semibold rounded-lg capitalize transition ${
                      difficulty === lvl
                        ? 'bg-white text-black shadow-sm'
                        : 'bg-[#0D0D0D] border border-[#262626] text-[#9A9A9A] hover:text-white'
                    }`}
                  >
                    {lvl}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#9A9A9A]">Question Count</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[3, 5, 10, 15].map((cnt) => (
                  <button
                    key={cnt}
                    type="button"
                    onClick={() => setQuestionCount(cnt)}
                    className={`py-2 text-xs font-semibold rounded-lg font-mono transition ${
                      questionCount === cnt
                        ? 'bg-white text-black shadow-sm'
                        : 'bg-[#0D0D0D] border border-[#262626] text-[#9A9A9A] hover:text-white'
                    }`}
                  >
                    {cnt} Questions
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5 flex flex-col justify-end">
              <div className="p-3 rounded-xl bg-[#0D0D0D] border border-[#262626] space-y-2">
                <label className="flex items-center gap-2.5 text-xs text-white cursor-pointer">
                  <input
                    type="checkbox"
                    checked={timedMode}
                    onChange={(e) => setTimedMode(e.target.checked)}
                    className="accent-white rounded"
                  />
                  <span>Timed Exam Mode (Countdown Timer)</span>
                </label>
                <label className="flex items-center gap-2.5 text-xs text-white cursor-pointer">
                  <input
                    type="checkbox"
                    checked={negativeMarking}
                    onChange={(e) => setNegativeMarking(e.target.checked)}
                    className="accent-white rounded"
                  />
                  <span>Negative Marking (-0.25)</span>
                </label>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-[#262626] flex justify-end">
            <button
              onClick={handleStartExam}
              disabled={loading || !selectedDocId}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-white hover:bg-neutral-200 text-black text-xs font-semibold transition shadow-sm active:scale-95 disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin text-black" /> : <Play className="w-4 h-4 stroke-[2.5]" />}
              <span>Begin Examination</span>
            </button>
          </div>
        </div>
      )}

      {/* EXAM IN PROGRESS OR RESULTS VIEW */}
      {isExamActive && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main Question Display */}
          <div className="lg:col-span-3 space-y-5">
            {isSubmitted ? (
              /* RESULTS SUMMARY */
              <div className="rounded-2xl border border-[#262626] bg-[#1A1A1A] p-6 sm:p-8 space-y-6 shadow-sm">
                <div className="text-center space-y-2">
                  <div className="w-16 h-16 rounded-2xl bg-white text-black flex items-center justify-center mx-auto shadow-md">
                    <Award className="w-8 h-8 stroke-[2.2]" />
                  </div>
                  <h2 className="text-2xl font-bold text-white tracking-[-0.03em]">Examination Results</h2>
                  <p className="text-xs text-[#9A9A9A]">
                    Your performance on {documents.find((d) => d.id === selectedDocId)?.filename || 'Curriculum'}
                  </p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                  <div className="p-4 rounded-xl bg-[#0D0D0D] border border-[#262626]">
                    <div className="text-xs text-[#9A9A9A]">Total Score</div>
                    <div className="text-2xl font-bold text-white font-mono mt-1">
                      {scoreData.rawScore} / {scoreData.maxScore}
                    </div>
                  </div>
                  <div className="p-4 rounded-xl bg-[#0D0D0D] border border-[#262626]">
                    <div className="text-xs text-[#9A9A9A]">Accuracy</div>
                    <div className="text-2xl font-bold text-emerald-400 font-mono mt-1">
                      {scoreData.percentage}%
                    </div>
                  </div>
                  <div className="p-4 rounded-xl bg-[#0D0D0D] border border-[#262626]">
                    <div className="text-xs text-[#9A9A9A]">Correct</div>
                    <div className="text-2xl font-bold text-emerald-400 font-mono mt-1">
                      {scoreData.correct}
                    </div>
                  </div>
                  <div className="p-4 rounded-xl bg-[#0D0D0D] border border-[#262626]">
                    <div className="text-xs text-[#9A9A9A]">Incorrect</div>
                    <div className="text-2xl font-bold text-rose-400 font-mono mt-1">
                      {scoreData.incorrect}
                    </div>
                  </div>
                </div>

                {/* AI Study Recommendations */}
                <div className="p-4 rounded-xl bg-[#141414] border border-[#262626] space-y-2 text-xs">
                  <div className="flex items-center gap-2 text-white font-semibold">
                    <Lightbulb className="w-4 h-4 text-white" />
                    <span>Personalized AI Study Recommendation</span>
                  </div>
                  <p className="text-[#9A9A9A] leading-relaxed">
                    {scoreData.percentage >= 80
                      ? 'Outstanding grasp of the foundational principles! Review the Flashcards tab to maintain long-term memory retention before finals.'
                      : scoreData.percentage >= 50
                        ? 'Solid foundation, but several distractors tripped you up on specific definitions. Review the questions below with page citations to strengthen your weak spots.'
                        : 'You should revisit the high-yield sections in your course slides. Use the "Explain Simply" study tool to understand the key analogies before retrying!'}
                  </p>
                </div>

                <div className="flex justify-center gap-3 pt-2">
                  <button
                    onClick={() => {
                      setIsExamActive(false);
                      setIsSubmitted(false);
                    }}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#1F1F1F] hover:bg-[#282828] border border-[#2E2E2E] text-white text-xs font-medium transition active:scale-95"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Configure New Test</span>
                  </button>
                </div>
              </div>
            ) : null}

            {/* Current Question Box */}
            <div className="rounded-2xl border border-[#262626] bg-[#1A1A1A] p-6 sm:p-8 space-y-6 shadow-sm">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-[#9A9A9A] font-mono">
                  Question {currentIdx + 1} of {questions.length}
                </span>

                {!isSubmitted && (
                  <button
                    onClick={toggleMarkReview}
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs transition ${
                      markedForReview[currentIdx]
                        ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30 font-medium'
                        : 'text-[#9A9A9A] hover:text-white bg-[#0D0D0D] border border-[#262626]'
                    }`}
                  >
                    <Bookmark className="w-3.5 h-3.5" />
                    <span>{markedForReview[currentIdx] ? 'Marked for Review' : 'Mark for Review'}</span>
                  </button>
                )}
              </div>

              <h3 className="text-base sm:text-lg font-semibold text-white leading-relaxed">
                {questions[currentIdx]?.question}
              </h3>

              {/* Options */}
              <div className="space-y-3">
                {questions[currentIdx]?.options?.map((opt) => {
                  const isSelected = userAnswers[currentIdx] === opt.id;
                  const isCorrect = opt.id === questions[currentIdx]?.correct_option_id;

                  let optClass = 'bg-[#0D0D0D] border-[#262626] hover:border-[#404040] text-[#9A9A9A] hover:text-white';
                  if (isSubmitted) {
                    if (isCorrect) {
                      optClass = 'bg-emerald-500/15 border-emerald-500 text-emerald-300 font-medium';
                    } else if (isSelected && !isCorrect) {
                      optClass = 'bg-rose-500/15 border-rose-500 text-rose-300';
                    }
                  } else if (isSelected) {
                    optClass = 'bg-[#242424] border-white text-white font-medium shadow-sm';
                  }

                  return (
                    <button
                      key={opt.id}
                      onClick={() => handleSelectOption(opt.id)}
                      disabled={isSubmitted}
                      className={`w-full p-4 rounded-xl border text-left text-xs transition flex items-center justify-between gap-3 ${optClass}`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-lg bg-[#141414] border border-[#262626] flex items-center justify-center font-mono font-bold text-white text-xs shrink-0">
                          {opt.id}
                        </span>
                        <span>{opt.text}</span>
                      </div>

                      {isSubmitted && isCorrect && (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      )}
                      {isSubmitted && isSelected && !isCorrect && (
                        <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Instant Explanation (Review Mode) */}
              {isSubmitted && questions[currentIdx]?.explanation && (
                <div className="p-4 rounded-xl bg-[#0D0D0D] border border-[#262626] space-y-1.5 text-xs">
                  <span className="font-semibold text-white">Academic Explanation & Citation:</span>
                  <p className="text-[#9A9A9A] leading-relaxed">{questions[currentIdx].explanation}</p>
                  <span className="text-[11px] text-[#9A9A9A] font-mono block">
                    Page Reference: Page {questions[currentIdx].page_number || 1}
                  </span>
                </div>
              )}

              {/* Prev / Next Buttons */}
              <div className="flex items-center justify-between pt-4 border-t border-[#262626]">
                <button
                  onClick={() => setCurrentIdx((prev) => Math.max(0, prev - 1))}
                  disabled={currentIdx === 0}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0D0D0D] border border-[#262626] text-xs text-[#9A9A9A] hover:text-white disabled:opacity-40 transition"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Previous</span>
                </button>

                <button
                  onClick={() => setCurrentIdx((prev) => Math.min(questions.length - 1, prev + 1))}
                  disabled={currentIdx === questions.length - 1}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0D0D0D] border border-[#262626] text-xs text-[#9A9A9A] hover:text-white disabled:opacity-40 transition"
                >
                  <span>Next</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Question Palette Sidebar */}
          <div className="space-y-4">
            <div className="p-5 rounded-2xl border border-[#262626] bg-[#1A1A1A] space-y-4 shadow-sm">
              <h4 className="text-xs font-semibold text-white uppercase tracking-wider">
                Question Palette
              </h4>

              <div className="grid grid-cols-5 gap-2">
                {questions.map((q, idx) => {
                  const isCurrent = idx === currentIdx;
                  const isAnswered = !!userAnswers[idx];
                  const isMarked = !!markedForReview[idx];

                  let btnStyle = 'bg-[#0D0D0D] border-[#262626] text-[#9A9A9A] hover:text-white';
                  if (isSubmitted) {
                    const isCorrect = userAnswers[idx] === q.correct_option_id;
                    btnStyle = isCorrect
                      ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                      : 'bg-rose-500/20 border-rose-500 text-rose-400';
                  } else if (isCurrent) {
                    btnStyle = 'bg-white text-black font-bold border-white shadow-sm';
                  } else if (isMarked) {
                    btnStyle = 'bg-amber-500/20 border-amber-500 text-amber-400 font-bold';
                  } else if (isAnswered) {
                    btnStyle = 'bg-[#1F1F1F] border-[#2E2E2E] text-white font-medium';
                  }

                  return (
                    <button
                      key={idx}
                      onClick={() => setCurrentIdx(idx)}
                      className={`h-9 rounded-lg border text-xs font-mono font-medium transition ${btnStyle}`}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="space-y-1.5 pt-3 border-t border-[#262626] text-[11px] text-[#9A9A9A]">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded bg-white inline-block" />
                  <span>Current Question</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded bg-[#1F1F1F] border border-[#2E2E2E] inline-block" />
                  <span>Answered</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded bg-amber-500/30 border border-amber-500 inline-block" />
                  <span>Marked for Review</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded bg-[#0D0D0D] border border-[#262626] inline-block" />
                  <span>Unvisited</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#141414] border border-[#262626] rounded-2xl p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white">Submit Examination?</h3>
            <p className="text-xs text-[#9A9A9A] leading-relaxed">
              You have answered <strong className="text-white">{Object.keys(userAnswers).length}</strong> of{' '}
              <strong className="text-white">{questions.length}</strong> questions. Once submitted, your score and instant explanations will be generated.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 rounded-lg bg-[#0D0D0D] hover:bg-[#1A1A1A] border border-[#262626] text-[#9A9A9A] hover:text-white text-xs font-medium transition"
              >
                Keep Testing
              </button>
              <button
                onClick={handleSubmitExam}
                className="px-5 py-2 rounded-lg bg-white hover:bg-neutral-200 text-black text-xs font-semibold transition shadow-sm active:scale-95"
              >
                Confirm & Submit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
