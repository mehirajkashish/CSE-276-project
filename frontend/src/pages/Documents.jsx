import React, { useState, useEffect } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import {
  Files,
  UploadCloud,
  Search,
  Filter,
  CheckCircle2,
  FileText,
  Trash2,
  Layers,
  HardDrive,
  Sparkles,
  BookOpen
} from 'lucide-react';
import DocumentCard from '../components/DocumentCard';
import { documentApi } from '../services/api';

export default function Documents() {
  const navigate = useNavigate();
  const { openUpload, refreshStats } = useOutletContext();
  const [documents, setDocuments] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  const loadDocuments = async () => {
    try {
      setLoading(true);
      const docs = await documentApi.getDocuments();
      setDocuments(docs || []);
    } catch (err) {
      console.error('Error fetching documents:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, []);

  const handleDelete = async (docId, filename) => {
    if (window.confirm(`Permanently delete "${filename}" and its vector embeddings from FAISS?`)) {
      try {
        await documentApi.deleteDocument(docId);
        await loadDocuments();
        if (refreshStats) refreshStats();
      } catch (err) {
        alert('Failed to delete document: ' + (err.response?.data?.detail || err.message));
      }
    }
  };

  const filteredDocs = documents.filter((doc) =>
    (doc.filename || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalPages = documents.reduce((sum, d) => sum + (d.total_pages || d.page_count || 0), 0);
  const totalChunks = documents.reduce((sum, d) => sum + (d.total_chunks || d.chunk_count || 0), 0);

  return (
    <div className="max-w-7xl mx-auto space-y-6 select-none">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Course Document{' '}
              <span className="font-serif italic font-normal text-white">Library</span>
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#1A1A1A] text-white border border-[#262626]">
              {documents.length} Files
            </span>
          </div>
          <p className="text-xs text-[#9A9A9A] mt-1">
            Manage your indexed textbooks, lecture notes, slides, and syllabus documents for RAG grounding.
          </p>
        </div>

        <button
          onClick={openUpload}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-white hover:bg-neutral-200 text-black font-semibold text-xs sm:text-sm shadow-sm transition active:scale-95 self-start sm:self-auto"
        >
          <UploadCloud className="w-4 h-4 stroke-[2.5]" />
          <span>Upload PDF Documents</span>
        </button>
      </div>

      {/* Stats Summary Bar - Obsidian Dark */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-2xl bg-[#1A1A1A] border border-[#262626] text-xs shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#0D0D0D] border border-[#262626] flex items-center justify-center text-white">
            <Files className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[11px] text-[#9A9A9A]">Total Documents</div>
            <div className="text-sm font-bold text-white font-mono">{documents.length} PDFs</div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#0D0D0D] border border-[#262626] flex items-center justify-center text-white">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[11px] text-[#9A9A9A]">Extracted Pages</div>
            <div className="text-sm font-bold text-white font-mono">{totalPages} Pages</div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#0D0D0D] border border-[#262626] flex items-center justify-center text-white">
            <HardDrive className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[11px] text-[#9A9A9A]">FAISS Vector Chunks</div>
            <div className="text-sm font-bold text-white font-mono">{totalChunks} Embeddings</div>
          </div>
        </div>
      </div>

      {/* Search Input Bar */}
      <div className="relative">
        <Search className="w-4 h-4 text-[#666666] absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder="Search documents by course code or filename..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#141414] border border-[#262626] text-sm text-white placeholder-[#666666] focus:outline-none focus:border-white transition"
        />
      </div>

      {/* Document Grid */}
      {loading ? (
        <div className="py-20 text-center text-xs text-[#9A9A9A] flex items-center justify-center gap-2">
          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          <span>Indexing academic library...</span>
        </div>
      ) : filteredDocs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#262626] bg-[#141414] p-12 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-[#1A1A1A] border border-[#262626] text-white flex items-center justify-center mx-auto">
            <FileText className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">
              {searchQuery ? 'No matching documents found' : 'No documents in your library yet'}
            </h3>
            <p className="text-xs text-[#9A9A9A] mt-1 max-w-sm mx-auto">
              {searchQuery
                ? `No documents match "${searchQuery}". Clear your search query.`
                : 'Upload syllabus PDFs, slides, or chapters to generate vector embeddings.'}
            </p>
          </div>
          {!searchQuery && (
            <button
              onClick={openUpload}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-white hover:bg-neutral-200 text-black font-semibold text-xs shadow-sm transition active:scale-95"
            >
              <UploadCloud className="w-4 h-4 stroke-[2.5]" />
              <span>Upload PDF Files</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDocs.map((doc) => (
            <DocumentCard
              key={doc.id}
              document={doc}
              onDelete={handleDelete}
              onChat={(d) => navigate(`/chat?doc=${d.id}`)}
              onView={(d) => navigate(`/viewer?doc=${d.id}`)}
              onStudy={(d) => navigate(`/study-tools?doc=${d.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
