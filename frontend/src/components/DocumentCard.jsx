import React from 'react';
import {
  FileText,
  Calendar,
  Layers,
  HardDrive,
  Trash2,
  MessageSquare,
  FileSearch,
  Sparkles,
  CheckCircle2,
  Clock
} from 'lucide-react';

export default function DocumentCard({
  document,
  onDelete,
  onChat,
  onView,
  onStudy
}) {
  const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const formatDate = (isoString) => {
    if (!isoString) return 'Just now';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return isoString;
    }
  };

  const totalPages = document.total_pages || document.page_count || 1;
  const totalChunks = document.total_chunks || document.chunk_count || 0;
  const dateString = document.upload_date || document.created_at;

  return (
    <div className="group relative rounded-2xl border border-[#262626] bg-[#1A1A1A] p-5 transition-all duration-200 hover:border-[#3A3A3A] hover:bg-[#1E1E1E] shadow-sm flex flex-col justify-between select-none">
      <div>
        {/* Top Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[#0D0D0D] border border-[#262626] flex items-center justify-center text-white shrink-0">
              <FileText className="w-5 h-5 text-white stroke-[1.75]" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-sm text-white truncate group-hover:text-white transition" title={document.filename}>
                {document.filename}
              </h3>
              <div className="flex items-center gap-2 mt-1 text-[11px] text-[#9A9A9A]">
                <span className="flex items-center gap-1 font-mono">
                  <Calendar className="w-3 h-3" />
                  {formatDate(dateString)}
                </span>
                <span>•</span>
                <span className="font-mono">{formatBytes(document.file_size)}</span>
              </div>
            </div>
          </div>

          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-[#0F291E] text-[#22C55E] border border-[#22C55E]/30 shrink-0 font-mono">
            <CheckCircle2 className="w-2.5 h-2.5" />
            Ready
          </span>
        </div>

        {/* Metadata badges */}
        <div className="grid grid-cols-2 gap-2 my-4 p-2.5 rounded-xl bg-[#0D0D0D] border border-[#262626] text-xs">
          <div className="flex items-center gap-2 text-[#9A9A9A]">
            <Layers className="w-3.5 h-3.5 text-white" />
            <span>
              <strong className="text-white font-mono">{totalPages}</strong> Pages
            </span>
          </div>
          <div className="flex items-center gap-2 text-[#9A9A9A]">
            <HardDrive className="w-3.5 h-3.5 text-white" />
            <span>
              <strong className="text-white font-mono">{totalChunks}</strong> Chunks
            </span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="pt-3 border-t border-[#262626] flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onChat(document)}
            title="Ask questions with AI"
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white hover:bg-neutral-200 text-black text-xs font-semibold transition active:scale-95 shadow-sm"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Chat</span>
          </button>

          <button
            onClick={() => onView(document)}
            title="Read and search PDF"
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#1F1F1F] hover:bg-[#282828] text-white border border-[#2E2E2E] text-xs font-medium transition active:scale-95"
          >
            <FileSearch className="w-3.5 h-3.5" />
            <span>View</span>
          </button>

          <button
            onClick={() => onStudy(document)}
            title="Generate Flashcards, Summary, Quizzes"
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#1F1F1F] hover:bg-[#282828] text-white border border-[#2E2E2E] text-xs font-medium transition active:scale-95"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Study</span>
          </button>
        </div>

        <button
          onClick={() => onDelete(document.id, document.filename)}
          title="Delete document"
          className="p-1.5 rounded-lg text-[#666666] hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
