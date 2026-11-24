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
  ArrowRight
} from 'lucide-react';

/**
 * Strips legacy bullet glyphs, redundant question echoes, and inline source spam
 * so responses look clean, natural, and modern like ChatGPT / Gemini.
 */
function sanitizeContent(rawText) {
  if (!rawText) return '';
  return rawText
    // Replace PPT bullet artifacts with clean spaces/dashes
    .replace(/[\uf0a7\u25aa\u2022\u25cf\u25cb\u25a0\u25a1\uf0b7]/g, ' ')
    // Clean repetitive pipes
    .replace(/\s*\|\s*/g, ' - ')
    // Remove legacy Answer to: echoes
    .replace(/^(?:###\s*📚\s*)?Answer\s+to:\s*"[^"]*"\s*\n*/i, '')
    // Remove legacy trailing source summaries
    .replace(/\n*Exact\s+Source\s+References:[^\n]*/gi, '')
    // Remove redundant inline source annotations (e.g. (Source: file.pdf, Page 46))
    .replace(/\(\s*Source:\s*[^)]+\)/gi, '')
    // Normalize newlines
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Renders a block equation using KaTeX if available, with smooth loading and fallback.
 */
function DisplayMath({ formula }) {
  const [html, setHtml] = useState(() => {
    if (typeof window !== 'undefined' && window.katex) {
      try {
        return window.katex.renderToString(formula.trim(), {
          displayMode: true,
          throwOnError: false,
        });
      } catch (err) {
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
        } catch (e) {
          return false;
        }
      }
      return false;
    };

    if (!html) {
      if (!tryRender()) {
        interval = setInterval(() => {
          if (tryRender()) clearInterval(interval);
        }, 150);
        timeout = setTimeout(() => clearInterval(interval), 4000);
      }
    }

    return () => {
      if (interval) clearInterval(interval);
      if (timeout) clearTimeout(timeout);
    };
  }, [formula, html]);

  if (html) {
    return (
      <div
        className="my-3 py-3 px-4 overflow-x-auto bg-[#0D0D0D] rounded-xl border border-[#262626] text-center shadow-sm select-text text-white"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }

  return (
    <div className="my-3 py-3 px-4 overflow-x-auto bg-[#0D0D0D] rounded-xl border border-[#262626] text-center font-mono text-xs text-white select-text">
      $${formula}$$
    </div>
  );
}

/**
 * Renders inline math $formula$ using KaTeX if available.
 */
function InlineMath({ formula }) {
  const [html, setHtml] = useState(() => {
    if (typeof window !== 'undefined' && window.katex) {
      try {
        return window.katex.renderToString(formula.trim(), {
          displayMode: false,
          throwOnError: false,
        });
      } catch (err) {
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
        } catch (e) {
          return false;
        }
      }
      return false;
    };

    if (!html) {
      if (!tryRender()) {
        interval = setInterval(() => {
          if (tryRender()) clearInterval(interval);
        }, 150);
        timeout = setTimeout(() => clearInterval(interval), 4000);
      }
    }

    return () => {
      if (interval) clearInterval(interval);
      if (timeout) clearTimeout(timeout);
    };
  }, [formula, html]);

  if (html) {
    return <span className="inline-math px-0.5" dangerouslySetInnerHTML={{ __html: html }} />;
  }

  return <span className="font-mono text-white font-semibold text-xs px-0.5">${formula}$</span>;
}

function TextSegmentWithInlineMath({ text }) {
  const inlineRegex = /(\$(?!\s)[^\$\n]+?(?<!\s)\$|\\\([^\n]+?\\\))/g;
  const subparts = text.split(inlineRegex);

  if (subparts.length === 1) {
    return (
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {text}
      </ReactMarkdown>
    );
  }

  return (
    <div className="leading-relaxed">
      {subparts.map((sub, sIdx) => {
        if (!sub) return null;

        if (sub.startsWith('$') && sub.endsWith('$') && sub.length >= 3) {
          const formula = sub.slice(1, -1);
          return <InlineMath key={sIdx} formula={formula} />;
        }
        if (sub.startsWith('\\(') && sub.endsWith('\\)') && sub.length >= 4) {
          const formula = sub.slice(2, -2);
          return <InlineMath key={sIdx} formula={formula} />;
        }

        return (
          <ReactMarkdown
            key={sIdx}
            remarkPlugins={[remarkGfm]}
            components={{
              p: ({ children }) => <span>{children}</span>
            }}
          >
            {sub}
          </ReactMarkdown>
        );
      })}
    </div>
  );
}

/**
 * Parses markdown text into display math blocks and text segments,
 * then parses inline math $...$ inside text segments so that math equations
 * are never mangled by Markdown asterisks/underscores.
 */
function MarkdownWithMath({ content }) {
  if (!content) return null;

  const displayRegex = /(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\])/g;
  const parts = content.split(displayRegex);

  return (
    <div className="space-y-2">
      {parts.map((part, pIdx) => {
        if (!part) return null;

        if (part.startsWith('$$') && part.endsWith('$$') && part.length >= 4) {
          const formula = part.slice(2, -2);
          return <DisplayMath key={pIdx} formula={formula} />;
        }
        if (part.startsWith('\\[') && part.endsWith('\\]') && part.length >= 4) {
          const formula = part.slice(2, -2);
          return <DisplayMath key={pIdx} formula={formula} />;
        }

        return <TextSegmentWithInlineMath key={pIdx} text={part} />;
      })}
    </div>
  );
}

