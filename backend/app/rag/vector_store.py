import os
import re
import json
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
import numpy as np

from app.core.config import VECTOR_STORE_DIR
from app.models.schemas import DocumentChunk

# Check if FAISS is installed
HAS_FAISS = False
try:
    import faiss
    HAS_FAISS = True
except ImportError:
    pass

STOP_WORDS = {
    'the', 'is', 'at', 'which', 'on', 'a', 'an', 'and', 'or', 'to',
    'in', 'for', 'of', 'with', 'as', 'by', 'that', 'this', 'it', 'from',
    'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
    'what', 'why', 'how', 'when', 'where', 'who', 'explain', 'describe'
}


class VectorStore:
    def __init__(self, dimension: int = 384):
        self.dimension = dimension
        self.chunks: List[DocumentChunk] = []
        self.vectors: np.ndarray = np.empty((0, dimension), dtype=np.float32)
        self.faiss_index = None

        self.storage_dir = VECTOR_STORE_DIR
        self.storage_dir.mkdir(parents=True, exist_ok=True)
        self.chunks_file = self.storage_dir / "chunks_metadata.json"
        self.vectors_file = self.storage_dir / "vectors.npy"
        self.index_file = self.storage_dir / "faiss.index"

        self._load()

    def _load(self):
        """Loads chunks metadata and vector embeddings from disk."""
        try:
            if self.chunks_file.exists():
                with open(self.chunks_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    self.chunks = [DocumentChunk(**item) for item in data]

            if self.vectors_file.exists():
                self.vectors = np.load(self.vectors_file)
                if self.vectors.ndim == 1:
                    self.vectors = self.vectors.reshape(-1, self.dimension)
            else:
                self.vectors = np.empty((0, self.dimension), dtype=np.float32)

            if HAS_FAISS:
                if self.index_file.exists():
                    self.faiss_index = faiss.read_index(str(self.index_file))
                else:
                    self.faiss_index = faiss.IndexFlatIP(self.dimension)
                    if self.vectors.shape[0] > 0:
                        self.faiss_index.add(self.vectors)
        except Exception as e:
            print(f"[VectorStore] Error loading vector store from disk: {e}")
            self.chunks = []
            self.vectors = np.empty((0, self.dimension), dtype=np.float32)
            if HAS_FAISS:
                self.faiss_index = faiss.IndexFlatIP(self.dimension)

    def _save(self):
        """Persists chunks metadata and vector embeddings to disk."""
        try:
            with open(self.chunks_file, "w", encoding="utf-8") as f:
                json.dump([c.model_dump() for c in self.chunks], f, ensure_ascii=False, indent=2)

            np.save(self.vectors_file, self.vectors)

            if HAS_FAISS and self.faiss_index is not None and self.vectors.shape[0] > 0:
                faiss.write_index(self.faiss_index, str(self.index_file))
        except Exception as e:
            print(f"[VectorStore] Error saving vector store: {e}")

    def add_chunks(self, new_chunks: List[DocumentChunk], new_vectors: np.ndarray):
        """Adds new chunks and their corresponding embeddings to the index."""
        if len(new_chunks) == 0:
            return

        new_vectors = new_vectors.astype(np.float32)

        if new_vectors.shape[1] != self.dimension:
            if new_vectors.shape[1] > self.dimension:
                new_vectors = new_vectors[:, :self.dimension]
            else:
                padded = np.zeros((new_vectors.shape[0], self.dimension), dtype=np.float32)
                padded[:, :new_vectors.shape[1]] = new_vectors
                new_vectors = padded

        self.chunks.extend(new_chunks)

        if self.vectors.shape[0] == 0:
            self.vectors = new_vectors
        else:
            self.vectors = np.vstack([self.vectors, new_vectors])

        if HAS_FAISS and self.faiss_index is not None:
            self.faiss_index.add(new_vectors)

        self._save()

    def delete_document_chunks(self, document_id: str, user_id: Optional[str] = None) -> int:
        """Removes all chunks associated with a document_id (and user_id if specified)."""
        keep_indices = []
        for i, c in enumerate(self.chunks):
            if c.document_id == document_id:
                if user_id and c.user_id and c.user_id != user_id:
                    keep_indices.append(i)
                    continue
            else:
                keep_indices.append(i)

        removed_count = len(self.chunks) - len(keep_indices)
        if removed_count == 0:
            return 0

        self.chunks = [self.chunks[i] for i in keep_indices]

        if len(keep_indices) > 0:
            self.vectors = self.vectors[keep_indices]
            if HAS_FAISS:
                self.faiss_index = faiss.IndexFlatIP(self.dimension)
                self.faiss_index.add(self.vectors)
        else:
            self.vectors = np.empty((0, self.dimension), dtype=np.float32)
            if HAS_FAISS:
                self.faiss_index = faiss.IndexFlatIP(self.dimension)

        self._save()
        return removed_count

    def safe_reindex_missing(self) -> int:
        """
        Safe non-destructive migration helper: preserves existing FAISS index/vectors
        and only re-embeds or rebuilds FAISS index when chunks & vectors are out of sync.
        """
        if len(self.chunks) == 0:
            return 0
        if self.vectors.shape[0] == len(self.chunks) and self.vectors.shape[1] == self.dimension:
            if HAS_FAISS and (self.faiss_index is None or self.faiss_index.ntotal != len(self.chunks)):
                self.faiss_index = faiss.IndexFlatIP(self.dimension)
                self.faiss_index.add(self.vectors.astype(np.float32))
                self._save()
            return 0

        from app.rag.embeddings import embedding_service
        texts = [c.text for c in self.chunks]
        self.vectors = embedding_service.embed_texts(texts).astype(np.float32)
        if HAS_FAISS:
            self.faiss_index = faiss.IndexFlatIP(self.dimension)
            self.faiss_index.add(self.vectors)
        self._save()
        return len(self.chunks)

    def search(
        self,
        query_vector: np.ndarray,
        query_text: Optional[str] = None,
        top_k: int = 4,
        user_id: Optional[str] = None,
        document_ids: Optional[List[str]] = None,
        score_threshold: float = 0.05,
        enable_rerank: bool = True,
    ) -> List[Tuple[DocumentChunk, float]]:
        """
        Retrieves top_k most relevant document chunks using Hybrid Retrieval:
        Dense Cosine Similarity + IDF-weighted Lexical Relevance + Bigram/Heading Reranking + Multi-Source Diversity.
        Strictly isolates chunks to the requesting user/document filter without destroying existing indexes.
        """
        if len(self.chunks) == 0 or self.vectors.shape[0] == 0:
            return []

        query_vector = query_vector.astype(np.float32)
        if query_vector.ndim == 1:
            query_vector = query_vector.reshape(1, -1)

        if query_vector.shape[1] != self.dimension:
            if query_vector.shape[1] > self.dimension:
                query_vector = query_vector[:, :self.dimension]
            else:
                padded = np.zeros((1, self.dimension), dtype=np.float32)
                padded[:, :query_vector.shape[1]] = query_vector
                query_vector = padded

        q_norm = np.linalg.norm(query_vector)
        if q_norm > 0:
            query_vector = query_vector / q_norm

        candidate_indices = []
        for i, chunk in enumerate(self.chunks):
            if document_ids and len(document_ids) > 0:
                if chunk.document_id not in document_ids:
                    continue
            elif user_id and chunk.user_id and chunk.user_id != user_id:
                continue
            candidate_indices.append(i)

        if not candidate_indices:
            return []

        cand_vectors = self.vectors[candidate_indices]
        dense_sims = np.dot(cand_vectors, query_vector.T).flatten()

        query_words = []
        query_bigrams = []
        if query_text:
            query_words = [
                w.lower() for w in re.findall(r'\b[a-zA-Z0-9_\-]{3,}\b', query_text)
                if w.lower() not in STOP_WORDS
            ]
            if len(query_words) >= 2:
                query_bigrams = [f"{query_words[i]} {query_words[i+1]}" for i in range(len(query_words) - 1)]

        # Precompute simple inverse-document frequency weights across candidate chunks
        term_idf: Dict[str, float] = {}
        num_cands = max(1, len(candidate_indices))
        if query_words:
            for qw in set(query_words):
                df = sum(1 for orig_idx in candidate_indices if qw in self.chunks[orig_idx].text.lower())
                term_idf[qw] = 1.0 + float(np.log((num_cands + 1.0) / (df + 1.0)))

        scored_candidates = []
        clean_q = query_text.strip().lower() if query_text else ""

        for k, orig_idx in enumerate(candidate_indices):
            chunk = self.chunks[orig_idx]
            d_sim = max(0.0, float(dense_sims[k]))

            if query_words:
                text_lower = chunk.text.lower()
                heading_lower = str(chunk.metadata.get("section_heading", "")).lower()
                total_weight = sum(term_idf.get(w, 1.0) for w in query_words) or 1.0
                matched_weight = sum(term_idf.get(w, 1.0) for w in query_words if w in text_lower)
                kw_coverage = matched_weight / total_weight
                phrase_bonus = 0.25 if (clean_q and clean_q in text_lower) else 0.0
                bigram_hits = sum(1 for bg in query_bigrams if bg in text_lower)
                bigram_bonus = 0.15 * (bigram_hits / len(query_bigrams)) if query_bigrams else 0.0
                heading_bonus = 0.10 if any(w in heading_lower for w in query_words) else 0.0

                # Filter obvious non-matches: if zero keywords match and dense score is noise, do not fabricate relevance
                if matched_weight == 0 and d_sim < 0.25:
                    continue

                kw_score = min(1.0, (0.65 * kw_coverage) + phrase_bonus + bigram_bonus + heading_bonus)
                final_score = (0.42 * d_sim) + (0.58 * kw_score)
            else:
                final_score = d_sim

            if final_score >= score_threshold:
                scored_candidates.append((chunk, min(1.0, final_score), orig_idx))

        scored_candidates.sort(key=lambda x: -x[1])

        if not enable_rerank or len(scored_candidates) <= 1:
            return [(chunk, score) for chunk, score, _ in scored_candidates[:top_k]]

        # MMR-style diversity reranking over top candidate pool (supports multi-document coverage)
        pool = scored_candidates[: max(top_k * 3, 10)]
        selected: List[Tuple[DocumentChunk, float, int]] = []
        multi_doc_mode = not document_ids or len(document_ids) > 1

        remaining = list(pool)
        while remaining and len(selected) < top_k:
            best_item = None
            best_mmr = -1e9
            for chunk, base_score, orig_idx in remaining:
                redundancy = 0.0
                for sel_chunk, _, _ in selected:
                    if sel_chunk.document_id == chunk.document_id and sel_chunk.page_number == chunk.page_number:
                        redundancy = max(redundancy, 0.14)
                    elif sel_chunk.document_id == chunk.document_id:
                        redundancy = max(redundancy, 0.05 if multi_doc_mode else 0.02)
                mmr_score = base_score - redundancy
                if mmr_score > best_mmr:
                    best_mmr = mmr_score
                    best_item = (chunk, base_score, orig_idx)
            if best_item is None:
                break
            selected.append(best_item)
            remaining.remove(best_item)

        return [(chunk, score) for chunk, score, _ in selected]

    def get_document_chunks(self, document_id: str, user_id: Optional[str] = None, filename: Optional[str] = None) -> List[DocumentChunk]:
        """Returns all chunks for a specific document in page and chunk order."""
        # 1. Try matching with strict user_id filter
        matched = [
            c for c in self.chunks
            if c.document_id == document_id and (not user_id or not c.user_id or c.user_id == user_id)
        ]
        if matched:
            return matched

        # 2. Fall back to document_id (DB authorization layer already verified ownership)
        matched = [c for c in self.chunks if c.document_id == document_id]
        if matched:
            return matched

        # 3. Fallback: match by filename (direct parameter or from DB lookup)
        target_fn = filename
        if not target_fn and document_id:
            try:
                from app.core.database import SessionLocal
                from app.models.db_models import Document
                db = SessionLocal()
                try:
                    db_doc = db.query(Document).filter(Document.id == document_id).first()
                    if db_doc:
                        target_fn = db_doc.filename
                finally:
                    db.close()
            except Exception:
                pass

        if target_fn:
            clean_target = Path(target_fn).name.lower().strip()
            matched = [
                c for c in self.chunks
                if c.filename and (
                    clean_target == Path(c.filename).name.lower().strip() or
                    clean_target in c.filename.lower() or
                    c.filename.lower() in clean_target
                )
            ]
            if matched:
                return matched

        # 4. If still no chunks found, try parsing the PDF physical file from disk on-the-fly
        if document_id:
            try:
                from app.core.database import SessionLocal
                from app.models.db_models import Document
                from app.core.config import UPLOADS_DIR
                from app.rag.pdf_extractor import pdf_extractor
                db = SessionLocal()
                try:
                    db_doc = db.query(Document).filter(Document.id == document_id).first()
                    if db_doc:
                        fn = Path(db_doc.file_path or db_doc.filename).name
                        phys_path = UPLOADS_DIR / fn
                        if not phys_path.exists():
                            matches = list(UPLOADS_DIR.glob(f"*{db_doc.filename}*"))
                            if matches:
                                phys_path = matches[0]
                        if phys_path.exists():
                            extracted = pdf_extractor.extract(str(phys_path))
                            if extracted.get("chunks"):
                                generated_chunks = [
                                    DocumentChunk(
                                        id=f"{document_id}_p{c['page_number']}_c{c['chunk_index']}",
                                        document_id=document_id,
                                        user_id=user_id or db_doc.user_id,
                                        filename=db_doc.filename,
                                        page_number=c['page_number'],
                                        chunk_index=c['chunk_index'],
                                        text=c['text'],
                                        metadata={"page_number": c['page_number'], "filename": db_doc.filename}
                                    )
                                    for c in extracted["chunks"]
                                ]
                                self.chunks.extend(generated_chunks)
                                return generated_chunks
                finally:
                    db.close()
            except Exception as e:
                print(f"[VectorStore] On-the-fly chunk extraction fallback failed: {e}")

        return []

    def total_chunks(self) -> int:
        return len(self.chunks)

    def total_chunks_for_user(self, user_id: Optional[str] = None) -> int:
        if not user_id:
            return len(self.chunks)
        return sum(1 for c in self.chunks if not c.user_id or c.user_id == user_id)

    def is_empty_for_user(self, user_id: Optional[str] = None) -> bool:
        return self.total_chunks_for_user(user_id) == 0


vector_store = VectorStore()
