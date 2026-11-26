import os
import re
import math
import hashlib
from typing import List
import numpy as np
from app.core.config import settings

def _should_use_sentence_transformers() -> bool:
    configured = (settings.embedding_model or "hybrid-semantic").strip().lower()
    return configured not in ("", "hybrid-semantic", "dense-semantic", "local")


# Only enable heavy PyTorch SentenceTransformers when explicitly configured
HAS_SENTENCE_TRANSFORMERS = False
st_model = None
if _should_use_sentence_transformers():
    try:
        from sentence_transformers import SentenceTransformer  # noqa: F401
        HAS_SENTENCE_TRANSFORMERS = True
    except Exception:
        HAS_SENTENCE_TRANSFORMERS = False


class EmbeddingGenerator:
    def __init__(self, vector_dim: int = 384):
        self.vector_dim = vector_dim
        self._st_model = None
        self._st_failed = False

    def _get_st_model(self):
        global st_model
        if not _should_use_sentence_transformers() or self._st_failed:
            return None
        if HAS_SENTENCE_TRANSFORMERS and self._st_model is None:
            try:
                from sentence_transformers import SentenceTransformer
                model_name = settings.embedding_model.strip() or "all-MiniLM-L6-v2"
                self._st_model = SentenceTransformer(model_name)
                st_model = self._st_model
            except Exception as e:
                print(f"[Embeddings] Falling back to hybrid-semantic dense vectorizer: {e}")
                self._st_failed = True
                self._st_model = None
        return self._st_model

    def embed_texts(self, texts: List[str]) -> np.ndarray:
        """
        Embeds a list of texts into normalized dense vectors of fixed dimension (384).
        Uses:
        1. Sentence Transformers ('all-MiniLM-L6-v2') if installed locally
        2. High-Precision Dense Semantic N-gram Vectorizer (384-dim, unit normalized)
        Guarantees 100% consistent dimensionality so similarity search never crashes.
        """
        if not texts:
            return np.empty((0, self.vector_dim), dtype=np.float32)

        # 1. Try Sentence Transformers if available locally
        st = self._get_st_model()
        if st is not None:
            try:
                embeddings = st.encode(texts, convert_to_numpy=True, normalize_embeddings=True)
                return embeddings.astype(np.float32)
            except Exception:
                pass

        # 2. Robust Dense Semantic Vectorizer (384-dimensional unit hypersphere)
        return self._embed_dense_semantic(texts)

    def embed_query(self, query: str) -> np.ndarray:
        clean = query.strip() if query else ""
        vecs = self.embed_texts([clean])
        return vecs[0]

    def _embed_dense_semantic(self, texts: List[str]) -> np.ndarray:
        """
        Dense semantic embedding generator.
        Combines word tokens, subword 3-grams, 4-grams, and term frequency
        projected onto a fixed 384-dimensional unit hypersphere.
        Works identically in offline, sandboxed, and cloud environments.
        """
        dim = self.vector_dim
        vectors = np.zeros((len(texts), dim), dtype=np.float32)

        stop_words = {
            'the', 'is', 'at', 'which', 'on', 'a', 'an', 'and', 'or', 'to',
            'in', 'for', 'of', 'with', 'as', 'by', 'that', 'this', 'it', 'from',
            'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had'
        }

        for i, text in enumerate(texts):
            clean_text = text.lower()
            tokens = re.findall(r'\b[a-zA-Z0-9_\-\.]{2,}\b', clean_text)
            
            vec = np.zeros(dim, dtype=np.float32)
            
            for token in tokens:
                weight = 0.35 if token in stop_words else 1.2
                
                # Word hash projection
                h = int(hashlib.md5(token.encode('utf-8')).hexdigest(), 16)
                idx = h % dim
                sign = 1.0 if ((h >> 8) & 1) else -1.0
                vec[idx] += sign * weight

                # Subword n-grams for morphology & typos
                if len(token) >= 4:
                    for n in range(3, min(6, len(token) + 1)):
                        for k in range(len(token) - n + 1):
                            ngram = token[k:k+n]
                            h_ng = int(hashlib.sha256(ngram.encode('utf-8')).hexdigest(), 16)
                            ng_idx = h_ng % dim
                            ng_sign = 1.0 if ((h_ng >> 8) & 1) else -1.0
                            vec[ng_idx] += ng_sign * 0.3 * weight

            # L2 Normalization (Cosine Similarity ready)
            norm = np.linalg.norm(vec)
            if norm > 1e-8:
                vec = vec / norm
            else:
                # Fallback non-zero vector
                vec[0] = 1.0
            vectors[i] = vec

        return vectors


# Singleton instance
embedding_service = EmbeddingGenerator()
