import React, { useState, useEffect } from 'react';
import {
  CalendarDays,
  Plus,
  CheckCircle2,
  Circle,
  Clock,
  Sparkles,
  BookOpen,
  Trash2,
  AlertCircle,
  Flame,
  Calendar,
  Check,
  Tag
} from 'lucide-react';
import { documentApi } from '../services/api';

const DEFAULT_TASKS = [
  { id: '1', title: 'Review Unit 5 Disaster Management notes', subject: 'Environmental Studies', deadline: '2026-11-20', completed: true, priority: 'High' },
  { id: '2', title: 'Solve 10 Practice MCQs on Scaled Dot-Product Attention', subject: 'Machine Learning', deadline: '2026-11-21', completed: false, priority: 'High' },
  { id: '3', title: 'Memorize Flashcards for Wave Function Normalization', subject: 'Quantum Physics', deadline: '2026-11-22', completed: false, priority: 'Medium' },
  { id: '4', title: 'Attempt 2-hour Full Mock Exam on Chapter 4', subject: 'Chemistry', deadline: '2026-11-24', completed: false, priority: 'High' },
];

export default function Planner() {
  const [tasks, setTasks] = useState(() => {
    const saved = localStorage.getItem('studymind_tasks');
    return saved ? JSON.parse(saved) : DEFAULT_TASKS;
  });

  const [documents, setDocuments] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);

  // New task form state
  const [newTitle, setNewTitle] = useState('');
  const [newSubject, setNewSubject] = useState('');
  const [newDeadline, setNewDeadline] = useState('');
  const [newPriority, setNewPriority] = useState('Medium');

  const [aiGenerating, setAiGenerating] = useState(false);

  useEffect(() => {
    localStorage.setItem('studymind_tasks', JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    loadDocs();
  }, []);

  const loadDocs = async () => {
    try {
      const d = await documentApi.getDocuments();
      setDocuments(d || []);
    } catch (e) {
      console.warn('Could not load docs for planner:', e);
    }
  };

  const handleToggleTask = (id) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t))
    );
  };

  const handleDeleteTask = (id) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  const handleAddTask = (e) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const task = {
      id: String(Date.now()),
      title: newTitle.trim(),
      subject: newSubject.trim() || 'General Study',
      deadline: newDeadline || new Date().toISOString().split('T')[0],
      priority: newPriority,
      completed: false,
    };

    setTasks((prev) => [task, ...prev]);
    setNewTitle('');
    setNewSubject('');
    setNewDeadline('');
    setShowAddModal(false);
  };

  const handleGenerateAiSchedule = () => {
    setAiGenerating(true);
    setTimeout(() => {
      const docTitles = documents.map((d) => d.filename.replace('.pdf', '')).slice(0, 3);
      const generated = [
        {
          id: String(Date.now() + 1),
          title: `Active recall session on ${docTitles[0] || 'Unit 5 Disaster Management'}`,
          subject: docTitles[0] || 'Curriculum Subject',
          deadline: new Date(Date.now() + 86400000).toISOString().split('T')[0],
          priority: 'High',
          completed: false,
        },
        {
          id: String(Date.now() + 2),
          title: `Solve timed MCQs for ${docTitles[1] || 'Attention Mechanisms'}`,
          subject: docTitles[1] || 'Core Subject',
          deadline: new Date(Date.now() + 172800000).toISOString().split('T')[0],
          priority: 'Medium',
          completed: false,
        },
        {
          id: String(Date.now() + 3),
          title: 'Comprehensive Review of Formula Cheat Sheets',
          subject: 'Exam Prep',
          deadline: new Date(Date.now() + 259200000).toISOString().split('T')[0],
          priority: 'High',
          completed: false,
        },
      ];

      setTasks((prev) => [...generated, ...prev]);
      setAiGenerating(false);
    }, 800);
  };

  const completedCount = tasks.filter((t) => t.completed).length;
  const progressPct = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-16 select-none">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl bg-[#1A1A1A] border border-[#262626] shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Personal Study{' '}
              <span className="font-serif italic font-normal text-white">Planner</span>
            </h1>
            <span className="text-[10px] font-semibold uppercase px-2.5 py-0.5 rounded-full bg-[#141414] text-white border border-[#262626]">
              Goal Tracker
            </span>
          </div>
          <p className="text-xs text-[#9A9A9A] mt-1">
            Organize chapters, track daily study milestones, and generate automated revision schedules.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleGenerateAiSchedule}
            disabled={aiGenerating}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1F1F1F] hover:bg-[#282828] border border-[#2E2E2E] text-white text-xs font-medium transition"
          >
            <Sparkles className="w-4 h-4 text-white" />
            <span>{aiGenerating ? 'Analyzing Docs...' : 'Generate AI Schedule'}</span>
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white hover:bg-neutral-200 text-black text-xs font-semibold transition shadow-sm active:scale-95"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Add Study Task</span>
          </button>
        </div>
      </div>

      {/* Progress Card */}
      <div className="p-6 rounded-2xl bg-[#1A1A1A] border border-[#262626] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#9A9A9A]">
            <Flame className="w-4 h-4 text-amber-400" />
            <span>Weekly Study Milestone</span>
          </div>
          <h3 className="text-lg font-bold text-white">
            {completedCount} of {tasks.length} Tasks Completed ({progressPct}%)
          </h3>
          <p className="text-xs text-[#9A9A9A]">
            Consistent active review boosts long-term recall by over 40% before exams.
          </p>
        </div>

        <div className="w-full sm:w-64 space-y-2">
          <div className="flex items-center justify-between text-xs font-mono text-[#9A9A9A]">
            <span>Overall Completion</span>
            <span className="text-emerald-400 font-bold">{progressPct}%</span>
          </div>
          <div className="w-full h-2.5 bg-[#0D0D0D] rounded-full overflow-hidden border border-[#262626]">
            <div
              className="h-full bg-white transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Task List */}
      <div className="rounded-2xl border border-[#262626] bg-[#1A1A1A] p-6 space-y-4 shadow-sm">
        <h3 className="text-base font-semibold text-white">Active Study Schedule & Deadlines</h3>

        {tasks.length === 0 ? (
          <div className="py-12 text-center text-xs text-[#9A9A9A]">
            No study tasks added yet. Click "Add Study Task" or "Generate AI Schedule" to get started!
          </div>
        ) : (
          <div className="space-y-2.5">
            {tasks.map((task) => (
              <div
                key={task.id}
                onClick={() => handleToggleTask(task.id)}
                className={`p-4 rounded-xl border transition flex items-center justify-between gap-4 cursor-pointer ${
                  task.completed
                    ? 'bg-[#0D0D0D]/60 border-[#262626] opacity-60'
                    : 'bg-[#0D0D0D] border-[#262626] hover:border-[#404040]'
                }`}
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <button
                    type="button"
                    className="text-[#9A9A9A] hover:text-white shrink-0"
                  >
                    {task.completed ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    ) : (
                      <Circle className="w-5 h-5 text-[#666666]" />
                    )}
                  </button>

                  <div className="min-w-0">
                    <p
                      className={`text-xs sm:text-sm font-semibold truncate ${
                        task.completed ? 'line-through text-[#666666]' : 'text-white'
                      }`}
                    >
                      {task.title}
                    </p>
                    <div className="flex items-center gap-3 text-[11px] text-[#9A9A9A] mt-0.5">
                      <span className="flex items-center gap-1">
                        <Tag className="w-3 h-3 text-white" />
                        {task.subject}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1 font-mono">
                        <Calendar className="w-3 h-3" />
                        Due {task.deadline}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span
                    className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full border ${
                      task.priority === 'High'
                        ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                        : 'bg-[#141414] text-white border-[#262626]'
                    }`}
                  >
                    {task.priority}
                  </span>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteTask(task.id);
                    }}
                    className="p-1.5 text-[#9A9A9A] hover:text-rose-400 transition rounded-lg hover:bg-[#141414]"
                    title="Delete task"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Task Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleAddTask}
            className="w-full max-w-md bg-[#141414] border border-[#262626] rounded-2xl p-6 space-y-4 shadow-2xl"
          >
            <h3 className="text-base font-bold text-white">Add New Study Task</h3>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#9A9A9A]">Task Title / Goal</label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                required
                placeholder="e.g. Read Chapter 3 on Scaled Attention"
                className="w-full bg-[#0D0D0D] border border-[#262626] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-white"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#9A9A9A]">Subject / Module</label>
              <input
                type="text"
                value={newSubject}
                onChange={(e) => setNewSubject(e.target.value)}
                placeholder="e.g. CS101 Machine Learning"
                className="w-full bg-[#0D0D0D] border border-[#262626] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#9A9A9A]">Target Deadline</label>
                <input
                  type="date"
                  value={newDeadline}
                  onChange={(e) => setNewDeadline(e.target.value)}
                  className="w-full bg-[#0D0D0D] border border-[#262626] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-white"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#9A9A9A]">Priority</label>
                <select
                  value={newPriority}
                  onChange={(e) => setNewPriority(e.target.value)}
                  className="w-full bg-[#0D0D0D] border border-[#262626] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-white"
                >
                  <option value="Low">Low Priority</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High Priority</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#262626]">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 rounded-lg bg-[#0D0D0D] hover:bg-[#1A1A1A] text-[#9A9A9A] hover:text-white text-xs font-medium transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-lg bg-white hover:bg-neutral-200 text-black text-xs font-semibold transition shadow-sm active:scale-95"
              >
                Add Task
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
