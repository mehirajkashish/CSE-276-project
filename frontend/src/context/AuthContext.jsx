import React, { createContext, useContext, useState, useEffect } from 'react';
import { authApi, ensureBackendConnected } from '../services/api';
import { DEMO_USER } from '../services/demoData';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [isDemoMode, setIsDemoMode] = useState(() => {
    return sessionStorage.getItem('studymind_demo_mode') === 'true';
  });

  const [user, setUser] = useState(() => {
    if (sessionStorage.getItem('studymind_demo_mode') === 'true') {
      return DEMO_USER;
    }
    try {
      const stored = localStorage.getItem('studymind_user') || sessionStorage.getItem('studymind_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const [token, setToken] = useState(() => {
    if (sessionStorage.getItem('studymind_demo_mode') === 'true') {
      return 'studymind-demo-token';
    }
    return localStorage.getItem('studymind_token') || sessionStorage.getItem('studymind_token') || null;
  });

  const [loading, setLoading] = useState(true);

  // Validate session on mount
  useEffect(() => {
    const initAuth = async () => {
      if (sessionStorage.getItem('studymind_demo_mode') === 'true') {
        setUser(DEMO_USER);
        setToken('studymind-demo-token');
        setIsDemoMode(true);
        setLoading(false);
        return;
      }

      const activeToken = localStorage.getItem('studymind_token') || sessionStorage.getItem('studymind_token');
      if (activeToken) {
        try {
          const userData = await authApi.getMe();
          setUser(userData);
          if (localStorage.getItem('studymind_token')) {
            localStorage.setItem('studymind_user', JSON.stringify(userData));
          } else {
            sessionStorage.setItem('studymind_user', JSON.stringify(userData));
          }
        } catch (err) {
          const status = err.response?.status;
          const isConnErr =
            !err.response || err.code === 'ERR_NETWORK' || status === 404 || status === 502 || status === 503;
          if (isConnErr) {
            const check = await ensureBackendConnected();
            if (check.connected) {
              try {
                const retryUser = await authApi.getMe();
                setUser(retryUser);
                setLoading(false);
                return;
              } catch {
                // fall through to clear invalid session
              }
            }
          }
          console.warn('Session verification failed, clearing auth:', err);
          logout();
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  const enterDemoMode = () => {
    sessionStorage.setItem('studymind_demo_mode', 'true');
    sessionStorage.setItem('studymind_token', 'studymind-demo-token');
    sessionStorage.setItem('studymind_user', JSON.stringify(DEMO_USER));
    setIsDemoMode(true);
    setUser(DEMO_USER);
    setToken('studymind-demo-token');
    return DEMO_USER;
  };

  const exitDemoMode = () => {
    sessionStorage.removeItem('studymind_demo_mode');
    sessionStorage.removeItem('studymind_token');
    sessionStorage.removeItem('studymind_user');
    setIsDemoMode(false);
    setUser(null);
    setToken(null);
  };

  const login = async (email, password, rememberMe = true) => {
    // Clear demo mode if logging into real account
    sessionStorage.removeItem('studymind_demo_mode');
    setIsDemoMode(false);

    const data = await authApi.login({ email, password });
    if (!data?.access_token || !data?.user) {
      throw new Error('Backend did not return a valid auth token. Ensure VITE_API_URL points to your FastAPI backend.');
    }
    const storage = rememberMe ? localStorage : sessionStorage;

    if (rememberMe) {
      sessionStorage.removeItem('studymind_token');
      sessionStorage.removeItem('studymind_user');
    } else {
      localStorage.removeItem('studymind_token');
      localStorage.removeItem('studymind_user');
    }

    storage.setItem('studymind_token', data.access_token);
    storage.setItem('studymind_user', JSON.stringify(data.user));
    setToken(data.access_token);
    setUser(data.user);
    return data.user;
  };

  const register = async (full_name, email, password, confirm_password) => {
    sessionStorage.removeItem('studymind_demo_mode');
    setIsDemoMode(false);

    const data = await authApi.register({ full_name, email, password, confirm_password });
    if (!data?.access_token || !data?.user) {
      throw new Error('Backend did not return a valid auth token. Ensure VITE_API_URL points to your FastAPI backend.');
    }
    localStorage.setItem('studymind_token', data.access_token);
    localStorage.setItem('studymind_user', JSON.stringify(data.user));
    sessionStorage.removeItem('studymind_token');
    sessionStorage.removeItem('studymind_user');
    setToken(data.access_token);
    setUser(data.user);
    return data.user;
  };

  const updateUser = (updatedUser) => {
    setUser(updatedUser);
    if (localStorage.getItem('studymind_token')) {
      localStorage.setItem('studymind_user', JSON.stringify(updatedUser));
    } else {
      sessionStorage.setItem('studymind_user', JSON.stringify(updatedUser));
    }
  };

  const logout = () => {
    sessionStorage.removeItem('studymind_demo_mode');
    localStorage.removeItem('studymind_token');
    localStorage.removeItem('studymind_user');
    sessionStorage.removeItem('studymind_token');
    sessionStorage.removeItem('studymind_user');
    setIsDemoMode(false);
    setToken(null);
    setUser(null);
  };

  const value = {
    user,
    token,
    isAuthenticated: !!token && !!user,
    isDemoMode,
    loading,
    enterDemoMode,
    exitDemoMode,
    login,
    register,
    updateUser,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
