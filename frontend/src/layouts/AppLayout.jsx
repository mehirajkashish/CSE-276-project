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
        return 'StudyMind AI';
    }
  };

  const handleUploadSuccess = () => {
    fetchHealthAndStats();
  };

  const handleNewChat = () => {
    navigate('/chat?new=true');
  };

  return (
    <div className="flex h-screen bg-[#0D0D0D] text-white overflow-hidden font-sans select-none">
      {/* Sidebar */}
      <Sidebar health={health} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden min-w-0 bg-[#0D0D0D]">
        {/* Demo Mode Notification Bar */}
        {isDemoMode && (
          <div className="bg-[#141414] border-b border-[#222222] px-6 py-2 text-xs flex items-center justify-between text-[#9A9A9A] z-30 shrink-0">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              <span className="font-semibold text-white">Interactive Demo Mode</span>
              <span className="hidden sm:inline text-[#666666] text-[11px]">
                • Pre-loaded sample academic curriculum
              </span>
            </div>
            <button
              onClick={() => {
                exitDemoMode();
                navigate('/login');
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white hover:bg-neutral-200 text-black text-[11px] font-semibold transition shadow-sm active:scale-95"
            >
              <LogIn className="w-3 h-3 text-current" />
              <span>Sign In with Account</span>
            </button>
          </div>
        )}

        <Navbar
          title={getPageTitle()}
          onOpenUpload={() => setIsUploadOpen(true)}
          onNewChat={handleNewChat}
          onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
          stats={stats}
        />

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-[#0D0D0D]">
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
