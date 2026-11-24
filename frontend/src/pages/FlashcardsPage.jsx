import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Layers,
  RotateCcw,
  Check,
  X,
  Shuffle,
  Star,
  LayoutGrid,
  Square,
  Sparkles,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Bookmark,
  CheckCircle2,
  Volume2
} from 'lucide-react';
import { documentApi, studyApi } from '../services/api';
import { DEMO_FLASHCARDS } from '../services/demoData';

export default function FlashcardsPage() {
  const [searchParams] = useSearchParams();
  const docFromUrl = searchParams.get('doc');

  const [documents, setDocuments] = useState([]);
  const [selectedDocId, setSelectedDocId] = useState(docFromUrl || '');
  const [cardCount, setCardCount] = useState(6);
  const [flashcards, setFlashcards] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [viewMode, setViewMode] = useState('single'); // 'single' or 'grid'

  const [mastered, setMastered] = useState({});
  const [starred, setStarred] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    try {
      const docs = await documentApi.getDocuments();
      setDocuments(docs || []);
      if (!selectedDocId && docs.length > 0) {
        setSelectedDocId(docs[0].id);
        fetchCards(docs[0].id);
      } else if (selectedDocId) {
        fetchCards(selectedDocId);
      }
    } catch (e) {
      console.warn('Could not load documents:', e);
      setFlashcards(DEMO_FLASHCARDS);
    }
  };

  const fetchCards = async (docId) => {
    setLoading(true);
    setError(null);
    setCurrentIdx(0);
    setIsFlipped(false);
    try {
      const res = await studyApi.generateFlashcards({
        document_id: docId,
        count: cardCount,
      });
      setFlashcards(res.flashcards || DEMO_FLASHCARDS);
    } catch (err) {
      setFlashcards(DEMO_FLASHCARDS);
    } finally {
      setLoading(false);
    }
  };

  const handleShuffle = () => {
    const shuffled = [...flashcards].sort(() => Math.random() - 0.5);
    setFlashcards(shuffled);
    setCurrentIdx(0);
    setIsFlipped(false);
  };

  const markCardStatus = (isKnown) => {
    setMastered((prev) => ({
      ...prev,
      [currentIdx]: isKnown,
    }));
    if (currentIdx < flashcards.length - 1) {
      setIsFlipped(false);
      setTimeout(() => setCurrentIdx((prev) => prev + 1), 150);
    }
  };

  const toggleStar = (e, idx) => {
    e.stopPropagation();
    setStarred((prev) => ({
      ...prev,
      [idx]: !prev[idx],
    }));
  };

  const masteredCount = Object.values(mastered).filter(Boolean).length;
  const currentCard = flashcards[currentIdx];

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl bg-[#1A1A1A] border border-[#262626] shadow-sm select-none">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Active Recall{' '}
              <span className="font-serif italic font-normal text-white">Flashcards</span>
            </h1>
            <span className="text-[10px] font-semibold uppercase px-2.5 py-0.5 rounded-full bg-[#141414] text-white border border-[#262626]">
              Spaced Repetition
            </span>
          </div>
          <p className="text-xs text-[#9A9A9A] mt-1">
            Test retention on definitions, mechanisms, and key formulas extracted from course documents.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode(viewMode === 'single' ? 'grid' : 'single')}
            className="px-3 py-2 rounded-lg bg-[#0D0D0D] border border-[#262626] text-[#9A9A9A] hover:text-white transition text-xs flex items-center gap-1.5 shadow-sm"
            title="Toggle between single card and grid view"
          >
            {viewMode === 'single' ? <LayoutGrid className="w-4 h-4 text-white" /> : <Square className="w-4 h-4 text-white" />}
            <span className="hidden sm:inline font-medium">{viewMode === 'single' ? 'Grid View' : 'Single Card'}</span>
          </button>

          <button
            onClick={handleShuffle}
            disabled={flashcards.length === 0}
            className="px-3 py-2 rounded-lg bg-[#0D0D0D] border border-[#262626] text-[#9A9A9A] hover:text-white transition text-xs flex items-center gap-1.5 disabled:opacity-40 shadow-sm"
            title="Shuffle cards order"
          >
            <Shuffle className="w-4 h-4 text-white" />
            <span className="hidden sm:inline font-medium">Shuffle</span>
          </button>
        </div>
      </div>

      {/* Document Selector bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-[#1A1A1A] border border-[#262626] shadow-sm select-none">
        <div className="flex items-center gap-3">
          <span className="text-xs text-[#9A9A9A] font-medium">Target Document:</span>
          <select
            value={selectedDocId}
            onChange={(e) => {
              setSelectedDocId(e.target.value);
              fetchCards(e.target.value);
            }}
            className="bg-[#0D0D0D] border border-[#262626] rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-white max-w-xs"
          >
            {documents.map((d) => (
              <option key={d.id} value={d.id}>
                📄 {d.filename}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-[#9A9A9A] font-medium">Card Count:</span>
          <select
            value={cardCount}
            onChange={(e) => {
              const count = parseInt(e.target.value);
              setCardCount(count);
              if (selectedDocId) fetchCards(selectedDocId);
            }}
            className="bg-[#0D0D0D] border border-[#262626] rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-white"
          >
            <option value={4}>4 Cards</option>
            <option value={6}>6 Cards</option>
            <option value={10}>10 Cards</option>
          </select>
        </div>
      </div>

      {/* Progress & Mastery Bar */}
      {flashcards.length > 0 && (
        <div className="flex items-center justify-between text-xs text-[#9A9A9A] px-1">
          <span>
            Mastery: <strong className="text-emerald-400 font-semibold">{masteredCount}</strong> of {flashcards.length} cards
          </span>
          <div className="w-48 h-2 bg-[#0D0D0D] rounded-full overflow-hidden border border-[#262626]">
            <div
              className="h-full bg-white transition-all duration-300"
              style={{ width: `${(masteredCount / flashcards.length) * 100}%` }}
            />
          </div>
        </div>
      )}

      {loading ? (
        <div className="py-24 text-center text-xs text-[#9A9A9A] flex items-center justify-center gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-white" />
          <span>Synthesizing active recall cards...</span>
        </div>
      ) : flashcards.length === 0 ? (
        <div className="p-12 text-center rounded-2xl border border-dashed border-[#262626] bg-[#141414] text-xs text-[#9A9A9A]">
          No flashcards available. Select a document above to generate active recall cards!
        </div>
      ) : viewMode === 'single' ? (
        /* SINGLE CARD FOCUS VIEW */
        <div className="space-y-5">
          <div
            onClick={() => setIsFlipped(!isFlipped)}
            className="relative w-full min-h-[22rem] rounded-2xl border border-[#262626] bg-[#1A1A1A] p-8 flex flex-col justify-between shadow-lg cursor-pointer hover:border-[#404040] transition-all duration-300 select-none group"
          >
            {/* Top Bar on Card */}
            <div className="flex items-center justify-between text-xs">
              <span className="px-2.5 py-1 rounded-full bg-[#0D0D0D] text-white border border-[#262626] font-semibold uppercase tracking-wider text-[10px]">
                {currentCard?.key_concept || 'Concept'}
              </span>

              <div className="flex items-center gap-3">
                <span className="font-mono text-[#9A9A9A] text-xs">
                  Card {currentIdx + 1} of {flashcards.length}
                </span>

                <button
                  onClick={(e) => toggleStar(e, currentIdx)}
                  className={`p-1.5 rounded-lg transition ${
                    starred[currentIdx] ? 'text-amber-400' : 'text-[#9A9A9A] hover:text-white'
                  }`}
                  title="Star / Favorite Card"
                >
                  <Star className="w-4 h-4 fill-current" />
                </button>
              </div>
            </div>

            {/* Middle Face Content */}
            <div className="my-auto text-center py-8">
              {!isFlipped ? (
                <div className="space-y-3">
                  <span className="text-[11px] font-semibold text-[#9A9A9A] uppercase tracking-widest block font-mono">
                    🧠 QUESTION (CLICK CARD TO REVEAL ANSWER)
                  </span>
                  <p className="text-lg sm:text-xl font-bold text-white leading-relaxed max-w-xl mx-auto">
                    {currentCard?.question}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-widest block font-mono">
                    ✅ ANSWER & EXPLANATION
                  </span>
                  <p className="text-base sm:text-lg font-medium text-white leading-relaxed max-w-xl mx-auto">
                    {currentCard?.answer}
                  </p>
                </div>
              )}
            </div>

            {/* Bottom Footer on Card */}
            <div className="flex items-center justify-between text-xs text-[#9A9A9A] pt-4 border-t border-[#262626]">
              <span className="font-mono text-[11px]">
                Citation: Page {currentCard?.page_number || 1}
              </span>
              <span className="text-white flex items-center gap-1.5 text-xs font-medium group-hover:underline">
                <RotateCcw className="w-3.5 h-3.5" />
                {isFlipped ? 'Click to see Question' : 'Click to flip'}
              </span>
            </div>
          </div>

          {/* Action Controls: Don't Know / Know / Nav */}
          <div className="flex items-center justify-between gap-4">
            <button
              onClick={() => setCurrentIdx((prev) => Math.max(0, prev - 1))}
              disabled={currentIdx === 0}
              className="p-3 rounded-lg bg-[#0D0D0D] border border-[#262626] text-[#9A9A9A] hover:text-white disabled:opacity-40 transition shadow-sm"
              title="Previous card"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <button
                onClick={() => markCardStatus(false)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 text-xs font-semibold transition"
              >
                <X className="w-4 h-4" />
                <span>Need Review</span>
              </button>

              <button
                onClick={() => markCardStatus(true)}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-white hover:bg-neutral-200 text-black text-xs font-semibold transition shadow-sm active:scale-95"
              >
                <Check className="w-4 h-4 stroke-[2.5]" />
                <span>Know / Mastered</span>
              </button>
            </div>

            <button
              onClick={() => setCurrentIdx((prev) => Math.min(flashcards.length - 1, prev + 1))}
              disabled={currentIdx === flashcards.length - 1}
              className="p-3 rounded-lg bg-[#0D0D0D] border border-[#262626] text-[#9A9A9A] hover:text-white disabled:opacity-40 transition shadow-sm"
              title="Next card"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      ) : (
        /* GRID VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {flashcards.map((card, idx) => (
            <div
              key={idx}
              className="p-5 rounded-2xl border border-[#262626] bg-[#1A1A1A] flex flex-col justify-between space-y-4 hover:border-[#404040] transition shadow-sm"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-[#9A9A9A]">
                  <span className="px-2 py-0.5 rounded-full bg-[#0D0D0D] text-white font-semibold uppercase text-[10px] border border-[#262626]">
                    {card.key_concept}
                  </span>
                  <span className="font-mono text-[11px]">Page {card.page_number}</span>
                </div>
                <h4 className="text-sm font-semibold text-white">{card.question}</h4>
                <p className="text-xs text-[#9A9A9A] leading-relaxed pt-2 border-t border-[#262626]">
                  {card.answer}
                </p>
              </div>

              <button
                onClick={() =>
                  setMastered((prev) => ({
                    ...prev,
                    [idx]: !prev[idx],
                  }))
                }
                className={`w-full py-2 rounded-lg text-xs font-medium transition flex items-center justify-center gap-1.5 ${
                  mastered[idx]
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                    : 'bg-[#0D0D0D] text-[#9A9A9A] hover:text-white border border-[#262626]'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{mastered[idx] ? 'Mastered' : 'Mark as Mastered'}</span>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
