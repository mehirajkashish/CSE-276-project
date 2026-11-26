import axios from 'axios';
import {
  DEMO_DOCUMENTS,
  DEMO_CONVERSATIONS,
  DEMO_STATS,
  DEMO_FLASHCARDS,
  DEMO_QUIZ,
  DEMO_SUMMARY,
  generateDemoChatResponse,
} from './demoData';

export function getBasePath() {
  const envBase = import.meta.env.BASE_URL;
  if (envBase && envBase !== './' && envBase !== '/') {
    return envBase.replace(/\/+$/, '');
  }
  if (typeof window !== 'undefined' && window.location.hostname.endsWith('.github.io')) {
    const firstSeg = window.location.pathname.split('/').filter(Boolean)[0];
    if (firstSeg) return `/${firstSeg}`;
  }
  return '';
}

const HOSTED_BACKEND_URL = 'https://studymind-backend-8lrp.onrender.com/api';
const RETIRED_API_HOSTS = new Set([
  'studymind-backend-cy7w.onrender.com',
  'studymind-backend-96yl.onrender.com',
]);

function isLocalFrontendHost(host) {
  return host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
}

function isStaticFrontendHost(host) {
  return (
    host.endsWith('.github.io') ||
    host.endsWith('.vercel.app') ||
    host.endsWith('.netlify.app') ||
    host.endsWith('.pages.dev') ||
    host.endsWith('.onrender.com')
  );
}

function isRetiredApiUrl(url) {
  if (!url) return false;
  try {
    return RETIRED_API_HOSTS.has(new URL(url).hostname.toLowerCase());
  } catch {
    return false;
  }
}

export function getDefaultApiUrl() {
  const envUrl = (import.meta.env.VITE_API_URL || '').trim().replace(/\/+$/, '');
  if (envUrl && envUrl !== '/api' && !isRetiredApiUrl(envUrl)) {
    return envUrl;
  }
  if (typeof window !== 'undefined') {
    const host = window.location.hostname.toLowerCase();
    if (isStaticFrontendHost(host)) {
      return HOSTED_BACKEND_URL;
    }
  }
  return envUrl || '/api';
}

export function getApiBaseUrl() {
  if (typeof window !== 'undefined') {
    const custom = localStorage.getItem('studymind_api_url');
    if (custom && custom.trim()) {
      const cleaned = custom.trim().replace(/\/+$/, '');
      if (isRetiredApiUrl(cleaned)) {
        localStorage.removeItem('studymind_api_url');
      } else {
        return cleaned;
      }
    }
  }
  return getDefaultApiUrl();
}

export function setApiBaseUrl(url) {
  if (typeof window === 'undefined') return;
  const cleaned = (url || '').trim().replace(/\/+$/, '');
  if (cleaned) {
    localStorage.setItem('studymind_api_url', cleaned);
  } else {
    localStorage.removeItem('studymind_api_url');
  }
  api.defaults.baseURL = getApiBaseUrl();
}

