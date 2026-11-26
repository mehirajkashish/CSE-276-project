import os
import re
from pathlib import Path
from typing import List, Dict, Any, Tuple

# Check PDF extraction backends
HAS_PYMUPDF = False
try:
    import fitz  # PyMuPDF
    HAS_PYMUPDF = True
except ImportError:
    pass

HAS_PYPDF = False
try:
    import pypdf
    HAS_PYPDF = True
except ImportError:
    pass


class PDFExtractionError(Exception):
    pass


def _clean_disclaimer_boilerplate(text: str) -> str:
    """Strips repetitive classroom slide disclaimers while preserving paragraph structure and fixing hyphenated line-wraps."""
    patterns = [
        r"This\s+PPT\s+should\s+be\s+used\s+as\s+reference\s+only[^\n\.]*[\n\.]*",
        r"Reading\s+books\s+\(mentioned\s+in\s+syllabus\)\s+is\s+mandatory[^\n\.]*[\n\.]*",
        r"for\s+the\s+preparation\s+of\s+the\s+examinations?[\n\.]*",
        r"for\s+the\s+preparation\s+of\s+the\s+exam[^\n\.]*[\n\.]*"
    ]
    cleaned = text.replace("\r\n", "\n").replace("\r", "\n")
    # Rejoin hyphenated words broken across PDF line wraps
    cleaned = re.sub(r"([A-Za-z])-\s*\n\s*([a-z])", r"\1\2", cleaned)
    for p in patterns:
        cleaned = re.sub(p, "", cleaned, flags=re.IGNORECASE)
    # Collapse inline whitespace per paragraph while keeping paragraph boundaries
    paragraphs = []
    for para in re.split(r"\n{2,}", cleaned):
        normalized = " ".join(para.split()).strip()
        if normalized:
            paragraphs.append(normalized)
    return "\n\n".join(paragraphs).strip()


def extract_text_from_pdf(file_path: str) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    """
    Extracts text from a PDF file page-by-page.
    Preserves page numbers (1-indexed) and extracts metadata.
    Prioritizes PyMuPDF, gracefully falling back to pypdf.
    """
    path = Path(file_path)
    if not path.exists():
        raise PDFExtractionError(f"File not found: {file_path}")

    if path.stat().st_size == 0:
        raise PDFExtractionError(f"PDF file is empty (0 bytes): {path.name}")

    pages_data = []
    metadata = {
        "filename": path.name,
        "file_size": path.stat().st_size,
        "page_count": 0,
        "extractor_used": "PyMuPDF" if HAS_PYMUPDF else "pypdf"
    }

    if HAS_PYMUPDF:
        try:
            doc = fitz.open(file_path)
            metadata["page_count"] = len(doc)
            pypdf_reader = None
            for page_idx in range(len(doc)):
                page = doc[page_idx]
                text = page.get_text("text") or ""
                cleaned_text = _clean_disclaimer_boilerplate(text)
                if not cleaned_text and HAS_PYPDF:
                    try:
                        if pypdf_reader is None:
                            pypdf_reader = pypdf.PdfReader(file_path)
                        if page_idx < len(pypdf_reader.pages):
                            fallback_text = pypdf_reader.pages[page_idx].extract_text() or ""
                            cleaned_text = _clean_disclaimer_boilerplate(fallback_text)
                    except Exception:
                        pass
                if cleaned_text:
                    pages_data.append({
                        "page_number": page_idx + 1,
                        "text": cleaned_text,
                        "raw_length": len(text)
                    })
            doc.close()
        except Exception as e:
            if HAS_PYPDF:
                return _extract_with_pypdf(file_path, metadata)
            raise PDFExtractionError(f"Error extracting PDF with PyMuPDF: {str(e)}")
    elif HAS_PYPDF:
        return _extract_with_pypdf(file_path, metadata)
    else:
        raise PDFExtractionError("Neither PyMuPDF nor pypdf is installed.")

    if not pages_data:
        raise PDFExtractionError(f"No extractable text found in '{path.name}'. The PDF may be scanned images or empty.")

    return pages_data, metadata


def _extract_with_pypdf(file_path: str, metadata: Dict[str, Any]) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    pages_data = []
    metadata["extractor_used"] = "pypdf"
    try:
        reader = pypdf.PdfReader(file_path)
        metadata["page_count"] = len(reader.pages)
        for page_idx, page in enumerate(reader.pages):
            text = page.extract_text() or ""
            cleaned_text = _clean_disclaimer_boilerplate(text)
            if cleaned_text:
                pages_data.append({
                    "page_number": page_idx + 1,
                    "text": cleaned_text,
                    "raw_length": len(text)
                })
    except Exception as e:
        raise PDFExtractionError(f"Error reading PDF with pypdf: {str(e)}")

    return pages_data, metadata
