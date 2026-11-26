import re
import uuid
from typing import List, Dict, Any, Optional
from app.models.schemas import DocumentChunk


def _detect_section_heading(text: str) -> Optional[str]:
    """Extracts a leading chapter/unit/section heading when present."""
    first_line = text.strip().splitlines()[0].strip() if text.strip() else ""
    if 3 <= len(first_line) <= 100 and re.match(
        r"^(?:chapter|unit|module|section|part|topic|\d+(?:\.\d+)*[:.)])\b",
        first_line,
        re.IGNORECASE,
    ):
        return first_line
    return None


def _build_chunk(
    document_id: str,
    page_num: int,
    chunk_counter: int,
    user_id: Optional[str],
    filename: str,
    chunk_text: str,
    section_heading: Optional[str] = None,
) -> DocumentChunk:
    clean = chunk_text.strip()
    meta: Dict[str, Any] = {
        "char_length": len(clean),
        "page_number": page_num,
        "filename": filename,
    }
    if section_heading:
        meta["section_heading"] = section_heading
    return DocumentChunk(
        id=f"{document_id}_p{page_num}_c{chunk_counter}",
        document_id=document_id,
        user_id=user_id,
        filename=filename,
        page_number=page_num,
        chunk_index=chunk_counter,
        text=clean,
        metadata=meta,
    )


def chunk_document_pages(
    pages_data: List[Dict[str, Any]],
    document_id: str,
    filename: str,
    user_id: Optional[str] = None,
    chunk_size: int = 750,
    chunk_overlap: int = 150
) -> List[DocumentChunk]:
    """
    Chunks document pages into overlapping segments while preserving
    page numbers, section headings, and document metadata. Respects paragraph and sentence boundaries.
    """
    chunks: List[DocumentChunk] = []
    chunk_counter = 0

    for page in pages_data:
        page_num = page["page_number"]
        page_text = page["text"]

        if not page_text or len(page_text.strip()) == 0:
            continue

        heading = _detect_section_heading(page_text)

        # If page text is small enough, keep as single chunk
        if len(page_text) <= chunk_size:
            chunk_counter += 1
            chunks.append(
                _build_chunk(document_id, page_num, chunk_counter, user_id, filename, page_text, heading)
            )
            continue

        # Split into paragraph & sentence-aware units
        units: List[str] = []
        for para in re.split(r"\n{2,}", page_text):
            para = para.strip()
            if not para:
                continue
            units.extend(s.strip() for s in re.split(r"(?<=[.?!])\s+", para) if s.strip())

        current_chunk: List[str] = []
        current_length = 0

        for sentence in units:
            sentence_len = len(sentence)

            # If a single sentence is huge, split it by words
            if sentence_len > chunk_size:
                if current_chunk:
                    chunk_text = " ".join(current_chunk).strip()
                    if chunk_text:
                        chunk_counter += 1
                        chunks.append(
                            _build_chunk(document_id, page_num, chunk_counter, user_id, filename, chunk_text, heading)
                        )
                    current_chunk = []
                    current_length = 0

                words = sentence.split()
                w_chunk = []
                w_len = 0
                for w in words:
                    w_chunk.append(w)
                    w_len += len(w) + 1
                    if w_len >= chunk_size:
                        chunk_counter += 1
                        chunks.append(
                            _build_chunk(document_id, page_num, chunk_counter, user_id, filename, " ".join(w_chunk), heading)
                        )
                        overlap_words = max(1, int(chunk_overlap / 6))
                        w_chunk = w_chunk[-overlap_words:] if len(w_chunk) > overlap_words else []
                        w_len = sum(len(x) + 1 for x in w_chunk)

                if w_chunk:
                    current_chunk = w_chunk
                    current_length = w_len
                continue

            if current_length + sentence_len + 1 > chunk_size and current_chunk:
                chunk_text = " ".join(current_chunk).strip()
                if chunk_text:
                    chunk_counter += 1
                    chunks.append(
                        _build_chunk(document_id, page_num, chunk_counter, user_id, filename, chunk_text, heading)
                    )

                overlap_text = []
                overlap_len = 0
                for prev_sent in reversed(current_chunk):
                    if overlap_len + len(prev_sent) <= chunk_overlap:
                        overlap_text.insert(0, prev_sent)
                        overlap_len += len(prev_sent) + 1
                    else:
                        break

                current_chunk = overlap_text + [sentence]
                current_length = sum(len(s) + 1 for s in current_chunk)
            else:
                current_chunk.append(sentence)
                current_length += sentence_len + 1

        if current_chunk:
            chunk_text = " ".join(current_chunk).strip()
            if chunk_text:
                chunk_counter += 1
                chunks.append(
                    _build_chunk(document_id, page_num, chunk_counter, user_id, filename, chunk_text, heading)
                )

    return chunks
