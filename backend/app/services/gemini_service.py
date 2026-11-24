import os
import json
import re
from typing import List, Dict, Any, Optional
import requests
from app.core.config import settings
from app.models.schemas import SourceCitation

SYSTEM_INSTRUCTION = (
    "You are StudyMind AI, a warm, brilliant, empathetic, and encouraging academic tutor and mentor. "
    "Your mission is to help students genuinely grasp the intuition behind their course materials and study with confidence. "
    "Speak naturally, clearly, and supportively—like an inspiring tutor sitting right beside the student. "
    "Use intuitive analogies, step-by-step reasoning, clean bullet points, and LaTeX equations where appropriate. "
    "Base your answers strictly on the provided context. If a detail is missing from their notes, kindly explain what is known and offer guidance. "
    "Never sound robotic, cold, or repetitive. Keep explanations crisp, human, and directly useful for excelling in exams."
)

GREETING_PATTERNS = [
    r'^(hi|hello|hey|greetings|good\s+(morning|afternoon|evening|day)|howdy)\b',
    r'^(who\s+are\s+you|what\s+can\s+you\s+do|what\s+is\s+studymind|help\s+me)\b',
    r'^(what\'s\s+up|sup)\b'
]


class GeminiService:
    def __init__(self):
        self.default_model = "gemini-1.5-flash"

    def is_configured(self) -> bool:
        return bool(settings.gemini_api_key and settings.gemini_api_key.strip())

    def is_greeting(self, question: str) -> bool:
        clean = question.strip().lower()
        if len(clean) < 30:
            for pattern in GREETING_PATTERNS:
                if re.search(pattern, clean):
                    return True
        return False

    def get_greeting_response(self, user_name: Optional[str] = None) -> str:
        name_str = f", **{user_name}**" if user_name else ""
        return (
            f"Hello{name_str}! 👋 Welcome to **StudyMind AI**.\n\n"
            f"I'm here to help you study your course materials. You can ask me questions about your uploaded PDFs, "
            f"request concept explanations, or ask for practice questions.\n\n"
            f"What would you like to review today?"
        )

    def _clean_slide_text(self, text: str) -> str:
        """Cleans PDF slide bullet artifacts, presentation disclaimers, and noise."""
        cleaned = re.sub(r"This\s+PPT\s+should\s+be\s+used\s+as\s+reference[^\n\.]*[\n\.]*", "", text, flags=re.IGNORECASE)
        cleaned = re.sub(r"Reading\s+books[^\n\.]*[\n\.]*", "", cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r"for\s+the\s+preparation\s+of\s+the\s+examinations?[\n\.]*", "", cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r"for\s+the\s+preparation\s+of\s+the\s+exam[^\n\.]*[\n\.]*", "", cleaned, flags=re.IGNORECASE)
        # Convert rectangular bullet artifacts to clean markdown
        cleaned = re.sub(r"[\uf0a7\u25aa\u2022\u25cf\u25cb\u25a0\u25a1\uf0b7]\s*", "\n- ", cleaned)
        cleaned = re.sub(r"\s*\|\s*", " - ", cleaned)
        cleaned = re.sub(r"\n\s*-\s*\n", "\n", cleaned)
        cleaned = re.sub(r"(?:\n-\s*)+", "\n- ", cleaned)
        return cleaned.strip()

    def generate_general_academic_answer(self, question: str, user_name: Optional[str] = None) -> Dict[str, Any]:
        """
        Answers student questions when no PDF is attached or when asking general academic queries.
        Provides warm, intuitive explanations with analogies, bullet points, and LaTeX equations.
        """
        api_key = settings.gemini_api_key.strip()
        model_name = settings.gemini_model or self.default_model

        user_prompt = (
            f"STUDENT'S QUESTION:\n{question}\n\n"
            f"INSTRUCTIONS:\n"
            f"You are StudyMind AI, an encouraging and brilliant academic study tutor. "
            f"The student asked this question without attaching a specific textbook or notes PDF. "
            f"Provide a clear, engaging, intuitive explanation. "
            f"Use structured paragraphs, bullet points, real-world analogies, and clean LaTeX math where relevant. "
            f"Keep your tone warm, encouraging, and easy to understand. "
            f"Conclude with a brief, friendly tip:\n"
            f"> 💡 *Tip: You can attach your course lecture slides or textbook anytime to get answers grounded in your specific class notes with exact page citations!*"
        )

        if api_key:
            try:
                answer = self._call_gemini_api(api_key, model_name, user_prompt)
                return {
                    "answer": answer,
                    "grounded": False,
                    "model_used": model_name
                }
            except Exception as e:
                print(f"[GeminiService] Gemini call failed for general query: {e}")

        # Local intelligent tutor fallback if API key is not configured or offline
        local_ans = self._synthesize_general_academic_fallback(question)
        return {
            "answer": local_ans,
            "grounded": False,
            "model_used": "local-academic-tutor"
        }

    def _synthesize_general_academic_fallback(self, question: str) -> str:
        q_clean = question.strip()
        q_lower = q_clean.lower()

        # Math / Equations / Algebra
        if any(w in q_lower for w in ["solve", "equation", "formula", "derivative", "integral", "matrix", "eigen", "calculus", "math"]):
            return (
                f"### 📐 Mathematical Breakdown: **{q_clean}**\n\n"
                f"Here is how to solve and understand this concept step-by-step:\n\n"
                f"1. **Identify the Core Principle:** State the known variables, definitions, and target values.\n"
                f"2. **Standard Formulation:** Set up the governing algebraic or differential equations.\n"
                f"3. **Analytical Solution:** Apply systematic substitution or transformation rules to isolate the solution.\n"
                f"4. **Verification:** Test boundary conditions or substitute the root back into the original expression to confirm.\n\n"
                f"> 💡 *Tip: Upload your course syllabus or lecture slides to get step-by-step derivations matching your professor's exact format and page citations!*"
            )

        # AI / Machine Learning / Deep Learning
        if any(w in q_lower for w in ["machine learning", "deep learning", "neural", "attention", "transformer", "backpropagation", "gradient", "cnn", "rnn"]):
            return (
                f"### 🧠 Core Concept: **{q_clean}**\n\n"
                f"In computer science and artificial intelligence, this is a foundational principle:\n\n"
                f"- **Core Intuition:** Instead of hardcoding hand-written rules, neural models iteratively adjust parameter weights to minimize an objective error loss.\n"
                f"- **Mathematical Basis:** Backpropagation applies the multi-variable chain rule $\\frac{{\\partial L}}{{\\partial w}} = \\frac{{\\partial L}}{{\\partial y}} \\cdot \\frac{{\\partial y}}{{\\partial w}}$ to propagate gradient updates backward.\n"
                f"- **Optimization:** Modern architectures utilize layer normalization, residual connections, and adaptive learning rates (like AdamW) to maintain numerical stability.\n\n"
                f"> 💡 *Tip: Attach your lecture slides or textbook anytime to see how this specific architecture is defined in your syllabus with exact page numbers!*"
            )

        # Science / Physics / Chemistry / Biology
        if any(w in q_lower for w in ["physics", "chemistry", "quantum", "energy", "force", "molecule", "reaction", "acid", "cell", "biology"]):
            return (
                f"### 🔬 Scientific Overview: **{q_clean}**\n\n"
                f"Here is a clear breakdown of the underlying scientific mechanism:\n\n"
                f"- **Fundamental Law:** Physical and chemical systems are governed by conservation principles (energy, mass, and charge).\n"
                f"- **Microscopic vs Macroscopic:** At the molecular level, interactions occur via electromagnetic forces and thermodynamics, dictating the observed macroscopic behaviors.\n"
                f"- **Exam Takeaway:** When answering exam questions, always state the underlying assumptions, balance physical units, and note equilibrium states.\n\n"
                f"> 💡 *Tip: Attach your textbook or lab notes to review the specific reaction pathways, diagrams, and exact page citations!*"
            )

        # General Academic Query
        return (
            f"### 💡 Overview & Insights: **{q_clean}**\n\n"
            f"Here is an intuitive academic explanation to help you understand this topic:\n\n"
            f"- **Conceptual Framework:** Break down the idea into fundamental building blocks before tackling complex edge cases.\n"
            f"- **Connecting Theory to Practice:** Notice how this concept applies in real-world scenarios and structured problem-solving.\n"
            f"- **Active Recall Recommendation:** Try explaining this concept out loud in your own words or testing yourself on practice questions.\n\n"
            f"> 💡 *Tip: You can attach your course PDFs anytime to ground answers directly in your lecture notes with exact page citations!*"
        )

    def generate_rag_answer(
        self,
        question: str,
        citations: List[SourceCitation],
        user_name: Optional[str] = None,
        conversation_history: Optional[List[Dict[str, str]]] = None
    ) -> Dict[str, Any]:
        """
        Generates an answer grounded in retrieved RAG context using Gemini API.
        If no citations exist, seamlessly answers using general academic tutor intelligence!
        """
        # 1. Conversational Greeting check
        if self.is_greeting(question):
            return {
                "answer": self.get_greeting_response(user_name),
                "grounded": False,
                "model_used": "conversational-agent"
            }

        # 2. If no citations are found, seamlessly answer as an intelligent academic tutor!
        if not citations:
            return self.generate_general_academic_answer(question, user_name)

        # 3. Format retrieved context
        context_blocks = []
        for i, cite in enumerate(citations, 1):
            clean_c_text = self._clean_slide_text(cite.text)
            context_blocks.append(
                f"[Source {i}: {cite.filename} | Page {cite.page_number}]\n{clean_c_text}\n"
            )
        formatted_context = "\n---\n".join(context_blocks)

        user_prompt = (
            f"STUDY MATERIALS CONTEXT:\n{formatted_context}\n\n"
            f"STUDENT'S QUESTION:\n{question}\n\n"
            f"INSTRUCTIONS:\n"
            f"Answer the question directly, cleanly, and naturally like ChatGPT or Gemini. "
            f"Use clear paragraphs and bullet points where helpful. "
            f"Do NOT include repetitive source disclaimers or repetitive citation footers (the UI displays citations automatically). "
            f"Base your answer strictly on the provided context."
        )

        api_key = settings.gemini_api_key.strip()
        model_name = settings.gemini_model or self.default_model

        if not api_key:
            synthesized_answer = self._synthesize_local_context(question, citations)
            return {
                "answer": synthesized_answer,
                "grounded": True,
                "model_used": "local-rag-synthesizer"
            }

        try:
            answer = self._call_gemini_api(api_key, model_name, user_prompt)
            return {
                "answer": answer,
                "grounded": True,
                "model_used": model_name
            }
        except Exception as e:
            local_ans = self._synthesize_local_context(question, citations)
            return {
                "answer": local_ans,
                "grounded": True,
                "model_used": "local-fallback"
            }

    def _call_gemini_api(self, api_key: str, model: str, prompt: str) -> str:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"

        payload = {
            "contents": [
                {
                    "parts": [{"text": prompt}]
                }
            ],
            "systemInstruction": {
                "parts": [{"text": SYSTEM_INSTRUCTION}]
            },
            "generationConfig": {
                "temperature": 0.2,
                "maxOutputTokens": 2048,
            }
        }

        resp = requests.post(url, json=payload, timeout=30.0)
        if resp.status_code != 200:
            err_text = resp.text
            try:
                err_json = resp.json()
                err_msg = err_json.get("error", {}).get("message", err_text)
            except Exception:
                err_msg = err_text
            raise Exception(f"Gemini API Error ({resp.status_code}): {err_msg}")

        data = resp.json()
        candidates = data.get("candidates", [])
        if not candidates:
            raise Exception("Gemini returned empty candidates.")

        text_parts = candidates[0].get("content", {}).get("parts", [])
        if not text_parts:
            finish_reason = candidates[0].get("finishReason", "UNKNOWN")
            raise Exception(f"No response text received (finish reason: {finish_reason}).")

        return text_parts[0].get("text", "")

    def _synthesize_local_context(self, question: str, citations: List[SourceCitation]) -> str:
        """
        Synthesizes a clean, natural, student-friendly answer like ChatGPT/Gemini
        from top retrieved document chunks.
        """
        if not citations:
            return "I could not find information relevant to this question in your uploaded documents."

        clean_q = question.strip()
        is_exam_request = any(k in clean_q.lower() for k in ["practice question", "exam question", "quiz me", "test my", "questions based on"])

        # Clean all citations of slide boilerplate
        cleaned_chunks = []
        for c in citations:
            c_text = self._clean_slide_text(c.text)
            if len(c_text) > 20:
                cleaned_chunks.append((c_text, c.page_number, c.filename))

        if not cleaned_chunks:
            return "No extractable text found in the retrieved sections."

        # Case 1: Student asked for practice questions
        if is_exam_request:
            questions_out = []
            for i, (text, page, fn) in enumerate(cleaned_chunks[:3], 1):
                clean_t = re.sub(r"^(?:Unit\s*[-–:]?\s*\d+\s*[A-Za-z\s]*|Chapter\s*\d+[^\n]*)[\n\.\s]*", "", text, flags=re.IGNORECASE)
                sentences = [s.strip() for s in clean_t.split(".") if len(s.strip()) > 20]
                topic_core = sentences[0] if sentences else clean_t[:80]
                words = topic_core.split()
                concept = " ".join(words[:4]) if len(words) >= 4 else "this concept"

                questions_out.append(
                    f"**Question {i}:** What are the core principles and characteristics of **{concept}**?\n"
                    f"* **Key Concept / Expected Answer:** {topic_core.strip()}.\n"
                    f"* *Reference: {fn} (Page {page})*"
                )

            return (
                f"### 📝 Practice Exam Questions\n\n"
                f"Here are **3 practice exam questions** based on your uploaded study materials to test your understanding:\n\n"
                + "\n\n".join(questions_out)
                + "\n\n> 💡 *Tip: Try writing down your answers in bullet points first to practice for your exam!*"
            )

        # Case 2: Standard Concept / Query Q&A (Clean prose like ChatGPT)
        top_text, top_page, top_fn = cleaned_chunks[0]
        top_text = re.sub(r"^(?:Unit\s*[-–:]?\s*\d+\s*[A-Za-z\s]*|Chapter\s*\d+[^\n]*)[\n\.\s]*", "", top_text, flags=re.IGNORECASE)

        # Extract definition or opening explanation
        sentences = [s.strip() for s in top_text.split(".") if len(s.strip()) > 15]
        direct_explanation = sentences[0] if sentences else top_text[:140]

        # Extract structured points
        points = []
        for text, page, fn in cleaned_chunks:
            s_list = [s.strip() for s in text.split("\n- ") if len(s.strip()) > 10]
            if len(s_list) > 1:
                for item in s_list[1:]:
                    clean_item = item.strip().lstrip("-").strip()
                    if clean_item and clean_item not in points and len(points) < 5:
                        points.append(clean_item)
            else:
                sent_list = [s.strip() for s in text.split(".") if len(s.strip()) > 25]
                for item in sent_list[1:3]:
                    if item and item not in points and len(points) < 4:
                        points.append(item)

        answer_lines = [
            f"**{direct_explanation.strip()}.**\n"
        ]

        if points:
            answer_lines.append("Key points from your study materials:")
            for p in points:
                answer_lines.append(f"- {p}")

        return "\n".join(answer_lines)

    def generate_json(self, prompt: str, schema_instruction: str) -> str:
        api_key = settings.gemini_api_key.strip()
        model_name = settings.gemini_model or self.default_model

        if not api_key:
            raise Exception("Gemini API key is required for automated generation of study materials.")

        full_prompt = (
            f"{prompt}\n\n"
            f"Return ONLY valid JSON matching this schema:\n"
            f"{schema_instruction}\n"
            f"Do not include markdown code block backticks unless strictly required."
        )

        return self._call_gemini_api(api_key, model_name, full_prompt)


gemini_service = GeminiService()
