import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  FileText,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Search,
  Layers,
  HardDrive,
  Sparkles,
  Info,
  BookOpen,
  ZoomIn,
  ZoomOut,
  RotateCcw
} from 'lucide-react';
import { documentApi, getApiBaseUrl } from '../services/api';

export default function Viewer() {
  const [searchParams] = useSearchParams();
  const initialDocId = searchParams.get('doc');
  const targetPage = parseInt(searchParams.get('page') || '1', 10);

  const [documents, setDocuments] = useState([]);
  const [selectedDocId, setSelectedDocId] = useState(initialDocId || '');
  const [docDetails, setDocDetails] = useState(null);
  const [currentPage, setCurrentPage] = useState(targetPage || 1);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  // Rendered page image (primary, zero-iframe) & optional blob PDF fallback
  const [pageImgUrl, setPageImgUrl] = useState('');
  const [pageLoading, setPageLoading] = useState(false);
  const [pageError, setPageError] = useState('');
  const [pdfBlobUrl, setPdfBlobUrl] = useState('');
  const [viewMode, setViewMode] = useState('image'); // 'image' | 'embed'
  const [zoom, setZoom] = useState(100);

  useEffect(() => {
    loadDocuments();
  }, []);

  useEffect(() => {
    if (initialDocId) {
      setSelectedDocId(initialDocId);
    }
  }, [initialDocId]);

  useEffect(() => {
    if (selectedDocId) {
      loadDocDetails(selectedDocId);
    }
  }, [selectedDocId]);

  const loadDocuments = async () => {
    try {
      const docs = await documentApi.getDocuments();
      setDocuments(docs || []);
      if (!selectedDocId && docs.length > 0) {
        setSelectedDocId(docs[0].id);
      }
    } catch (err) {
      console.error('Failed to load documents:', err);
    }
  };

  const loadDocDetails = async (docId) => {
    try {
      setLoading(true);
      const res = await documentApi.getDocument(docId);
      const normalized = res?.document
        ? res
        : { document: res, chunks: res?.chunks || res?.page_chunks || [] };
      setDocDetails(normalized);
      setCurrentPage(docId === initialDocId && targetPage ? targetPage : 1);
      setZoom(100);
    } catch (err) {
      console.error('Failed to load document details:', err);
    } finally {
      setLoading(false);
    }
  };

  const getPdfUrl = (d) => {
    if (!d) return '';
    const apiBase = getApiBaseUrl();
    if (d.id && !String(d.id).startsWith('demo-')) return `${apiBase}/documents/${d.id}/file`;
    const path = typeof d === 'string' ? d : d.file_path || '';
    if (!path) return '';
    const clean = path.replace(/\\/g, '/').split('/').pop();
    const originBase = apiBase.endsWith('/api') ? apiBase.slice(0, -4) : '';
    return `${originBase}/uploads/${clean}`;
  };

  const getPageImageUrl = (d, page) => {
    if (!d?.id || String(d.id).startsWith('demo-')) return '';
    return `${getApiBaseUrl()}/documents/${d.id}/page/${page}`;
  };

  const doc = docDetails?.document;
  const chunks = docDetails?.chunks || [];
  const pageChunks = chunks.filter((c) => c.page_number === currentPage);
  const totalPages = doc?.total_pages || doc?.page_count || 1;

  // Fetch high-DPI rendered page image via CORS (completely avoids iframe blocking)
  useEffect(() => {
    let active = true;
    let objectUrl = '';
    const imgEndpoint = getPageImageUrl(doc, currentPage);

    if (!doc || !imgEndpoint) {
      setPageImgUrl('');
      setPageError(doc ? 'Preview rendered from extracted text chunks below.' : '');
      return undefined;
    }

    const fetchPageImage = async () => {
      setPageLoading(true);
      setPageError('');
      setPageImgUrl('');
      try {
        const res = await fetch(imgEndpoint, { mode: 'cors' });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const blob = await res.blob();
        objectUrl = URL.createObjectURL(blob);
        if (active) {
          setPageImgUrl(objectUrl);
        } else {
          URL.revokeObjectURL(objectUrl);
        }
      } catch (err) {
        if (active) {
          setPageError(
            err.message?.includes('404')
              ? 'Original PDF file is no longer in temporary server storage; showing extracted page text instead.'
              : 'Could not render PDF page image; showing extracted page text or try Raw PDF above.'
          );
        }
      } finally {
        if (active) setPageLoading(false);
      }
    };

    fetchPageImage();
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [doc?.id, currentPage]);

  // Also fetch same-origin PDF blob if user switches to Interactive PDF Embed
  useEffect(() => {
    let active = true;
    let objectUrl = '';
    const pdfUrl = getPdfUrl(doc);

    if (!doc || !pdfUrl || viewMode !== 'embed') {
      setPdfBlobUrl('');
      return undefined;
    }

    const fetchPdfBlob = async () => {
      try {
        const res = await fetch(pdfUrl, { mode: 'cors' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        const typedBlob = blob.type === 'application/pdf' ? blob : new Blob([blob], { type: 'application/pdf' });
        objectUrl = URL.createObjectURL(typedBlob);
        if (active) setPdfBlobUrl(objectUrl);
        else URL.revokeObjectURL(objectUrl);
      } catch {
        if (active) setPdfBlobUrl('');
      }
    };

    fetchPdfBlob();
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [doc?.id, viewMode]);

  const matchingChunks = searchQuery.trim()
    ? chunks.filter((c) => c.text.toLowerCase().includes(searchQuery.toLowerCase()))
    : [];

  return (
    <div className="flex flex-col h-[calc(100vh-7.5rem)] max-w-7xl mx-auto space-y-4 select-none">
      {/* Top Document Selector Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-[#1A1A1A] border border-[#262626] shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#0D0D0D] border border-[#262626] flex items-center justify-center text-white shrink-0">
            <BookOpen className="w-4 h-4" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#9A9A9A] font-medium">Document:</span>
            <select
              value={selectedDocId}
              onChange={(e) => setSelectedDocId(e.target.value)}
              className="text-xs font-semibold rounded-lg bg-[#0D0D0D] border border-[#262626] text-white px-3 py-1.5 focus:outline-none focus:border-white max-w-sm truncate"
            >
              {documents.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.filename} ({d.total_pages || d.page_count || 1} pages)
                </option>
              ))}
            </select>
          </div>
        </div>

        {doc && (
          <div className="flex items-center gap-3 text-xs text-[#9A9A9A]">
            <span className="flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-white" />
              <strong className="text-white font-mono">{doc.total_pages || doc.page_count || 1}</strong> Pages
            </span>
            <span>•</span>
            <span className="flex items-center gap-1.5">
              <HardDrive className="w-3.5 h-3.5 text-white" />
              <strong className="text-white font-mono">{doc.total_chunks || doc.chunk_count || 0}</strong> Chunks
            </span>
            {getPdfUrl(doc) && (
              <a
                href={getPdfUrl(doc)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#1F1F1F] hover:bg-[#282828] border border-[#2E2E2E] text-white font-medium text-xs transition"
              >
                <span>Raw PDF</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        )}
      </div>

      {/* Main Viewer Area (Split into Left: Page View & Right: Extracted Chunks & Search) */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 overflow-hidden min-h-0">
        {/* Left Column: Rendered PDF Page Display (7 Cols) */}
        <div className="lg:col-span-7 flex flex-col rounded-2xl border border-[#262626] bg-[#141414] overflow-hidden shadow-sm">
          {/* Page Navigation Header */}
          <div className="p-3 border-b border-[#222222] bg-[#141414] flex flex-wrap items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2 text-xs font-medium text-[#9A9A9A]">
              <span>Page</span>
              <input
                type="number"
                min={1}
                max={totalPages}
                value={currentPage}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  if (val >= 1 && val <= totalPages) setCurrentPage(val);
                }}
                className="w-12 text-center rounded-lg bg-[#0D0D0D] border border-[#262626] py-0.5 text-xs text-white focus:outline-none focus:border-white font-mono"
              />
              <span>of {totalPages}</span>
            </div>

            <div className="flex items-center gap-1.5">
              {viewMode === 'image' && pageImgUrl && (
                <div className="hidden sm:flex items-center gap-1 mr-2 px-1.5 py-0.5 rounded-lg bg-[#0D0D0D] border border-[#262626]">
                  <button
                    onClick={() => setZoom((z) => Math.max(60, z - 15))}
                    className="p-1 text-[#9A9A9A] hover:text-white transition"
                    title="Zoom out"
                  >
                    <ZoomOut className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-[11px] font-mono text-white w-10 text-center">{zoom}%</span>
                  <button
                    onClick={() => setZoom((z) => Math.min(200, z + 15))}
                    className="p-1 text-[#9A9A9A] hover:text-white transition"
                    title="Zoom in"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>
                  {zoom !== 100 && (
                    <button
                      onClick={() => setZoom(100)}
                      className="p-1 text-[#9A9A9A] hover:text-white transition"
                      title="Reset zoom"
                    >
                      <RotateCcw className="w-3 h-3" />
                    </button>
                  )}
                </div>
              )}

              {getPdfUrl(doc) && (
                <div className="flex items-center rounded-lg bg-[#0D0D0D] border border-[#262626] p-0.5 mr-1 text-[11px]">
                  <button
                    onClick={() => setViewMode('image')}
                    className={`px-2 py-0.5 rounded-md transition ${viewMode === 'image' ? 'bg-[#262626] text-white font-medium' : 'text-[#9A9A9A] hover:text-white'}`}
                  >
                    Page
                  </button>
                  <button
                    onClick={() => setViewMode('embed')}
                    className={`px-2 py-0.5 rounded-md transition ${viewMode === 'embed' ? 'bg-[#262626] text-white font-medium' : 'text-[#9A9A9A] hover:text-white'}`}
                  >
                    PDF
                  </button>
                </div>
              )}

              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="p-1.5 rounded-lg bg-[#1F1F1F] text-[#9A9A9A] hover:text-white border border-[#2E2E2E] disabled:opacity-40 transition"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="p-1.5 rounded-lg bg-[#1F1F1F] text-[#9A9A9A] hover:text-white border border-[#2E2E2E] disabled:opacity-40 transition"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* PDF Viewer Frame */}
          <div className="flex-1 bg-[#0D0D0D] p-3 overflow-auto flex flex-col min-h-0">
            {!doc || loading ? (
              <div className="m-auto text-xs text-[#9A9A9A]">
                {loading ? 'Loading document...' : 'No document selected.'}
              </div>
            ) : viewMode === 'embed' && pdfBlobUrl ? (
              <iframe
                key={`${doc.id}-${currentPage}`}
                src={`${pdfBlobUrl}#page=${currentPage}`}
                title="PDF Document Viewer"
                className="w-full h-full rounded-xl border-0 bg-white min-h-[420px]"
              />
            ) : pageLoading ? (
              <div className="m-auto text-xs text-[#9A9A9A]">Rendering Page {currentPage}...</div>
            ) : pageImgUrl ? (
              <div className="mx-auto my-auto flex justify-center w-full">
                <img
                  src={pageImgUrl}
                  alt={`${doc.filename} - Page ${currentPage}`}
                  style={{ width: `${zoom}%`, maxWidth: zoom <= 100 ? '100%' : 'none' }}
                  className="rounded-xl shadow-2xl bg-white object-contain select-text"
                />
              </div>
            ) : (
              <div className="m-auto max-w-lg w-full space-y-4 p-4">
                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-[#141414] border border-[#262626] text-xs text-[#9A9A9A]">
                  <Info className="w-4 h-4 shrink-0 text-[#4F8CFF] mt-0.5" />
                  <div className="space-y-2 flex-1">
                    <p className="leading-relaxed">
                      {pageError || `Showing extracted text for Page ${currentPage}.`}
                    </p>
                    {getPdfUrl(doc) && (
                      <a
                        href={getPdfUrl(doc)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#1F1F1F] hover:bg-[#282828] border border-[#2E2E2E] text-white font-medium text-xs transition"
                      >
                        <span>Open Raw PDF</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>
                {pageChunks.length > 0 && (
                  <div className="p-4 rounded-xl bg-[#141414] border border-[#262626] space-y-2.5 text-xs text-[#E2E8F0] leading-relaxed select-text">
                    <div className="text-[11px] font-semibold text-[#9A9A9A] uppercase tracking-wider">
                      Page {currentPage} Extracted Text
                    </div>
                    {pageChunks.map((c, idx) => (
                      <p key={idx} className="whitespace-pre-wrap">{c.text}</p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Semantic Chunks & Search on this Page (5 Cols) */}
        <div className="lg:col-span-5 flex flex-col rounded-2xl border border-[#262626] bg-[#141414] overflow-hidden shadow-sm">
          {/* Header */}
          <div className="p-3.5 border-b border-[#222222] bg-[#141414] space-y-2.5 shrink-0">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-white" />
                Grounded Vector Chunks (Page {currentPage})
              </span>
              <span className="text-[11px] text-[#9A9A9A] font-mono px-2 py-0.5 rounded-full bg-[#1A1A1A] border border-[#262626]">
                {pageChunks.length} chunks
              </span>
            </div>

            {/* In-Document Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#666666] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search semantic text in this PDF..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg bg-[#0D0D0D] border border-[#262626] text-white placeholder-[#666666] focus:outline-none focus:border-white transition"
              />
            </div>
          </div>

          {/* Chunks List */}
          <div className="flex-1 overflow-y-auto p-3.5 space-y-2.5 min-h-0 scrollbar-none">
            {searchQuery.trim() ? (
              <div className="space-y-2">
                <div className="text-[11px] text-[#9A9A9A]">
                  Found {matchingChunks.length} matching segment(s) in document:
                </div>
                {matchingChunks.map((c, i) => (
                  <div
                    key={i}
                    onClick={() => setCurrentPage(c.page_number)}
                    className="p-3 rounded-xl bg-[#0D0D0D] border border-[#262626] hover:border-[#3A3A3A] transition cursor-pointer text-xs space-y-1.5"
                  >
                    <div className="flex justify-between items-center text-[10px] text-white font-semibold">
                      <span>Chunk #{c.chunk_index}</span>
                      <span className="px-2 py-0.5 rounded-full bg-[#1A1A1A] text-white border border-[#262626] font-mono">
                        Page {c.page_number}
                      </span>
                    </div>
                    <p className="text-[#9A9A9A] line-clamp-3 italic">"{c.text}"</p>
                  </div>
                ))}
              </div>
            ) : pageChunks.length === 0 ? (
              <div className="py-20 text-center text-xs text-[#9A9A9A] space-y-2">
                <Info className="w-6 h-6 mx-auto text-[#666666]" />
                <p className="font-semibold text-white">No chunk segments on Page {currentPage}.</p>
                <p className="text-[11px] text-[#666666]">The page may contain diagram illustrations or cover art.</p>
              </div>
            ) : (
              pageChunks.map((chunk, i) => (
                <div
                  key={i}
                  className="p-3.5 rounded-xl bg-[#0D0D0D] border border-[#262626] text-xs space-y-2"
                >
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-white">
                      Vector Chunk #{chunk.chunk_index}
                    </span>
                    <span className="text-[#666666] font-mono text-[10px]">
                      {chunk.text.length} chars
                    </span>
                  </div>
                  <p className="text-white leading-relaxed whitespace-pre-wrap font-sans bg-[#141414] p-3 rounded-xl border border-[#262626]">
                    {chunk.text}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
