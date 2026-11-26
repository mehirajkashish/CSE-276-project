import React, { useState, useRef, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import {
  LayoutDashboard,
  MessageSquare,
  FolderOpen,
  BookOpen,
  Brain,
  ClipboardList,
  Layers,
  CalendarDays,
  Timer,
  ChartNoAxesCombined,
  History,
  Settings,
  UserRound,
  GraduationCap,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  LogOut,
  Sparkles,
  ShieldCheck,
  Cpu,
  Database,
  Moon,
  Sun,
  UserCheck,
  X
} from 'lucide-react';

const SECTIONS = [
  {
    title: 'Workspace',
    items: [
      { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/chat', label: 'AI Tutor', icon: MessageSquare, badge: 'AI' },
      { to: '/documents', label: 'My Documents', icon: FolderOpen },
      { to: '/viewer', label: 'Document Reader', icon: BookOpen },
    ],
  },
  {
    title: 'Learning Tools',
    items: [
      { to: '/study-tools', label: 'Study Toolkit', icon: Brain, badge: '10 Tools' },
      { to: '/exams', label: 'Exams & Quizzes', icon: ClipboardList, badge: 'Simulator' },
      { to: '/flashcards', label: 'Active Recall', icon: Layers },
      { to: '/planner', label: 'Study Planner', icon: CalendarDays },
      { to: '/focus', label: 'Focus Mode', icon: Timer },
    ],
  },
  {
    title: 'Personal',
    items: [
      { to: '/analytics', label: 'Learning Analytics', icon: ChartNoAxesCombined },
      { to: '/settings', label: 'Settings', icon: Settings },
      { to: '/profile', label: 'My Profile', icon: UserRound },
    ],
  },
];

export default function Sidebar({ health, mobileOpen = false, onCloseMobile }) {
  const { user, logout, isDemoMode } = useAuth();
  const { theme, toggleTheme, isDark } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  // Remember collapsed preference in localStorage
  const [collapsed, setCollapsed] = useState(() => {
    return localStorage.getItem('studymind_sidebar_collapsed') === 'true';
  });

  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem('studymind_sidebar_collapsed', String(next));
  };

  // Close mobile drawer on route change
  useEffect(() => {
    if (onCloseMobile) onCloseMobile();
  }, [location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close profile dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setProfileDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getInitials = (name) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  const renderSidebarBody = (isMobileDrawer = false) => {
    const isCollapsed = isMobileDrawer ? false : collapsed;
    return (
      <>
        {/* Circular Collapse Toggle Button on Border (Desktop only) */}
        {!isMobileDrawer && (
          <button
            onClick={toggleCollapsed}
            className="hidden lg:flex absolute -right-3 top-6 w-6 h-6 rounded-full bg-[#1A1A1A] hover:bg-[#242424] border border-[#262626] text-[#9A9A9A] hover:text-white items-center justify-center shadow-lg transition z-50 group"
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? (
              <ChevronRight className="w-3.5 h-3.5" />
            ) : (
              <ChevronLeft className="w-3.5 h-3.5" />
            )}
          </button>
        )}

        {/* Brand Header */}
        <div
          className={`h-16 sm:h-20 px-4 border-b border-[#222222] flex items-center ${
            isCollapsed ? 'justify-center' : 'justify-between'
          } shrink-0`}
        >
          <div
            onClick={() => { navigate('/'); if (isMobileDrawer && onCloseMobile) onCloseMobile(); }}
            className="flex items-center gap-3 cursor-pointer group shrink-0"
            title={isCollapsed ? 'StudyMind AI' : undefined}
          >
            {/* Minimal Geometric Logo */}
            <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-black font-black text-sm shadow-md group-hover:scale-105 transition-transform shrink-0">
              <GraduationCap className="w-4 h-4 text-current stroke-[2.5]" />
            </div>

            {!isCollapsed && (
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-sm tracking-tight text-white block">
                    StudyMind
                  </span>
                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-white text-black">
                    AI
                  </span>
                </div>
                <span className="text-[10px] text-[#666666] tracking-wider font-mono block">
                  LEARNING SPACE
                </span>
              </div>
            )}
          </div>

          {isMobileDrawer && onCloseMobile && (
            <button
              type="button"
              onClick={onCloseMobile}
              className="p-1.5 rounded-lg bg-[#1A1A1A] border border-[#262626] text-[#9A9A9A] hover:text-white transition"
              aria-label="Close navigation menu"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Navigation Links grouped into 3 sections */}
        <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto scrollbar-none">
          {SECTIONS.map((section, sIdx) => (
            <div key={sIdx} className="space-y-1">
              {!isCollapsed && (
                <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-[#666666]">
                  {section.title}
                </div>
              )}

              {section.items.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.exact}
                    onClick={() => { if (isMobileDrawer && onCloseMobile) onCloseMobile(); }}
                    title={isCollapsed ? item.label : undefined}
                    className={({ isActive }) =>
                      `flex items-center ${
                        isCollapsed ? 'justify-center p-2.5' : 'justify-between px-3 py-2.5'
                      } rounded-xl text-xs font-medium transition-all duration-150 group relative ${
                        isActive
                          ? 'bg-[#242424] text-white font-semibold shadow-sm'
                          : 'text-[#9A9A9A] hover:text-white hover:bg-[#1A1A1A]'
                      }`
                    }
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Icon className="w-4 h-4 shrink-0 transition-transform group-hover:scale-105" />
                      {!isCollapsed && <span className="truncate">{item.label}</span>}
                    </div>

                    {!isCollapsed && item.badge && (
                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-[#1A1A1A] text-white border border-[#262626] shrink-0">
                        {item.badge}
                      </span>
                    )}

                    {/* Floating tooltip when collapsed */}
                    {isCollapsed && (
                      <div className="absolute left-full ml-3 px-2.5 py-1 rounded-md bg-[#1A1A1A] border border-[#262626] text-white text-[11px] font-medium whitespace-nowrap shadow-2xl opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50">
                        {item.label}
                      </div>
                    )}
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>

        {/* System Status Card (when expanded) */}
        {!isCollapsed && (
          <div className="p-3 mx-3 mb-2 rounded-2xl bg-[#1A1A1A] border border-[#262626] text-[11px] space-y-1.5 shadow-sm">
            <div className="flex items-center justify-between font-semibold text-[#9A9A9A] text-[10px] uppercase tracking-wider">
              <span>RAG Pipeline</span>
              <span className="flex items-center gap-1 text-emerald-400 font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Active
              </span>
            </div>

            <div className="flex items-center justify-between text-white">
              <span className="flex items-center gap-1.5 text-[#9A9A9A]">
                <Database className="w-3 h-3 text-white" />
                Vector Index
              </span>
              <span className="font-mono text-[10px] text-white font-medium">
                {health?.vector_store?.type || 'FAISS Cosine'}
              </span>
            </div>

            <div className="flex items-center justify-between text-white">
              <span className="flex items-center gap-1.5 text-[#9A9A9A]">
                <Cpu className="w-3 h-3 text-white" />
                AI Intelligence
              </span>
              <span className="font-mono text-[10px] text-white font-medium truncate max-w-[100px]">
                {health?.llm_model || 'StudyMind Flash'}
              </span>
            </div>
          </div>
        )}

        {/* User Profile Section with Dropdown at Bottom */}
        <div className="p-3 border-t border-[#222222] relative shrink-0" ref={isMobileDrawer ? undefined : dropdownRef}>
          {/* Profile Trigger */}
          <div
            onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
            className={`flex items-center ${
              isCollapsed ? 'justify-center p-1' : 'justify-between p-2'
            } rounded-xl bg-[#1A1A1A] hover:bg-[#242424] border border-[#262626] cursor-pointer transition select-none group`}
          >
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div className="w-7 h-7 rounded-lg bg-white flex items-center justify-center font-bold text-xs text-black shadow-sm shrink-0">
                {getInitials(user?.full_name)}
              </div>

              {!isCollapsed && (
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-white truncate" title={user?.full_name}>
                      {user?.full_name || 'Academic User'}
                    </span>
                    {isDemoMode && (
                      <span className="text-[8px] font-bold px-1.5 py-0.2 rounded-full bg-white/10 text-white border border-white/20 shrink-0">
                        Demo
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-[#9A9A9A] truncate font-mono" title={user?.email}>
                    {user?.email || 'scholar@studymind.ai'}
                  </p>
                </div>
              )}
            </div>

            {!isCollapsed && (
              <div className="p-1 text-[#9A9A9A] group-hover:text-white transition shrink-0">
                <ChevronUp className={`w-3.5 h-3.5 transition-transform duration-200 ${profileDropdownOpen ? 'rotate-180' : ''}`} />
              </div>
            )}
          </div>

          {/* Profile Dropdown Menu */}
          {profileDropdownOpen && (
            <div
              className={`absolute bottom-full ${
                isCollapsed ? 'left-full ml-3' : 'left-3 right-3'
              } mb-2 bg-[#141414] border border-[#262626] rounded-2xl shadow-2xl p-2 z-50 text-xs text-white space-y-1 backdrop-blur-xl min-w-[210px]`}
            >
              <div className="px-3 py-2 border-b border-[#222222]">
                <p className="font-semibold text-white truncate">{user?.full_name || 'Academic Scholar'}</p>
                <p className="text-[10px] text-[#9A9A9A] font-mono truncate">{user?.email}</p>
              </div>

              <button
                onClick={() => {
                  setProfileDropdownOpen(false);
                  if (isMobileDrawer && onCloseMobile) onCloseMobile();
                  navigate('/profile');
                }}
                className="w-full px-3 py-2 rounded-xl text-left hover:bg-[#1A1A1A] transition flex items-center gap-2.5 text-[#9A9A9A] hover:text-white"
              >
                <UserRound className="w-3.5 h-3.5 text-white" />
                <span>My Profile & Credentials</span>
              </button>

              <button
                onClick={() => {
                  setProfileDropdownOpen(false);
                  if (isMobileDrawer && onCloseMobile) onCloseMobile();
                  navigate('/settings');
                }}
                className="w-full px-3 py-2 rounded-xl text-left hover:bg-[#1A1A1A] transition flex items-center gap-2.5 text-[#9A9A9A] hover:text-white"
              >
                <Settings className="w-3.5 h-3.5 text-white" />
                <span>Account & API Settings</span>
              </button>

              <button
                onClick={() => {
                  setProfileDropdownOpen(false);
                  if (isMobileDrawer && onCloseMobile) onCloseMobile();
                  navigate('/analytics');
                }}
                className="w-full px-3 py-2 rounded-xl text-left hover:bg-[#1A1A1A] transition flex items-center gap-2.5 text-[#9A9A9A] hover:text-white"
              >
                <ChartNoAxesCombined className="w-3.5 h-3.5 text-emerald-400" />
                <span>Learning Analytics</span>
              </button>

              {/* Theme Toggle in Dropdown */}
              <button
                onClick={() => {
                  toggleTheme();
                }}
                className="w-full px-3 py-2 rounded-xl text-left hover:bg-[#1A1A1A] transition flex items-center justify-between text-[#9A9A9A] hover:text-white"
              >
                <div className="flex items-center gap-2.5">
                  {isDark ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-[#0F172A]" />}
                  <span>Theme: {isDark ? 'Obsidian Dark' : 'Academic Light'}</span>
                </div>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#1F1F1F] text-white border border-[#2E2E2E]">
                  {isDark ? 'Dark' : 'Light'}
                </span>
              </button>

              <div className="pt-1 border-t border-[#222222]">
                <button
                  onClick={() => {
                    setProfileDropdownOpen(false);
                    if (isMobileDrawer && onCloseMobile) onCloseMobile();
                    logout();
                    navigate('/login');
                  }}
                  className="w-full px-3 py-2 rounded-xl text-left hover:bg-rose-500/15 transition flex items-center gap-2.5 text-rose-400 hover:text-rose-300 font-medium"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Logout Session</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </>
    );
  };

  return (
    <>
      {/* Desktop Collapsible Sidebar (lg+) */}
      <aside
        className={`${
          collapsed ? 'w-[72px]' : 'w-[260px]'
        } hidden lg:flex shrink-0 bg-[#141414] border-r border-[#222222] flex-col h-[100dvh] select-none z-30 transition-all duration-300 relative`}
      >
        {renderSidebarBody(false)}
      </aside>

      {/* Mobile & Tablet Slide-Over Navigation Drawer (< lg) */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm"
            onClick={onCloseMobile}
          />
          <aside className="relative z-10 w-72 max-w-[85vw] bg-[#141414] border-r border-[#222222] flex flex-col h-[100dvh] select-none shadow-2xl animate-fade-in-up">
            {renderSidebarBody(true)}
          </aside>
        </div>
      )}
    </>
  );
}
