import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import UploadModal from '../components/UploadModal';
import CommandPalette from '../components/CommandPalette';
import { useAuth } from '../context/AuthContext';
import { systemApi, dashboardApi } from '../services/api';
import { Sparkles, LogIn } from 'lucide-react';

export default function AppLayout() {
  const { isDemoMode, exitDemoMode } = useAuth();
  const [health, setHealth] = useState(null);
  const [stats, setStats] = useState({ total_documents: 0, total_chunks: 0 });
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const fetchHealthAndStats = async () => {
    try {
      const [h, s] = await Promise.all([
        systemApi.getHealth().catch(() => null),
        dashboardApi.getStats().catch(() => null),
      ]);
      if (h) setHealth(h);
      if (s) {
        setStats({
          total_documents: s.total_documents || 0,
          total_chunks: s.total_chunks || 0,
        });
      }
    } catch (e) {
      console.error('Failed to load system health/stats:', e);
    }
  };

  useEffect(() => {
    fetchHealthAndStats();
    const interval = setInterval(fetchHealthAndStats, 15000);
    return () => clearInterval(interval);
  }, []);

  const getPageTitle = () => {
    switch (location.pathname) {
      case '/':
        return 'Study Dashboard';
      case '/documents':
        return 'Document Library';
      case '/chat':
        return 'AI Study Assistant & Tutor';
      case '/viewer':
        return 'Document Reader & Viewer';
      case '/study-tools':
        return 'AI Study Toolkit (10 Tools)';
      case '/exams':
        return 'Exams & Quiz Evaluation';
      case '/flashcards':
        return 'Active Recall Flashcards';
      case '/planner':
        return 'Personal Study Planner';
      case '/focus':
        return 'Focus Mode & Pomodoro';
      case '/analytics':
        return 'Learning Analytics & Activity';
      case '/settings':
        return 'Settings & Configuration';
      case '/profile':
        return 'My Profile & Credentials';
      default:
        if (location.pathname.startsWith('/study-tools/') || location.pathname.startsWith('/workspace/study-tools/')) {
          return 'AI Study Toolkit';
        }
        return 'StudyMind AI';
    }
  };

  const handleUploadSuccess = () => {
    fetchHealthAndStats();
  };

  const handleNewChat = () => {
    navigate('/chat?new=true');
  };

  const isChatRoute = location.pathname === '/chat' || location.pathname === '/workspace/chat';

  return (
    <div className="flex h-[100dvh] bg-[#0D0D0D] text-white overflow-hidden font-sans select-none">
      {/* Sidebar (Desktop fixed + Mobile/Tablet slide-over drawer) */}
      <Sidebar
        health={health}
        mobileOpen={mobileNavOpen}
        onCloseMobile={() => setMobileNavOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-[100dvh] overflow-hidden min-w-0 bg-[#0D0D0D]">
        {/* Demo Mode Notification Bar */}
        {isDemoMode && (
          <div className="bg-[#141414] border-b border-[#222222] px-3 sm:px-6 py-2 text-xs flex items-center justify-between gap-2 text-[#9A9A9A] z-30 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse shrink-0" />
              <span className="font-semibold text-white truncate">Demo Mode</span>
              <span className="hidden sm:inline text-[#666666] text-[11px]">
                • Pre-loaded sample academic curriculum
              </span>
            </div>
            <button
              onClick={() => {
                exitDemoMode();
                navigate('/login');
              }}
              className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-lg bg-white hover:bg-neutral-200 text-black text-[11px] font-semibold transition shadow-sm active:scale-95 shrink-0"
            >
              <LogIn className="w-3 h-3 text-current" />
              <span>Sign In</span>
            </button>
          </div>
        )}

        <Navbar
          title={getPageTitle()}
          onOpenMobileNav={() => setMobileNavOpen(true)}
          onOpenUpload={() => setIsUploadOpen(true)}
          onNewChat={handleNewChat}
          onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
          stats={stats}
        />

        <main className={`flex-1 overflow-y-auto bg-[#0D0D0D] ${isChatRoute ? 'p-0 sm:p-4 lg:p-6 overflow-hidden' : 'p-3 sm:p-5 lg:p-8'}`}>
          <Outlet context={{ refreshStats: fetchHealthAndStats, openUpload: () => setIsUploadOpen(true) }} />
        </main>
      </div>

      {/* Universal Upload Modal */}
      <UploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onUploadSuccess={handleUploadSuccess}
      />

      {/* Global Search / Command Palette (Ctrl + K) */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={setIsCommandPaletteOpen}
        onOpenUpload={() => setIsUploadOpen(true)}
      />
    </div>
  );
}
