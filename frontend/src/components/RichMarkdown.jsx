import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Copy, Check } from 'lucide-react';

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
    let cls = 'text-[#E5E5E5]';
    if (token.startsWith('//') || token.startsWith('#') || token.startsWith('/*')) {
      cls = 'text-[#666666] italic';
    } else if (token.startsWith('"') || token.startsWith("'") || token.startsWith('`')) {
      cls = 'text-emerald-300';
    } else if (KEYWORDS_SET.has(token)) {
      cls = 'text-[#C4B5FD] font-medium';
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

export function CodeBlock({ className, children }) {
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
    <div className="my-3 rounded-xl overflow-hidden border border-[#262626] bg-[#0D0D0D] shadow-sm not-prose">
      <div className="flex items-center justify-between px-3.5 py-2 bg-[#141414] border-b border-[#222222] text-[11px]">
        <span className="font-mono font-semibold uppercase tracking-wider text-[#E5E5E5]">
          {lang || 'code'}
        </span>
        <button
          type="button"
          onClick={handleCopyCode}
          className="inline-flex items-center gap-1.5 text-[#9A9A9A] hover:text-white transition px-2 py-0.5 rounded-md hover:bg-[#1F1F1F]"
        >
          {copiedCode ? (
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
      <pre className="p-3.5 overflow-x-auto text-xs leading-relaxed font-mono text-[#E5E5E5] select-text m-0">
        <code>{highlightCodeLine(rawCode)}</code>
      </pre>
    </div>
  );
}

function useKatexHtml(formula, displayMode) {
  const [html, setHtml] = useState(() => {
    if (typeof window !== 'undefined' && window.katex) {
      try {
        return window.katex.renderToString(formula.trim(), { displayMode, throwOnError: false });
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
          setHtml(window.katex.renderToString(formula.trim(), { displayMode, throwOnError: false }));
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
  }, [formula, displayMode, html]);

  return html;
}

export function DisplayMath({ formula }) {
  const html = useKatexHtml(formula, true);
  if (html) {
    return (
      <div
        className="my-3 py-3 px-4 overflow-x-auto bg-[#0D0D0D] rounded-xl border border-[#262626] text-center select-text text-white"
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

export function InlineMath({ formula }) {
  const html = useKatexHtml(formula, false);
  if (html) {
    return <span className="inline-math px-0.5 text-white" dangerouslySetInnerHTML={{ __html: html }} />;
  }
  return <span className="font-mono text-[#E5E5E5] font-medium text-xs px-0.5">${formula}$</span>;
}

const INLINE_MATH_REGEX = /(\$(?!\s)[^\$\n]+?(?<!\s)\$|\\\([^\n]+?\\\))/g;

function renderStringWithMath(str, keyPrefix = 'm') {
  if (!str || (!str.includes('$') && !str.includes('\\('))) return str;
  const parts = str.split(INLINE_MATH_REGEX);
  if (parts.length === 1) return str;
  return parts.map((sub, idx) => {
    if (!sub) return null;
    if (sub.startsWith('$') && sub.endsWith('$') && sub.length >= 3) {
      return <InlineMath key={`${keyPrefix}-${idx}`} formula={sub.slice(1, -1)} />;
    }
    if (sub.startsWith('\\(') && sub.endsWith('\\)') && sub.length >= 4) {
      return <InlineMath key={`${keyPrefix}-${idx}`} formula={sub.slice(2, -2)} />;
    }
    return sub;
  });
}

function withInlineMath(children) {
  return React.Children.map(children, (child, idx) => {
    if (typeof child === 'string') {
      return renderStringWithMath(child, `str-${idx}`);
    }
    return child;
  });
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
        className="px-1.5 py-0.5 rounded-md bg-[#1A1A1A] border border-[#262626] text-white font-mono text-[12px]"
        {...props}
      >
        {children}
      </code>
    );
  },
  p: ({ children }) => <p className="text-[14px] leading-7 my-2.5 text-[#E5E5E5] first:mt-0 last:mb-0">{withInlineMath(children)}</p>,
  ul: ({ children }) => <ul className="list-disc pl-5 my-3 space-y-1.5 text-[14px] text-[#E5E5E5] marker:text-[#666666]">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-5 my-3 space-y-1.5 text-[14px] text-[#E5E5E5] marker:text-[#9A9A9A] marker:font-mono">{children}</ol>,
  li: ({ children }) => <li className="leading-7 pl-1 text-[#E5E5E5]">{withInlineMath(children)}</li>,
  hr: () => <hr className="my-5 border-0 border-t border-[#262626]" />,
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-white underline decoration-[#666666] hover:decoration-white underline-offset-4 transition">
      {withInlineMath(children)}
    </a>
  ),
  strong: ({ children }) => <strong className="font-semibold text-white">{withInlineMath(children)}</strong>,
  em: ({ children }) => <em className="italic text-[#D4D4D4]">{withInlineMath(children)}</em>,
  h1: ({ children }) => <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight mt-6 mb-3 border-b border-[#262626] pb-2.5 first:mt-0">{withInlineMath(children)}</h1>,
  h2: ({ children }) => <h2 className="text-base sm:text-lg font-bold text-white tracking-tight mt-6 mb-2.5 pt-1 border-l-2 border-white pl-3">{withInlineMath(children)}</h2>,
  h3: ({ children }) => <h3 className="text-sm sm:text-base font-semibold text-white mt-4 mb-1.5">{withInlineMath(children)}</h3>,
  h4: ({ children }) => <h4 className="text-xs sm:text-sm font-semibold text-[#E5E5E5] uppercase tracking-wider mt-3 mb-1">{withInlineMath(children)}</h4>,
  table: ({ children }) => (
    <div className="my-4 overflow-x-auto rounded-xl border border-[#262626] bg-[#0D0D0D]">
      <table className="w-full text-left border-collapse text-xs sm:text-[13px]">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-[#141414] border-b border-[#262626] text-white font-semibold">{children}</thead>
  ),
  tr: ({ children }) => <tr className="even:bg-[#111111]/70">{children}</tr>,
  th: ({ children }) => <th className="px-4 py-2.5 text-xs font-semibold text-white whitespace-nowrap">{withInlineMath(children)}</th>,
  td: ({ children }) => <td className="px-4 py-2.5 text-xs sm:text-[13px] leading-relaxed text-[#D4D4D4] border-t border-[#222222] align-top">{withInlineMath(children)}</td>,
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
            : 'bg-[#1A1A1A] border-l-white border border-[#262626] text-[#E5E5E5]'
        }`}
      >
        {children}
      </blockquote>
    );
  },
};

export default function RichMarkdown({ content, className = '' }) {
  if (!content) return null;

  const displayRegex = /(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\])/g;
  const parts = String(content).split(displayRegex);

  return (
    <div className={`space-y-2 text-[14px] leading-7 text-[#E5E5E5] ${className}`}>
      {parts.map((part, pIdx) => {
        if (!part) return null;
        if ((part.startsWith('$$') && part.endsWith('$$')) || (part.startsWith('\\[') && part.endsWith('\\]'))) {
          if (part.length >= 4) {
            return <DisplayMath key={pIdx} formula={part.slice(2, -2)} />;
          }
        }
        return (
          <ReactMarkdown key={pIdx} remarkPlugins={[remarkGfm]} components={markdownComponents}>
            {part}
          </ReactMarkdown>
        );
      })}
    </div>
  );
}
