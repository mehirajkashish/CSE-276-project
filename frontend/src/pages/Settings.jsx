import React, { useState, useEffect } from 'react';
import {
  Key,
  Cpu,
  Layers,
  HardDrive,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Save,
  RefreshCw,
  Info,
  Sun,
  Moon,
  Check
} from 'lucide-react';
import { systemApi } from '../services/api';
import { useTheme } from '../context/ThemeContext';

export default function Settings() {
  const { theme, setTheme, isDark } = useTheme();
  const [settings, setSettings] = useState(null);
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [selectedModel, setSelectedModel] = useState('gemini-1.5-flash');
  const [chunkSize, setChunkSize] = useState(750);
  const [chunkOverlap, setChunkOverlap] = useState(150);
  const [topK, setTopK] = useState(4);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);

  const loadSettings = async () => {
    try {
      const data = await systemApi.getSettings();
      setSettings(data);
      setSelectedModel(data.gemini_model || 'gemini-1.5-flash');
      setChunkSize(data.chunk_size || 750);
      setChunkOverlap(data.chunk_overlap || 150);
      setTopK(data.top_k || 4);
    } catch (e) {
      console.error('Failed to load settings:', e);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setStatusMessage(null);
    try {
      const payload = {
        gemini_model: selectedModel,
        chunk_size: parseInt(chunkSize, 10),
        chunk_overlap: parseInt(chunkOverlap, 10),
        top_k: parseInt(topK, 10)
      };
      if (apiKey.trim()) {
        payload.gemini_api_key = apiKey.trim();
      }
      await systemApi.updateSettings(payload);
      setStatusMessage({ type: 'success', text: 'Settings saved and applied successfully!' });
      setApiKey('');
      loadSettings();
    } catch (err) {
      setStatusMessage({ type: 'error', text: 'Failed to update settings: ' + err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-16 select-none">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">
          System Settings &{' '}
          <span className="font-serif italic font-normal text-white">Configuration</span>
        </h1>
        <p className="text-xs text-[#9A9A9A] mt-1">
          Configure your LLM provider, API keys, RAG chunking parameters, and vector store models.
        </p>
      </div>

      {statusMessage && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center gap-2.5 ${
            statusMessage.type === 'success'
              ? 'bg-[#0F291E] border-[#22C55E]/30 text-[#22C55E]'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Appearance & Workspace Theme Toggle Card */}
      <div className="rounded-2xl border border-[#262626] bg-[#1A1A1A] p-6 space-y-4 shadow-sm">
        <div className="flex items-center justify-between pb-3 border-b border-[#222222]">
          <div className="flex items-center gap-2.5">
            {isDark ? (
              <Moon className="w-5 h-5 text-white" />
            ) : (
              <Sun className="w-5 h-5 text-amber-500" />
            )}
            <div>
              <h2 className="text-sm font-bold text-white">Appearance & Theme Mode</h2>
              <p className="text-xs text-[#9A9A9A]">Select your preferred color workspace aesthetic</p>
            </div>
          </div>
          <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-[#141414] text-[#9A9A9A] border border-[#262626]">
            Active: {isDark ? 'Obsidian Dark' : 'Academic Light'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
          {/* Obsidian Dark Option */}
          <div
            onClick={() => setTheme('dark')}
            className={`p-4 rounded-xl border cursor-pointer transition flex items-start justify-between ${
              isDark
                ? 'bg-[#141414] border-white ring-1 ring-white/20'
                : 'bg-[#141414] border-[#262626] hover:border-[#3A3A3A]'
            }`}
          >
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <div className="w-3.5 h-3.5 rounded-full bg-[#0D0D0D] border border-white flex items-center justify-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-white" />
                </div>
                <span className="text-xs font-bold text-white">Obsidian Dark</span>
                <span className="text-[9px] px-1.5 py-0.2 rounded bg-white/10 text-white border border-white/20 font-mono">
                  Default
                </span>
              </div>
              <p className="text-[11px] text-[#9A9A9A] leading-relaxed">
                Deep #0D0D0D obsidian canvas with refined dark cards and crisp white contrast.
              </p>
            </div>
            {isDark && (
              <div className="w-5 h-5 rounded-full bg-white text-black flex items-center justify-center shrink-0">
                <Check className="w-3 h-3 stroke-[3]" />
              </div>
            )}
          </div>

          {/* Academic Light Option */}
          <div
            onClick={() => setTheme('light')}
            className={`p-4 rounded-xl border cursor-pointer transition flex items-start justify-between ${
              !isDark
                ? 'bg-[#141414] border-white ring-1 ring-white/20'
                : 'bg-[#141414] border-[#262626] hover:border-[#3A3A3A]'
            }`}
          >
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <div className="w-3.5 h-3.5 rounded-full bg-white border border-[#262626] flex items-center justify-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#0F172A]" />
                </div>
                <span className="text-xs font-bold text-white">Academic Light</span>
                <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                  Clean Slate
                </span>
              </div>
              <p className="text-[11px] text-[#9A9A9A] leading-relaxed">
                Soft #F8FAFC slate canvas with clean white cards and high-contrast typography.
              </p>
            </div>
            {!isDark && (
              <div className="w-5 h-5 rounded-full bg-white text-black flex items-center justify-center shrink-0">
                <Check className="w-3 h-3 stroke-[3]" />
              </div>
            )}
          </div>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* 1. LLM Provider & API Key */}
        <div className="rounded-2xl border border-[#262626] bg-[#1A1A1A] p-6 space-y-4 shadow-sm">
          <div className="flex items-center gap-2.5 pb-3 border-b border-[#222222]">
            <Key className="w-5 h-5 text-white" />
            <div>
              <h2 className="text-sm font-bold text-white">LLM Provider & Credentials</h2>
              <p className="text-xs text-[#9A9A9A]">Configure answer synthesis with Google Gemini API</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#9A9A9A] mb-1.5">
                Gemini Model
              </label>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="w-full rounded-xl bg-[#0D0D0D] border border-[#262626] text-xs text-white p-2.5 focus:outline-none focus:border-white"
              >
                <option value="gemini-1.5-flash">Gemini 1.5 Flash (Recommended - Fast & High Quota)</option>
                <option value="gemini-2.0-flash">Gemini 2.0 Flash (Next-Gen Flash)</option>
                <option value="gemini-1.5-pro">Gemini 1.5 Pro (Deep Academic Reasoning)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#9A9A9A] mb-1.5">
                Current API Key Status
              </label>
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-[#0D0D0D] border border-[#262626] text-xs">
                <span className={`w-2 h-2 rounded-full ${settings?.gemini_api_key_configured ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                <span className="font-mono text-white">
                  {settings?.gemini_api_key_configured
                    ? `Active (${settings.gemini_api_key_masked})`
                    : 'Not Configured (Using Local RAG Engine)'}
                </span>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#9A9A9A] mb-1.5">
              Set / Update Google Gemini API Key
            </label>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                placeholder="AIzaSy... (Paste your Gemini API key from Google AI Studio)"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="w-full rounded-xl bg-[#0D0D0D] border border-[#262626] text-xs text-white pl-3 pr-10 py-2.5 focus:outline-none focus:border-white font-mono placeholder-[#666666]"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9A9A9A] hover:text-white"
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[11px] text-[#666666] mt-1.5">
              Keys are stored securely in backend <code>.env</code>. You can obtain a free key from{' '}
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="text-white hover:underline font-medium"
              >
                aistudio.google.com
              </a>.
            </p>
          </div>
        </div>

        {/* 2. RAG Chunking Parameters */}
        <div className="rounded-2xl border border-[#262626] bg-[#1A1A1A] p-6 space-y-4 shadow-sm">
          <div className="flex items-center gap-2.5 pb-3 border-b border-[#262626]">
            <Layers className="w-5 h-5 text-white" />
            <div>
              <h2 className="text-sm font-semibold text-white">RAG Ingestion & Chunking</h2>
              <p className="text-xs text-[#9A9A9A]">Configure text splitting rules for uploaded documents</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#9A9A9A] mb-1">
                Chunk Size (Characters)
              </label>
              <input
                type="number"
                min={200}
                max={2000}
                value={chunkSize}
                onChange={(e) => setChunkSize(e.target.value)}
                className="w-full rounded-xl bg-[#0D0D0D] border border-[#262626] text-xs text-white p-2.5 focus:outline-none focus:border-white"
              />
              <span className="text-[11px] text-[#9A9A9A]">Default: 750 characters</span>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#9A9A9A] mb-1">
                Chunk Overlap (Characters)
              </label>
              <input
                type="number"
                min={50}
                max={500}
                value={chunkOverlap}
                onChange={(e) => setChunkOverlap(e.target.value)}
                className="w-full rounded-xl bg-[#0D0D0D] border border-[#262626] text-xs text-white p-2.5 focus:outline-none focus:border-white"
              />
              <span className="text-[11px] text-[#9A9A9A]">Default: 150 characters</span>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#9A9A9A] mb-1">
                Top-K Retrieved Chunks
              </label>
              <input
                type="number"
                min={1}
                max={10}
                value={topK}
                onChange={(e) => setTopK(e.target.value)}
                className="w-full rounded-xl bg-[#0D0D0D] border border-[#262626] text-xs text-white p-2.5 focus:outline-none focus:border-white"
              />
              <span className="text-[11px] text-[#9A9A9A]">Default: 4 passages</span>
            </div>
          </div>
        </div>

        {/* 3. System Prompt & Anti-Hallucination Guardrails */}
        <div className="rounded-2xl border border-[#262626] bg-[#1A1A1A] p-6 space-y-4 shadow-sm">
          <div className="flex items-center gap-2.5 pb-3 border-b border-[#262626]">
            <ShieldCheck className="w-5 h-5 text-white" />
            <div>
              <h2 className="text-sm font-semibold text-white">System Prompt & Grounding Guardrails</h2>
              <p className="text-xs text-[#9A9A9A]">Strict academic anti-hallucination instruction enforced on all queries</p>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-[#0D0D0D] border border-[#262626] text-xs text-white font-mono leading-relaxed">
            "You are StudyMind AI, an academic study assistant. Answer questions using only the provided retrieved document context. If the answer is not supported by the context, clearly state that the information is unavailable in the uploaded study materials. Do not invent facts, citations, or page numbers. Provide clear and student-friendly explanations. Cite the source document and page number wherever possible."
          </div>
        </div>

        {/* 4. Architecture & Pipeline Info */}
        <div className="rounded-2xl border border-[#262626] bg-[#1A1A1A] p-6 space-y-4 shadow-sm">
          <div className="flex items-center gap-2.5 pb-3 border-b border-[#262626]">
            <Info className="w-5 h-5 text-white" />
            <div>
              <h2 className="text-sm font-semibold text-white">System Pipeline Diagnostics</h2>
              <p className="text-xs text-[#9A9A9A]">Verified status of local RAG libraries</p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-[#0D0D0D] border border-[#262626]">
              <span className="text-[#9A9A9A] block text-[11px]">PDF Parser</span>
              <strong className="text-white mt-1 block">
                {settings?.system_features?.pymupdf_enabled ? 'PyMuPDF (fitz)' : 'pypdf'}
              </strong>
            </div>
            <div className="p-3 rounded-xl bg-[#0D0D0D] border border-[#262626]">
              <span className="text-[#9A9A9A] block text-[11px]">Vector Store</span>
              <strong className="text-white mt-1 block">
                {settings?.system_features?.faiss_enabled ? 'FAISS Index' : 'Cosine Dense Matrix'}
              </strong>
            </div>
            <div className="p-3 rounded-xl bg-[#0D0D0D] border border-[#262626]">
              <span className="text-[#9A9A9A] block text-[11px]">Embeddings</span>
              <strong className="text-white mt-1 block">
                {settings?.system_features?.sentence_transformers_enabled
                  ? 'Sentence Transformers'
                  : 'Dense Semantic Vectorizer'}
              </strong>
            </div>
            <div className="p-3 rounded-xl bg-[#0D0D0D] border border-[#262626]">
              <span className="text-[#9A9A9A] block text-[11px]">Total Chunks</span>
              <strong className="text-white mt-1 block font-mono">
                {settings?.system_features?.total_indexed_chunks || 0}
              </strong>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-white hover:bg-neutral-200 text-black font-semibold text-xs sm:text-sm shadow-sm transition disabled:opacity-50 active:scale-95"
          >
            {saving ? <RefreshCw className="w-4 h-4 animate-spin text-black" /> : <Save className="w-4 h-4 stroke-[2.5]" />}
            <span>Save Configuration</span>
          </button>
        </div>
      </form>
    </div>
  );
}
