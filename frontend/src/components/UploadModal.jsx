import React, { useState, useRef } from 'react';
import { X, UploadCloud, FileText, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { documentApi, ensureBackendConnected, getApiBaseUrl } from '../services/api';

export default function UploadModal({ isOpen, onClose, onUploadSuccess }) {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [processingStatus, setProcessingStatus] = useState('');
  const [error, setError] = useState(null);
  const [successInfo, setSuccessInfo] = useState(null);
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const validateFiles = (files) => {
    const validPdfs = [];
    let err = null;

    for (const file of files) {
      if (!file.name.toLowerCase().endsWith('.pdf')) {
        err = `"${file.name}" is not a valid PDF file. Only PDF files are accepted.`;
        continue;
      }
      if (file.size === 0) {
        err = `"${file.name}" is an empty file (0 bytes).`;
        continue;
      }
      if (file.size > 50 * 1024 * 1024) {
        err = `"${file.name}" exceeds the 50MB limit.`;
        continue;
      }
      validPdfs.push(file);
    }

    if (err) setError(err);
    return validPdfs;
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    setError(null);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const valid = validateFiles(Array.from(e.dataTransfer.files));
      if (valid.length > 0) {
        setSelectedFiles((prev) => [...prev, ...valid]);
      }
    }
  };

  const handleChange = (e) => {
    setError(null);
    if (e.target.files && e.target.files.length > 0) {
      const valid = validateFiles(Array.from(e.target.files));
      if (valid.length > 0) {
        setSelectedFiles((prev) => [...prev, ...valid]);
      }
    }
  };

  const removeFile = (index) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;

    setUploading(true);
    setError(null);
    setUploadProgress(20);
    setProcessingStatus('Uploading PDFs to backend...');

    try {
      const uploadOnce = () =>
        documentApi.uploadDocuments(selectedFiles, (progressEvent) => {
          if (progressEvent.total) {
            const percent = Math.round((progressEvent.loaded * 50) / progressEvent.total);
            setUploadProgress(percent);
          }
        });

      let result;
      try {
        result = await uploadOnce();
      } catch (firstErr) {
        const status = firstErr.response?.status;
        const isConnErr =
          !firstErr.response ||
          firstErr.code === 'ERR_NETWORK' ||
          firstErr.code === 'ECONNABORTED' ||
          status === 502 ||
          status === 503 ||
          status === 504;
        if (isConnErr) {
          setProcessingStatus('Reconnecting to backend server & retrying upload...');
          const check = await ensureBackendConnected();
          if (check.connected) {
            result = await uploadOnce();
          } else {
            throw firstErr;
          }
        } else {
          throw firstErr;
        }
      }

      setUploadProgress(85);
      setProcessingStatus('Extracting text with PyMuPDF, generating embeddings & indexing into FAISS...');

      setTimeout(() => {
        setUploadProgress(100);
        setUploading(false);
        setSuccessInfo(result);
        if (onUploadSuccess) onUploadSuccess(result);
      }, 600);
    } catch (err) {
      setUploading(false);
      setUploadProgress(0);
      const isConnErr =
        !err.response || err.code === 'ERR_NETWORK' || err.code === 'ECONNABORTED';
      const msg = isConnErr
        ? `Cannot reach backend at "${getApiBaseUrl()}". If the free Render server just restarted or is waking up, wait a few seconds and try uploading again.`
        : err.response?.data?.detail || err.message || 'Failed to process and index PDF.';
      setError(msg);
    }
  };

  const handleModalClose = () => {
    setSelectedFiles([]);
    setError(null);
    setSuccessInfo(null);
    setUploading(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl rounded-2xl bg-[#141414] border border-[#262626] shadow-2xl p-6 text-white select-none">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#222222]">
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight">Upload Study Documents</h2>
            <p className="text-xs text-[#9A9A9A] mt-0.5">
              Upload PDF textbooks, lecture notes, research papers, or syllabus documents
            </p>
          </div>
          <button
            onClick={handleModalClose}
            className="p-1.5 rounded-lg text-[#9A9A9A] hover:text-white hover:bg-[#1A1A1A] transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Success View */}
        {successInfo ? (
          <div className="py-8 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Documents Ingested Successfully!</h3>
              <p className="text-xs text-[#9A9A9A] mt-1">
                Extracted pages, generated embeddings, and indexed into FAISS vector database.
              </p>
              {successInfo.documents && (
                <div className="mt-3 text-xs text-white font-mono bg-[#0D0D0D] p-3 rounded-xl border border-[#262626] text-left max-h-36 overflow-y-auto">
                  {successInfo.documents.map((doc, i) => (
                    <div key={i} className="flex justify-between py-1 border-b border-[#222222] last:border-none">
                      <span className="truncate pr-2">{doc.filename}</span>
                      <span className="text-emerald-400 shrink-0 font-medium">{doc.total_chunks ?? doc.chunk_count ?? 0} chunks ({doc.total_pages ?? doc.page_count ?? 0} pages)</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="pt-2 flex justify-center gap-3">
              <button
                onClick={() => {
                  setSuccessInfo(null);
                  setSelectedFiles([]);
                }}
                className="px-4 py-2 text-xs font-medium rounded-lg bg-[#1F1F1F] text-white border border-[#2E2E2E] hover:bg-[#282828] transition"
              >
                Upload More
              </button>
              <button
                onClick={handleModalClose}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-white text-black hover:bg-neutral-200 transition shadow-sm"
              >
                Go to Document Library
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            {/* Drag & Drop Zone */}
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
                dragActive
                  ? 'border-white bg-[#1A1A1A]'
                  : 'border-[#262626] hover:border-[#3A3A3A] bg-[#0D0D0D] hover:bg-[#1A1A1A]'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,application/pdf"
                className="hidden"
                onChange={handleChange}
              />
              <div className="w-12 h-12 rounded-xl bg-[#1A1A1A] text-white flex items-center justify-center mx-auto mb-3 border border-[#262626]">
                <UploadCloud className="w-6 h-6" />
              </div>
              <p className="text-sm font-semibold text-white">
                Click to browse or drag and drop PDF files here
              </p>
              <p className="text-xs text-[#9A9A9A] mt-1">
                PyMuPDF text extraction • Automated Chunking • FAISS Vector Store • Max 50MB per file
              </p>
            </div>

            {/* Error Banner */}
            {error && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Selected Files List */}
            {selectedFiles.length > 0 && (
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs text-[#9A9A9A] px-1">
                  <span>Selected Documents ({selectedFiles.length})</span>
                  <button
                    onClick={() => setSelectedFiles([])}
                    className="text-xs text-[#9A9A9A] hover:text-red-400 transition"
                  >
                    Clear all
                  </button>
                </div>
                <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                  {selectedFiles.map((file, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-[#0D0D0D] border border-[#262626] text-xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <FileText className="w-4 h-4 text-white shrink-0" />
                        <span className="font-medium text-white truncate">{file.name}</span>
                        <span className="text-[11px] text-[#666666] shrink-0 font-mono">
                          ({(file.size / (1024 * 1024)).toFixed(2)} MB)
                        </span>
                      </div>
                      {!uploading && (
                        <button
                          onClick={() => removeFile(idx)}
                          className="p-1 rounded text-[#9A9A9A] hover:text-red-400 transition"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Upload Progress Bar */}
            {uploading && (
              <div className="space-y-2 pt-2">
                <div className="flex justify-between text-xs font-medium">
                  <span className="text-white flex items-center gap-1.5">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    {processingStatus}
                  </span>
                  <span className="text-[#9A9A9A] font-mono">{uploadProgress}%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-[#1A1A1A] overflow-hidden">
                  <div
                    className="h-full bg-white transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="pt-3 border-t border-[#222222] flex justify-end gap-3">
              <button
                type="button"
                onClick={handleModalClose}
                disabled={uploading}
                className="px-4 py-2 text-xs font-medium rounded-lg text-[#9A9A9A] hover:text-white hover:bg-[#1A1A1A] transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUpload}
                disabled={uploading || selectedFiles.length === 0}
                className="inline-flex items-center gap-2 px-5 py-2 text-xs font-semibold rounded-lg bg-white hover:bg-neutral-200 text-black shadow-sm transition disabled:opacity-50 active:scale-95"
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-black" />
                    <span>Processing RAG...</span>
                  </>
                ) : (
                  <>
                    <UploadCloud className="w-4 h-4 stroke-[2.5]" />
                    <span>Process & Ingest ({selectedFiles.length})</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
