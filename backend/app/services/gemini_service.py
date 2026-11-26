import os
import json
import re
import time
from typing import List, Dict, Any, Optional, Generator, Tuple
import requests
from app.core.config import settings
from app.models.schemas import SourceCitation

SYSTEM_INSTRUCTION = (
    "You are StudyMind AI, a warm, intelligent personal AI assistant and academic study tutor. "
    "Respond naturally and conversationally like ChatGPT: for casual chat, greetings, check-ins (e.g., 'how are you'), "
    "thanks, encouragement, or everyday questions, reply warmly, concisely, and naturally in plain conversational prose "
    "WITHOUT forcing academic headings, templates, tables, or quizzes. "
    "When explaining academic, technical, mathematical, coding, or study topics, use crisp Markdown: structured headings, "
    "numbered steps, comparison tables where helpful, syntax-highlighted fenced code blocks, LaTeX math ($...$ and $$...$$), "
    "and callouts (`> **Note:** ...` or `> **Warning:** ...`). "
    "NEVER fabricate document filenames, page numbers, or quotes. Only cite sources actually provided in STUDY MATERIALS CONTEXT."
)

LEVEL_INSTRUCTIONS = {
    "beginner": (
        "EXPLANATION LEVEL — BEGINNER:\n"
        "- Use simple, clear English and everyday analogies before introducing technical terms.\n"
        "- Break every explanation into small, easy-to-follow steps with basic concrete examples.\n"
        "- Define any unavoidable technical term immediately in plain words."
    ),
    "intermediate": (
        "EXPLANATION LEVEL — INTERMEDIATE:\n"
        "- Provide detailed university-level academic explanations combining clear intuition with formal concepts.\n"
        "- Include key equations, definitions, structured points, and practical examples."
    ),
    "advanced": (
        "EXPLANATION LEVEL — ADVANCED:\n"
        "- Deliver rigorous, technical depth suitable for upper-division/graduate engineering or research.\n"
        "- Include formal notation, derivations, architectural trade-offs, edge cases, and asymptotic complexity where relevant."
    ),
}

MODE_INSTRUCTIONS = {
    "learn": (
        "SMART MODE — LEARN MODE:\n"
        "- Act as a patient personal tutor. Teach the concept intuitively with clear reasoning, worked examples, "
        "visual analogies, and end with 1 brief follow-up question to check understanding."
    ),
    "exam": (
        "SMART MODE — EXAM MODE:\n"
        "- Structure the response for top marks in university examinations using clear sections:\n"
        "  1. **Concise Definition**\n"
        "  2. **Key Points & Derivations / Core Mechanics**\n"
        "  3. **High-Yield Exam Takeaways & Common Pitfalls**\n"
        "  4. **Conclusion**"
    ),
    "practice": (
        "SMART MODE — PRACTICE MODE:\n"
        "- Act as an interactive coach. If the student attempted an answer in the prior conversation turn, first evaluate "
        "their answer clearly (what is right, specific mistakes, and why), then show the step-by-step correction.\n"
        "- Otherwise, pose 1–2 focused practice problems (or diagnostic questions) tailored to the topic with a collapsible-style "
        "Hint section so the student can actively think before seeing full solutions."
    ),
    "code": (
        "SMART MODE — CODE MODE:\n"
        "- Focus on clean, working, well-commented code in fenced syntax-highlighted blocks (e.g., ```python, ```cpp, ```javascript).\n"
        "- Walk through the logic step-by-step, highlight debugging pitfalls / edge cases (`> **Warning:** ...`), "
        "and state Time and Space complexity."
    ),
    "research": (
        "SMART MODE — RESEARCH MODE:\n"
        "- Perform rigorous cross-document synthesis over the retrieved passages.\n"
        "- Explicitly attribute factual claims inline using `[Filename, Page X]` where sources support them, compare or contrast "
        "evidence across documents (using a Markdown table if multiple concepts/sources apply), and explicitly flag missing evidence."
    ),
}

TITLE_STOP_PREFIXES = (
    "can you please ", "could you please ", "please ", "can you ", "could you ",
    "explain ", "tell me about ", "what is ", "what are ", "how does ", "how do ",
    "why does ", "why is ", "give me ", "help me understand ", "help me with ",
)

