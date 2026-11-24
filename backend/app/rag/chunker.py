import re
import uuid
from typing import List, Dict, Any, Optional
from app.models.schemas import DocumentChunk


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
    page numbers and document metadata. Respects sentence and paragraph boundaries.
    """
    chunks: List[DocumentChunk] = []
    chunk_counter = 0

    for page in pages_data:
        page_num = page["page_number"]
        page_text = page["text"]

        if not page_text or len(page_text.strip()) == 0:
            continue

        # If page text is small enough, keep as single chunk
        if len(page_text) <= chunk_size:
            chunk_counter += 1
            chunks.append(
                DocumentChunk(
                    id=f"{document_id}_p{page_num}_c{chunk_counter}",
                    document_id=document_id,
                    user_id=user_id,
                    filename=filename,
                    page_number=page_num,
                    chunk_index=chunk_counter,
                    text=page_text.strip(),
                    metadata={
                        "char_length": len(page_text.strip()),
                        "page_number": page_num,
                        "filename": filename
                    }
                )
            )
            continue

        # Split into sentence-aware blocks
        sentences = re.split(r'(?<=[.?!])\s+', page_text)
        current_chunk = []
        current_length = 0

        for sentence in sentences:
            sentence = sentence.strip()
            if not sentence:
                continue

            sentence_len = len(sentence)

            # If a single sentence is huge, split it by words
            if sentence_len > chunk_size:
                if current_chunk:
                    chunk_text = " ".join(current_chunk).strip()
                    if chunk_text:
                        chunk_counter += 1
                        chunks.append(
                            DocumentChunk(
                                id=f"{document_id}_p{page_num}_c{chunk_counter}",
                                document_id=document_id,
                                user_id=user_id,
                                filename=filename,
                                page_number=page_num,
                                chunk_index=chunk_counter,
                                text=chunk_text,
                                metadata={"char_length": len(chunk_text), "page_number": page_num, "filename": filename}
                            )
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
                        chunk_text = " ".join(w_chunk)
                        chunks.append(
                            DocumentChunk(
                                id=f"{document_id}_p{page_num}_c{chunk_counter}",
                                document_id=document_id,
                                user_id=user_id,
                                filename=filename,
                                page_number=page_num,
                                chunk_index=chunk_counter,
                                text=chunk_text,
                                metadata={"char_length": len(chunk_text), "page_number": page_num, "filename": filename}
                            )
                        )
                        # Keep overlap words
                        overlap_words = int(chunk_overlap / 6)
                        w_chunk = w_chunk[-overlap_words:] if len(w_chunk) > overlap_words else []
                        w_len = sum(len(x) + 1 for x in w_chunk)

                if w_chunk:
                    current_chunk = w_chunk
                    current_length = w_len
                continue

            # Standard accumulation
            if current_length + sentence_len + 1 > chunk_size and current_chunk:
                chunk_text = " ".join(current_chunk).strip()
                if chunk_text:
                    chunk_counter += 1
                    chunks.append(
                        DocumentChunk(
                            id=f"{document_id}_p{page_num}_c{chunk_counter}",
                            document_id=document_id,
                            user_id=user_id,
                            filename=filename,
                            page_number=page_num,
                            chunk_index=chunk_counter,
                            text=chunk_text,
                            metadata={"char_length": len(chunk_text), "page_number": page_num, "filename": filename}
                        )
                    )

                # Keep trailing sentences for overlap
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

        # Last chunk
        if current_chunk:
            chunk_text = " ".join(current_chunk).strip()
            if chunk_text:
                chunk_counter += 1
                chunks.append(
                    DocumentChunk(
                        id=f"{document_id}_p{page_num}_c{chunk_counter}",
                        document_id=document_id,
                        user_id=user_id,
                        filename=filename,
                        page_number=page_num,
                        chunk_index=chunk_counter,
                        text=chunk_text,
                        metadata={"char_length": len(chunk_text), "page_number": page_num, "filename": filename}
                    )
                )

    return chunks
