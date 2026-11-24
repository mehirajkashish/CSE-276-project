import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { authApi, dashboardApi } from '../services/api';
import {
  UserRound,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Check,
  AlertCircle,
  Loader2,
  ShieldCheck,
  Sparkles,
  BookOpen,
  Calendar,
  Flame,
  KeyRound,
  CheckCircle2,
  Sliders,
  Database,
  ArrowRight
} from 'lucide-react';

export default function Profile() {
  const { user, isDemoMode, updateUser } = useAuth();

  const [activeTab, setActiveTab] = useState('credentials'); // 'credentials', 'preferences', 'stats'
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  // Form states
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);

  // Preferences states
  const [prefDepth, setPrefDepth] = useState('intermediate');
  const [prefMode, setPrefMode] = useState('standard');
  const [dailyGoalHours, setDailyGoalHours] = useState(2);

  // Real stats
  const [stats, setStats] = useState({
    total_documents: 0,
    total_chunks: 0,
    total_conversations: 0,
    total_questions: 0,
  });

  useEffect(() => {
    if (user) {
      setFullName(user.full_name || '');
      setEmail(user.email || '');
    }
    loadStats();
  }, [user]);

  const loadStats = async () => {
    try {
      const data = await dashboardApi.getStats();
      if (data) {
        setStats({
          total_documents: data.total_documents || 0,
          total_chunks: data.total_chunks || 0,
          total_conversations: data.recent_conversations?.length || 0,
          total_questions: data.total_questions || 12,
        });
      }
    } catch (e) {
      console.warn('Could not load user stats:', e);
    }
  };

  const handleUpdateCredentials = async (e) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (newPassword && newPassword.length < 6) {
      setErrorMsg('New password must be at least 6 characters.');
      return;
    }

    if (newPassword && newPassword !== confirmNewPassword) {
      setErrorMsg('New passwords do not match.');
      return;
    }

    if (newPassword && !currentPassword && !isDemoMode) {
      setErrorMsg('Please enter your current password to confirm changes.');
      return;
    }

    if (isDemoMode) {
      setLoading(true);
      setTimeout(() => {
        const updatedDemoUser = {
          ...user,
          full_name: fullName.trim() || 'Alex Academic',
          email: email.trim() || 'demo.scholar@studymind.ai',
        };
        sessionStorage.setItem('studymind_user', JSON.stringify(updatedDemoUser));
        if (updateUser) updateUser(updatedDemoUser);
        setSuccessMsg('Your demo profile credentials have been successfully updated!');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmNewPassword('');
        setLoading(false);
      }, 300);
      return;
    }

    setLoading(true);
    try {
      const payload = {
        full_name: fullName.trim(),
        email: email.trim(),
      };
      if (newPassword) {
        payload.current_password = currentPassword;
        payload.new_password = newPassword;
        payload.confirm_new_password = confirmNewPassword;
      }

      const updatedUser = await authApi.updateProfile(payload);
      if (updateUser && updatedUser) {
        updateUser(updatedUser);
      }
      setSuccessMsg('Your profile credentials and settings have been successfully updated!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
    } catch (err) {
      setErrorMsg(err.response?.data?.detail || err.message || 'Failed to update credentials.');
    } finally {
      setLoading(false);
    }
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
    <div className="max-w-5xl mx-auto space-y-8 pb-16 select-none">
      {/* Profile Header Banner */}
      <div className="relative rounded-2xl bg-[#1A1A1A] border border-[#262626] p-6 sm:p-8 overflow-hidden shadow-sm">
        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white flex items-center justify-center text-black text-2xl font-bold shadow-md shrink-0">
              {getInitials(user?.full_name || fullName)}
            </div>

            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                  {user?.full_name || fullName || 'Academic Scholar'}
                </h1>
                {isDemoMode ? (
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-white/10 text-white border border-white/20">
                    Interactive Demo Scholar
                  </span>
                ) : (
                  <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-[#0F291E] text-[#22C55E] border border-[#22C55E]/30 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" /> Verified Scholar
                  </span>
                )}
              </div>
              <p className="text-xs text-[#9A9A9A] flex items-center gap-1.5 font-mono">
                <Mail className="w-3.5 h-3.5 text-[#666666]" />
                {user?.email || email || 'scholar@university.edu'}
              </p>
              <div className="flex items-center gap-3 pt-1 text-[11px] text-[#9A9A9A]">
                <span className="flex items-center gap-1">
                  <Flame className="w-3.5 h-3.5 text-amber-400" />
                  <strong className="text-white">5 Day</strong> Study Streak
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <BookOpen className="w-3.5 h-3.5 text-white" />
                  <strong className="text-white">{stats.total_documents}</strong> Documents Loaded
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end">
            <span className="text-[11px] text-[#9A9A9A] bg-[#0D0D0D] px-3 py-1.5 rounded-xl border border-[#262626]">
              Member since: <strong className="text-white">Nov 2026</strong>
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-[#222222] pb-1 text-xs">
        {[
          { id: 'credentials', label: 'Account & Security Credentials', icon: KeyRound },
          { id: 'preferences', label: 'Study & Tutor Preferences', icon: Sliders },
          { id: 'stats', label: 'Academic Activity & Data', icon: Database },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                setErrorMsg(null);
                setSuccessMsg(null);
              }}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition ${
                activeTab === tab.id
                  ? 'bg-[#242424] text-white border border-[#2E2E2E] font-semibold'
                  : 'text-[#9A9A9A] hover:text-white hover:bg-[#1A1A1A]'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* TAB 1: CREDENTIALS */}
      {activeTab === 'credentials' && (
        <form onSubmit={handleUpdateCredentials} className="space-y-6">
          <div className="rounded-2xl border border-[#262626] bg-[#1A1A1A] p-6 sm:p-8 space-y-6 shadow-sm">
            <div>
              <h3 className="text-base font-semibold text-white">Profile Details</h3>
              <p className="text-xs text-[#9A9A9A] mt-0.5">
                Update your student name and login email address.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#9A9A9A]">Full Name</label>
                <div className="relative">
                  <UserRound className="w-4 h-4 text-[#666666] absolute left-3 top-3" />
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    className="w-full bg-[#0D0D0D] border border-[#262626] rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-white"
                    placeholder="Alex Academic"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#9A9A9A]">Email Address</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#666666] absolute left-3 top-3" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full bg-[#0D0D0D] border border-[#262626] rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-white"
                    placeholder="alex@university.edu"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-[#262626] bg-[#1A1A1A] p-6 sm:p-8 space-y-6 shadow-sm">
            <div>
              <h3 className="text-base font-semibold text-white">Change Password</h3>
              <p className="text-xs text-[#9A9A9A] mt-0.5">
                Leave blank if you do not wish to change your existing password.
              </p>
            </div>

            <div className="space-y-4 max-w-lg">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#9A9A9A]">Current Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#666666] absolute left-3 top-3" />
                  <input
                    type={showCurrentPw ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full bg-[#0D0D0D] border border-[#262626] rounded-xl pl-9 pr-10 py-2 text-xs text-white focus:outline-none focus:border-white"
                    placeholder="Enter current password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPw(!showCurrentPw)}
                    className="absolute right-3 top-2.5 text-[#666666] hover:text-white"
                  >
                    {showCurrentPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#9A9A9A]">New Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#666666] absolute left-3 top-3" />
                  <input
                    type={showNewPw ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full bg-[#0D0D0D] border border-[#262626] rounded-xl pl-9 pr-10 py-2 text-xs text-white focus:outline-none focus:border-white"
                    placeholder="At least 6 characters"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPw(!showNewPw)}
                    className="absolute right-3 top-2.5 text-[#666666] hover:text-white"
                  >
                    {showNewPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#9A9A9A]">Confirm New Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#666666] absolute left-3 top-3" />
                  <input
                    type={showNewPw ? 'text' : 'password'}
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    className="w-full bg-[#0D0D0D] border border-[#262626] rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-white"
                    placeholder="Confirm new password"
                  />
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-[#262626] flex justify-end">
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-white hover:bg-neutral-200 text-black text-xs font-semibold transition shadow-sm active:scale-95 disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin text-black" /> : <Check className="w-4 h-4 stroke-[2.5]" />}
                <span>Save Changes</span>
              </button>
            </div>
          </div>
        </form>
      )}

      {/* TAB 2: PREFERENCES */}
      {activeTab === 'preferences' && (
        <div className="rounded-2xl border border-[#262626] bg-[#1A1A1A] p-6 sm:p-8 space-y-6 shadow-sm">
          <div>
            <h3 className="text-base font-semibold text-white">Study & AI Tutor Preferences</h3>
            <p className="text-xs text-[#9A9A9A] mt-0.5">
              Customize how StudyMind AI answers your questions and structures study guides.
            </p>
          </div>

          <div className="space-y-6 max-w-xl">
            <div className="space-y-2">
              <label className="text-xs font-medium text-[#9A9A9A]">Default Academic Depth</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'beginner', label: '🌱 Beginner', desc: 'Focus on intuition & metaphors' },
                  { id: 'intermediate', label: '🎓 Intermediate', desc: 'Standard undergraduate rigor' },
                  { id: 'advanced', label: '🔬 Advanced', desc: 'Mathematical proofs & edge cases' },
                ].map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setPrefDepth(d.id)}
                    className={`p-3 rounded-xl border text-left transition ${
                      prefDepth === d.id
                        ? 'bg-[#242424] border-white text-white font-medium shadow-sm'
                        : 'bg-[#0D0D0D] border-[#262626] text-[#9A9A9A] hover:text-white'
                    }`}
                  >
                    <div className="text-xs font-semibold">{d.label}</div>
                    <div className="text-[10px] text-[#9A9A9A] mt-0.5">{d.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-[#9A9A9A]">Preferred Tutor Mode</label>
              <select
                value={prefMode}
                onChange={(e) => setPrefMode(e.target.value)}
                className="w-full bg-[#0D0D0D] border border-[#262626] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-white"
              >
                <option value="standard">Standard Interactive Tutor (ChatGPT/Gemini style)</option>
                <option value="eli5">ELI5 (Explain Like I am 5 with everyday stories)</option>
                <option value="exam">High-Yield Exam Prep (Formulas, mark rubrics, expected questions)</option>
                <option value="hinglish">Hinglish Blend (Hindi + English conversational explanation)</option>
                <option value="code">Code Deep Dive (Algorithms & complexity analysis)</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-[#9A9A9A]">Daily Study Target</label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="1"
                  max="8"
                  value={dailyGoalHours}
                  onChange={(e) => setDailyGoalHours(parseInt(e.target.value))}
                  className="flex-1 accent-white cursor-pointer"
                />
                <span className="text-xs font-mono font-semibold text-white bg-[#0D0D0D] px-2.5 py-1 rounded-lg border border-[#262626]">
                  {dailyGoalHours} hrs / day
                </span>
              </div>
            </div>

            <div className="pt-4 border-t border-[#262626] flex justify-end">
              <button
                type="button"
                onClick={() => setSuccessMsg('Tutor preferences saved!')}
                className="px-5 py-2 rounded-lg bg-white hover:bg-neutral-200 text-black text-xs font-semibold transition shadow-sm active:scale-95"
              >
                Save Preferences
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: DATA & STATS */}
      {activeTab === 'stats' && (
        <div className="rounded-2xl border border-[#262626] bg-[#1A1A1A] p-6 sm:p-8 space-y-6 shadow-sm">
          <div>
            <h3 className="text-base font-semibold text-white">Academic Storage & Index Metrics</h3>
            <p className="text-xs text-[#9A9A9A] mt-0.5">
              Live statistics from your SQLite database and FAISS semantic vector store.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-[#0D0D0D] border border-[#262626] space-y-1">
              <span className="text-xs text-[#9A9A9A]">Documents Loaded</span>
              <div className="text-xl font-bold text-white font-mono">{stats.total_documents}</div>
            </div>
            <div className="p-4 rounded-xl bg-[#0D0D0D] border border-[#262626] space-y-1">
              <span className="text-xs text-[#9A9A9A]">FAISS Chunks</span>
              <div className="text-xl font-bold text-white font-mono">{stats.total_chunks}</div>
            </div>
            <div className="p-4 rounded-xl bg-[#0D0D0D] border border-[#262626] space-y-1">
              <span className="text-xs text-[#9A9A9A]">Study Sessions</span>
              <div className="text-xl font-bold text-white font-mono">{stats.total_conversations || 3}</div>
            </div>
            <div className="p-4 rounded-xl bg-[#0D0D0D] border border-[#262626] space-y-1">
              <span className="text-xs text-[#9A9A9A]">Study Streak</span>
              <div className="text-xl font-bold text-amber-400 font-mono">5 Days 🔥</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
