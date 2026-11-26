import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  User,
  GraduationCap,
  Copy,
  Check,
  FileText,
  ShieldCheck,
  Sparkles,
  Volume2,
  VolumeX,
  ExternalLink,
  Lightbulb,
  BookOpen,
  HelpCircle,
  Layers,
  ThumbsUp,
  ThumbsDown,
  RotateCcw,
  Pencil,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Info,
  ClipboardCheck,
  Send,
  X,
  Globe,
} from 'lucide-react';
import RichMarkdown from './RichMarkdown';

/**
 * Strips legacy PPT bullet glyphs and old redundant echoes while preserving
 * Markdown tables, code blocks, callouts, and LaTeX formatting intact.
 */
function sanitizeContent(rawText) {
  if (!rawText) return '';
  return rawText
    .replace(/[\uf0a7\u25aa\u2022\u25cf\u25cb\u25a0\u25a1\uf0b7]/g, ' ')
    .replace(/^(?:###\s*📚\s*)?Answer\s+to:\s*"[^"]*"\s*\n*/i, '')
    .replace(/\n*Exact\s+Source\s+References:[^\n]*/gi, '')
    .replace(/\(\s*Source:\s*[^)]+\)/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const CONTEXTUAL_ACTIONS = [
  { id: 'explain_simpler', label: 'Explain simpler', icon: Sparkles },
  { id: 'example', label: 'Give an example', icon: Lightbulb },
  { id: 'summarize', label: 'Summarize', icon: BookOpen },
  { id: 'mcqs', label: 'Generate MCQs', icon: HelpCircle },
  { id: 'flashcards', label: 'Create flashcards', icon: Layers },
  { id: 'practice_questions', label: 'Give practice questions', icon: ClipboardCheck },
];

export default function ChatBubble({
  message,
  onNavigateToDoc,
  onContextualAction,
  onRegenerate,
  onEditUserMessage,
  onFeedback,
  onFollowUpClick,
  isLastMessage = false,
  disabledActions = false,
}) {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';
  const isStreaming = Boolean(message.isStreaming);

  const [copied, setCopied] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [expandedSourceIdx, setExpandedSourceIdx] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editDraft, setEditDraft] = useState('');
  const [localFeedback, setLocalFeedback] = useState(message.feedback || null);
  const contentRef = useRef(null);

  useEffect(() => {
    setLocalFeedback(message.feedback || null);
  }, [message.feedback]);

  const rawContent = message.content || message.message || '';
  const displayContent = useMemo(
    () => (isUser ? rawContent : sanitizeContent(rawContent)),
    [rawContent, isUser]
  );
  const rawSources = message.sources || message.source_metadata || [];

  useEffect(() => {
    if (isStreaming) return;
    let t1;
    const renderMath = () => {
      if (contentRef.current && typeof window !== 'undefined' && window.renderMathInElement) {
        try {
          window.renderMathInElement(contentRef.current, {
            delimiters: [
              { left: '$$', right: '$$', display: true },
              { left: '$', right: '$', display: false },
              { left: '\\[', right: '\\]', display: true },
              { left: '\\(', right: '\\)', display: false },
            ],
            ignoredTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code'],
            throwOnError: false,
          });
        } catch {
          // ignore KaTeX parse fallback
        }
      }
    };
    renderMath();
    t1 = setTimeout(renderMath, 180);
    return () => clearTimeout(t1);
  }, [displayContent, isStreaming]);

  const uniqueSources = useMemo(() => {
    if (!Array.isArray(rawSources)) return [];
    const seen = new Set();
    const result = [];
    for (const src of rawSources) {
      if (!src) continue;
      const fn = src.filename || 'Document';
      const pg = src.page || src.page_number || 1;
      const key = `${fn}_${pg}`;
      if (!seen.has(key)) {
        seen.add(key);
        result.push({
          ...src,
          filename: fn,
          page: pg,
        });
      }
    }
    return result;
  }, [rawSources]);

  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const handleCopy = () => {
    navigator.clipboard.writeText(displayContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleTextToSpeech = () => {
    if (!('speechSynthesis' in window)) {
      alert('Text-to-Speech is not supported in this browser.');
      return;
    }
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }
    const cleanText = displayContent
      .replace(/```[\s\S]*?```/g, 'Code example omitted.')
      .replace(/[#*`_~|]/g, '')
      .replace(/\[(.*?)\]\(.*?\)/g, '$1')
      .replace(/\n+/g, ' ')
      .trim();
    if (!cleanText) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.0;
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  const handleFeedbackClick = (val) => {
    const nextVal = localFeedback === val ? null : val;
    setLocalFeedback(nextVal);
    if (onFeedback && message.id) {
      onFeedback(message.id, nextVal);
    }
  };

  const startEditing = () => {
    setEditDraft(rawContent);
    setIsEditing(true);
  };

  const submitEdit = () => {
    const trimmed = editDraft.trim();
    if (!trimmed || !onEditUserMessage) return;
    setIsEditing(false);
    onEditUserMessage(trimmed);
  };

  if (isSystem) {
    return (
      <div className="py-2 px-3.5 max-w-2xl mx-auto my-2 rounded-xl text-xs flex items-center gap-2.5 bg-[#141414] border border-[#262626]">
        <Info className="w-3.5 h-3.5 shrink-0 text-[#9A9A9A]" />
        <div className="flex-1 font-medium text-[#9A9A9A]">{displayContent}</div>
      </div>
    );
  }

  return (
    <div
      className={`group/msg py-2.5 sm:py-3 flex ${
        isUser ? 'justify-start animate-msg-left' : 'justify-end animate-msg-right'
      }`}
    >
      <div
        className={`flex items-start gap-2.5 sm:gap-3 ${
          isUser
            ? 'flex-row max-w-[86%] sm:max-w-[76%]'
            : 'flex-row-reverse max-w-[94%] sm:max-w-[84%]'
        }`}
      >
        {/* Avatar matching StudyMind AI monochrome brand */}
        <div className="shrink-0 mt-0.5">
          {isUser ? (
            <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-[#1A1A1A] border border-[#262626]">
              <User className="w-3.5 h-3.5 text-[#9A9A9A]" />
            </div>
          ) : (
            <div
              className={`w-7 h-7 rounded-lg flex items-center justify-center bg-white text-black shadow-sm transition-transform ${
                isStreaming ? 'animate-pulse ring-2 ring-white/25' : ''
              }`}
            >
              <GraduationCap className="w-4 h-4 stroke-[2.4]" />
            </div>
          )}
        </div>

        {/* Content Body */}
        <div className={`min-w-0 space-y-1.5 ${isUser ? 'items-start' : 'flex-1'}`}>
          {/* Header */}
          <div
            className={`flex flex-wrap items-center gap-2 ${
              isUser ? 'justify-between' : 'flex-row-reverse justify-between'
            }`}
          >
            <div className={`flex flex-wrap items-center gap-1.5 ${isUser ? '' : 'flex-row-reverse'}`}>
              <span className="text-[11px] font-semibold text-white">
                {isUser ? 'You' : 'StudyMind AI'}
              </span>
              {!isUser && uniqueSources.length > 0 && (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#141414] border border-[#262626] text-emerald-400">
                  <ShieldCheck className="w-2.5 h-2.5" />
                  {uniqueSources.length} source{uniqueSources.length !== 1 ? 's' : ''}
                </span>
              )}
              {!isUser && message.not_found_in_docs && (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#141414] border border-amber-500/30 text-amber-300">
                  <AlertTriangle className="w-2.5 h-2.5" />
                  Not in PDFs
                </span>
              )}
              {!isUser && message.mode && (
                <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded-md bg-[#141414] border border-[#222222] text-[#9A9A9A]">
                  {message.mode}
                </span>
              )}
              {!isUser && isStreaming && (
                <span className="inline-flex items-center gap-1 text-[10px] text-[#9A9A9A] font-mono">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                  Replying
                </span>
              )}
            </div>

            {/* Message Toolbar */}
            {isUser ? (
              !isEditing &&
              onEditUserMessage && (
                <button
                  type="button"
                  disabled={disabledActions}
                  onClick={startEditing}
                  className="sm:opacity-0 sm:group-hover/msg:opacity-100 focus-within:opacity-100 inline-flex items-center gap-1 text-[11px] text-[#9A9A9A] hover:text-white px-2 py-0.5 rounded-lg transition disabled:opacity-30"
                  title="Edit and resend question"
                >
                  <Pencil className="w-3 h-3" />
                  <span>Edit</span>
                </button>
              )
            ) : (
              displayContent &&
              !isStreaming && (
                <div className="flex flex-wrap items-center gap-1 sm:opacity-0 sm:group-hover/msg:opacity-100 focus-within:opacity-100 transition">
                  <button
                    type="button"
                    onClick={handleTextToSpeech}
                    className={`inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg transition ${
                      isSpeaking
                        ? 'bg-[#242424] text-white border border-[#3A3A3A]'
                        : 'text-[#9A9A9A] hover:text-white'
                    }`}
                    title={isSpeaking ? 'Stop reading aloud' : 'Read answer aloud'}
                  >
                    {isSpeaking ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
                    <span className="hidden sm:inline">{isSpeaking ? 'Stop' : 'Listen'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCopy}
                    className={`inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg transition ${
                      copied ? 'text-emerald-400' : 'text-[#9A9A9A] hover:text-white'
                    }`}
                    title="Copy response"
                  >
                    {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    <span className="hidden sm:inline">{copied ? 'Copied' : 'Copy'}</span>
                  </button>

                  {onRegenerate && (
                    <button
                      type="button"
                      disabled={disabledActions}
                      onClick={onRegenerate}
                      className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg text-[#9A9A9A] hover:text-white transition disabled:opacity-30"
                      title="Regenerate response"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span className="hidden sm:inline">Retry</span>
                    </button>
                  )}

                  {onFeedback && message.id && (
                    <div className="flex items-center gap-0.5 pl-1 border-l border-[#222222]">
                      <button type="button" onClick={() => handleFeedbackClick('helpful')}
                        className={`p-1.5 rounded-lg transition ${
                          localFeedback === 'helpful' ? 'text-emerald-400 bg-emerald-500/10' : 'text-[#9A9A9A] hover:text-white'
                        }`}
                        title="Helpful">
                        <ThumbsUp className="w-3 h-3" />
                      </button>
                      <button type="button" onClick={() => handleFeedbackClick('not_helpful')}
                        className={`p-1.5 rounded-lg transition ${
                          localFeedback === 'not_helpful' ? 'text-rose-400 bg-rose-500/10' : 'text-[#9A9A9A] hover:text-white'
                        }`}
                        title="Not helpful">
                        <ThumbsDown className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              )
            )}
          </div>

          {/* User Edit Mode vs Normal Message Body */}
          {isUser && isEditing ? (
            <div className="space-y-2">
              <textarea
                rows={3}
                value={editDraft}
                onChange={(e) => setEditDraft(e.target.value)}
                className="w-full p-3 rounded-xl text-sm text-white bg-[#141414] border border-[#3A3A3A] focus:outline-none focus:border-white/40 resize-y"
              />
              <div className="flex items-center justify-end gap-2">
                <button type="button" onClick={() => setIsEditing(false)}
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs text-[#9A9A9A] hover:text-white bg-[#1A1A1A] border border-[#262626] transition">
                  <X className="w-3 h-3" /> Cancel
                </button>
                <button type="button" disabled={!editDraft.trim()} onClick={submitEdit}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-white text-black hover:bg-neutral-200 disabled:opacity-40 transition">
                  <Send className="w-3 h-3" /> Save & Resend
                </button>
              </div>
            </div>
          ) : (
            <div
              ref={contentRef}
              className={`text-sm text-[#E5E5E5] leading-relaxed font-sans break-words prose prose-invert prose-sm max-w-none prose-headings:text-white prose-strong:text-white prose-a:text-white prose-a:underline prose-p:text-[#E5E5E5] prose-li:text-[#E5E5E5] ${
                isUser
                  ? 'text-left'
                  : `text-left rounded-2xl rounded-tr-sm px-4 py-3 bg-[#141414] border transition-colors ${
                      isStreaming ? 'reply-streaming-card border-white/20' : 'border-[#242424]'
                    }`
              }`}
            >
              {isUser ? (
                <div className="inline-block max-w-full rounded-2xl rounded-tl-sm px-4 py-2.5 bg-[#1A1A1A] border border-[#262626] text-white">
                  <p className="whitespace-pre-wrap m-0 text-white">{displayContent}</p>
                </div>
              ) : isStreaming && !displayContent ? (
                <div className="flex items-center gap-2.5 text-xs text-[#9A9A9A] py-0.5">
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-typing-dot-1" />
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-typing-dot-2" />
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-typing-dot-3" />
                  </span>
                  <span>Thinking…</span>
                </div>
              ) : (
                <>
                  <RichMarkdown content={displayContent} />
                  {isStreaming && (
                    <span className="inline-block w-1.5 h-4 ml-1 align-middle bg-white rounded-sm animate-stream-cursor" />
                  )}
                </>
              )}
            </div>
          )}

          {/* Contextual Action Buttons */}
          {!isUser && !isStreaming && displayContent && onContextualAction && (
            <div className="pt-2 flex flex-wrap items-center justify-end gap-1.5 text-xs animate-fade-in-up">
              {CONTEXTUAL_ACTIONS.map((btn) => {
                const Icon = btn.icon;
                return (
                  <button
                    key={btn.id}
                    type="button"
                    disabled={disabledActions}
                    onClick={() => onContextualAction(btn.id, message)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-[#141414] border border-[#262626] text-[#9A9A9A] hover:text-white hover:border-[#3A3A3A] hover:bg-[#1A1A1A] transition disabled:opacity-30"
                  >
                    <Icon className="w-3 h-3 text-[#9A9A9A]" />
                    <span>{btn.label}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Citations with Clickable Page Jump & Relevant Source Passage Drawer */}
          {!isUser && uniqueSources.length > 0 && (
            <div className="pt-2 mt-1 border-t border-[#222222] space-y-2 text-xs animate-fade-in-up">
              <div className="flex flex-wrap items-center justify-end gap-1.5">
                <span className="text-[11px] text-[#9A9A9A] font-medium mr-0.5 flex items-center gap-1">
                  <FileText className="w-3 h-3 text-white" />
                  Sources:
                </span>
                {uniqueSources.map((src, idx) => {
                  const isExpanded = expandedSourceIdx === idx;
                  const scorePct =
                    typeof src.relevance_score === 'number'
                      ? `${Math.round(src.relevance_score * 100)}%`
                      : null;
                  return (
                    <div key={idx} className="inline-flex items-center rounded-lg overflow-hidden bg-[#141414] border border-[#262626] transition">
                      <button
                        type="button"
                        onClick={() => setExpandedSourceIdx(isExpanded ? null : idx)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] text-[#9A9A9A] hover:text-white transition"
                        title="Preview retrieved source passage"
                      >
                        <span className="truncate max-w-[140px] font-medium">{src.filename}</span>
                        <span className="text-[10px] font-mono px-1.5 rounded bg-[#1F1F1F] text-white">
                          p.{src.page}
                        </span>
                        {scorePct && (
                          <span className="text-[10px] font-mono text-[#666666]">{scorePct}</span>
                        )}
                        {isExpanded ? (
                          <ChevronUp className="w-3 h-3 text-[#9A9A9A]" />
                        ) : (
                          <ChevronDown className="w-3 h-3 text-[#9A9A9A]" />
                        )}
                      </button>
                      {onNavigateToDoc && src.document_id && (
                        <button
                          type="button"
                          onClick={() => onNavigateToDoc(src.document_id, src.page)}
                          className="px-2 py-1 border-l border-[#262626] text-[#9A9A9A] hover:text-white transition"
                          title={`Open ${src.filename} (Page ${src.page}) in Viewer`}
                        >
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {expandedSourceIdx !== null && uniqueSources[expandedSourceIdx] && (
                <div className="p-3 rounded-xl space-y-1.5 bg-[#141414] border border-[#262626]">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-white">
                      {uniqueSources[expandedSourceIdx].filename} — Page {uniqueSources[expandedSourceIdx].page}
                    </span>
                    {onNavigateToDoc && uniqueSources[expandedSourceIdx].document_id && (
                      <button
                        type="button"
                        onClick={() => onNavigateToDoc(uniqueSources[expandedSourceIdx].document_id, uniqueSources[expandedSourceIdx].page)}
                        className="inline-flex items-center gap-1 text-white hover:underline font-medium"
                      >
                        Open in Viewer <ExternalLink className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  <p className="text-[#9A9A9A] leading-relaxed italic whitespace-pre-wrap text-xs">
                    "{uniqueSources[expandedSourceIdx].text}"
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Live Web Search Citations */}
          {!isUser && Array.isArray(message.web_sources) && message.web_sources.length > 0 && (
            <div className="pt-2 mt-1 border-t border-[#222222] flex flex-wrap items-center justify-end gap-1.5 text-xs animate-fade-in-up">
              <span className="text-[11px] text-[#9A9A9A] font-medium mr-0.5 flex items-center gap-1">
                <Globe className="w-3 h-3 text-white" />
                Web:
              </span>
              {message.web_sources.map((ws, idx) => (
                <a
                  key={idx}
                  href={ws.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] bg-[#141414] border border-[#262626] text-[#E5E5E5] hover:text-white hover:border-[#3A3A3A] transition"
                  title={ws.snippet || ws.url}
                >
                  <span className="truncate max-w-[170px] font-medium">{ws.title}</span>
                  <ExternalLink className="w-2.5 h-2.5 shrink-0 text-[#9A9A9A]" />
                </a>
              ))}
            </div>
          )}

          {/* Clickable Follow-up Suggestions (on latest assistant message) */}
          {!isUser && !isStreaming && isLastMessage && Array.isArray(message.follow_up_suggestions) && message.follow_up_suggestions.length > 0 && onFollowUpClick && (
            <div className="pt-1.5 flex flex-wrap items-center justify-end gap-1.5 animate-fade-in-up">
              {message.follow_up_suggestions.map((sug, idx) => (
                <button
                  key={idx}
                  type="button"
                  disabled={disabledActions}
                  onClick={() => onFollowUpClick(sug)}
                  className="px-3 py-1 rounded-full text-[11px] font-medium bg-[#141414] border border-[#262626] text-[#9A9A9A] hover:text-white hover:border-[#3A3A3A] hover:bg-[#1A1A1A] transition disabled:opacity-35"
                >
                  {sug} →
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
