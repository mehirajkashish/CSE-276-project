import React, { useState, useEffect, useMemo, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
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
} from 'lucide-react';

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

const CODE_TOKEN_REGEX =
  /(\/\/[^\n]*|#[^\n]*|\/\*[\s\S]*?\*\/|"""[\s\S]*?"""|'''[\s\S]*?'''|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|\b(?:def|class|return|import|from|as|if|elif|else|for|while|break|continue|try|except|finally|raise|with|yield|async|await|lambda|pass|True|False|None|const|let|var|function|export|default|switch|case|new|throw|catch|typeof|interface|type|public|private|static|void|int|float|double|string|bool|struct|enum|SELECT|FROM|WHERE|JOIN|GROUP|BY|ORDER|INSERT|UPDATE|DELETE)\b|\b\d+(?:\.\d+)?\b)/g;

const KEYWORDS_SET = new Set([
  'def', 'class', 'return', 'import', 'from', 'as', 'if', 'elif', 'else', 'for', 'while',
  'break', 'continue', 'try', 'except', 'finally', 'raise', 'with', 'yield', 'async', 'await',
  'lambda', 'pass', 'True', 'False', 'None', 'const', 'let', 'var', 'function', 'export',
  'default', 'switch', 'case', 'new', 'throw', 'catch', 'typeof', 'interface', 'type', 'public',
  'private', 'static', 'void', 'int', 'float', 'double', 'string', 'bool', 'struct', 'enum',
  'SELECT', 'FROM', 'WHERE', 'JOIN', 'GROUP', 'BY', 'ORDER', 'INSERT', 'UPDATE', 'DELETE',
]);

function highlightCodeLine(code) {
  const nodes = [];
  let lastIndex = 0;
  let match;
  CODE_TOKEN_REGEX.lastIndex = 0;
  let key = 0;
  while ((match = CODE_TOKEN_REGEX.exec(code)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(<span key={key++}>{code.slice(lastIndex, match.index)}</span>);
    }
    const token = match[0];
    let cls = 'text-[#E2E8F0]';
    if (token.startsWith('//') || token.startsWith('#') || token.startsWith('/*')) {
      cls = 'text-[#64748B] italic';
    } else if (
      token.startsWith('"') ||
      token.startsWith("'") ||
      token.startsWith('`')
    ) {
      cls = 'text-emerald-300';
    } else if (KEYWORDS_SET.has(token)) {
      cls = 'text-[#8B7CFF] font-medium';
    } else if (/^\d/.test(token)) {
      cls = 'text-amber-300';
    }
    nodes.push(
      <span key={key++} className={cls}>
        {token}
      </span>
    );
    lastIndex = CODE_TOKEN_REGEX.lastIndex;
  }
  if (lastIndex < code.length) {
    nodes.push(<span key={key++}>{code.slice(lastIndex)}</span>);
  }
  return nodes;
}

function CodeBlock({ className, children }) {
  const [copiedCode, setCopiedCode] = useState(false);
  const rawCode = String(children || '').replace(/\n$/, '');
  const langMatch = /language-([\w-]+)/.exec(className || '');
  const lang = langMatch ? langMatch[1] : '';

  const handleCopyCode = () => {
    navigator.clipboard.writeText(rawCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 1800);
  };

  return (
    <div className="my-3 rounded-xl overflow-hidden border border-[#1E2E4A] bg-[#080D18] shadow-lg not-prose">
      <div className="flex items-center justify-between px-3.5 py-2 bg-[#0D1628] border-b border-[#1E2E4A] text-[11px]">
        <span className="font-mono font-semibold uppercase tracking-wider text-[#4F8CFF]">
          {lang || 'code'}
        </span>
        <button
          type="button"
          onClick={handleCopyCode}
          className="inline-flex items-center gap-1.5 text-[#8A9BB8] hover:text-[#F1F5FC] transition px-2 py-0.5 rounded-md hover:bg-[#16243B]"
        >
          {copiedCode ? (
            <>
              <Check className="w-3 h-3 text-emerald-400" />
              <span className="text-emerald-400 font-medium">Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" />
              <span>Copy code</span>
            </>
          )}
        </button>
      </div>
      <pre className="p-3.5 overflow-x-auto text-xs leading-relaxed font-mono text-[#F1F5FC] select-text m-0">
        <code>{highlightCodeLine(rawCode)}</code>
      </pre>
    </div>
  );
}

function DisplayMath({ formula }) {
  const [html, setHtml] = useState(() => {
    if (typeof window !== 'undefined' && window.katex) {
      try {
        return window.katex.renderToString(formula.trim(), {
          displayMode: true,
          throwOnError: false,
        });
      } catch {
        return null;
      }
    }
    return null;
  });

  useEffect(() => {
    let interval;
    let timeout;
    const tryRender = () => {
      if (typeof window !== 'undefined' && window.katex) {
        try {
          const res = window.katex.renderToString(formula.trim(), {
            displayMode: true,
            throwOnError: false,
          });
          setHtml(res);
          return true;
        } catch {
          return false;
        }
      }
      return false;
    };

    if (!html && !tryRender()) {
      interval = setInterval(() => {
        if (tryRender()) clearInterval(interval);
      }, 150);
      timeout = setTimeout(() => clearInterval(interval), 4000);
    }

    return () => {
      if (interval) clearInterval(interval);
      if (timeout) clearTimeout(timeout);
    };
  }, [formula, html]);

  if (html) {
    return (
      <div
        className="my-3 py-3 px-4 overflow-x-auto bg-[#080D18] rounded-xl border border-[#1E2E4A] text-center shadow-sm select-text text-[#F1F5FC]"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }

  return (
    <div className="my-3 py-3 px-4 overflow-x-auto bg-[#080D18] rounded-xl border border-[#1E2E4A] text-center font-mono text-xs text-[#F1F5FC] select-text">
      $${formula}$$
    </div>
  );
}

function InlineMath({ formula }) {
  const [html, setHtml] = useState(() => {
    if (typeof window !== 'undefined' && window.katex) {
      try {
        return window.katex.renderToString(formula.trim(), {
          displayMode: false,
          throwOnError: false,
        });
      } catch {
        return null;
      }
    }
    return null;
  });

  useEffect(() => {
    let interval;
    let timeout;
    const tryRender = () => {
      if (typeof window !== 'undefined' && window.katex) {
        try {
          const res = window.katex.renderToString(formula.trim(), {
            displayMode: false,
            throwOnError: false,
          });
          setHtml(res);
          return true;
        } catch {
          return false;
        }
      }
      return false;
    };

    if (!html && !tryRender()) {
      interval = setInterval(() => {
        if (tryRender()) clearInterval(interval);
      }, 150);
      timeout = setTimeout(() => clearInterval(interval), 4000);
    }

    return () => {
      if (interval) clearInterval(interval);
      if (timeout) clearTimeout(timeout);
    };
  }, [formula, html]);

  if (html) {
    return <span className="inline-math px-0.5" dangerouslySetInnerHTML={{ __html: html }} />;
  }

  return <span className="font-mono text-[#4F8CFF] font-semibold text-xs px-0.5">${formula}$</span>;
}

const markdownComponents = {
  pre: ({ children }) => <>{children}</>,
  code: ({ inline, className, children, ...props }) => {
    const text = String(children || '');
    const isBlock = !inline && (className?.includes('language-') || text.includes('\n'));
    if (isBlock) {
      return <CodeBlock className={className}>{children}</CodeBlock>;
    }
    return (
      <code
        className="px-1.5 py-0.5 rounded-md bg-[#080D18] border border-[#1E2E4A] text-[#4F8CFF] font-mono text-[12px]"
        {...props}
      >
        {children}
      </code>
    );
  },
  table: ({ children }) => (
    <div className="my-3 overflow-x-auto rounded-xl border border-[#1E2E4A] bg-[#080D18]">
      <table className="w-full text-left border-collapse text-xs">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-[#0D1628] border-b border-[#1E2E4A] text-[#F1F5FC] font-semibold">{children}</thead>
  ),
  th: ({ children }) => <th className="px-3.5 py-2.5 text-xs font-semibold text-[#F1F5FC]">{children}</th>,
  td: ({ children }) => <td className="px-3.5 py-2 text-xs text-[#CBD5E1] border-t border-[#1E2E4A]/70">{children}</td>,
  blockquote: ({ children }) => {
    const flatText = React.Children.toArray(children)
      .map((c) => (typeof c === 'string' ? c : c?.props?.children || ''))
      .flat()
      .map((x) => (typeof x === 'string' ? x : x?.props?.children || ''))
      .join(' ')
      .toLowerCase();

    const isWarning = flatText.includes('warning') || flatText.includes('not found');
    const isAnswer = flatText.includes('answer') || flatText.includes('solution');

    return (
      <blockquote
        className={`my-3 px-4 py-2.5 rounded-xl border-l-4 not-italic text-xs leading-relaxed ${
          isWarning
            ? 'bg-amber-500/10 border-l-amber-400 border border-amber-500/25 text-amber-100'
            : isAnswer
            ? 'bg-emerald-500/10 border-l-emerald-400 border border-emerald-500/25 text-emerald-100'
            : 'bg-[#4F8CFF]/10 border-l-[#4F8CFF] border border-[#4F8CFF]/25 text-[#E2E8F0]'
        }`}
      >
        {children}
      </blockquote>
    );
  },
};

function TextSegmentWithInlineMath({ text }) {
  const inlineRegex = /(\$(?!\s)[^\$\n]+?(?<!\s)\$|\\\([^\n]+?\\\))/g;
  const subparts = text.split(inlineRegex);

  if (subparts.length === 1) {
    return (
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {text}
      </ReactMarkdown>
    );
  }

  return (
    <div className="leading-relaxed">
      {subparts.map((sub, sIdx) => {
        if (!sub) return null;

        if (sub.startsWith('$') && sub.endsWith('$') && sub.length >= 3) {
          return <InlineMath key={sIdx} formula={sub.slice(1, -1)} />;
        }
        if (sub.startsWith('\\(') && sub.endsWith('\\)') && sub.length >= 4) {
          return <InlineMath key={sIdx} formula={sub.slice(2, -2)} />;
        }

        return (
          <ReactMarkdown
            key={sIdx}
            remarkPlugins={[remarkGfm]}
            components={{
              ...markdownComponents,
              p: ({ children }) => <span>{children}</span>,
            }}
          >
            {sub}
          </ReactMarkdown>
        );
      })}
    </div>
  );
}

function MarkdownWithMath({ content }) {
  if (!content) return null;

  const displayRegex = /(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\])/g;
  const parts = content.split(displayRegex);

  return (
    <div className="space-y-2">
      {parts.map((part, pIdx) => {
        if (!part) return null;

        if (part.startsWith('$$') && part.endsWith('$$') && part.length >= 4) {
          return <DisplayMath key={pIdx} formula={part.slice(2, -2)} />;
        }
        if (part.startsWith('\\[') && part.endsWith('\\]') && part.length >= 4) {
          return <DisplayMath key={pIdx} formula={part.slice(2, -2)} />;
        }

        return <TextSegmentWithInlineMath key={pIdx} text={part} />;
      })}
    </div>
  );
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
      <div className="py-2.5 px-4 max-w-2xl mx-auto my-2 rounded-xl bg-[#111C2E] border border-[#1E2E4A] text-[#F1F5FC] text-xs flex items-center gap-2.5 shadow-sm">
        <Info className="w-4 h-4 shrink-0 text-[#4F8CFF]" />
        <div className="flex-1 font-medium">{displayContent}</div>
      </div>
    );
  }

  return (
    <div
      className={`group/msg py-4 px-4 sm:px-6 rounded-2xl transition-all ${
        isUser
          ? 'bg-[#16243B] border border-[#4F8CFF]/25 shadow-sm'
          : 'bg-[#111C2E] border border-[#1E2E4A] shadow-md'
      }`}
    >
      <div className="flex items-start gap-3.5 max-w-4xl mx-auto">
        {/* Avatar */}
        <div className="shrink-0 mt-0.5">
          {isUser ? (
            <div className="w-8 h-8 rounded-xl bg-[#080D18] border border-[#4F8CFF]/35 flex items-center justify-center text-[#F1F5FC]">
              <User className="w-4 h-4 text-[#4F8CFF]" />
            </div>
          ) : (
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#4F8CFF] to-[#8B7CFF] flex items-center justify-center text-white shadow-md shadow-[#4F8CFF]/20">
              <GraduationCap className="w-4 h-4 stroke-[2.3]" />
            </div>
          )}
        </div>

        {/* Content Body */}
        <div className="flex-1 min-w-0 space-y-3">
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-[#F1F5FC]">
                {isUser ? 'You' : 'StudyMind AI Tutor'}
              </span>
              {!isUser && uniqueSources.length > 0 && (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/25">
                  <ShieldCheck className="w-2.5 h-2.5" />
                  RAG Grounded ({uniqueSources.length})
                </span>
              )}
              {!isUser && message.not_found_in_docs && (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/25">
                  <AlertTriangle className="w-2.5 h-2.5" />
                  Not Found in Uploaded PDFs
                </span>
              )}
              {!isUser && message.mode && (
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-[#4F8CFF]/10 text-[#4F8CFF] border border-[#4F8CFF]/25">
                  {message.mode}
                </span>
              )}
              {!isUser && message.explanation_level && (
                <span className="text-[10px] font-mono capitalize px-2 py-0.5 rounded-full bg-[#8B7CFF]/10 text-[#C4B5FD] border border-[#8B7CFF]/25">
                  {message.explanation_level}
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
                  className="opacity-70 group-hover/msg:opacity-100 inline-flex items-center gap-1 text-[11px] text-[#8A9BB8] hover:text-[#F1F5FC] px-2 py-0.5 rounded-lg hover:bg-[#080D18]/60 border border-transparent hover:border-[#1E2E4A] transition disabled:opacity-30"
                  title="Edit and resend question"
                >
                  <Pencil className="w-3 h-3" />
                  <span>Edit</span>
                </button>
              )
            ) : (
              displayContent &&
              !isStreaming && (
                <div className="flex flex-wrap items-center gap-1">
                  <button
                    type="button"
                    onClick={handleTextToSpeech}
                    className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-lg border transition ${
                      isSpeaking
                        ? 'bg-[#4F8CFF] text-white border-[#4F8CFF] font-semibold'
                        : 'text-[#8A9BB8] hover:text-[#F1F5FC] hover:bg-[#080D18] border-transparent hover:border-[#1E2E4A]'
                    }`}
                    title={isSpeaking ? 'Stop reading aloud' : 'Read answer aloud'}
                  >
                    {isSpeaking ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
                    <span className="hidden sm:inline">{isSpeaking ? 'Stop' : 'Listen'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCopy}
                    className="inline-flex items-center gap-1 text-[11px] text-[#8A9BB8] hover:text-[#F1F5FC] transition px-2 py-0.5 rounded-lg hover:bg-[#080D18] border border-transparent hover:border-[#1E2E4A]"
                    title="Copy response"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span className="text-emerald-400 font-medium">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span className="hidden sm:inline">Copy</span>
                      </>
                    )}
                  </button>

                  {onRegenerate && (
                    <button
                      type="button"
                      disabled={disabledActions}
                      onClick={onRegenerate}
                      className="inline-flex items-center gap-1 text-[11px] text-[#8A9BB8] hover:text-[#4F8CFF] transition px-2 py-0.5 rounded-lg hover:bg-[#080D18] border border-transparent hover:border-[#1E2E4A] disabled:opacity-40"
                      title="Regenerate response"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span className="hidden sm:inline">Regenerate</span>
                    </button>
                  )}

                  {onFeedback && message.id && (
                    <div className="flex items-center gap-0.5 ml-1 pl-1 border-l border-[#1E2E4A]">
                      <button
                        type="button"
                        onClick={() => handleFeedbackClick('helpful')}
                        className={`p-1 rounded-lg transition ${
                          localFeedback === 'helpful'
                            ? 'text-emerald-400 bg-emerald-500/15'
                            : 'text-[#8A9BB8] hover:text-emerald-300 hover:bg-[#080D18]'
                        }`}
                        title="Helpful response"
                      >
                        <ThumbsUp className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleFeedbackClick('not_helpful')}
                        className={`p-1 rounded-lg transition ${
                          localFeedback === 'not_helpful'
                            ? 'text-rose-400 bg-rose-500/15'
                            : 'text-[#8A9BB8] hover:text-rose-300 hover:bg-[#080D18]'
                        }`}
                        title="Not helpful"
                      >
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
                className="w-full p-3 rounded-xl bg-[#080D18] border border-[#4F8CFF]/50 text-sm text-[#F1F5FC] focus:outline-none focus:border-[#4F8CFF] resize-y"
              />
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-[#080D18] border border-[#1E2E4A] text-xs text-[#8A9BB8] hover:text-[#F1F5FC]"
                >
                  <X className="w-3 h-3" />
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!editDraft.trim()}
                  onClick={submitEdit}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#4F8CFF] hover:bg-[#3B7BFA] text-xs font-semibold text-white disabled:opacity-50"
                >
                  <Send className="w-3 h-3" />
                  Save & Resend
                </button>
              </div>
            </div>
          ) : (
            <div
              ref={contentRef}
              className="text-sm text-[#F1F5FC] leading-relaxed font-sans break-words prose prose-invert prose-sm max-w-none prose-headings:text-[#F1F5FC] prose-strong:text-[#F1F5FC] prose-a:text-[#4F8CFF]"
            >
              {isUser ? (
                <p className="whitespace-pre-wrap m-0">{displayContent}</p>
              ) : isStreaming && !displayContent ? (
                <div className="flex items-center gap-2 text-xs text-[#8A9BB8] py-1">
                  <span className="flex gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#4F8CFF] animate-bounce [animation-delay:-0.3s]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-[#8B7CFF] animate-bounce [animation-delay:-0.15s]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-[#4F8CFF] animate-bounce" />
                  </span>
                  <span>Synthesizing explanation & verifying citations...</span>
                </div>
              ) : (
                <>
                  <MarkdownWithMath content={displayContent} />
                  {isStreaming && (
                    <span className="inline-block w-2 h-4 ml-1 align-middle bg-[#4F8CFF] rounded-sm animate-pulse" />
                  )}
                </>
              )}
            </div>
          )}

          {/* Contextual Action Buttons */}
          {!isUser && !isStreaming && displayContent && onContextualAction && (
            <div className="pt-2 flex flex-wrap items-center gap-1.5 text-xs">
              {CONTEXTUAL_ACTIONS.map((btn) => {
                const Icon = btn.icon;
                return (
                  <button
                    key={btn.id}
                    type="button"
                    disabled={disabledActions}
                    onClick={() => onContextualAction(btn.id, message)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#080D18]/80 hover:bg-[#16243B] border border-[#1E2E4A] hover:border-[#4F8CFF]/50 text-[11px] font-medium text-[#8A9BB8] hover:text-[#F1F5FC] transition disabled:opacity-40"
                  >
                    <Icon className="w-3 h-3 text-[#4F8CFF]" />
                    <span>{btn.label}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Citations with Clickable Page Jump & Relevant Source Passage Drawer */}
          {!isUser && uniqueSources.length > 0 && (
            <div className="pt-2.5 mt-2 border-t border-[#1E2E4A] space-y-2 text-xs">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] text-[#8A9BB8] font-medium mr-0.5 flex items-center gap-1">
                  <FileText className="w-3 h-3 text-[#4F8CFF]" />
                  Citations:
                </span>
                {uniqueSources.map((src, idx) => {
                  const isExpanded = expandedSourceIdx === idx;
                  const scorePct =
                    typeof src.relevance_score === 'number'
                      ? `${Math.round(src.relevance_score * 100)}%`
                      : null;
                  return (
                    <div key={idx} className="inline-flex items-center rounded-full bg-[#080D18] border border-[#1E2E4A] hover:border-[#4F8CFF]/50 transition overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setExpandedSourceIdx(isExpanded ? null : idx)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] text-[#CBD5E1] hover:text-[#F1F5FC] transition"
                        title="Preview retrieved source passage"
                      >
                        <span className="truncate max-w-[140px] font-medium">{src.filename}</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#111C2E] text-[#4F8CFF] border border-[#1E2E4A]">
                          p.{src.page}
                        </span>
                        {scorePct && (
                          <span className="text-[10px] font-mono text-[#8B7CFF]">{scorePct}</span>
                        )}
                        {isExpanded ? (
                          <ChevronUp className="w-3 h-3 text-[#8A9BB8]" />
                        ) : (
                          <ChevronDown className="w-3 h-3 text-[#8A9BB8]" />
                        )}
                      </button>
                      {onNavigateToDoc && src.document_id && (
                        <button
                          type="button"
                          onClick={() => onNavigateToDoc(src.document_id, src.page)}
                          className="px-2 py-1 border-l border-[#1E2E4A] text-[#8A9BB8] hover:text-[#4F8CFF] hover:bg-[#111C2E] transition"
                          title={`Open ${src.filename} (Page ${src.page}) in Document Viewer`}
                        >
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {expandedSourceIdx !== null && uniqueSources[expandedSourceIdx] && (
                <div className="p-3 rounded-xl bg-[#080D18] border border-[#4F8CFF]/30 text-xs space-y-1.5 animate-in fade-in">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-[#F1F5FC]">
                      {uniqueSources[expandedSourceIdx].filename} — Page {uniqueSources[expandedSourceIdx].page}
                    </span>
                    {onNavigateToDoc && uniqueSources[expandedSourceIdx].document_id && (
                      <button
                        type="button"
                        onClick={() =>
                          onNavigateToDoc(
                            uniqueSources[expandedSourceIdx].document_id,
                            uniqueSources[expandedSourceIdx].page
                          )
                        }
                        className="inline-flex items-center gap-1 text-[#4F8CFF] hover:underline font-medium"
                      >
                        Open Page in Viewer <ExternalLink className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  <p className="text-[#8A9BB8] leading-relaxed italic whitespace-pre-wrap">
                    "{uniqueSources[expandedSourceIdx].text}"
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
