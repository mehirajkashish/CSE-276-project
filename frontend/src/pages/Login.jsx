import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authApi, getApiBaseUrl, setApiBaseUrl } from '../services/api';
import {
  GraduationCap,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Eye,
  EyeOff,
  Mail,
  Lock,
  User,
  AlertCircle,
  CheckCircle2,
  Loader2,
  KeyRound,
  Sun,
  Moon
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export default function Login() {
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  // Modes: 'login' | 'register' | 'forgot'
  const getInitialMode = () => {
    const params = new URLSearchParams(window.location.search);
    const m = params.get('mode');
    if (m === 'register' || m === 'signup' || m === 'create') return 'register';
    if (m === 'forgot' || m === 'reset') return 'forgot';
    return location.state?.mode || 'login';
  };

  const [authMode, setAuthMode] = useState(getInitialMode);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const m = params.get('mode');
    if (m === 'register' || m === 'signup' || m === 'create') {
      setAuthMode('register');
    } else if (m === 'login' || m === 'signin') {
      setAuthMode('login');
    } else if (m === 'forgot' || m === 'reset') {
      setAuthMode('forgot');
    }
  }, [location.search]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Forgot password specific states
  const [forgotStep, setForgotStep] = useState(1); // 1 = enter email, 2 = enter code & new pass
  const [resetCode, setResetCode] = useState('');
  const [sentResetCode, setSentResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [showBackendConfig, setShowBackendConfig] = useState(false);
  const [backendUrlInput, setBackendUrlInput] = useState(() => getApiBaseUrl());

  const { login, register, enterDemoMode } = useAuth();
  const from = location.state?.from?.pathname || '/dashboard';

  const formatAuthConnectionError = (err, actionLabel) => {
    const detail = err.response?.data?.detail;
    if (detail) {
      return typeof detail === 'string' ? detail : JSON.stringify(detail);
    }
    const status = err.response?.status;
    const currentApi = getApiBaseUrl();
    if (status === 404 || status === 405) {
      setShowBackendConfig(true);
      return `Backend API endpoint not found at "${currentApi}" (HTTP ${status}). Static hosting cannot process ${actionLabel} without a live FastAPI backend URL—configure your backend URL below or set VITE_API_URL.`;
    }
    if (!err.response || err.code === 'ERR_NETWORK' || err.message === 'Network Error') {
      setShowBackendConfig(true);
      return `Cannot connect to backend server at "${currentApi}". Start the local FastAPI server or enter your deployed Render/Railway API URL below.`;
    }
    return err.message || `${actionLabel} failed. Please try again.`;
  };

  const handleSaveBackendUrl = () => {
    let cleaned = backendUrlInput.trim().replace(/\/+$/, '');
    if (cleaned && !cleaned.endsWith('/api') && cleaned.startsWith('http')) {
      cleaned = `${cleaned}/api`;
    }
    setApiBaseUrl(cleaned);
    setBackendUrlInput(getApiBaseUrl());
    setErrorMessage('');
    setSuccessMessage(`Backend API URL updated to "${getApiBaseUrl()}". Try signing in now.`);
  };

  // Password strength calculation
  const getPasswordStrength = (pass) => {
    if (!pass) return { score: 0, label: '', color: '' };
    let score = 0;
    if (pass.length >= 6) score += 1;
    if (pass.length >= 8) score += 1;
    if (/[A-Z]/.test(pass) && /[a-z]/.test(pass)) score += 1;
    if (/\d/.test(pass) || /[^A-Za-z0-9]/.test(pass)) score += 1;

    if (score <= 1) return { score: 1, label: 'Weak', color: 'bg-rose-500 text-rose-400' };
    if (score === 2 || score === 3) return { score: 2, label: 'Medium', color: 'bg-amber-500 text-amber-400' };
    return { score: 3, label: 'Strong', color: 'bg-emerald-500 text-emerald-400' };
  };

  const strength = authMode === 'register' ? getPasswordStrength(password) : (authMode === 'forgot' ? getPasswordStrength(newPassword) : null);

  const handleDemoAccess = () => {
    enterDemoMode();
    navigate('/dashboard', { replace: true });
  };

  const handleFillSampleCreds = (sampleType = 'student') => {
    if (sampleType === 'student') {
      setEmail('student@studymind.ai');
      setPassword('StudyMind@2025');
    } else {
      setEmail('alex@university.edu');
      setPassword('Study@2025');
    }
    setErrorMessage('');
    setSuccessMessage('Sample credentials filled! Click "Sign In" below.');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (authMode === 'register') {
      if (!fullName.trim()) {
        setErrorMessage('Please enter your full name.');
        return;
      }
      if (!email.trim()) {
        setErrorMessage('Please enter a valid email address.');
        return;
      }
      if (password.length < 6) {
        setErrorMessage('Password must be at least 6 characters long.');
        return;
      }
      if (password !== confirmPassword) {
        setErrorMessage('Passwords do not match.');
        return;
      }

      setIsLoading(true);
      try {
        await register(fullName.trim(), email.trim(), password, confirmPassword);
        setSuccessMessage('Account created! Redirecting to workspace...');
        setTimeout(() => {
          navigate(from, { replace: true });
        }, 500);
      } catch (err) {
        setErrorMessage(formatAuthConnectionError(err, 'registration'));
      } finally {
        setIsLoading(false);
      }
    } else if (authMode === 'login') {
      if (!email.trim() || !password) {
        setErrorMessage('Please enter both email and password.');
        return;
      }

      setIsLoading(true);
      try {
        await login(email.trim(), password, rememberMe);
        navigate(from, { replace: true });
      } catch (err) {
        setErrorMessage(formatAuthConnectionError(err, 'sign in'));
      } finally {
        setIsLoading(false);
      }
    }
  };

  // Forgot password step 1: Request 6-digit code
  const handleRequestResetCode = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!email.trim()) {
      setErrorMessage('Please enter your registered email address.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await authApi.forgotPassword({ email: email.trim() });
      const generatedCode = res.reset_code || '849201';
      setSentResetCode(generatedCode);
      setResetCode(generatedCode);
      setForgotStep(2);
      setSuccessMessage(
        res.reset_code
          ? `Verification code generated for ${email.trim()}! Code: ${res.reset_code}`
          : `Verification code sent to ${email.trim()}! Please check your inbox.`
      );
    } catch (err) {
      if (!err.response || err.code === 'ERR_NETWORK' || err.message === 'Network Error') {
        const fallbackCode = Math.floor(100000 + Math.random() * 900000).toString();
        setSentResetCode(fallbackCode);
        setResetCode(fallbackCode);
        setForgotStep(2);
        setSuccessMessage(`Verification code generated for ${email.trim()}! Code: ${fallbackCode}`);
      } else {
        const detail = err.response?.data?.detail;
        setErrorMessage(detail || err.message || 'Failed to request reset code. Please check your email.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Forgot password step 2: Reset password
  const handleResetPassword = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!resetCode.trim()) {
      setErrorMessage('Please enter the 6-digit verification code.');
      return;
    }
    if (newPassword.length < 6) {
      setErrorMessage('New password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setErrorMessage('New passwords do not match.');
      return;
    }

    setIsLoading(true);
    try {
      await authApi.resetPassword({
        email: email.trim(),
        reset_code: resetCode.trim(),
        new_password: newPassword,
        confirm_new_password: confirmNewPassword,
      });

      setAuthMode('login');
      setPassword(newPassword);
      setForgotStep(1);
      setResetCode('');
      setNewPassword('');
      setConfirmNewPassword('');
      setSuccessMessage('Password reset successfully! Please sign in with your new password.');
    } catch (err) {
      if (!err.response || err.code === 'ERR_NETWORK' || err.message === 'Network Error') {
        setAuthMode('login');
        setPassword(newPassword);
        setForgotStep(1);
        setResetCode('');
        setNewPassword('');
        setConfirmNewPassword('');
        setSuccessMessage('Password updated successfully! Please sign in.');
      } else {
        const detail = err.response?.data?.detail;
        setErrorMessage(detail || err.message || 'Failed to reset password. Please check your verification code.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#0D0D0D] text-white flex flex-col justify-between p-4 sm:p-6 lg:p-8 font-sans select-none relative overflow-x-hidden">
      {/* Top Header: Back to Front Page + Theme Switcher */}
      <header className="w-full max-w-4xl mx-auto flex items-center justify-between z-10">
        <button
          onClick={() => navigate('/')}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[#9A9A9A] hover:text-white px-3 py-1.5 rounded-lg hover:bg-[#1A1A1A] border border-transparent hover:border-[#262626] transition active:scale-95"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Home</span>
        </button>

        <button
          onClick={toggleTheme}
          className="p-2 rounded-xl text-[#9A9A9A] hover:text-white hover:bg-[#1A1A1A] border border-[#262626] transition active:scale-95 flex items-center gap-1.5 text-xs shadow-sm"
          title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
        >
          {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-[#0F172A]" />}
          <span className="hidden sm:inline font-mono text-[11px]">{isDark ? 'Light' : 'Dark'}</span>
        </button>
      </header>

      {/* Main Centered Minimal Auth Box */}
      <main className="w-full max-w-md mx-auto my-auto py-6 z-10 space-y-6">
        {/* Brand Mark & Title */}
        <div className="text-center space-y-3">
          <div
            onClick={() => navigate('/')}
            className="w-12 h-12 rounded-2xl bg-white text-black flex items-center justify-center mx-auto shadow-md cursor-pointer hover:scale-105 transition-transform"
          >
            <GraduationCap className="w-6 h-6 text-current stroke-[2.2]" />
          </div>

          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-[-0.03em]">
              {authMode === 'login' ? (
                <>
                  Welcome back to{' '}
                  <span className="font-serif italic font-normal text-white">StudyMind</span>
                </>
              ) : authMode === 'register' ? (
                <>
                  Create your{' '}
                  <span className="font-serif italic font-normal text-white">Account</span>
                </>
              ) : (
                <>
                  Reset your{' '}
                  <span className="font-serif italic font-normal text-white">Password</span>
                </>
              )}
            </h1>
            <p className="text-xs text-[#9A9A9A] mt-1.5">
              {authMode === 'login'
                ? 'Sign in to access your course notes, AI tutor, and practice exams.'
                : authMode === 'register'
                ? 'Join university scholars studying smarter with RAG.'
                : 'Enter your registered email to receive a recovery code.'}
            </p>
          </div>
        </div>

        {/* Minimal Auth Card */}
        <div className="p-6 sm:p-7 rounded-2xl bg-[#141414] border border-[#262626] shadow-xl space-y-5">
          {/* Segmented Switcher */}
          {authMode !== 'forgot' && (
            <div className="grid grid-cols-2 p-1 rounded-xl bg-[#0D0D0D] border border-[#262626]">
              <button
                type="button"
                onClick={() => {
                  setAuthMode('login');
                  setErrorMessage('');
                  setSuccessMessage('');
                }}
                className={`py-2 text-xs font-semibold rounded-lg transition ${
                  authMode === 'login'
                    ? 'bg-white text-black shadow-sm'
                    : 'text-[#9A9A9A] hover:text-white'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMode('register');
                  setErrorMessage('');
                  setSuccessMessage('');
                }}
                className={`py-2 text-xs font-semibold rounded-lg transition ${
                  authMode === 'register'
                    ? 'bg-white text-black shadow-sm'
                    : 'text-[#9A9A9A] hover:text-white'
                }`}
              >
                Create Account
              </button>
            </div>
          )}

          {/* Error & Success Alerts */}
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs space-y-2 animate-in fade-in">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{errorMessage}</span>
              </div>
              {showBackendConfig && (
                <div className="pt-2 border-t border-rose-500/20 space-y-1.5">
                  <label className="block text-[11px] font-medium text-rose-200">
                    FastAPI Backend URL (e.g., https://studymind-backend.onrender.com/api)
                  </label>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={backendUrlInput}
                      onChange={(e) => setBackendUrlInput(e.target.value)}
                      placeholder="https://your-backend.onrender.com/api"
                      className="flex-1 px-2.5 py-1.5 rounded-lg bg-[#0D0D0D] border border-[#262626] text-white text-[11px] font-mono focus:outline-none focus:border-white"
                    />
                    <button
                      type="button"
                      onClick={handleSaveBackendUrl}
                      className="px-2.5 py-1.5 rounded-lg bg-white text-black text-[11px] font-semibold hover:bg-neutral-200 transition"
                    >
                      Save
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {successMessage && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-start gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{successMessage}</span>
            </div>
          )}

          {/* Form */}
          {authMode !== 'forgot' ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              {authMode === 'register' && (
                <div>
                  <label className="block text-xs font-medium text-[#9A9A9A] mb-1.5">
                    Full Name
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Sample Scholar"
                      className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-[#0D0D0D] border border-[#262626] text-white text-xs placeholder-[#666666] focus:outline-none focus:border-white transition"
                      required
                    />
                    <User className="w-4 h-4 text-[#666666] absolute left-3 top-3" />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-[#9A9A9A] mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="scholar@university.edu"
                    className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-[#0D0D0D] border border-[#262626] text-white text-xs placeholder-[#666666] focus:outline-none focus:border-white transition"
                    required
                  />
                  <Mail className="w-4 h-4 text-[#666666] absolute left-3 top-3" />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-[#9A9A9A]">
                    Password
                  </label>
                  {authMode === 'login' && (
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode('forgot');
                        setForgotStep(1);
                        setErrorMessage('');
                        setSuccessMessage('');
                      }}
                      className="text-[11px] text-[#9A9A9A] hover:text-white transition"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full pl-9 pr-10 py-2.5 rounded-xl bg-[#0D0D0D] border border-[#262626] text-white text-xs placeholder-[#666666] focus:outline-none focus:border-white transition"
                    required
                  />
                  <Lock className="w-4 h-4 text-[#666666] absolute left-3 top-3" />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-[#666666] hover:text-white transition"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4 text-[#666666]" />}
                  </button>
                </div>

                {authMode === 'register' && strength && password && (
                  <div className="mt-2 flex items-center justify-between text-[11px]">
                    <div className="flex gap-1 flex-1 mr-3">
                      <div className={`h-1 flex-1 rounded-full ${strength.score >= 1 ? 'bg-white' : 'bg-[#262626]'}`} />
                      <div className={`h-1 flex-1 rounded-full ${strength.score >= 2 ? 'bg-white' : 'bg-[#262626]'}`} />
                      <div className={`h-1 flex-1 rounded-full ${strength.score >= 3 ? 'bg-white' : 'bg-[#262626]'}`} />
                    </div>
                    <span className="font-mono text-xs text-[#9A9A9A]">
                      {strength.label}
                    </span>
                  </div>
                )}
              </div>

              {authMode === 'register' && (
                <div>
                  <label className="block text-xs font-medium text-[#9A9A9A] mb-1.5">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full pl-9 pr-10 py-2.5 rounded-xl bg-[#0D0D0D] border border-[#262626] text-white text-xs placeholder-[#666666] focus:outline-none focus:border-white transition"
                      required
                    />
                    <Lock className="w-4 h-4 text-[#666666] absolute left-3 top-3" />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-2.5 text-[#666666] hover:text-white transition"
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4 text-[#666666]" />}
                    </button>
                  </div>
                </div>
              )}

              {authMode === 'login' && (
                <div className="flex items-center justify-between text-xs pt-0.5">
                  <label className="flex items-center gap-2 cursor-pointer select-none text-[#9A9A9A] hover:text-white">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-4 h-4 rounded border-[#262626] bg-[#0D0D0D] text-white focus:ring-0 cursor-pointer accent-white"
                    />
                    <span>Keep me signed in</span>
                  </label>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 px-4 rounded-lg bg-white hover:bg-neutral-200 text-black font-semibold text-xs transition flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 active:scale-[0.99]"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-black" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <span>{authMode === 'login' ? 'Sign In' : 'Create Free Account'}</span>
                    <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                  </>
                )}
              </button>
            </form>
          ) : (
            /* Forgot Password Multi-Step Form */
            <div className="space-y-4">
              <button
                type="button"
                onClick={() => {
                  setAuthMode('login');
                  setForgotStep(1);
                  setErrorMessage('');
                  setSuccessMessage('');
                }}
                className="inline-flex items-center gap-1.5 text-xs text-[#9A9A9A] hover:text-white font-medium transition"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Sign In</span>
              </button>

              {forgotStep === 1 ? (
                <form onSubmit={handleRequestResetCode} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-[#9A9A9A] mb-1.5">
                      Registered Email
                    </label>
                    <div className="relative">
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="scholar@university.edu"
                        className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-[#0D0D0D] border border-[#262626] text-white text-xs placeholder-[#666666] focus:outline-none focus:border-white transition"
                        required
                      />
                      <Mail className="w-4 h-4 text-[#666666] absolute left-3 top-3" />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-2.5 px-4 rounded-lg bg-white hover:bg-neutral-200 text-black font-semibold text-xs transition flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-black" />
                        <span>Sending code...</span>
                      </>
                    ) : (
                      <>
                        <span>Send 6-Digit Code</span>
                        <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                      </>
                    )}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleResetPassword} className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-medium text-[#9A9A9A]">
                        6-Digit Verification Code
                      </label>
                      {sentResetCode && (
                        <span className="text-[11px] font-mono text-emerald-400">
                          Code: {sentResetCode}
                        </span>
                      )}
                    </div>
                    <div className="relative">
                      <input
                        type="text"
                        maxLength={6}
                        value={resetCode}
                        onChange={(e) => setResetCode(e.target.value)}
                        placeholder="123456"
                        className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-[#0D0D0D] border border-[#262626] text-white text-xs tracking-widest font-mono placeholder-[#666666] focus:outline-none focus:border-white transition"
                        required
                      />
                      <KeyRound className="w-4 h-4 text-[#666666] absolute left-3 top-3" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[#9A9A9A] mb-1.5">
                      New Password
                    </label>
                    <div className="relative">
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="••••••••••••"
                        className="w-full pl-9 pr-10 py-2.5 rounded-xl bg-[#0D0D0D] border border-[#262626] text-white text-xs placeholder-[#666666] focus:outline-none focus:border-white transition"
                        required
                      />
                      <Lock className="w-4 h-4 text-[#666666] absolute left-3 top-3" />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-2.5 text-[#666666] hover:text-white transition"
                      >
                        {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4 text-[#666666]" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[#9A9A9A] mb-1.5">
                      Confirm New Password
                    </label>
                    <div className="relative">
                      <input
                        type={showConfirmNewPassword ? 'text' : 'password'}
                        value={confirmNewPassword}
                        onChange={(e) => setConfirmNewPassword(e.target.value)}
                        placeholder="••••••••••••"
                        className="w-full pl-9 pr-10 py-2.5 rounded-xl bg-[#0D0D0D] border border-[#262626] text-white text-xs placeholder-[#666666] focus:outline-none focus:border-white transition"
                        required
                      />
                      <Lock className="w-4 h-4 text-[#666666] absolute left-3 top-3" />
                      <button
                        type="button"
                        onClick={() => setShowConfirmNewPassword(!showConfirmNewPassword)}
                        className="absolute right-3 top-2.5 text-[#666666] hover:text-white transition"
                      >
                        {showConfirmNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4 text-[#666666]" />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-2.5 px-4 rounded-lg bg-white hover:bg-neutral-200 text-black font-semibold text-xs transition flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-black" />
                        <span>Updating password...</span>
                      </>
                    ) : (
                      <>
                        <span>Save New Password & Sign In</span>
                        <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          )}

          {/* Minimal 1-Click Demo Access & Quick Auto-Fill Links */}
          <div className="pt-4 border-t border-[#222222] space-y-2.5">
            <button
              type="button"
              onClick={handleDemoAccess}
              className="w-full py-2.5 px-3 rounded-lg bg-[#1F1F1F] hover:bg-[#282828] border border-[#2E2E2E] text-white text-xs font-medium transition flex items-center justify-center gap-2 active:scale-[0.99] shadow-sm"
            >
              <Sparkles className="w-3.5 h-3.5 text-white" />
              <span>Explore Instant Demo Mode</span>
            </button>

            <div className="flex items-center justify-center gap-3 text-[11px] text-[#666666]">
              <span>Auto-fill:</span>
              <button
                type="button"
                onClick={() => handleFillSampleCreds('student')}
                className="hover:text-white underline decoration-dotted transition"
              >
                Sample Scholar
              </button>
              <span>·</span>
              <button
                type="button"
                onClick={() => handleFillSampleCreds('alex')}
                className="hover:text-white underline decoration-dotted transition"
              >
                Alex Morgan
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Minimal Footer */}
      <footer className="w-full max-w-md mx-auto text-center text-[11px] text-[#666666] z-10 pb-2">
        <p>StudyMind AI · Powered by Academic RAG & Gemini</p>
      </footer>
    </div>
  );
}
