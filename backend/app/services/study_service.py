import json
import re
import random
from typing import Any, Dict, List, Optional, Tuple
from sqlalchemy.orm import Session

from app.models.db_models import Document
from app.models.schemas import (
    FlashcardResponse,
    FlashcardItem,
    QuizResponse,
    QuizItem,
    QuizOption,
    RevisionNotesResponse,
    ImportantTopicsResponse,
)
from app.services.llm_providers import llm_router
from app.rag.embeddings import embedding_service
from app.rag.vector_store import vector_store


ACADEMIC_SYSTEM_PROMPT = (
    "You are StudyMind AI, an expert academic professor and curriculum architect. "
    "Generate accurate, clear, well-structured, student-friendly study materials grounded strictly in the provided document text. "
    "Rules:\n"
    "- Cite real page numbers [Page X] directly from the provided chunks; never invent page numbers or facts.\n"
    "- Format equations properly using LaTeX ($...$ for inline, $$...$$ for display) and code using fenced Markdown blocks.\n"
    "- Keep explanations crisp, logically organized with headings, bullet points, and tables where helpful.\n"
    "- When JSON is requested, return ONLY valid raw JSON matching the exact schema with no surrounding commentary."
)


class StudyService:
    def _clean_academic_text(self, text: str) -> str:
        """Clean PDF slide artifacts, presentation disclaimers, and bullet noise."""
        cleaned = re.sub(r"This\s+PPT\s+should\s+be\s+used\s+as\s+reference[^\n\.]*[\n\.]*", "", text, flags=re.IGNORECASE)
        cleaned = re.sub(r"Reading\s+books[^\n\.]*[\n\.]*", "", cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r"for\s+the\s+preparation\s+of\s+the\s+examinations?[\n\.]*", "", cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r"Page\s+\d+\s+Highlight:?", "", cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r"[\uf0a7\u25aa\u2022\u25cf\u25cb\u25a0\u25a1\uf0b7]\s*", " - ", cleaned)
        cleaned = re.sub(r"\s*\|\s*", " - ", cleaned)
        cleaned = re.sub(r"\s*-\s*-\s*", " - ", cleaned)
        return cleaned.strip()

    def _get_doc_and_chunks(self, db: Session, user_id: str, document_id: str):
        doc = db.query(Document).filter(Document.id == document_id, Document.user_id == user_id).first()
        if not doc:
            raise ValueError("Document not found or access denied.")
        chunks = vector_store.get_document_chunks(document_id, user_id=user_id)
        if not chunks:
            raise ValueError("No indexed chunks found for this document.")
        return doc, chunks

    def _sample_context(self, chunks: list, max_chunks: int = 16, focus: Optional[str] = None) -> str:
        """Select representative chunks (plus top focus matches if a focus topic is provided)."""
        selected = []
        seen_ids = set()

        if focus and focus.strip():
            q_vec = embedding_service.embed_query(focus.strip())
            doc_ids = [chunks[0].document_id] if chunks else None
            user_id = chunks[0].user_id if chunks else None
            focused = vector_store.search(q_vec, top_k=min(6, max_chunks // 2), user_id=user_id, document_ids=doc_ids)
            for c, _ in focused:
                key = (c.page_number, c.text[:40])
                if key not in seen_ids:
                    seen_ids.add(key)
                    selected.append(c)

        remaining_slots = max(1, max_chunks - len(selected))
        step = max(1, len(chunks) // remaining_slots)
        for c in chunks[0::step]:
            if len(selected) >= max_chunks:
                break
            key = (c.page_number, c.text[:40])
            if key not in seen_ids:
                seen_ids.add(key)
                selected.append(c)

        return "\n\n".join(f"[Page {c.page_number}]: {self._clean_academic_text(c.text)}" for c in selected)

    def _call_ai_text(
        self,
        prompt: str,
        model: Optional[str] = None,
        temperature: float = 0.25,
        max_tokens: int = 3000,
    ) -> Tuple[str, str]:
        if not llm_router.has_any_provider():
            raise RuntimeError("No LLM provider configured.")
        text, used_model, _provider = llm_router.generate(
            requested_model=model,
            system_instruction=ACADEMIC_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": prompt}],
            temperature=temperature,
            max_tokens=max_tokens,
        )
        return text, used_model

    def _loads_tolerant(self, candidate: str) -> Any:
        try:
            return json.loads(candidate, strict=False)
        except json.JSONDecodeError:
            # Escape stray backslashes (e.g., single-escaped LaTeX \Omega inside JSON strings)
            repaired = re.sub(r'\\(?!["\\/bfnrtu])', r'\\\\', candidate)
            return json.loads(repaired, strict=False)

    def _parse_json_payload(self, raw: str) -> Any:
        text = re.sub(r"```(?:json)?|```", "", (raw or "")).strip()
        try:
            return self._loads_tolerant(text)
        except Exception:
            # Extract first JSON array or object cleanly
            arr_match = re.search(r"(\[[\s\S]*\])", text)
            obj_match = re.search(r"(\{[\s\S]*\})", text)
            candidate = None
            if arr_match and obj_match:
                candidate = arr_match.group(1) if arr_match.start() < obj_match.start() else obj_match.group(1)
            elif arr_match:
                candidate = arr_match.group(1)
            elif obj_match:
                candidate = obj_match.group(1)
            if candidate:
                return self._loads_tolerant(candidate)
            raise

    def _call_ai_json(
        self,
        prompt: str,
        schema_example: str,
        model: Optional[str] = None,
        temperature: float = 0.2,
        max_tokens: int = 2800,
    ) -> Tuple[Any, str]:
        full_prompt = (
            f"{prompt}\n\n"
            f"Return ONLY valid raw JSON matching this exact structure (no markdown fences or commentary):\n"
            f"{schema_example}"
        )
        raw_text, used_model = self._call_ai_text(
            full_prompt, model=model, temperature=temperature, max_tokens=max_tokens
        )
        return self._parse_json_payload(raw_text), used_model

    def _extract_academic_knowledge(self, chunks: list) -> Dict[str, Any]:
        """Lightweight heuristic fallback parser when no live LLM provider is reachable."""
        definitions = []
        classifications = []
        key_facts = []
        topic_candidates: Dict[str, int] = {}

        def_patterns = [
            r"([A-Z][a-zA-Z\s]{2,35})\s+(?:is defined as|refers to|means|is a process of|is characterized by|is known as)\s+([^.\n]{20,250})",
            r"(?:Definition|defined as)[:\s]+([^.\n]{20,250})",
        ]
        class_patterns = [
            r"([A-Z][a-zA-Z\s]{2,30})\s+(?:are classified into|types of|categories of|include|consists of)\s+([^.\n]{20,250})",
            r"(?:Types|Categories|Classification)\s+of\s+([A-Za-z\s]{3,30})[:\s]+([^.\n]{20,250})",
        ]

        for c in chunks:
            text = self._clean_academic_text(c.text)
            if len(text) < 20:
                continue
            for pat in def_patterns:
                for m in re.findall(pat, text, re.IGNORECASE):
                    if isinstance(m, tuple) and len(m) == 2:
                        term, desc = m[0].strip().title(), m[1].strip()
                        if len(term) > 2 and len(desc) > 15:
                            definitions.append({"term": term, "definition": desc, "page_number": c.page_number})
            for pat in class_patterns:
                for m in re.findall(pat, text, re.IGNORECASE):
                    if isinstance(m, tuple) and len(m) == 2:
                        classifications.append({
                            "category": m[0].strip().title(),
                            "details": m[1].strip(),
                            "page_number": c.page_number,
                        })
            for s in [s.strip() for s in text.split(".") if len(s.strip()) > 35]:
                if any(w in s.lower() for w in ["important", "caused by", "results in", "algorithm", "complexity", "method", "primary", "critical", "theorem"]):
                    key_facts.append({"fact": s + ".", "page_number": c.page_number})
            for w in re.findall(r"\b[A-Z][a-zA-Z]{3,}(?:\s+[A-Z][a-zA-Z]{3,})*\b", text):
                w_clean = w.strip()
                if len(w_clean) > 4 and w_clean.lower() not in {"chapter", "section", "figure", "table", "total", "page"}:
                    topic_candidates[w_clean] = topic_candidates.get(w_clean, 0) + 1

        top_topics = [t[0] for t in sorted(topic_candidates.items(), key=lambda x: x[1], reverse=True)[:12]]
        return {"definitions": definitions, "classifications": classifications, "key_facts": key_facts, "top_topics": top_topics}

    # ─── 1. AI NOTES GENERATOR ──────────────────────────────────────────────
    def generate_ai_notes(
        self,
        db: Session,
        user_id: str,
        document_id: str,
        depth: str = "comprehensive",
        focus: Optional[str] = None,
        model: Optional[str] = None,
    ) -> Dict[str, Any]:
        doc, chunks = self._get_doc_and_chunks(db, user_id, document_id)
        context = self._sample_context(chunks, max_chunks=16, focus=focus)
        focus_note = f"\nFocus specifically on: '{focus.strip()}'." if focus and focus.strip() else ""

        if llm_router.has_any_provider():
            prompt = (
                f"Create crystal-clear, student-friendly {depth} lecture notes for '{doc.filename}'.{focus_note}\n\n"
                f"Document Excerpts:\n{context}\n\n"
                f"Organize with clean Markdown headings:\n"
                f"1. **Learning Outcomes** (concise bullets)\n"
                f"2. **Core Concepts & Intuitive Explanations** (with real-world analogies and `[Page X]` citations)\n"
                f"3. **Key Formulas, Complexity, or Frameworks** (use valid KaTeX `$...$` / `$$...$$` or Markdown comparison tables)\n"
                f"4. **Worked Examples / Trace Walkthrough** (if applicable from the material)\n"
                f"5. **High-Yield Exam Checklist & Common Mistakes**"
            )
            try:
                notes, used_model = self._call_ai_text(prompt, model=model, temperature=0.25, max_tokens=3200)
                return {
                    "document_id": document_id,
                    "filename": doc.filename,
                    "notes": notes,
                    "ai_generated": True,
                    "model_used": used_model,
                }
            except Exception as e:
                print(f"[StudyService] AI notes generation failed, using local fallback: {e}")

        knowledge = self._extract_academic_knowledge(chunks)
        defs, classes, topics, facts = (
            knowledge["definitions"], knowledge["classifications"], knowledge["top_topics"], knowledge["key_facts"]
        )
        topic_header = topics[0] if topics else doc.filename.replace(".pdf", "")
        notes_md = f"# Lecture Notes: {doc.filename}\n\n**Subject Focus:** {topic_header} · **Pages:** {doc.total_pages}\n\n"
        if defs:
            notes_md += "## Core Definitions\n" + "".join(
                f"### {d['term']} *(Page {d['page_number']})*\n> {d['definition'].strip()}\n\n" for d in defs[:4]
            )
        if classes:
            notes_md += "## Taxonomy & Categories\n" + "".join(
                f"- **{c['category']}** *(Page {c['page_number']})*: {c['details'].strip()}\n" for c in classes[:4]
            )
        if facts:
            notes_md += "\n## Key Takeaways\n" + "".join(
                f"- **Page {f['page_number']}:** {f['fact']}\n" for f in facts[:6]
            )
        return {"document_id": document_id, "filename": doc.filename, "notes": notes_md, "ai_generated": False, "model_used": None}

    # ─── 2. PDF SUMMARIZER ──────────────────────────────────────────────────
    def generate_summary(
        self,
        db: Session,
        user_id: str,
        document_id: str,
        style: str = "detailed",
        focus: Optional[str] = None,
        model: Optional[str] = None,
    ) -> Dict[str, Any]:
        doc, chunks = self._get_doc_and_chunks(db, user_id, document_id)
        context = self._sample_context(chunks, max_chunks=16, focus=focus)
        focus_note = f"\nPrioritize section/topic: '{focus.strip()}'." if focus and focus.strip() else ""

        if llm_router.has_any_provider():
            prompt = (
                f"Generate an accurate, readable academic summary for '{doc.filename}' in '{style}' style.{focus_note}\n\n"
                f"Document Excerpts:\n{context}\n\n"
                f"Include:\n"
                f"- `# Study Guide: {doc.filename}`\n"
                f"- `## Executive Overview` (2-4 crisp sentences)\n"
                f"- `## Unit / Topic Breakdown` (Markdown table or structured bullets with page numbers)\n"
                f"- `## Essential Definitions & Formulas` (clean KaTeX math like `$O(n \\log n)$` where relevant)\n"
                f"- `## Must-Know Exam Takeaways`"
            )
            try:
                summary_text, used_model = self._call_ai_text(prompt, model=model, temperature=0.22, max_tokens=2800)
                return {
                    "document_id": document_id,
                    "filename": doc.filename,
                    "style": style,
                    "summary": summary_text,
                    "ai_generated": True,
                    "model_used": used_model,
                }
            except Exception as e:
                print(f"[StudyService] AI summary failed, using local fallback: {e}")

        knowledge = self._extract_academic_knowledge(chunks)
        topics = knowledge["top_topics"][:6]
        summary_text = (
            f"# Study Guide: {doc.filename}\n\n"
            f"Synthesizes **{doc.total_pages} pages** covering {', '.join(f'`{t}`' for t in topics) or doc.filename}.\n\n"
            f"## Key Takeaways\n"
            + "\n".join(f"- **Page {c.page_number}:** {self._clean_academic_text(c.text)[:220]}..." for c in chunks[:5])
        )
        return {"document_id": document_id, "filename": doc.filename, "style": style, "summary": summary_text, "ai_generated": False, "model_used": None}

    # ─── 3. MCQ QUIZ GENERATOR ──────────────────────────────────────────────
    def generate_quiz(
        self,
        db: Session,
        user_id: str,
        document_id: str,
        count: int = 5,
        focus: Optional[str] = None,
        model: Optional[str] = None,
    ) -> QuizResponse:
        doc, chunks = self._get_doc_and_chunks(db, user_id, document_id)
        context = self._sample_context(chunks, max_chunks=14, focus=focus)
        focus_note = f" Focus especially on: '{focus.strip()}'." if focus and focus.strip() else ""

        if llm_router.has_any_provider():
            schema = (
                '[{"question": "Clear question text", '
                '"options": [{"id": "A", "text": "..."}, {"id": "B", "text": "..."}, {"id": "C", "text": "..."}, {"id": "D", "text": "..."}], '
                '"correct_option_id": "A", "explanation": "Concise reasoning citing page number", "page_number": 1}]'
            )
            prompt = (
                f"Generate {count} challenging, accurate exam MCQs strictly from '{doc.filename}'.{focus_note}\n"
                f"Avoid obvious giveaways—make all 4 options plausible and vary the correct answer letter.\n\n"
                f"Context:\n{context}"
            )
            try:
                parsed, used_model = self._call_ai_json(prompt, schema, model=model)
                quiz_items: List[QuizItem] = []
                for item in parsed[:count]:
                    opts = [QuizOption(id=str(o["id"]), text=str(o["text"])) for o in item.get("options", [])[:4]]
                    if len(opts) == 4:
                        quiz_items.append(QuizItem(
                            question=str(item["question"]),
                            options=opts,
                            correct_option_id=str(item.get("correct_option_id", "A")),
                            explanation=str(item.get("explanation", "")),
                            page_number=int(item.get("page_number", 1) or 1),
                        ))
                if quiz_items:
                    return QuizResponse(
                        document_id=document_id, filename=doc.filename, quiz=quiz_items,
                        ai_generated=True, model_used=used_model,
                    )
            except Exception as e:
                print(f"[StudyService] AI quiz failed, using local fallback: {e}")

        # Local analytical fallback
        quiz_items = []
        step = max(1, len(chunks) // max(1, count))
        for ch in chunks[0::step][:count]:
            sent = self._clean_academic_text(ch.text).split(".")[0].strip()
            opts_raw = [
                (sent[:120] + ".", True),
                ("Occurs strictly without any boundary or state constraints.", False),
                ("Produces zero measurable effect on runtime or accuracy.", False),
                ("Applies only to deprecated single-step approximations.", False),
            ]
            random.shuffle(opts_raw)
            correct_letter = "A"
            opts = []
            for idx, letter in enumerate(["A", "B", "C", "D"]):
                opts.append(QuizOption(id=letter, text=opts_raw[idx][0]))
                if opts_raw[idx][1]:
                    correct_letter = letter
            quiz_items.append(QuizItem(
                question=f"Which statement accurately reflects Page {ch.page_number} of '{doc.filename}'?",
                options=opts,
                correct_option_id=correct_letter,
                explanation=f"Stated directly on Page {ch.page_number} of '{doc.filename}'.",
                page_number=ch.page_number,
            ))
        return QuizResponse(document_id=document_id, filename=doc.filename, quiz=quiz_items[:count], ai_generated=False, model_used=None)

    # ─── 4. FLASHCARD GENERATOR ─────────────────────────────────────────────
    def generate_flashcards(
        self,
        db: Session,
        user_id: str,
        document_id: str,
        count: int = 6,
        focus: Optional[str] = None,
        model: Optional[str] = None,
    ) -> FlashcardResponse:
        doc, chunks = self._get_doc_and_chunks(db, user_id, document_id)
        context = self._sample_context(chunks, max_chunks=14, focus=focus)
        focus_note = f" Prioritize concepts related to: '{focus.strip()}'." if focus and focus.strip() else ""

        if llm_router.has_any_provider():
            schema = '[{"question": "Front prompt", "answer": "Crisp, high-recall answer", "page_number": 1, "key_concept": "Concept Tag"}]'
            prompt = (
                f"Generate {count} active-recall flashcards from '{doc.filename}'.{focus_note}\n"
                f"Make questions sharp and answers concise yet complete (using LaTeX `$...$` for formulas if needed).\n\n"
                f"Context:\n{context}"
            )
            try:
                parsed, used_model = self._call_ai_json(prompt, schema, model=model)
                items = [
                    FlashcardItem(
                        question=str(it["question"]),
                        answer=str(it["answer"]),
                        page_number=int(it.get("page_number", 1) or 1),
                        key_concept=str(it.get("key_concept", "Concept")),
                    )
                    for it in parsed[:count]
                ]
                if items:
                    return FlashcardResponse(
                        document_id=document_id, filename=doc.filename, flashcards=items,
                        ai_generated=True, model_used=used_model,
                    )
            except Exception as e:
                print(f"[StudyService] AI flashcards failed, using local fallback: {e}")

        items = []
        step = max(1, len(chunks) // max(1, count))
        for ch in chunks[0::step][:count]:
            clean = self._clean_academic_text(ch.text)
            lead = clean.split(".")[0][:80]
            items.append(FlashcardItem(
                question=f"Explain the key idea behind \"{lead}...\" (Page {ch.page_number})",
                answer=clean[:240] + f" (Page {ch.page_number})",
                page_number=ch.page_number,
                key_concept="Core Concept",
            ))
        return FlashcardResponse(document_id=document_id, filename=doc.filename, flashcards=items[:count], ai_generated=False, model_used=None)

    # ─── 5. IMPORTANT TOPICS FINDER (NOW AI-POWERED) ─────────────────────────
    def generate_important_topics(
        self,
        db: Session,
        user_id: str,
        document_id: str,
        model: Optional[str] = None,
    ) -> ImportantTopicsResponse:
        doc, chunks = self._get_doc_and_chunks(db, user_id, document_id)
        context = self._sample_context(chunks, max_chunks=16)

        if llm_router.has_any_provider():
            schema = '[{"title": "Topic Name", "importance": "High", "page_number": 1, "summary": "Why it matters for exams and core takeaways."}]'
            prompt = (
                f"Analyze '{doc.filename}' and identify the 6-8 most exam-important topics.\n"
                f"Assign importance as 'High' or 'Medium' and cite the exact page_number from the excerpts.\n\n"
                f"Context:\n{context}"
            )
            try:
                parsed, used_model = self._call_ai_json(prompt, schema, model=model)
                topics = [
                    {
                        "title": str(t.get("title", "Key Topic")),
                        "importance": "High" if str(t.get("importance", "")).lower() == "high" else "Medium",
                        "page_number": int(t.get("page_number", 1) or 1),
                        "summary": str(t.get("summary", "")),
                    }
                    for t in parsed[:8]
                ]
                if topics:
                    return ImportantTopicsResponse(
                        document_id=document_id, filename=doc.filename, topics=topics,
                        ai_generated=True, model_used=used_model,
                    )
            except Exception as e:
                print(f"[StudyService] AI important topics failed, using local fallback: {e}")

        knowledge = self._extract_academic_knowledge(chunks)
        topics = []
        for i, t in enumerate(knowledge["top_topics"][:6]):
            matching = [c for c in chunks if t.lower() in c.text.lower()]
            topics.append({
                "title": t,
                "page_number": matching[0].page_number if matching else (i + 1),
                "importance": "High" if i < 3 else "Medium",
                "summary": (self._clean_academic_text(matching[0].text)[:180] + "...") if matching else f"Core topic covering {t}.",
            })
        return ImportantTopicsResponse(document_id=document_id, filename=doc.filename, topics=topics, ai_generated=False, model_used=None)

    # ─── 6. MIND MAP GENERATOR (NOW AI-POWERED) ──────────────────────────────
    def generate_mind_map(
        self,
        db: Session,
        user_id: str,
        document_id: str,
        model: Optional[str] = None,
    ) -> Dict[str, Any]:
        doc, chunks = self._get_doc_and_chunks(db, user_id, document_id)
        context = self._sample_context(chunks, max_chunks=16)

        if llm_router.has_any_provider():
            schema = (
                '{"root_topic": "Main Subject Title", "children": ['
                '{"id": "b1", "name": "Branch Title", "children": ['
                '{"id": "b1_0", "name": "Subtopic Name", "note": "1-sentence concise explanation (Page X)"}'
                ']}]}'
            )
            prompt = (
                f"Create an accurate, well-organized 4-to-5 branch hierarchical mind map for '{doc.filename}'.\n"
                f"Each branch should have 3-5 concrete subtopics extracted strictly from the material, with a crisp 1-sentence 'note' and page reference.\n\n"
                f"Context:\n{context}"
            )
            try:
                parsed, used_model = self._call_ai_json(prompt, schema, model=model)
                root_topic = str(parsed.get("root_topic") or doc.filename.replace(".pdf", ""))
                branches = parsed.get("children") or []
                if branches:
                    return {
                        "document_id": document_id,
                        "filename": doc.filename,
                        "root_topic": root_topic,
                        "mind_map": {"name": root_topic, "children": branches},
                        "ai_generated": True,
                        "model_used": used_model,
                    }
            except Exception as e:
                print(f"[StudyService] AI mind map failed, using local fallback: {e}")

        knowledge = self._extract_academic_knowledge(chunks)
        root_label = knowledge["top_topics"][0] if knowledge["top_topics"] else doc.filename.replace(".pdf", "")
        branches = [
            {
                "id": "b1",
                "name": "Core Foundations",
                "children": [
                    {"id": f"b1_{i}", "name": f"{d['term']} (p.{d['page_number']})", "note": d["definition"][:120]}
                    for i, d in enumerate(knowledge["definitions"][:4])
                ] or [{"id": "b1_0", "name": root_label, "note": "Primary document subject"}],
            },
            {
                "id": "b2",
                "name": "Key Concepts",
                "children": [
                    {"id": f"b2_{i}", "name": t, "note": f"Key recurring concept in {doc.filename}"}
                    for i, t in enumerate(knowledge["top_topics"][:4])
                ] or [{"id": "b2_0", "name": "Curriculum Concepts"}],
            },
        ]
        return {
            "document_id": document_id,
            "filename": doc.filename,
            "root_topic": root_label,
            "mind_map": {"name": root_label, "children": branches},
            "ai_generated": False,
            "model_used": None,
        }

    # ─── 7. PRACTICE QUESTION GENERATOR (NOW AI-POWERED) ────────────────────
    def generate_practice_questions(
        self,
        db: Session,
        user_id: str,
        document_id: str,
        count: int = 5,
        focus: Optional[str] = None,
        model: Optional[str] = None,
    ) -> Dict[str, Any]:
        doc, chunks = self._get_doc_and_chunks(db, user_id, document_id)
        context = self._sample_context(chunks, max_chunks=14, focus=focus)
        focus_note = f" Focus on: '{focus.strip()}'." if focus and focus.strip() else ""

        if llm_router.has_any_provider():
            schema = (
                '[{"type": "Short Answer (5 Marks)", "difficulty": "Easy", "page": 1, '
                '"question": "Subjective question grounded in document", '
                '"solution": "Step-by-step model answer & marking rubric"}]'
            )
            prompt = (
                f"Generate {count} exam-style subjective practice questions (mix of Easy 5-mark, Medium 8-mark, and Hard 10/12-mark problems) "
                f"from '{doc.filename}', each with a complete step-by-step model solution.{focus_note}\n\n"
                f"Context:\n{context}"
            )
            try:
                parsed, used_model = self._call_ai_json(prompt, schema, model=model)
                questions = [
                    {
                        "type": str(q.get("type", "Practice Problem")),
                        "difficulty": str(q.get("difficulty", "Medium")),
                        "page": int(q.get("page", 1) or 1),
                        "question": str(q.get("question", "")),
                        "solution": str(q.get("solution", "")),
                    }
                    for q in parsed[:count]
                    if q.get("question")
                ]
                if questions:
                    return {
                        "document_id": document_id,
                        "filename": doc.filename,
                        "practice_questions": questions,
                        "ai_generated": True,
                        "model_used": used_model,
                    }
            except Exception as e:
                print(f"[StudyService] AI practice questions failed, using local fallback: {e}")

        questions = []
        for idx, ch in enumerate(chunks[:count]):
            questions.append({
                "type": "Short Answer (5 Marks)" if idx % 2 == 0 else "Analytical (8 Marks)",
                "difficulty": "Easy" if idx == 0 else "Medium",
                "page": ch.page_number,
                "question": f"Explain the core principles covered on Page {ch.page_number} of '{doc.filename}' with an example.",
                "solution": f"Key material from Page {ch.page_number}: {self._clean_academic_text(ch.text)[:260]}",
            })
        return {"document_id": document_id, "filename": doc.filename, "practice_questions": questions, "ai_generated": False, "model_used": None}

    # ─── 8. CODING TUTOR (NOW USES LLM ROUTER + OPTIONAL PDF CONTEXT) ────────
    def generate_coding_tutor(
        self,
        db: Optional[Session] = None,
        user_id: Optional[str] = None,
        topic: str = "",
        language: str = "python",
        document_id: Optional[str] = None,
        model: Optional[str] = None,
    ) -> Dict[str, Any]:
        t_clean = topic.strip()
        lang_clean = language.lower()

        doc_context = ""
        if db is not None and user_id and document_id:
            try:
                q_vec = embedding_service.embed_query(t_clean)
                hits = vector_store.search(q_vec, top_k=3, user_id=user_id, document_ids=[document_id])
                if hits:
                    doc_context = "\n\nRelevant Course Material Context:\n" + "\n".join(
                        f"[{c.filename}, Page {c.page_number}]: {self._clean_academic_text(c.text)}" for c, _ in hits
                    )
            except Exception:
                pass

        if llm_router.has_any_provider():
            prompt = (
                f"Teach and solve '{t_clean}' in {lang_clean}.{doc_context}\n\n"
                f"Structure clearly in Markdown:\n"
                f"1. **Conceptual Intuition** (why it works + visual dry-run trace)\n"
                f"2. **Clean, Commented {lang_clean.title()} Code**\n"
                f"3. **Time & Space Complexity** (best/average/worst in LaTeX `$...$`)\n"
                f"4. **Edge Cases & Exam/Interview Follow-ups**"
            )
            try:
                code_ans, used_model = self._call_ai_text(prompt, model=model, temperature=0.2, max_tokens=2800)
                return {
                    "topic": t_clean,
                    "language": lang_clean,
                    "content": code_ans,
                    "ai_generated": True,
                    "model_used": used_model,
                }
            except Exception as e:
                print(f"[StudyService] AI coding tutor failed: {e}")

        content_md = (
            f"### Coding Tutor: **{t_clean}** ({lang_clean.title()})\n\n"
            f"Connect a valid LLM API key on the backend to synthesize custom code walkthroughs for **{t_clean}**."
        )
        return {"topic": t_clean, "language": lang_clean, "content": content_md, "ai_generated": False, "model_used": None}

    # ─── 9. CHAPTER REVISION NOTES (NOW AI-POWERED) ─────────────────────────
    def generate_revision_notes(
        self,
        db: Session,
        user_id: str,
        document_id: str,
        focus: Optional[str] = None,
        model: Optional[str] = None,
    ) -> RevisionNotesResponse:
        doc, chunks = self._get_doc_and_chunks(db, user_id, document_id)
        context = self._sample_context(chunks, max_chunks=16, focus=focus)
        focus_note = f" Focus specifically on: '{focus.strip()}'." if focus and focus.strip() else ""

        if llm_router.has_any_provider():
            schema = (
                '{"title": "Exam Revision Sheet: Document Title", '
                '"high_yield_points": ["Crisp memorization point with (Page X)"], '
                '"important_definitions": [{"term": "Term Name", "definition": "Exact concise definition (Page X)"}], '
                '"potential_exam_questions": ["Likely exam question grounded in document"]}'
            )
            prompt = (
                f"Build a crisp exam-eve revision sheet strictly from '{doc.filename}'.{focus_note}\n"
                f"Include 6-8 high-yield bullet points, 5-6 essential term definitions, and 4-5 likely exam questions.\n\n"
                f"Context:\n{context}"
            )
            try:
                parsed, used_model = self._call_ai_json(prompt, schema, model=model)
                points = [str(p) for p in parsed.get("high_yield_points", []) if p]
                defs = [
                    {"term": str(d.get("term", "Term")), "definition": str(d.get("definition", ""))}
                    for d in parsed.get("important_definitions", [])
                    if d
                ]
                eqs = [str(q) for q in parsed.get("potential_exam_questions", []) if q]
                if points or defs:
                    return RevisionNotesResponse(
                        document_id=document_id,
                        filename=doc.filename,
                        title=str(parsed.get("title") or f"Exam Revision Sheet: {doc.filename}"),
                        high_yield_points=points,
                        important_definitions=defs,
                        potential_exam_questions=eqs,
                        ai_generated=True,
                        model_used=used_model,
                    )
            except Exception as e:
                print(f"[StudyService] AI revision notes failed, using local fallback: {e}")

        knowledge = self._extract_academic_knowledge(chunks)
        points = [f"Page {f['page_number']}: {f['fact']}" for f in knowledge["key_facts"][:6]] or [
            f"Page {c.page_number}: {self._clean_academic_text(c.text).split('.')[0]}." for c in chunks[:5]
        ]
        definitions = [
            {"term": d["term"], "definition": f"{d['definition']} (Page {d['page_number']})"}
            for d in knowledge["definitions"][:4]
        ] or [
            {"term": f"Section (p.{c.page_number})", "definition": self._clean_academic_text(c.text)[:120] + "..."}
            for c in chunks[:3]
        ]
        exam_questions = [
            f"Explain the core principles covered in '{doc.filename}' on Page {c.page_number}."
            for c in chunks[:3]
        ]
        return RevisionNotesResponse(
            document_id=document_id,
            filename=doc.filename,
            title=f"Exam Revision Sheet: {doc.filename}",
            high_yield_points=points,
            important_definitions=definitions,
            potential_exam_questions=exam_questions,
            ai_generated=False,
            model_used=None,
        )

    # ─── 10. QUESTION PAPER GENERATOR (NOW AI-POWERED) ──────────────────────
    def generate_question_paper(
        self,
        db: Session,
        user_id: str,
        document_id: str,
        focus: Optional[str] = None,
        model: Optional[str] = None,
    ) -> Dict[str, Any]:
        doc, chunks = self._get_doc_and_chunks(db, user_id, document_id)
        context = self._sample_context(chunks, max_chunks=16, focus=focus)
        focus_note = f" Cover especially: '{focus.strip()}'." if focus and focus.strip() else ""

        if llm_router.has_any_provider():
            schema = (
                '{"title": "University Examination Paper: Course Name", "total_marks": 60, "time_allowed": "2 Hours", '
                '"sections": [{"section": "Section A: Short Conceptual Questions (10 Marks)", '
                '"instructions": "Answer all 5 questions (2 marks each).", '
                '"questions": ["1. Question text..."], '
                '"answer_hints": ["1. Concise marking hint (Page X)..."]}]}'
            )
            prompt = (
                f"Draft a realistic 60-mark university examination paper strictly based on '{doc.filename}'.{focus_note}\n"
                f"Include Section A (5 x 2 marks), Section B (5 x 5 marks, answer 4), and Section C (2 x 15 marks analytical/design).\n"
                f"Provide concise 'answer_hints' for every question so students can self-evaluate.\n\n"
                f"Context:\n{context}"
            )
            try:
                parsed, used_model = self._call_ai_json(prompt, schema, model=model)
                if parsed.get("sections"):
                    return {
                        "document_id": document_id,
                        "filename": doc.filename,
                        "question_paper": parsed,
                        "ai_generated": True,
                        "model_used": used_model,
                    }
            except Exception as e:
                print(f"[StudyService] AI question paper failed, using local fallback: {e}")

        paper = {
            "title": f"Practice Examination: {doc.filename.replace('.pdf', '')}",
            "total_marks": 60,
            "time_allowed": "2 Hours",
            "sections": [
                {
                    "section": "Section A: Conceptual Foundations (10 Marks)",
                    "instructions": "Answer all questions (2 marks each).",
                    "questions": [
                        f"1. Summarize the core concept introduced on Page {c.page_number} of '{doc.filename}'."
                        for c in chunks[:3]
                    ],
                },
                {
                    "section": "Section B: Analytical Problems (20 Marks)",
                    "instructions": "Answer any 2 detailed questions (10 marks each).",
                    "questions": [
                        f"1. Discuss and apply the methodology from '{doc.filename}' with a worked example."
                    ],
                },
            ],
        }
        return {"document_id": document_id, "filename": doc.filename, "question_paper": paper, "ai_generated": False, "model_used": None}

    # ─── LEGACY HELPER FOR CHAT/STUDY COMPATIBILITY ───────────────────────────
    def explain_simply(
        self,
        db: Session,
        user_id: str,
        topic: str,
        document_id: Optional[str] = None,
        model: Optional[str] = None,
    ) -> Dict[str, Any]:
        query_vec = embedding_service.embed_query(topic)
        doc_ids = [document_id] if document_id else None
        results = vector_store.search(query_vec, top_k=4, user_id=user_id, document_ids=doc_ids)
        context_str = "\n".join(f"[Page {c.page_number}]: {self._clean_academic_text(c.text)}" for c, _ in results)

        if llm_router.has_any_provider():
            prompt = (
                f"Explain '{topic}' clearly from intuition up to exam precision.\n"
                + (f"Study Material Context:\n{context_str}\n\n" if context_str else "")
                + "Include an everyday analogy, plain-English core explanation, and key exam takeaway."
            )
            try:
                explanation, used_model = self._call_ai_text(prompt, model=model, temperature=0.3, max_tokens=1800)
                return {
                    "topic": topic,
                    "explanation": explanation,
                    "ai_generated": True,
                    "model_used": used_model,
                    "sources": [
                        {"document_id": c.document_id, "filename": c.filename, "page_number": c.page_number}
                        for c, _ in results
                    ],
                }
            except Exception as e:
                print(f"[StudyService] AI explain_simply failed: {e}")

        top_chunk = results[0][0] if results else None
        excerpt = self._clean_academic_text(top_chunk.text)[:220] if top_chunk else "Core foundational concept."
        return {
            "topic": topic,
            "explanation": f"### Understanding **{topic}**\n\n> \"{excerpt}...\"",
            "ai_generated": False,
            "model_used": None,
            "sources": [
                {"document_id": c.document_id, "filename": c.filename, "page_number": c.page_number}
                for c, _ in results
            ],
        }


study_service = StudyService()
