import os
import uuid
from pathlib import Path
from typing import List, Optional
from datetime import datetime, timezone
from sqlalchemy.orm import Session

from app.core.config import UPLOADS_DIR, settings
from app.models.db_models import Document
from app.models.schemas import DocumentResponse, DocumentChunk
from app.rag.extractor import extract_text_from_pdf, PDFExtractionError
from app.rag.chunker import chunk_document_pages
from app.rag.embeddings import embedding_service
from app.rag.vector_store import vector_store


class DocumentService:
    def process_and_add_pdf(
        self,
        db: Session,
        user_id: str,
        filename: str,
        file_bytes: bytes
    ) -> Document:
        """
        Processes an uploaded PDF for an authenticated user:
        1. Validates and writes file to disk
        2. Extracts text page-by-page using PyMuPDF / pypdf
        3. Chunks text while preserving user_id and page numbers
        4. Generates dense embeddings
        5. Stores vectors in FAISS / vector store
        6. Persists document record in SQLite database
        """
        clean_filename = Path(filename).name
        if not clean_filename.lower().endswith(".pdf"):
            raise ValueError("Only PDF documents are supported.")

        if len(file_bytes) == 0:
            raise ValueError("Uploaded file is 0 bytes.")

        if len(file_bytes) > 50 * 1024 * 1024:
            raise ValueError("File exceeds maximum allowed size of 50MB.")

        doc_id = str(uuid.uuid4())
        safe_prefix = doc_id[:8]
        stored_filename = f"{safe_prefix}_{clean_filename}"
        file_path = UPLOADS_DIR / stored_filename

        with open(file_path, "wb") as f:
            f.write(file_bytes)

        try:
            # 1. Extract text page-by-page
            pages_data, meta = extract_text_from_pdf(str(file_path))

            # 2. Chunk text segments
            chunks = chunk_document_pages(
                pages_data=pages_data,
                document_id=doc_id,
                filename=clean_filename,
                user_id=user_id,
                chunk_size=settings.chunk_size,
                chunk_overlap=settings.chunk_overlap
            )

            # 3. Generate embeddings & store in vector database
            chunk_texts = [c.text for c in chunks]
            vectors = embedding_service.embed_texts(chunk_texts)
            vector_store.add_chunks(chunks, vectors)

            # 4. Save metadata to database
            db_doc = Document(
                id=doc_id,
                user_id=user_id,
                filename=clean_filename,
                file_path=f"/uploads/{stored_filename}",
                file_size=len(file_bytes),
                upload_date=datetime.now(timezone.utc),
                processing_status="indexed",
                total_pages=meta.get("page_count", len(pages_data)),
                total_chunks=len(chunks)
            )
            db.add(db_doc)
            db.commit()
            db.refresh(db_doc)
            return db_doc

        except Exception as e:
            # Clean up uploaded file if extraction fails
            if file_path.exists():
                file_path.unlink()
            raise e

    def list_documents(self, db: Session, user_id: str) -> List[Document]:
        return db.query(Document).filter(Document.user_id == user_id).order_by(Document.upload_date.desc()).all()

    def get_document(self, db: Session, user_id: str, doc_id: str) -> Optional[Document]:
        return db.query(Document).filter(Document.id == doc_id, Document.user_id == user_id).first()

    def delete_document(self, db: Session, user_id: str, doc_id: str) -> bool:
        doc = self.get_document(db, user_id, doc_id)
        if not doc:
            return False

        # 1. Remove chunks from vector store
        vector_store.delete_document_chunks(doc_id, user_id=user_id)

        # 2. Remove physical file
        try:
            filename_only = doc.file_path.replace("/uploads/", "")
            disk_path = UPLOADS_DIR / filename_only
            if disk_path.exists():
                disk_path.unlink()
        except Exception as e:
            print(f"[DocumentService] Could not remove file {doc.file_path}: {e}")

        # 3. Delete database record
        db.delete(doc)
        db.commit()
        return True

    def get_document_chunks(self, user_id: str, doc_id: str) -> List[DocumentChunk]:
        return vector_store.get_document_chunks(doc_id, user_id=user_id)


document_service = DocumentService()
