from typing import List
from pathlib import Path
from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, status
from fastapi.responses import FileResponse, Response
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.config import UPLOADS_DIR
from app.core.security import get_current_user
from app.models.db_models import User, Document
from app.services.document_service import document_service
from app.models.schemas import DocumentResponse
from app.rag.extractor import HAS_PYMUPDF

if HAS_PYMUPDF:
    import fitz

router = APIRouter(prefix="/documents", tags=["Documents"])

@router.post("/upload", response_model=dict)
async def upload_documents(
    files: List[UploadFile] = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Upload one or multiple PDF documents for the authenticated user.
    Extracts text page-by-page, generates embeddings, stores in FAISS,
    and saves document metadata to SQLite database.
    """
    if not files or len(files) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No files provided for upload."
        )

    processed_docs = []
    errors = []

    for file in files:
        if not file.filename.lower().endswith(".pdf"):
            errors.append(f"'{file.filename}' rejected: Only PDF files (.pdf) are accepted.")
            continue

        try:
            content = await file.read()
            if len(content) == 0:
                errors.append(f"'{file.filename}' rejected: File is empty (0 bytes).")
                continue

            if len(content) > 50 * 1024 * 1024:
                errors.append(f"'{file.filename}' rejected: Exceeds 50MB file size limit.")
                continue

            doc = document_service.process_and_add_pdf(
                db=db,
                user_id=current_user.id,
                filename=file.filename,
                file_bytes=content
            )
            processed_docs.append(DocumentResponse.model_validate(doc).model_dump())

        except Exception as e:
            errors.append(f"Failed to process '{file.filename}': {str(e)}")

    if len(processed_docs) == 0 and len(errors) > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="; ".join(errors)
        )

    return {
        "success": True,
        "message": f"Successfully ingested {len(processed_docs)} document(s).",
        "documents": processed_docs,
        "errors": errors if errors else None
    }


@router.get("", response_model=List[DocumentResponse])
def get_user_documents(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Retrieve all uploaded documents belonging to the authenticated user."""
    docs = document_service.list_documents(db, current_user.id)
    return [DocumentResponse.model_validate(d) for d in docs]


@router.get("/{document_id}", response_model=dict)
def get_document_details(
    document_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Retrieve document details and indexed RAG chunks for the document."""
    doc = document_service.get_document(db, current_user.id, document_id)
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document with id '{document_id}' not found."
        )

    chunks = document_service.get_document_chunks(current_user.id, document_id)
    return {
        "document": DocumentResponse.model_validate(doc).model_dump(),
        "chunks": [c.model_dump() for c in chunks]
    }


def _resolve_document_file(document_id: str, db: Session) -> tuple[Document, Path]:
    """Resolve DB Document record and its physical PDF path on disk."""
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document '{document_id}' not found."
        )

    target_filename = Path(doc.file_path).name
    file_path = UPLOADS_DIR / target_filename

    if not file_path.exists():
        matches = list(UPLOADS_DIR.glob(f"*{doc.filename}*"))
        if matches:
            file_path = matches[0]

    if not file_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"PDF physical file '{target_filename}' not found on storage."
        )

    return doc, file_path


@router.get("/{document_id}/file")
def get_document_file(
    document_id: str,
    db: Session = Depends(get_db)
):
    """
    Serve the raw PDF file directly for inline rendering in Document Viewer.
    Allows iframe / object embedding without falling back to Vite SPA index.html.
    """
    doc, file_path = _resolve_document_file(document_id, db)

    safe_name = doc.filename.replace('"', "")
    return FileResponse(
        path=str(file_path),
        media_type="application/pdf",
        filename=doc.filename,
        headers={
            "Content-Disposition": f'inline; filename="{safe_name}"',
            "Cache-Control": "public, max-age=3600"
        }
    )


@router.get("/{document_id}/page/{page_number}")
def get_document_page_image(
    document_id: str,
    page_number: int,
    db: Session = Depends(get_db)
):
    """
    Render a single 1-indexed PDF page as a crisp PNG using PyMuPDF so Document Viewer
    never depends on cross-origin PDF iframes or browser PDF plugin support.
    """
    if not HAS_PYMUPDF:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="PyMuPDF is not installed on the server."
        )

    _, file_path = _resolve_document_file(document_id, db)

    try:
        with fitz.open(str(file_path)) as pdf_doc:
            total_pages = len(pdf_doc)
            if page_number < 1 or page_number > total_pages:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Page {page_number} out of range (1-{total_pages})."
                )
            page = pdf_doc[page_number - 1]
            pix = page.get_pixmap(matrix=fitz.Matrix(2.0, 2.0), alpha=False)
            png_bytes = pix.tobytes("png")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to render page {page_number}: {str(e)}"
        )

    return Response(
        content=png_bytes,
        media_type="image/png",
        headers={"Cache-Control": "public, max-age=3600"}
    )


@router.delete("/{document_id}", response_model=dict)
def delete_document(
    document_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a document, remove its disk file, and prune its FAISS vector embeddings."""
    success = document_service.delete_document(db, current_user.id, document_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document with id '{document_id}' not found or access denied."
        )

    return {
        "success": True,
        "message": f"Document '{document_id}' and all associated vector embeddings were deleted."
    }


@router.post("/reindex", response_model=dict)
def safe_reindex_vector_store(
    current_user: User = Depends(get_current_user),
):
    """Safely verifies and repairs missing vector embeddings without wiping existing FAISS indexes."""
    from app.rag.vector_store import vector_store
    reindexed_count = vector_store.safe_reindex_missing()
    return {
        "success": True,
        "reindexed_chunks": reindexed_count,
        "total_chunks": vector_store.total_chunks_for_user(current_user.id),
    }