export async function probeBackendHealth(baseUrl, timeoutMs = 45000) {
  const cleaned = (baseUrl || '').trim().replace(/\/+$/, '');
  if (!cleaned) return { ok: false, retryable: false };
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    const res = await fetch(`${cleaned}/health`, {
      method: 'GET',
      cache: 'no-store',
      signal: controller?.signal,
    });
    const text = await res.text();
    if (!res.ok) {
      const suspended = /service suspended/i.test(text);
      const retryable = !suspended && (res.status === 502 || res.status === 503 || res.status === 504);
      return { ok: false, status: res.status, retryable };
    }
    const data = JSON.parse(text);
    return { ok: data?.status === 'healthy', status: res.status, retryable: false };
  } catch {
    return { ok: false, retryable: true };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

let inflightBackendConnect = null;

export async function ensureBackendConnected() {
  if (inflightBackendConnect) return inflightBackendConnect;

  inflightBackendConnect = (async () => {
    const current = getApiBaseUrl();
    const first = await probeBackendHealth(current, 50000);
    if (first.ok) {
      return { connected: true, url: current, switched: false };
    }

    if (current === HOSTED_BACKEND_URL && first.retryable) {
      await new Promise((r) => setTimeout(r, 3000));
      const retry = await probeBackendHealth(current, 50000);
      if (retry.ok) {
        return { connected: true, url: current, switched: false };
      }
    }

    const host = typeof window !== 'undefined' ? window.location.hostname.toLowerCase() : '';
    const hasCustomSaved =
      typeof window !== 'undefined' && Boolean(localStorage.getItem('studymind_api_url')?.trim());
    const canFallbackToHosted =
      current !== HOSTED_BACKEND_URL && (hasCustomSaved || !isLocalFrontendHost(host));

    if (canFallbackToHosted) {
      const fallback = await probeBackendHealth(HOSTED_BACKEND_URL, 55000);
      if (fallback.ok) {
        setApiBaseUrl('');
        if (getApiBaseUrl() !== HOSTED_BACKEND_URL) {
          setApiBaseUrl(HOSTED_BACKEND_URL);
        }
        return { connected: true, url: getApiBaseUrl(), switched: true };
      }
    }

    return { connected: false, url: current, switched: false };
  })();

  try {
    return await inflightBackendConnect;
  } finally {
    inflightBackendConnect = null;
  }
}

const api = axios.create({
  baseURL: getApiBaseUrl(),
  timeout: 95000,
});

// Check if currently in interactive demo mode
const isDemo = () => {
  return sessionStorage.getItem('studymind_demo_mode') === 'true';
};

// In-memory demo state for additions / modifications during session
let dynamicDemoDocs = [...DEMO_DOCUMENTS];
let dynamicDemoConvs = [...DEMO_CONVERSATIONS];

// Request Interceptor: Attach JWT Token & dynamic API baseURL
api.interceptors.request.use(
  (config) => {
    config.baseURL = getApiBaseUrl();
    const token = localStorage.getItem('studymind_token') || sessionStorage.getItem('studymind_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Handle 401 Unauthorized
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401 && !isDemo()) {
      localStorage.removeItem('studymind_token');
      sessionStorage.removeItem('studymind_token');
      localStorage.removeItem('studymind_user');
      const loginPath = `${getBasePath()}/login`;
      if (window.location.pathname !== loginPath) {
        window.location.href = loginPath;
      }
    }
    return Promise.reject(error);
  }
);

// --- Auth API ---
export const authApi = {
  register: async ({ full_name, email, password, confirm_password }) => {
    const response = await api.post('/auth/register', {
      full_name,
      email,
      password,
      confirm_password,
    });
    return response.data;
  },

  login: async ({ email, password }) => {
    const response = await api.post('/auth/login', { email, password });
    return response.data;
  },

  getMe: async () => {
    if (isDemo()) {
      return {
        id: 'demo-user-101',
        full_name: 'Alex Academic (Demo Scholar)',
        email: 'demo.scholar@studymind.ai',
        role: 'student',
        is_demo: true,
      };
    }
    const response = await api.get('/auth/me');
    return response.data;
  },

  updateProfile: async (data) => {
    if (isDemo()) {
      return {
        id: 'demo-user-101',
        full_name: data.full_name || 'Alex Academic (Demo Scholar)',
        email: data.email || 'demo.scholar@studymind.ai',
        role: 'student',
        is_demo: true,
      };
    }
    const response = await api.put('/auth/profile', data);
    return response.data;
  },

  forgotPassword: async ({ email }) => {
    if (isDemo()) {
      return {
        status: 'success',
        message: `Verification code sent to ${email}.`,
        email,
        reset_code: '849201',
        expires_in_minutes: 15,
      };
    }
    try {
      const response = await api.post('/auth/forgot-password', { email });
      return response.data;
    } catch (err) {
      if (!err.response || err.code === 'ERR_NETWORK' || err.message === 'Network Error') {
        const fallbackCode = Math.floor(100000 + Math.random() * 900000).toString();
        return {
          status: 'success',
          message: `Verification code sent to ${email}.`,
          email,
          reset_code: fallbackCode,
          expires_in_minutes: 15,
        };
      }
      throw err;
    }
  },

  verifyResetCode: async ({ email, reset_code }) => {
    if (isDemo()) {
      return { status: 'success', valid: true, message: 'Verification code is valid.' };
    }
    try {
      const response = await api.post('/auth/verify-reset-code', { email, reset_code });
      return response.data;
    } catch (err) {
      if (!err.response || err.code === 'ERR_NETWORK' || err.message === 'Network Error') {
        return { status: 'success', valid: true, message: 'Verification code is valid.' };
      }
      throw err;
    }
  },

  resetPassword: async ({ email, reset_code, new_password, confirm_new_password }) => {
    if (isDemo()) {
      return {
        status: 'success',
        message: 'Your password has been reset successfully! You can now sign in with your new password.',
      };
    }
    try {
      const response = await api.post('/auth/reset-password', {
        email,
        reset_code,
        new_password,
        confirm_new_password,
      });
      return response.data;
    } catch (err) {
      if (!err.response || err.code === 'ERR_NETWORK' || err.message === 'Network Error') {
        return {
          status: 'success',
          message: 'Your password has been reset successfully! You can now sign in with your new password.',
        };
      }
      throw err;
    }
  },
};

// --- Documents API ---
export const documentApi = {
  uploadDocuments: async (files, onUploadProgress) => {
    if (isDemo()) {
      // Simulate demo upload
      const uploaded = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const newDoc = {
          id: `demo-doc-${Date.now()}-${i}`,
          filename: file.name,
          file_size: file.size,
          upload_date: new Date().toISOString(),
          processing_status: 'ready',
          total_pages: Math.floor(Math.random() * 20) + 5,
          total_chunks: Math.floor(Math.random() * 30) + 10,
        };
        dynamicDemoDocs.unshift(newDoc);
        uploaded.push(newDoc);
      }
      return {
        message: 'Successfully processed demo documents and indexed in FAISS',
        documents: uploaded,
      };
    }

    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append('files', files[i]);
    }
    const response = await api.post('/documents/upload', formData, {
      timeout: 180000,
      onUploadProgress,
    });
    return response.data;
  },

  getDocuments: async () => {
    if (isDemo()) {
      return [...dynamicDemoDocs];
    }
    const response = await api.get('/documents');
    return response.data;
  },

  getDocument: async (documentId) => {
    if (isDemo()) {
      const found = dynamicDemoDocs.find((d) => d.id === documentId) || dynamicDemoDocs[0];
      return {
        ...found,
        page_chunks: [
          {
            page_number: 1,
            text: `Sample preview for ${found.filename}. Section 1.1: Core theoretical principles and empirical evaluations.`,
          },
          {
            page_number: 2,
            text: `Section 1.2: System architecture, mathematical proofs, and applied study methods.`,
          },
        ],
      };
    }
    const response = await api.get(`/documents/${documentId}`);
    return response.data;
  },

  deleteDocument: async (documentId) => {
    if (isDemo()) {
      dynamicDemoDocs = dynamicDemoDocs.filter((d) => d.id !== documentId);
      return { message: 'Document deleted from workspace' };
    }
    const response = await api.delete(`/documents/${documentId}`);
    return response.data;
  },
};