GREETING_PATTERNS = [
    r'^(hi|hello|hey|greetings|good\s+(morning|afternoon|evening|night|day)|howdy|yo|hiya)\b',
    r'^(who\s+are\s+you|what\s+can\s+you\s+do|what\s+is\s+studymind|help\s+me)\b',
    r'^(what\'?s\s+up|sup|how\s+are\s+(you|u)|how\s+r\s+u|how\'?s\s+it\s+going|how\s+is\s+it\s+going|how\s+do\s+you\s+do|how\s+have\s+you\s+been)\b',
]

CASUAL_CHAT_PATTERNS = [
    *GREETING_PATTERNS,
    r'^(thanks?|thank\s+you|thx|ty|appreciate\s+it)\b',
    r'^(bye|goodbye|see\s+you|see\s+ya|take\s+care|gn|goodnight)\b',
    r'^(ok|okay|cool|great|nice|awesome|got\s+it|alright|sure|fine|good|i\'?m\s+(good|fine|great|okay|ok|tired|bored|stressed))\b',
    r'^(tell\s+me\s+a\s+joke|motivate\s+me|cheer\s+me\s+up)\b',
]


class GeminiService:
    FALLBACK_MODELS = [
        "gemini-flash-lite-latest",
        "gemini-2.5-flash-lite",
        "gemini-2.5-flash",
        "gemini-2.0-flash",
        "gemini-flash-latest",
    ]

    def __init__(self):
        self.default_model = "gemini-flash-lite-latest"

    def is_configured(self) -> bool:
        return bool(settings.gemini_api_key and settings.gemini_api_key.strip())

    def is_greeting(self, question: str) -> bool:
        clean = question.strip().lower()
        if len(clean) <= 60:
            for pattern in GREETING_PATTERNS:
                if re.search(pattern, clean):
                    return True
        return False

    def is_casual_conversation(self, question: str) -> bool:
        """Detects greetings, check-ins, thanks, and everyday casual messages that shouldn't force RAG warnings or academic rubrics."""
        clean = question.strip().lower()
        if len(clean) <= 80:
            for pattern in CASUAL_CHAT_PATTERNS:
                if re.search(pattern, clean):
                    return True
        return False

    def get_greeting_response(self, user_name: Optional[str] = None, question: str = "") -> str:
        """Natural conversational fallback used only when Gemini API is unavailable or for simple offline greetings."""
        return self._synthesize_conversational_reply(question, user_name=user_name)

    def _synthesize_conversational_reply(self, question: str, user_name: Optional[str] = None) -> str:
        q_lower = (question or "").strip().lower()
        first_name = (user_name or "").strip().split()[0] if user_name and user_name.strip() else ""
        name_comma = f", {first_name}" if first_name else ""

        if any(p in q_lower for p in ["how are you", "how are u", "how r u", "how's it going", "how is it going", "how have you been", "how's everything"]):
            return (
                f"I'm doing great{name_comma}, thanks for asking! 😊 How is your day going?\n\n"
                f"We can just chat, brainstorm, or dive into your study notes whenever you're ready."
            )
        if any(p in q_lower for p in ["thank", "thx", "appreciate"]):
            return f"You're very welcome{name_comma}! Let me know anytime if there's anything else you'd like to talk about or study."
        if any(p in q_lower for p in ["bye", "goodbye", "see you", "see ya", "goodnight", "good night", "take care"]):
            return f"Take care{name_comma}! Best of luck with everything — come back anytime you want to chat or study."
        if "joke" in q_lower:
            return "Why do programmers prefer dark mode? Because light attracts bugs! 😄 Want another one, or ready to tackle something else?"
        if any(p in q_lower for p in ["tired", "stressed", "overwhelmed", "bored"]):
            return (
                f"Totally understandable{name_comma} — studying nonstop can wear anyone out. "
                f"Take a quick breather, grab some water, and if you want, we can break whatever you're working on into tiny, easy steps."
            )
        if any(p in q_lower for p in ["who are you", "what can you do", "what is studymind"]):
            return (
                f"I'm **StudyMind AI**, your personal study partner and chat assistant! "
                f"You can chat with me normally about anything, ask for step-by-step explanations, debug code, solve math, or upload PDFs for page-cited answers."
            )
        if re.match(r"^(ok|okay|cool|great|nice|awesome|got it|alright|sure|fine|good)\b", q_lower):
            return f"Sounds good{name_comma}! What's on your mind next?"

        return (
            f"Hey{name_comma}! 👋 How's it going?\n\n"
            f"Feel free to chat with me normally about anything, or ask a question about your studies or uploaded PDFs."
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

    def normalize_level(self, level: Optional[str]) -> str:
        val = (level or "intermediate").strip().lower()
        return val if val in LEVEL_INSTRUCTIONS else "intermediate"

    def normalize_mode(self, mode: Optional[str]) -> str:
        val = (mode or "learn").strip().lower()
        aliases = {"standard": "learn", "eli5": "learn", "exam rubric": "exam"}
        val = aliases.get(val, val)
        return val if val in MODE_INSTRUCTIONS else "learn"

    def build_system_instruction(
        self,
        level: Optional[str] = "intermediate",
        mode: Optional[str] = "learn",
        has_citations: bool = False,
        strict_doc_missing: bool = False,
        is_casual: bool = False,
    ) -> str:
        if is_casual:
            return (
                "You are StudyMind AI, a friendly, helpful personal AI assistant and study companion. "
                "The user is chatting casually (greeting, check-in, thanks, small talk, or general everyday chat). "
                "Reply naturally, warmly, and concisely in plain conversational prose like ChatGPT. "
                "Do NOT force academic headings, bulleted rubrics, tables, or quizzes unless the user asks a study question."
            )

        lvl = self.normalize_level(level)
        md = self.normalize_mode(mode)
        parts = [SYSTEM_INSTRUCTION, LEVEL_INSTRUCTIONS[lvl], MODE_INSTRUCTIONS[md]]
        if has_citations:
            parts.append(
                "GROUNDING RULE:\n"
                "- Ground factual claims in the supplied STUDY MATERIALS CONTEXT.\n"
                "- Cite supporting documents inline as [Filename, Page X] when helpful, and NEVER invent filenames, quotes, or page numbers."
            )
        elif strict_doc_missing:
            parts.append(
                "DOCUMENT COVERAGE RULE:\n"
                "- No matching passages were found in the student's uploaded PDFs for this query.\n"
                "- If the user is simply chatting casually or asking an everyday non-course question, answer naturally without a document warning. "
                "Otherwise, begin with a brief callout noting this topic was NOT found in their uploaded documents, then answer helpfully using general knowledge."
            )
        return "\n\n".join(parts)

    def _prepare_general_prompt(
        self,
        question: str,
        user_name: Optional[str] = None,
        level: str = "intermediate",
        mode: str = "learn",
        strict_doc_missing: bool = False,
        searched_docs: Optional[List[str]] = None,
    ) -> Tuple[str, str, bool]:
        is_casual = self.is_casual_conversation(question)
        sys_inst = self.build_system_instruction(
            level=level,
            mode=mode,
            has_citations=False,
            strict_doc_missing=strict_doc_missing and not is_casual,
            is_casual=is_casual,
        )

        if is_casual:
            first_name = (user_name or "").strip().split()[0] if user_name and user_name.strip() else ""
            name_note = f" (Student's first name: {first_name})" if first_name else ""
            user_prompt = (
                f"USER MESSAGE{name_note}:\n{question}\n\n"
                f"Respond naturally, warmly, and directly as a helpful conversational AI assistant."
            )
            return sys_inst, user_prompt, True

        scope_note = ""
        if strict_doc_missing:
            docs_desc = ", ".join(searched_docs[:4]) if searched_docs else "your uploaded documents"
            scope_note = (
                f"NOTE: I searched {docs_desc}, and this exact answer was NOT found in the uploaded passages.\n"
                f"If this is an academic/document question, start with a brief `> **Note — Not Found in Uploaded Documents:** ...` notice mentioning `{docs_desc}`, "
                f"then answer helpfully using general knowledge. If it's casual/everyday chat, just reply normally.\n\n"
            )

        user_prompt = (
            f"{scope_note}"
            f"USER'S MESSAGE:\n{question}\n\n"
            f"INSTRUCTIONS:\n"
            f"If the message is casual conversation or everyday chat, reply naturally like ChatGPT without forced templates. "
            f"For study, coding, math, or technical questions, use your active explanation level and smart chat mode, "
            f"maintain prior conversation context, and format clearly with Markdown/LaTeX/code blocks where helpful."
        )
        return sys_inst, user_prompt, False

    def generate_conversation_title(self, question: str) -> str:
        clean = " ".join((question or "").strip().split())
        if not clean:
            return "Study Discussion"
        lowered = clean.lower()
        for prefix in TITLE_STOP_PREFIXES:
            if lowered.startswith(prefix) and len(clean) > len(prefix) + 3:
                clean = clean[len(prefix):].strip()
                break
        clean = re.sub(r"^[\"'`:\-\s]+|[?!.]+$", "", clean).strip()
        words = clean.split()
        if not words:
            return "Study Discussion"
        snippet = " ".join(words[:6])
        if len(words) > 6:
            snippet += "..."
        return snippet[0].upper() + snippet[1:]

    def _build_gemini_contents(
        self,
        prompt: str,
        conversation_history: Optional[List[Dict[str, str]]] = None,
    ) -> List[Dict[str, Any]]:
        contents: List[Dict[str, Any]] = []
        if conversation_history:
            for turn in conversation_history[-10:]:
                role_raw = (turn.get("role") or "").strip().lower()
                text = (turn.get("content") or turn.get("message") or "").strip()
                if not text:
                    continue
                if len(text) > 1600:
                    text = text[:1600] + "..."
                gemini_role = "model" if role_raw == "assistant" else "user"
                contents.append({"role": gemini_role, "parts": [{"text": text}]})
        contents.append({"role": "user", "parts": [{"text": prompt}]})
        return contents

    def generate_general_academic_answer(
        self,
        question: str,
        user_name: Optional[str] = None,
        conversation_history: Optional[List[Dict[str, str]]] = None,
        level: str = "intermediate",
        mode: str = "learn",
        strict_doc_missing: bool = False,
        searched_docs: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """
        Answers normal conversational messages and general academic queries when no PDF matches.
        Adapts to casual chat vs explanation depth, smart chat mode, and prior conversation history.
        """
        api_key = settings.gemini_api_key.strip()
        model_name = settings.gemini_model or self.default_model
        sys_inst, user_prompt, is_casual = self._prepare_general_prompt(
            question=question,
            user_name=user_name,
            level=level,
            mode=mode,
            strict_doc_missing=strict_doc_missing,
            searched_docs=searched_docs,
        )

        if api_key:
            try:
                answer, used_model = self._call_gemini_api_with_meta(
                    api_key,
                    model_name,
                    user_prompt,
                    system_instruction=sys_inst,
                    conversation_history=conversation_history,
                )
                return {
                    "answer": answer,
                    "grounded": False,
                    "not_found_in_docs": strict_doc_missing and not is_casual,
                    "model_used": used_model,
                }
            except Exception as e:
                print(f"[GeminiService] Gemini call failed for general query: {e}")

        # Local intelligent tutor fallback if API key is not configured or offline
        local_ans = self._synthesize_general_academic_fallback(
            question,
            user_name=user_name,
            level=level,
            mode=mode,
            conversation_history=conversation_history,
            strict_doc_missing=strict_doc_missing,
            searched_docs=searched_docs,
        )
        return {
            "answer": local_ans,
            "grounded": False,
            "not_found_in_docs": strict_doc_missing and not is_casual,
            "model_used": "StudyMind Conversational" if is_casual else "local-academic-tutor",
        }

    def _synthesize_general_academic_fallback(
        self,
        question: str,
        user_name: Optional[str] = None,
        level: str = "intermediate",
        mode: str = "learn",
        conversation_history: Optional[List[Dict[str, str]]] = None,
        strict_doc_missing: bool = False,
        searched_docs: Optional[List[str]] = None,
    ) -> str:
        if self.is_casual_conversation(question):
            return self._synthesize_conversational_reply(question, user_name=user_name)

        q_clean = question.strip()
        q_lower = q_clean.lower()
        lvl = self.normalize_level(level)
        md = self.normalize_mode(mode)

        notice = ""
        if strict_doc_missing:
            docs_desc = ", ".join(searched_docs[:4]) if searched_docs else "your uploaded documents"
            notice = (
                f"> **Warning — Not Found in Uploaded Documents:** I searched **{docs_desc}** and did not find passages directly answering this query. "
                f"Here is general academic guidance instead:\n\n"
            )

        context_hint = ""
        if conversation_history:
            for turn in reversed(conversation_history):
                if (turn.get("role") or "").lower() == "user" and len((turn.get("content") or "").strip()) > 3:
                    prev_topic = (turn.get("content") or "").strip()[:90]
                    context_hint = f"\n> **Note:** Building on our earlier discussion (*\"{prev_topic}\"*).\n"
                    break

        if md == "code" or any(w in q_lower for w in ["code", "python", "bug", "debug", "function", "algorithm", "complexity"]):
            return notice + (
                f"### Code & Algorithmic Walkthrough: **{q_clean}**\n"
                f"{context_hint}\n"
                f"```python\ndef solve_problem(items):\n    \"\"\"Clean reference template ({lvl} level).\"\"\"\n    result = []\n    for idx, item in enumerate(items):\n        result.append((idx, item))\n    return result\n```\n\n"
                f"| Aspect | Analysis |\n| --- | --- |\n| **Time Complexity** | $\\mathcal{{O}}(n)$ single pass |\n| **Space Complexity** | $\\mathcal{{O}}(n)$ output storage |\n\n"
                f"> **Tip:** Attach your lab manual or paste the exact code snippet/error trace for line-by-line debugging."
            )

        if md == "exam":
            return notice + (
                f"### Exam Answer Blueprint ({lvl.title()} Level): **{q_clean}**\n"
                f"{context_hint}\n"
                f"1. **Definition:** State the core formal definition clearly in 1–2 sentences.\n"
                f"2. **Key Principles:** Explain the governing rules, variables, and mechanism step-by-step.\n"
                f"3. **Worked Application:** Show a short example or formula substitution.\n"
                f"4. **Conclusion:** Summarize why the concept matters and note common exam mistakes.\n\n"
                f"> **Tip:** Attach your syllabus slides so every section cites exact textbook pages."
            )

        if md == "practice":
            return notice + (
                f"### Practice Coaching ({lvl.title()} Level): **{q_clean}**\n"
                f"{context_hint}\n"
                f"Let's test your understanding step-by-step:\n\n"
                f"1. **Check Question:** In your own words, what is the primary goal or formula behind this topic?\n"
                f"2. **Applied Problem:** What happens when the key input parameter increases or hits a boundary case?\n\n"
                f"> **Hint:** Reply with your attempt and I will evaluate your reasoning and point out any gaps."
            )

        # Math / Equations / Algebra
        if any(w in q_lower for w in ["solve", "equation", "formula", "derivative", "integral", "matrix", "eigen", "calculus", "math"]):
            return notice + (
                f"### Mathematical Breakdown ({lvl.title()}): **{q_clean}**\n"
                f"{context_hint}\n"
                f"1. **Identify Knowns & Goal:** List given variables, constraints, and target unknown.\n"
                f"2. **Set Up Governing Relation:** Express the problem symbolically using standard definitions.\n"
                f"3. **Step-by-Step Derivation:** Apply systematic algebraic or calculus transformations.\n"
                f"4. **Verify Result:** Check boundary values and units.\n\n"
                f"> **Tip:** Upload your course PDF anytime for derivations grounded in your exact class notes."
            )

        # AI / Machine Learning / Deep Learning
        if any(w in q_lower for w in ["machine learning", "deep learning", "neural", "attention", "transformer", "backpropagation", "gradient", "cnn", "rnn"]):
            return notice + (
                f"### Core Concept ({lvl.title()}): **{q_clean}**\n"
                f"{context_hint}\n"
                f"- **Core Intuition:** Models learn representations iteratively by adjusting weights to minimize an objective loss.\n"
                f"- **Mathematical Basis:** Backpropagation applies the chain rule $\\frac{{\\partial L}}{{\\partial w}} = \\frac{{\\partial L}}{{\\partial y}} \\cdot \\frac{{\\partial y}}{{\\partial w}}$ across layers.\n"
                f"- **Optimization:** Normalization and residual paths stabilize gradient flow during training.\n\n"
                f"> **Tip:** Attach your lecture slides to inspect exact page-cited equations from your notes."
            )

        # Science / Physics / Chemistry / Biology
        if any(w in q_lower for w in ["physics", "chemistry", "quantum", "energy", "force", "molecule", "reaction", "acid", "cell", "biology"]):
            return notice + (
                f"### Scientific Overview ({lvl.title()}): **{q_clean}**\n"
                f"{context_hint}\n"
                f"- **Fundamental Law:** Physical and chemical systems obey conservation of energy, mass, and charge.\n"
                f"- **Mechanism:** Microscopic interactions drive observable macroscopic properties and equilibrium states.\n"
                f"- **Exam Takeaway:** Always verify units, assumptions, and limiting cases.\n\n"
                f"> **Tip:** Attach your textbook or lab notes for page-cited pathways and formulas."
            )

        # General Academic Query
        return notice + (
            f"### Overview & Insights ({lvl.title()}): **{q_clean}**\n"
            f"{context_hint}\n"
            f"- **Conceptual Framework:** Break the topic into foundational definitions before tackling edge cases.\n"
            f"- **Theory to Practice:** Connect how each principle applies to structured problem solving.\n"
            f"- **Active Recall:** Summarize the core takeaway in 2 sentences and test yourself with a practice question.\n\n"
            f"> **Tip:** Attach your course PDFs anytime to ground answers directly in your syllabus with clickable page citations."
        )

    def _prepare_rag_prompt(
        self,
        question: str,
        citations: List[SourceCitation],
        level: str = "intermediate",
        mode: str = "learn",
    ) -> Tuple[str, str]:
        context_blocks = []
        for i, cite in enumerate(citations, 1):
            clean_c_text = self._clean_slide_text(cite.text)
            score_pct = int(round(max(0.0, min(1.0, cite.relevance_score)) * 100))
            context_blocks.append(
                f"[Source {i}: {cite.filename} | Page {cite.page_number} | Relevance: {score_pct}%]\n{clean_c_text}\n"
            )
        formatted_context = "\n---\n".join(context_blocks)
        sys_inst = self.build_system_instruction(level=level, mode=mode, has_citations=True)

        user_prompt = (
            f"STUDY MATERIALS CONTEXT:\n{formatted_context}\n\n"
            f"STUDENT'S QUESTION:\n{question}\n\n"
            f"INSTRUCTIONS:\n"
            f"Answer clearly and thoroughly using your active explanation level and smart chat mode. "
            f"Ground your facts strictly in the retrieved STUDY MATERIALS CONTEXT above, citing sources inline as [Filename, Page X] where helpful. "
            f"If part of the question is not covered by the context, explicitly state what is missing rather than guessing or inventing citations."
        )
        return sys_inst, user_prompt

    def generate_rag_answer(
        self,
        question: str,
        citations: List[SourceCitation],
        user_name: Optional[str] = None,
        conversation_history: Optional[List[Dict[str, str]]] = None,
        level: str = "intermediate",
        mode: str = "learn",
        strict_doc_missing: bool = False,
        searched_docs: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """
        Generates an answer grounded in retrieved RAG context using Gemini API with conversation memory.
        If no citations exist, handles casual conversation and general queries naturally.
        """
        if not citations:
            return self.generate_general_academic_answer(
                question=question,
                user_name=user_name,
                conversation_history=conversation_history,
                level=level,
                mode=mode,
                strict_doc_missing=strict_doc_missing,
                searched_docs=searched_docs,
            )

        sys_inst, user_prompt = self._prepare_rag_prompt(question, citations, level=level, mode=mode)
        api_key = settings.gemini_api_key.strip()
        model_name = settings.gemini_model or self.default_model

        if not api_key:
            synthesized_answer = self._synthesize_local_context(question, citations, level=level, mode=mode)
            return {
                "answer": synthesized_answer,
                "grounded": True,
                "not_found_in_docs": False,
                "model_used": "local-rag-synthesizer",
            }

        try:
            answer, used_model = self._call_gemini_api_with_meta(
                api_key,
                model_name,
                user_prompt,
                system_instruction=sys_inst,
                conversation_history=conversation_history,
            )
            return {
                "answer": answer,
                "grounded": True,
                "not_found_in_docs": False,
                "model_used": used_model,
            }
        except Exception as e:
            print(f"[GeminiService] Gemini call failed for RAG query: {e}")
            local_ans = self._synthesize_local_context(question, citations, level=level, mode=mode)
            return {
                "answer": local_ans,
                "grounded": True,
                "not_found_in_docs": False,
                "model_used": "local-fallback",
            }

    def _call_gemini_api_with_meta(
        self,
        api_key: str,
        model: str,
        prompt: str,
        system_instruction: Optional[str] = None,
        conversation_history: Optional[List[Dict[str, str]]] = None,
    ) -> Tuple[str, str]:
        payload = {
            "contents": self._build_gemini_contents(prompt, conversation_history),
            "systemInstruction": {
                "parts": [{"text": system_instruction or SYSTEM_INSTRUCTION}]
            },
            "generationConfig": {
                "temperature": 0.25,
                "maxOutputTokens": 2048,
            },
        }

        headers = {"x-goog-api-key": api_key}
        candidates_to_try = [model] + [m for m in self.FALLBACK_MODELS if m != model]
        resp = None
        used_model = model
        last_error = None
        for idx, candidate_model in enumerate(candidates_to_try):
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{candidate_model}:generateContent"
            resp = requests.post(url, headers=headers, json=payload, timeout=30.0)
            if resp.status_code == 200:
                used_model = candidate_model
                break
            err_text = resp.text
            try:
                err_json = resp.json()
                err_msg = err_json.get("error", {}).get("message", err_text)
            except Exception:
                err_msg = err_text
            last_error = f"Gemini API Error ({resp.status_code}): {err_msg}"
            if resp.status_code not in (404, 429, 500, 503) or idx == len(candidates_to_try) - 1:
                raise Exception(last_error)

        if resp is None or resp.status_code != 200:
            raise Exception(last_error or "Gemini API call failed.")

        data = resp.json()
        candidates = data.get("candidates", [])
        if not candidates:
            raise Exception("Gemini returned empty candidates.")

        text_parts = candidates[0].get("content", {}).get("parts", [])
        if not text_parts:
            finish_reason = candidates[0].get("finishReason", "UNKNOWN")
            raise Exception(f"No response text received (finish reason: {finish_reason}).")

        answer_chunks = [p.get("text", "") for p in text_parts if not p.get("thought") and p.get("text")]
        if answer_chunks:
            return "\n".join(answer_chunks).strip(), used_model
        return text_parts[0].get("text", ""), used_model

    def _call_gemini_api(self, api_key: str, model: str, prompt: str) -> str:
        text, _ = self._call_gemini_api_with_meta(api_key, model, prompt)
        return text

    def _stream_gemini_api(
        self,
        api_key: str,
        model: str,
        prompt: str,
        system_instruction: Optional[str] = None,
        conversation_history: Optional[List[Dict[str, str]]] = None,
    ) -> Generator[Tuple[str, str], None, None]:
        """Streams (delta_text, used_model) directly from Gemini streamGenerateContent SSE."""
        payload = {
            "contents": self._build_gemini_contents(prompt, conversation_history),
            "systemInstruction": {
                "parts": [{"text": system_instruction or SYSTEM_INSTRUCTION}]
            },
            "generationConfig": {
                "temperature": 0.25,
                "maxOutputTokens": 2048,
            },
        }
        headers = {"x-goog-api-key": api_key}
        candidates_to_try = [model] + [m for m in self.FALLBACK_MODELS if m != model]

        resp = None
        used_model = model
        last_error = None
        for idx, candidate_model in enumerate(candidates_to_try):
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{candidate_model}:streamGenerateContent?alt=sse"
            r = requests.post(url, headers=headers, json=payload, timeout=(15.0, 60.0), stream=True)
            if r.status_code == 200:
                resp = r
                used_model = candidate_model
                break
            err_text = r.text
            r.close()
            try:
                err_msg = json.loads(err_text).get("error", {}).get("message", err_text)
            except Exception:
                err_msg = err_text
            last_error = f"Gemini Stream Error ({r.status_code}): {err_msg}"
            if r.status_code not in (404, 429, 500, 503) or idx == len(candidates_to_try) - 1:
                raise Exception(last_error)

        if resp is None:
            raise Exception(last_error or "Gemini stream connection failed.")

        try:
            for raw_line in resp.iter_lines(decode_unicode=True):
                if not raw_line or not raw_line.startswith("data:"):
                    continue
                json_str = raw_line[5:].strip()
                if not json_str or json_str == "[DONE]":
                    continue
                try:
                    chunk_obj = json.loads(json_str)
                except Exception:
                    continue
                candidates = chunk_obj.get("candidates", [])
                if not candidates:
                    continue
                parts = candidates[0].get("content", {}).get("parts", [])
                for part in parts:
                    if part.get("thought"):
                        continue
                    txt = part.get("text")
                    if txt:
                        yield txt, used_model
        finally:
            resp.close()

    def stream_chat_response(
        self,
        question: str,
        citations: List[SourceCitation],
        user_name: Optional[str] = None,
        conversation_history: Optional[List[Dict[str, str]]] = None,
        level: str = "intermediate",
        mode: str = "learn",
        strict_doc_missing: bool = False,
        searched_docs: Optional[List[str]] = None,
    ) -> Generator[Dict[str, Any], None, None]:
        """
        Yields streaming text delta dicts {"text": ..., "model_used": ...} via Gemini SSE
        with graceful chunked local fallback if Gemini is unconfigured or errors before output starts.
        """
        api_key = settings.gemini_api_key.strip()
        model_name = settings.gemini_model or self.default_model
        is_casual = False

        if citations:
            sys_inst, user_prompt = self._prepare_rag_prompt(question, citations, level=level, mode=mode)
        else:
            sys_inst, user_prompt, is_casual = self._prepare_general_prompt(
                question=question,
                user_name=user_name,
                level=level,
                mode=mode,
                strict_doc_missing=strict_doc_missing,
                searched_docs=searched_docs,
            )

        yielded_any = False
        if api_key:
            try:
                for delta, used_model in self._stream_gemini_api(
                    api_key,
                    model_name,
                    user_prompt,
                    system_instruction=sys_inst,
                    conversation_history=conversation_history,
                ):
                    yielded_any = True
                    yield {"text": delta, "model_used": used_model}
                if yielded_any:
                    return
            except Exception as e:
                print(f"[GeminiService] Stream failed (yielded_any={yielded_any}): {e}")
                if yielded_any:
                    raise

        # Seamless fallback if unconfigured or failed before first token
        if citations:
            fallback_text = self._synthesize_local_context(question, citations, level=level, mode=mode)
            used = "local-rag-synthesizer" if not api_key else "local-fallback"
        else:
            fallback_text = self._synthesize_general_academic_fallback(
                question,
                user_name=user_name,
                level=level,
                mode=mode,
                conversation_history=conversation_history,
                strict_doc_missing=strict_doc_missing,
                searched_docs=searched_docs,
            )
            used = "StudyMind Conversational" if is_casual else "local-academic-tutor"

        for piece in self._chunk_text_for_stream(fallback_text):
            yield {"text": piece, "model_used": used}
            time.sleep(0.015)

    def _chunk_text_for_stream(self, text: str, words_per_chunk: int = 5) -> List[str]:
        tokens = re.findall(r"\S+\s*", text)
        if not tokens:
            return [text] if text else []
        return ["".join(tokens[i:i + words_per_chunk]) for i in range(0, len(tokens), words_per_chunk)]

    def _synthesize_local_context(
        self,
        question: str,
        citations: List[SourceCitation],
        level: str = "intermediate",
        mode: str = "learn",
    ) -> str:
        """
        Synthesizes a clean, natural, student-friendly answer like ChatGPT/Gemini
        from top retrieved document chunks, respecting explanation level and mode.
        """
        if not citations:
            return "I could not find information relevant to this question in your uploaded documents."

        clean_q = question.strip()
        is_exam_request = (
            self.normalize_mode(mode) == "exam"
            or any(k in clean_q.lower() for k in ["practice question", "exam question", "quiz me", "test my", "questions based on"])
        )

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
