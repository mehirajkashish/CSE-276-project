import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  UploadCloud,
  MessageSquarePlus,
  Sparkles,
  BookOpen,
  Search,
  Bell,
  UserRound,
  Check,
  Flame,
  ChevronRight,
  Sun,
  Moon,
  Menu
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

export default function Navbar({ title, onOpenMobileNav, onOpenUpload, onNewChat, onOpenCommandPalette, stats }) {
  const { user } = useAuth();
  const { theme, toggleTheme, isDark } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const [showNotifications, setShowNotifications] = useState(false);

  const getBreadcrumb = () => {
    const path = location.pathname;
    if (path === '/') return 'Workspace / Dashboard';
    if (path === '/chat') return 'Workspace / AI Tutor';
    if (path === '/documents') return 'Workspace / My Documents';
    if (path === '/viewer') return 'Workspace / Document Reader';
    if (path === '/study-tools' || path.startsWith('/study-tools/') || path.startsWith('/workspace/study-tools')) return 'Learning Tools / Study Toolkit';
    if (path === '/exams') return 'Learning Tools / Exams & Quizzes';
    if (path === '/flashcards') return 'Learning Tools / Flashcards';
    if (path === '/planner') return 'Learning Tools / Study Planner';
    if (path === '/focus') return 'Learning Tools / Focus Mode';
    if (path === '/analytics') return 'Personal / Learning Analytics';
    if (path === '/settings') return 'Personal / Settings';
    if (path === '/profile') return 'Personal / My Profile';
    return 'StudyMind AI';
  };

  const getInitials = (name) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  return (
    <header className="h-14 sm:h-16 border-b border-[#222222] bg-[#141414] backdrop-blur-md px-3 sm:px-6 flex items-center justify-between gap-2 sticky top-0 z-20 select-none shrink-0">
      {/* Mobile Menu + Title & Breadcrumbs */}
      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
        {onOpenMobileNav && (
          <button
            type="button"
            onClick={onOpenMobileNav}
            className="lg:hidden p-2 rounded-lg bg-[#1A1A1A] hover:bg-[#242424] border border-[#262626] text-[#9A9A9A] hover:text-white transition shrink-0"
            aria-label="Open navigation menu"
            title="Menu"
          >
            <Menu className="w-4 h-4" />
          </button>
        )}
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-sm sm:text-base font-bold text-white tracking-tight truncate">
              {title}
            </h1>
            <span className="hidden xl:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] bg-[#1A1A1A] text-[#9A9A9A] border border-[#262626]">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              RAG Pipeline Ready
            </span>
          </div>
          <p className="text-[10px] text-[#666666] hidden sm:flex items-center gap-1 font-mono">
            {getBreadcrumb()}
          </p>
        </div>
      </div>

      {/* Center / Right Actions */}
      <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
        {/* Global Search / Command Palette (Ctrl + K) Button */}
        <button
          onClick={onOpenCommandPalette}
          className="flex items-center gap-2 p-2 sm:px-3 sm:py-1.5 rounded-lg bg-[#141414] border border-[#222222] hover:border-[#3A3A3A] text-[#9A9A9A] hover:text-white text-xs transition shadow-sm group"
          title="Search or jump to (Ctrl + K)"
        >
          <Search className="w-3.5 h-3.5 text-[#666666] group-hover:text-white transition" />
          <span className="hidden md:inline font-medium">Search or jump to...</span>
          <kbd className="hidden sm:inline-block px-1.5 py-0.2 rounded bg-[#1A1A1A] text-[10px] font-mono text-[#9A9A9A] border border-[#262626]">
            Ctrl K
          </kbd>
        </button>

        {/* Upload PDF */}
        <button
          onClick={onOpenUpload}
          className="inline-flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-white hover:bg-neutral-200 text-black shadow-sm transition active:scale-95 shrink-0"
          title="Upload PDF"
        >
          <UploadCloud className="w-3.5 h-3.5 stroke-[2.5]" />
          <span className="hidden sm:inline">Upload PDF</span>
        </button>

        {/* New Chat */}
        <button
          onClick={onNewChat}
          className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-medium rounded-lg bg-[#1F1F1F] hover:bg-[#282828] text-white border border-[#2E2E2E] transition active:scale-95 shrink-0"
          title="New Chat"
        >
          <MessageSquarePlus className="w-3.5 h-3.5 text-[#9A9A9A]" />
          <span className="hidden sm:inline">New Chat</span>
        </button>

        {/* Notification Bell */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-2 rounded-lg text-[#9A9A9A] hover:text-white hover:bg-[#1A1A1A] border border-transparent hover:border-[#262626] transition relative"
            title="Study Reminders & Notifications"
          >
            <Bell className="w-4 h-4" />
            <span className="w-2 h-2 rounded-full bg-white absolute top-1.5 right-1.5 ring-2 ring-[#0D0D0D]" />
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-[min(18rem,calc(100vw-1.5rem))] bg-[#141414] border border-[#262626] rounded-2xl shadow-2xl p-3 z-50 text-xs text-white space-y-2 animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between border-b border-[#222222] pb-2">
                <span className="font-bold text-white">Study Notifications</span>
                <span className="text-[10px] text-[#9A9A9A] font-mono">2 New</span>
              </div>
              <div className="space-y-2">
                <div className="p-2.5 rounded-xl bg-[#1A1A1A] border border-[#262626] space-y-0.5">
                  <div className="flex items-center gap-1.5 text-amber-400 font-semibold text-[11px]">
                    <Flame className="w-3 h-3" />
                    <span>5-Day Study Streak Active!</span>
                  </div>
                  <p className="text-[10px] text-[#9A9A9A]">Complete 1 practice MCQ today to keep your streak going.</p>
                </div>
                <div className="p-2.5 rounded-xl bg-[#1A1A1A] border border-[#262626] space-y-0.5">
                  <div className="flex items-center gap-1.5 text-white font-semibold text-[11px]">
                    <BookOpen className="w-3 h-3" />
                    <span>Spaced Repetition Due</span>
                  </div>
                  <p className="text-[10px] text-[#94A3B8]">Review 3 unmastered flashcards in Unit 5 Disaster Management.</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Theme Toggle Mode Button (Obsidian Dark / Academic Light) */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg text-[#9A9A9A] hover:text-white hover:bg-[#1A1A1A] border border-[#262626] transition active:scale-95 flex items-center justify-center shrink-0"
          title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
          aria-label="Toggle Dark and Light Mode"
        >
          {isDark ? (
            <Sun className="w-4 h-4 text-amber-400 animate-in spin-in-180 duration-300" />
          ) : (
            <Moon className="w-4 h-4 text-[#0F172A] animate-in spin-in-180 duration-300" />
          )}
        </button>

        {/* User Avatar linking to profile */}
        <button
          onClick={() => navigate('/profile')}
          className="w-8 h-8 rounded-lg bg-white text-black border border-[#262626] flex items-center justify-center text-xs font-bold shadow-sm hover:bg-neutral-200 transition shrink-0"
          title="Open My Profile & Credentials"
        >
          {getInitials(user?.full_name)}
        </button>
      </div>
    </header>
  );
}
