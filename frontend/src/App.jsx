import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { getBasePath } from './services/api';
import { ThemeProvider } from './context/ThemeContext';
import ProtectedRoute from './components/ProtectedRoute';
import AppLayout from './layouts/AppLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Documents from './pages/Documents';
import Chat from './pages/Chat';
import Viewer from './pages/Viewer';
import StudyTools from './pages/StudyTools';
import Exams from './pages/Exams';
import FlashcardsPage from './pages/FlashcardsPage';
import Planner from './pages/Planner';
import Focus from './pages/Focus';
import Analytics from './pages/Analytics';
import Profile from './pages/Profile';
import Settings from './pages/Settings';
import ModernDarkApp from './pages/ModernDarkApp';

export default function App() {
  const routerBasename = getBasePath() || '/';

  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter basename={routerBasename}>
        <Routes>
          {/* Public Authentication Route */}
          <Route path="/login" element={<Login />} />

          {/* Public Front Page / Landing Experience */}
          <Route path="/" element={<ModernDarkApp />} />

          {/* Standalone Interactive Overview & Architecture Showcase Aliases */}
          <Route path="/overview" element={<ModernDarkApp />} />
          <Route path="/showcase" element={<ModernDarkApp />} />
          <Route path="/catalog" element={<ModernDarkApp />} />
          <Route path="/modern" element={<ModernDarkApp />} />

          {/* Protected Application Workspace: Main StudyMind Platform */}
          <Route
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/chat" element={<Chat />} />
            <Route path="/documents" element={<Documents />} />
            <Route path="/viewer" element={<Viewer />} />
            <Route path="/study-tools" element={<StudyTools />} />
            <Route path="/study-tools/:toolId" element={<StudyTools />} />
            <Route path="/exams" element={<Exams />} />
            <Route path="/flashcards" element={<FlashcardsPage />} />
            <Route path="/planner" element={<Planner />} />
            <Route path="/focus" element={<Focus />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/profile" element={<Profile />} />

            {/* Also support /workspace/* routes for backwards compatibility */}
            <Route path="/workspace" element={<Dashboard />} />
            <Route path="/workspace/dashboard" element={<Dashboard />} />
            <Route path="/workspace/chat" element={<Chat />} />
            <Route path="/workspace/documents" element={<Documents />} />
            <Route path="/workspace/viewer" element={<Viewer />} />
            <Route path="/workspace/study-tools" element={<StudyTools />} />
            <Route path="/workspace/study-tools/:toolId" element={<StudyTools />} />
            <Route path="/workspace/exams" element={<Exams />} />
            <Route path="/workspace/flashcards" element={<FlashcardsPage />} />
            <Route path="/workspace/planner" element={<Planner />} />
            <Route path="/workspace/focus" element={<Focus />} />
            <Route path="/workspace/analytics" element={<Analytics />} />
            <Route path="/workspace/settings" element={<Settings />} />
            <Route path="/workspace/profile" element={<Profile />} />
          </Route>

          {/* Catch-all redirect to Dashboard */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  </ThemeProvider>
  );
}