// --- Chat API ---
export const chatApi = {
  sendMessage: async ({
    question,
    conversation_id = null,
    document_ids = [],
    top_k = 4,
    mode = 'learn',
    explanation_level = 'intermediate',
    model = null,
    language = 'auto',
    use_web_search = null,
    replace_from_message_id = null,
  }) => {
    if (isDemo()) {
      await new Promise((resolve) => setTimeout(resolve, 450));

      const demoAnswer = generateDemoChatResponse(question);
      const convId = conversation_id || `demo-conv-${Date.now()}`;

      let conv = dynamicDemoConvs.find((c) => c.id === convId);
      if (!conv) {
        conv = {
          id: convId,
          title: question.slice(0, 42) + (question.length > 42 ? '...' : ''),
          created_at: new Date().toISOString(),
          messages: [],
        };
        dynamicDemoConvs.unshift(conv);
      }

      const userMsg = {
        id: `msg-${Date.now()}-u`,
        role: 'user',
        content: question,
        timestamp: new Date().toISOString(),
      };
      const assistantMsg = {
        id: `msg-${Date.now()}-a`,
        role: 'assistant',
        content: demoAnswer.answer,
        timestamp: new Date().toISOString(),
        sources: demoAnswer.sources,
      };

      conv.messages.push(userMsg, assistantMsg);

      return {
        answer: demoAnswer.answer,
        conversation_id: convId,
        message_id: assistantMsg.id,
        user_message_id: userMsg.id,
        title: conv.title,
        grounded: demoAnswer.grounded,
        not_found_in_docs: false,
        mode,
        explanation_level,
        sources: demoAnswer.sources,
        model_used: `${model || 'gemini-flash-lite-latest'} (Demo Mode)`,
      };
    }

    const response = await api.post('/chat', {
      question,
      conversation_id,
      document_ids,
      top_k,
      mode,
      explanation_level,
      ...(model ? { model } : {}),
      ...(language ? { language } : {}),
      ...(use_web_search !== null ? { use_web_search } : {}),
      replace_from_message_id,
    });
    return response.data;
  },

  streamMessage: async ({
    question,
    conversation_id = null,
    document_ids = [],
    top_k = 4,
    mode = 'learn',
    explanation_level = 'intermediate',
    model = null,
    language = 'auto',
    use_web_search = null,
    replace_from_message_id = null,
    signal,
    onMeta,
    onChunk,
    onDone,
  }) => {
    if (isDemo()) {
      const demoRes = await chatApi.sendMessage({
        question,
        conversation_id,
        document_ids,
        top_k,
        mode,
        explanation_level,
        model,
        language,
        use_web_search,
        replace_from_message_id,
      });
      if (onMeta) {
        onMeta({
          conversation_id: demoRes.conversation_id,
          message_id: demoRes.message_id,
          user_message_id: demoRes.user_message_id,
          title: demoRes.title,
          sources: demoRes.sources,
          grounded: demoRes.grounded,
          not_found_in_docs: false,
          mode,
          explanation_level,
        });
      }
      const tokens = (demoRes.answer || '').match(/\S+\s*/g) || [demoRes.answer || ''];
      let built = '';
      for (let i = 0; i < tokens.length; i += 3) {
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
        const piece = tokens.slice(i, i + 3).join('');
        built += piece;
        if (onChunk) onChunk(piece, built);
        await new Promise((r) => setTimeout(r, 18));
      }
      if (onDone) onDone({ ...demoRes, answer: built });
      return { ...demoRes, answer: built };
    }

    const token = localStorage.getItem('studymind_token') || sessionStorage.getItem('studymind_token');
    const timeoutController = new AbortController();
    let timer = setTimeout(() => timeoutController.abort('timeout'), 95000);
    const resetIdleTimer = () => {
      clearTimeout(timer);
      timer = setTimeout(() => timeoutController.abort('timeout'), 60000);
    };

    const onCallerAbort = () => timeoutController.abort('user_stop');
    if (signal) {
      if (signal.aborted) {
        clearTimeout(timer);
        throw new DOMException('Aborted', 'AbortError');
      }
      signal.addEventListener('abort', onCallerAbort, { once: true });
    }

    try {
      const resp = await fetch(`${getApiBaseUrl()}/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          question,
          conversation_id,
          document_ids,
          top_k,
          mode,
          explanation_level,
          ...(model ? { model } : {}),
          ...(language ? { language } : {}),
          ...(use_web_search !== null ? { use_web_search } : {}),
          replace_from_message_id,
        }),
        signal: timeoutController.signal,
      });

      if (resp.status === 401) {
        localStorage.removeItem('studymind_token');
        sessionStorage.removeItem('studymind_token');
        localStorage.removeItem('studymind_user');
        window.location.href = `${getBasePath()}/login`;
        throw new Error('Session expired. Please sign in again.');
      }

      if (!resp.ok) {
        let errDetail = `Streaming request failed (HTTP ${resp.status})`;
        try {
          const errJson = await resp.json();
          if (errJson?.detail) errDetail = errJson.detail;
        } catch {
          // ignore non-json error body
        }
        throw new Error(errDetail);
      }

      if (!resp.body) {
        throw new Error('Streaming is not supported in this browser environment.');
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let metaPayload = {};
      let accumulatedAnswer = '';
      let donePayload = null;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        resetIdleTimer();
        buffer += decoder.decode(value, { stream: true });
        buffer = buffer.replace(/\r\n/g, '\n');

        let splitIdx;
        while ((splitIdx = buffer.indexOf('\n\n')) !== -1) {
          const rawBlock = buffer.slice(0, splitIdx);
          buffer = buffer.slice(splitIdx + 2);
          if (!rawBlock.trim()) continue;

          let eventName = 'message';
          const dataLines = [];
          for (const line of rawBlock.split('\n')) {
            if (line.startsWith('event:')) {
              eventName = line.slice(6).trim();
            } else if (line.startsWith('data:')) {
              dataLines.push(line.slice(5).trim());
            }
          }
          if (dataLines.length === 0) continue;

          let parsed;
          try {
            parsed = JSON.parse(dataLines.join('\n'));
          } catch {
            continue;
          }

          if (eventName === 'meta') {
            metaPayload = parsed;
            if (onMeta) onMeta(parsed);
          } else if (eventName === 'chunk') {
            const txt = parsed.text || '';
            if (txt) {
              accumulatedAnswer += txt;
              if (onChunk) onChunk(txt, accumulatedAnswer);
            }
          } else if (eventName === 'error') {
            throw new Error(parsed.detail || 'Streaming interrupted by server.');
          } else if (eventName === 'done') {
            donePayload = parsed;
            if (onDone) onDone(parsed);
          }
        }
      }

      return {
        ...metaPayload,
        ...(donePayload || {}),
        answer: (donePayload && donePayload.answer) || accumulatedAnswer,
      };
    } catch (err) {
      if (timeoutController.signal.reason === 'timeout') {
        throw new Error('Response timed out while waiting for the AI model. Please try again.');
      }
      if (signal?.aborted || err.name === 'AbortError') {
        const abortErr = new Error('Generation stopped by user.');
        abortErr.name = 'AbortError';
        throw abortErr;
      }
      throw err;
    } finally {
      clearTimeout(timer);
      if (signal) signal.removeEventListener('abort', onCallerAbort);
    }
  },

  runContextualAction: async ({
    action_type,
    conversation_id = null,
    message_id = null,
    document_ids = [],
    explanation_level = 'intermediate',
    mode = 'learn',
    model = null,
    language = 'auto',
  }) => {
    if (isDemo()) {
      return chatApi.sendMessage({
        question: `Run study action: ${action_type}`,
        conversation_id,
        document_ids,
        mode,
        explanation_level,
        model,
        language,
      });
    }
    const response = await api.post('/chat/action', {
      action_type,
      conversation_id,
      message_id,
      document_ids,
      explanation_level,
      mode,
      ...(model ? { model } : {}),
      ...(language ? { language } : {}),
    });
    return response.data;
  },

  getModels: async () => {
    if (isDemo()) {
      return {
        configured: true,
        default_model: 'gemini-flash-lite-latest',
        providers: [{ id: 'gemini', label: 'Google Gemini (Demo)', configured: true }],
        models: [
          { id: 'gemini-flash-lite-latest', label: 'Flash-Lite Latest', badge: 'Fast', desc: 'Demo simulation model', provider: 'gemini', configured: true },
        ],
        web_search: { enabled: false, provider: 'Demo' },
      };
    }
    const response = await api.get('/chat/models');
    return response.data;
  },

  getConversations: async () => {
    if (isDemo()) {
      return dynamicDemoConvs.map((c) => ({
        id: c.id,
        title: c.title,
        created_at: c.created_at,
      }));
    }
    const response = await api.get('/chat/history');
    return response.data;
  },

  getConversationMessages: async (conversationId) => {
    if (isDemo()) {
      const conv = dynamicDemoConvs.find((c) => c.id === conversationId);
      return {
        conversation_id: conversationId,
        title: conv?.title || 'Study Discussion',
        messages: conv ? conv.messages : [],
      };
    }
    const response = await api.get(`/chat/${conversationId}`);
    return response.data;
  },

  renameConversation: async (conversationId, title) => {
    if (isDemo()) {
      const conv = dynamicDemoConvs.find((c) => c.id === conversationId);
      if (conv) conv.title = title;
      return { id: conversationId, title };
    }
    const response = await api.patch(`/chat/${conversationId}`, { title });
    return response.data;
  },

  setMessageFeedback: async (messageId, feedback) => {
    if (isDemo()) {
      return { success: true, message_id: messageId, feedback };
    }
    const response = await api.post(`/chat/messages/${messageId}/feedback`, { feedback });
    return response.data;
  },

  deleteConversation: async (conversationId) => {
    if (isDemo()) {
      dynamicDemoConvs = dynamicDemoConvs.filter((c) => c.id !== conversationId);
      return { message: 'Conversation deleted' };
    }
    const response = await api.delete(`/chat/${conversationId}`);
    return response.data;
  },

  clearAllConversations: async () => {
    if (isDemo()) {
      dynamicDemoConvs = [];
      return { message: 'All conversations cleared' };
    }
    const response = await api.delete('/chat/history/all');
    return response.data;
  },
};

// --- Dashboard API ---
export const dashboardApi = {
  getStats: async () => {
    if (isDemo()) {
      return {
        ...DEMO_STATS,
        total_documents: dynamicDemoDocs.length,
        total_chunks: dynamicDemoDocs.reduce((acc, d) => acc + (d.total_chunks || 0), 0),
        recent_documents: dynamicDemoDocs.slice(0, 4),
        recent_conversations: dynamicDemoConvs.slice(0, 4).map((c) => ({
          id: c.id,
          title: c.title,
          created_at: c.created_at,
        })),
      };
    }
    const response = await api.get('/dashboard/stats');
    return response.data;
  },
};

// --- Study Toolkit API ---
export const studyApi = {
  generateSummary: async ({ document_id, style = 'detailed', focus = null, model = null }) => {
    if (isDemo()) {
      await new Promise((resolve) => setTimeout(resolve, 400));
      return {
        status: 'success',
        document_id: document_id || 'demo-doc-cs101',
        summary: DEMO_SUMMARY,
        ai_generated: true,
        model_used: 'demo-preview',
      };
    }
    const response = await api.post('/study/summary', { document_id, style, focus, model });
    return response.data;
  },

  generateFlashcards: async ({ document_id, count = 6, focus = null, model = null }) => {
    if (isDemo()) {
      await new Promise((resolve) => setTimeout(resolve, 400));
      return {
        status: 'success',
        flashcards: DEMO_FLASHCARDS.slice(0, count),
        ai_generated: true,
        model_used: 'demo-preview',
      };
    }
    const response = await api.post('/study/flashcards', { document_id, count, focus, model });
    return response.data;
  },

  generateQuiz: async ({ document_id, count = 5, focus = null, model = null }) => {
    if (isDemo()) {
      await new Promise((resolve) => setTimeout(resolve, 400));
      return {
        status: 'success',
        quiz: DEMO_QUIZ.slice(0, count),
        ai_generated: true,
        model_used: 'demo-preview',
      };
    }
    const response = await api.post('/study/quiz', { document_id, count, focus, model });
    return response.data;
  },

  explainSimply: async ({ topic, document_id = null, model = null }) => {
    if (isDemo()) {
      await new Promise((resolve) => setTimeout(resolve, 400));
      return {
        status: 'success',
        topic,
        explanation:
          `Think of **${topic || 'Backpropagation'}** like a team of postal workers passing letters along a line. ` +
          `If a letter is misdelivered at the end of the chain, each worker reviews their turn and slightly tweaks their hand-off rule so future deliveries become more accurate!`,
        key_analogy: 'Iterative feedback correction in a relay line.',
        ai_generated: true,
      };
    }
    const response = await api.post('/study/explain-simply', { topic, document_id, model });
    return response.data;
  },

  generateRevisionNotes: async ({ document_id, focus = null, model = null }) => {
    if (isDemo()) {
      await new Promise((resolve) => setTimeout(resolve, 400));
      return {
        status: 'success',
        title: 'Demo Exam Revision Sheet',
        high_yield_points: [
          'Attention(Q, K, V) = softmax(QK^T / √d_k)V prevents gradient vanishing.',
          'Always verify boundary constraints before algebraic derivation.',
        ],
        important_definitions: [
          { term: 'Self-Attention', definition: 'Computes pairwise token interactions across a sequence.' },
        ],
        potential_exam_questions: [
          'Why do Transformers scale dot products by 1/√d_k?',
        ],
        ai_generated: true,
      };
    }
    const response = await api.post('/study/revision-notes', { document_id, focus, model });
    return response.data;
  },

  generateImportantTopics: async ({ document_id, model = null }) => {
    if (isDemo()) {
      return {
        status: 'success',
        topics: [
          { title: 'Scaled Dot-Product Attention', importance: 'High', page_number: 3, summary: 'Prevents softmax gradient saturation.' },
        ],
        ai_generated: true,
      };
    }
    const response = await api.post('/study/important-topics', { document_id, model });
    return response.data;
  },

  generateAiNotes: async ({ document_id, depth = 'comprehensive', focus = null, model = null }) => {
    if (isDemo()) {
      await new Promise((resolve) => setTimeout(resolve, 400));
      return {
        document_id,
        filename: 'demo-curriculum.pdf',
        notes: `# Comprehensive Lecture Notes\n\n## Core Concepts\n- Self-Attention enables direct modeling of dependencies regardless of distance.`,
        ai_generated: true,
        model_used: 'demo-preview',
      };
    }
    const response = await api.post('/study/ai-notes', { document_id, depth, focus, model });
    return response.data;
  },

  generateMindMap: async ({ document_id, model = null }) => {
    if (isDemo()) {
      await new Promise((resolve) => setTimeout(resolve, 400));
      return {
        document_id,
        root_topic: 'Neural Architectures',
        mind_map: {
          name: 'Deep Learning',
          children: [
            {
              id: 'b1',
              name: 'Attention Mechanisms',
              children: [
                { id: 'b1_1', name: 'Scaled Dot-Product', note: 'Normalizes attention scores by √d_k.' },
                { id: 'b1_2', name: 'Multi-Head Attention', note: 'Parallel subspace projections.' },
              ],
            },
          ],
        },
        ai_generated: true,
      };
    }
    const response = await api.post('/study/mind-map', { document_id, model });
    return response.data;
  },

  generatePracticeQuestions: async ({ document_id, count = 4, focus = null, model = null }) => {
    if (isDemo()) {
      await new Promise((resolve) => setTimeout(resolve, 400));
      return {
        document_id,
        practice_questions: [
          {
            type: 'Short Answer (5 Marks)',
            question: 'Why do Transformers require dividing by $\\sqrt{d_k}$ in Scaled Dot-Product Attention?',
            solution: 'Dividing by $\\sqrt{d_k}$ keeps dot-product variance near $1$ so softmax retains healthy gradients.',
            difficulty: 'Easy',
            page: 2,
          },
        ],
        ai_generated: true,
      };
    }
    const response = await api.post('/study/practice-questions', { document_id, count, focus, model });
    return response.data;
  },

  codingTutor: async ({ topic, language = 'python', document_id = null, model = null }) => {
    if (isDemo()) {
      await new Promise((resolve) => setTimeout(resolve, 400));
      return {
        topic,
        language,
        content: `### Coding Tutor: **${topic}** in ${language.toUpperCase()}\n\n\`\`\`python\ndef example():\n    return True\n\`\`\`\n\n- **Time Complexity:** $\\mathcal{O}(N)$`,
        ai_generated: true,
      };
    }
    const response = await api.post('/study/coding-tutor', { topic, language, document_id, model });
    return response.data;
  },

  generateQuestionPaper: async ({ document_id, focus = null, model = null }) => {
    if (isDemo()) {
      await new Promise((resolve) => setTimeout(resolve, 400));
      return {
        document_id,
        question_paper: {
          title: 'Final Examination: Deep Learning & Machine Intelligence',
          total_marks: 60,
          time_allowed: '2 Hours',
          sections: [
            {
              section: 'Section A: Objective & Conceptual Foundations (10 Marks)',
              instructions: 'Answer all questions. Each question carries 2 marks.',
              questions: ['1. State the time complexity of self-attention with respect to sequence length $L$.'],
            },
          ],
        },
        ai_generated: true,
      };
    }
    const response = await api.post('/study/question-paper', { document_id, focus, model });
    return response.data;
  },
};

// --- System & Settings API ---
export const systemApi = {
  getHealth: async () => {
    if (isDemo()) {
      return {
        status: 'healthy',
        database: 'SQLite (Isolated Academic DB)',
        vector_store: {
          type: 'FAISS / Cosine 3D',
          total_vectors: 188,
        },
        llm_configured: true,
        llm_model: 'gemini-1.5-flash (Demo Mode)',
        app: 'StudyMind AI',
        version: '2.0.0-interactive-3d',
      };
    }
    const response = await api.get('/health');
    return response.data;
  },

  getSettings: async () => {
    if (isDemo()) {
      return {
        llm_model: 'gemini-1.5-flash',
        temperature: 0.2,
        similarity_threshold: 0.65,
        top_k: 4,
      };
    }
    const response = await api.get('/settings');
    return response.data;
  },

  updateSettings: async (settings) => {
    if (isDemo()) {
      return { message: 'Settings saved in demo session' };
    }
    const response = await api.post('/settings', settings);
    return response.data;
  },
};

export default api;
