import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  MessageSquare,
  BookOpen,
  Brain,
  ClipboardList,
  Layers,
  CalendarDays,
  Timer,
  ChartNoAxesCombined,
  Settings,
  UserRound,
  FileText,
  UploadCloud,
  X,
  ArrowRight
} from 'lucide-react';
import { documentApi } from '../services/api';

export default function CommandPalette({ isOpen, onClose, onOpenUpload }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [documents, setDocuments] = useState([]);

  useEffect(() => {
    if (isOpen) {
      documentApi.getDocuments().then((d) => setDocuments(d || [])).catch(() => {});
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        onClose ? onClose(!isOpen) : null;
      }
      if (e.key === 'Escape' && isOpen) {
        onClose(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const quickActions = [
    { label: 'AI Tutor Chat', desc: 'Ask questions grounded in your course materials', icon: MessageSquare, path: '/chat' },
    { label: 'Study Toolkit (10 Tools)', desc: 'Generate summaries, mind maps, and notes', icon: Brain, path: '/study-tools' },
    { label: 'Exams & Quizzes', desc: 'Timed mock exams with negative marking', icon: ClipboardList, path: '/exams' },
    { label: 'Active Recall Flashcards', desc: 'Spaced repetition decks with flip cards', icon: Layers, path: '/flashcards' },
    { label: 'Study Planner', desc: 'Weekly schedule and daily study milestones', icon: CalendarDays, path: '/planner' },
    { label: 'Focus Mode (Pomodoro)', desc: '25m focus timer with 40Hz binaural audio', icon: Timer, path: '/focus' },
    { label: 'Learning Analytics', desc: 'Study streak and subject mastery metrics', icon: ChartNoAxesCombined, path: '/analytics' },
    { label: 'My Profile & Credentials', desc: 'Change email, password, and preferences', icon: UserRound, path: '/profile' },
  ];

  const filteredActions = quickActions.filter(
    (a) => a.label.toLowerCase().includes(query.toLowerCase()) || a.desc.toLowerCase().includes(query.toLowerCase())
  );

  const filteredDocs = documents.filter((d) =>
    d.filename.toLowerCase().includes(query.toLowerCase())
  );

  const handleSelect = (path) => {
    onClose(false);
    navigate(path);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-start justify-center pt-20 p-4 select-none">
      <div className="w-full max-w-xl bg-[#141414] border border-[#262626] rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Search Input Bar */}
        <div className="p-3.5 border-b border-[#222222] flex items-center gap-3">
          <Search className="w-4 h-4 text-[#666666] shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command, search documents, or jump to tool..."
            autoFocus
            className="flex-1 bg-transparent text-xs sm:text-sm text-white placeholder-[#666666] focus:outline-none"
          />
          <kbd className="hidden sm:inline-block px-2 py-0.5 rounded bg-[#1A1A1A] text-[10px] font-mono text-[#9A9A9A] border border-[#262626]">
            ESC
          </kbd>
          <button onClick={() => onClose(false)} className="text-[#9A9A9A] hover:text-white p-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results List */}
        <div className="max-h-96 overflow-y-auto p-2 space-y-3 text-xs scrollbar-none">
          {/* Action shortcuts */}
          <div className="space-y-1">
            <span className="px-3 text-[10px] font-bold uppercase tracking-wider text-[#666666] block">
              Commands & Modules
            </span>
            {filteredActions.map((item, idx) => {
              const Icon = item.icon;
              return (
                <button
                  key={idx}
                  onClick={() => handleSelect(item.path)}
                  className="w-full p-2.5 rounded-xl hover:bg-[#1A1A1A] transition flex items-center justify-between text-left group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-[#1A1A1A] border border-[#262626] flex items-center justify-center text-white shrink-0 group-hover:bg-white group-hover:text-black transition">
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-white truncate">{item.label}</p>
                      <p className="text-[11px] text-[#9A9A9A] truncate">{item.desc}</p>
                    </div>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-[#666666] group-hover:text-white group-hover:translate-x-1 transition shrink-0" />
                </button>
              );
            })}
          </div>

          {/* Upload Document Quick Action */}
          <div className="space-y-1 pt-1 border-t border-[#222222]">
            <span className="px-3 text-[10px] font-bold uppercase tracking-wider text-[#666666] block">
              Quick Actions
            </span>
            <button
              onClick={() => {
                onClose(false);
                if (onOpenUpload) onOpenUpload();
              }}
              className="w-full p-2.5 rounded-xl hover:bg-[#1A1A1A] transition flex items-center justify-between text-left group"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-white flex items-center justify-center text-black shrink-0">
                  <UploadCloud className="w-3.5 h-3.5 stroke-[2.5]" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-white truncate">Upload New Study Document</p>
                  <p className="text-[11px] text-[#9A9A9A] truncate">Index PDF into FAISS semantic vector memory</p>
                </div>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-[#666666] group-hover:text-white group-hover:translate-x-1 transition shrink-0" />
            </button>
          </div>

          {/* Documents matched */}
          {filteredDocs.length > 0 && (
            <div className="space-y-1 pt-1 border-t border-[#222222]">
              <span className="px-3 text-[10px] font-bold uppercase tracking-wider text-[#666666] block">
                Study Documents ({filteredDocs.length})
              </span>
              {filteredDocs.map((doc) => (
                <button
                  key={doc.id}
                  onClick={() => handleSelect(`/viewer?doc=${doc.id}`)}
                  className="w-full p-2.5 rounded-xl hover:bg-[#1A1A1A] transition flex items-center justify-between text-left group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <FileText className="w-4 h-4 text-white shrink-0" />
                    <span className="text-white truncate font-medium">{doc.filename}</span>
                  </div>
                  <span className="text-[10px] font-mono text-[#9A9A9A] shrink-0">
                    {doc.total_pages || 1} pages
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