export default function ChatBubble({ message, onNavigateToDoc, onPromptAction }) {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';
  const [copied, setCopied] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const contentRef = useRef(null);

  const rawContent = message.content || message.message || '';
  const displayContent = useMemo(() => isUser ? rawContent : sanitizeContent(rawContent), [rawContent, isUser]);
  const rawSources = message.sources || message.source_metadata || [];

  // KaTeX math rendering effect for LaTeX equations
  useEffect(() => {
    let t1, t2, t3;
    const renderMath = () => {
      if (contentRef.current && typeof window !== 'undefined' && window.renderMathInElement) {
        try {
          window.renderMathInElement(contentRef.current, {
            delimiters: [
              { left: '$$', right: '$$', display: true },
              { left: '$', right: '$', display: false },
              { left: '\\[', right: '\\]', display: true },
              { left: '\\(', right: '\\)', display: false }
            ],
            ignoredTags: ['script', 'noscript', 'style', 'textarea'],
            throwOnError: false
          });
        } catch (err) {
          console.warn('KaTeX render error:', err);
        }
      }
    };

    renderMath();
    t1 = setTimeout(renderMath, 150);
    t2 = setTimeout(renderMath, 500);
    t3 = setTimeout(renderMath, 1200);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [displayContent]);

  // Deduplicate sources by filename + page
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
          page: pg
        });
      }
    }
    return result;
  }, [rawSources]);

  // Stop TTS if component unmounts
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

    // Strip markdown formatting for cleaner speech
    const cleanText = displayContent
      .replace(/[#*`_~]/g, '')
      .replace(/\[(.*?)\]\(.*?\)/g, '$1')
      .replace(/\n+/g, ' ')
      .trim();

    if (!cleanText) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    utterance.onend = () => {
      setIsSpeaking(false);
    };

    utterance.onerror = () => {
      setIsSpeaking(false);
    };

    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  if (isSystem) {
    return (
      <div className="py-2.5 px-4 max-w-xl mx-auto my-2 rounded-xl bg-[#1A1A1A] border border-[#262626] text-[#9A9A9A] text-xs flex items-center gap-2.5 shadow-sm">
        <Sparkles className="w-4 h-4 shrink-0 text-white" />
        <div className="flex-1 font-medium text-white">{displayContent}</div>
      </div>
    );
  }

  return (
    <div
      className={`py-4 px-4 sm:px-5 rounded-2xl transition-all ${
        isUser ? 'bg-[#242424] border border-[#2E2E2E]' : 'bg-[#141414] border border-[#222222] shadow-sm'
      }`}
    >
      <div className="flex items-start gap-3.5 max-w-4xl mx-auto">
        {/* Avatar */}
        <div className="shrink-0 mt-0.5">
          {isUser ? (
            <div className="w-8 h-8 rounded-xl bg-[#1A1A1A] border border-[#262626] flex items-center justify-center text-white">
              <User className="w-4 h-4" />
            </div>
          ) : (
            <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center text-black shadow-sm">
              <GraduationCap className="w-4 h-4 stroke-[2.5]" />
            </div>
          )}
        </div>

        {/* Content Body */}
        <div className="flex-1 min-w-0 space-y-3">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white">
                {isUser ? 'You' : 'StudyMind AI'}
              </span>
              {!isUser && (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.2 rounded-full bg-[#0F291E] text-[#22C55E] border border-[#22C55E]/30">
                  <ShieldCheck className="w-2.5 h-2.5" />
                  RAG Grounded
                </span>
              )}
            </div>

            {/* Action Buttons: Copy & Audio */}
            {!isUser && displayContent && (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleTextToSpeech}
                  className={`inline-flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-lg border transition ${
                    isSpeaking
                      ? 'bg-white text-black border-white animate-pulse font-semibold'
                      : 'text-[#9A9A9A] hover:text-white hover:bg-[#1A1A1A] border-transparent hover:border-[#262626]'
                  }`}
                  title={isSpeaking ? 'Stop reading aloud' : 'Read answer aloud with Voice'}
                >
                  {isSpeaking ? (
                    <>
                      <VolumeX className="w-3 h-3 text-black" />
                      <span>Stop Audio</span>
                    </>
                  ) : (
                    <>
                      <Volume2 className="w-3 h-3" />
                      <span>Read Aloud</span>
                    </>
                  )}
                </button>

                <button
                  onClick={handleCopy}
                  className="inline-flex items-center gap-1 text-[11px] text-[#9A9A9A] hover:text-white transition px-2.5 py-0.5 rounded-lg hover:bg-[#1A1A1A] border border-transparent hover:border-[#262626]"
                  title="Copy answer to clipboard"
                >
                  {copied ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span className="text-emerald-400 font-medium">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Message Text / Markdown with KaTeX math formatting */}
          <div
            ref={contentRef}
            className="text-sm text-white leading-relaxed font-sans break-words prose prose-invert prose-sm max-w-none prose-pre:bg-[#0D0D0D] prose-pre:border prose-pre:border-[#262626] prose-code:text-white prose-code:bg-[#0D0D0D] prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:before:content-none prose-code:after:content-none"
          >
            {isUser ? (
              <p className="whitespace-pre-wrap">{displayContent}</p>
            ) : (
              <MarkdownWithMath content={displayContent} />
            )}
          </div>

          {/* Interactive AI Action Buttons (Explain Simpler, Give Example, Summarize, MCQs, Flashcards) */}
          {!isUser && displayContent && onPromptAction && (
            <div className="pt-2 flex flex-wrap items-center gap-1.5 text-xs">
              {[
                { label: 'Explain Simpler', icon: Sparkles, action: 'Explain this in simpler terms with a relatable analogy for a beginner.' },
                { label: 'Give Example', icon: Lightbulb, action: 'Provide a concrete real-world example or practical case study illustrating this concept.' },
                { label: 'Summarize', icon: BookOpen, action: 'Summarize the core takeaways of this response into 3 concise bullet points.' },
                { label: 'Generate MCQs', icon: HelpCircle, action: 'Generate 3 exam practice multiple-choice questions (MCQs) based on this topic.' },
                { label: 'Create Flashcards', icon: Layers, action: 'Create 3 active recall flashcards with key concepts and answers based on this explanation.' },
              ].map((btn, bIdx) => {
                const Icon = btn.icon;
                return (
                  <button
                    key={bIdx}
                    onClick={() => onPromptAction(btn.action)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#1A1A1A] hover:bg-[#242424] border border-[#262626] hover:border-[#3A3A3A] text-[11px] font-medium text-[#9A9A9A] hover:text-white transition shadow-sm"
                  >
                    <Icon className="w-3 h-3 text-white" />
                    <span>{btn.label}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Minimalist Perplexity / Framer-style Source Pills (Deduplicated, Clean & Unobtrusive) */}
          {!isUser && uniqueSources.length > 0 && (
            <div className="pt-2.5 mt-2 border-t border-[#262626] flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-[11px] text-[#9A9A9A] font-medium mr-0.5 flex items-center gap-1">
                <FileText className="w-3 h-3 text-[#9A9A9A]" />
                Sources:
              </span>
              {uniqueSources.map((src, idx) => (
                <button
                  key={idx}
                  onClick={() =>
                    onNavigateToDoc &&
                    src.document_id &&
                    onNavigateToDoc(src.document_id, src.page)
                  }
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#1A1A1A] border border-[#262626] text-[11px] transition shadow-sm group ${
                    onNavigateToDoc && src.document_id
                      ? 'hover:bg-[#242424] hover:border-[#3A3A3A] text-[#9A9A9A] hover:text-white cursor-pointer'
                      : 'text-[#9A9A9A] cursor-default'
                  }`}
                  title={
                    onNavigateToDoc && src.document_id
                      ? `Click to view ${src.filename} (Page ${src.page}) in Document Viewer`
                      : `${src.filename} (Page ${src.page})`
                  }
                >
                  <span className="truncate max-w-[150px] font-medium group-hover:underline">
                    {src.filename}
                  </span>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#0D0D0D] text-white border border-[#262626]">
                    p.{src.page}
                  </span>
                  {onNavigateToDoc && src.document_id && (
                    <ExternalLink className="w-2.5 h-2.5 text-[#666666] group-hover:text-white transition" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
