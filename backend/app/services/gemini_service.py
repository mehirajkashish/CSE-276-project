import os
import json
import re
import time
from typing import List, Dict, Any, Optional, Generator, Tuple
import requests
from app.core.config import settings
from app.models.schemas import SourceCitation
from app.services.llm_providers import llm_router, NoLLMConfiguredError, LLMProviderError

SYSTEM_INSTRUCTION = (
    "You are StudyMind AI, a powerful, reliable universal AI assistant inspired by the clarity of ChatGPT and Gemini. "
    "You handle general knowledge, everyday questions, mathematics, physics, chemistry, computer science, programming & debugging "
    "(DSA, C++, Python, Java, JavaScript, SQL), AI/ML, engineering, writing/rewriting/translation, career & interview prep, "
    "business, brainstorming, and document research.\n\n"
    "CORE RESPONSE PRINCIPLES:\n"
    "1. Understand the user's actual intent and expected output before answering.\n"
    "2. Give the direct answer first. Match length to the question: short and crisp for simple questions; structured and step-by-step for complex ones.\n"
    "3. Adapt depth to the student's level (Beginner, Intermediate, or Advanced) when explaining concepts.\n"
    "4. Do NOT blindly agree with incorrect premises—politely point out wrong assumptions and explain why.\n"
    "5. Ask a brief clarifying question only when genuinely necessary; otherwise give your best helpful answer.\n"
    "6. Admit uncertainty rather than guessing or inventing facts, APIs, URLs, filenames, or page numbers.\n"
    "7. Avoid repetitive greetings, filler phrases, and unnecessary wrap-up conclusions.\n"
    "8. Format cleanly with Markdown (headings, lists, tables, fenced syntax-highlighted code blocks, and LaTeX `$...$` / `$$...$$` for math) only where it improves clarity."
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
        "TASK STRATEGY — PROGRAMMING & DEBUGGING:\n"
        "- Understand the code/problem, identify root-cause bugs or edge cases, and explain errors clearly.\n"
        "- Write clean, correct, runnable code in fenced blocks (e.g., ```python, ```cpp, ```java, ```javascript, ```sql).\n"
        "- Explain how the code works rather than dumping code without explanation, and state Time/Space complexity when relevant."
    ),
    "math": (
        "TASK STRATEGY — MATHEMATICS:\n"
        "- State the relevant formulas/theorems, show clear step-by-step calculations in LaTeX, and double-check/verify the final result."
    ),
    "writing": (
        "TASK STRATEGY — WRITING & COMMUNICATION:\n"
        "- Deliver polished, ready-to-use emails, essays, reports, summaries, or translations matching the requested tone and audience."
    ),
    "research": (
        "TASK STRATEGY — RESEARCH & ANALYSIS:\n"
        "- Break complex questions into clear parts, synthesize evidence from retrieved PDFs (`[Filename, Page X]`) and web sources (`[Title](URL)`), "
        "and clearly separate established evidence from general context or uncertainty."
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
    # Hindi & Hinglish greetings / check-ins
    r'^(namaste|namaskar|pranam|kaise\s+ho|kaisi\s+ho|kaise\s+hain|kya\s+haal|sab\s+badh?iya|aur\s+batao|hello\s+bhai|hi\s+bhai|hey\s+yaar)\b',
    r'^(नमस्ते|नमस्कार|कैसे\s+हो|कैसी\s+हो|कैसे\s+हैं|क्या\s+हाल|सब\s+बढ़िया)',
    # Other global greetings
    r'^(hola|bonjour|salut|ciao|hallo|guten\s+tag|ola|olá|salam|assalam|marhaba)\b',
]

CASUAL_CHAT_PATTERNS = [
    *GREETING_PATTERNS,
    r'^(thanks?|thank\s+you|thx|ty|appreciate\s+it|shukriya|dhanyawad|dhanyavaad|gracias|merci|danke|shukran)\b',
    r'^(धन्यवाद|शुक्रिया)',
    r'^(bye|goodbye|see\s+you|see\s+ya|take\s+care|gn|goodnight|alvida|chalta\s+hu|chalti\s+hu)\b',
    r'^(ok|okay|cool|great|nice|awesome|got\s+it|alright|sure|fine|good|theek\s+hai|thik\s+hai|accha|achha|sahi\s+hai|badh?iya|haan|hanji|hm+)\b',
    r'^(ठीक\s+है|अच्छा|सही\s+है|बढ़िया)',
    r'^(i\'?m\s+(good|fine|great|okay|ok|tired|bored|stressed)|main\s+(theek|thik|badh?iya|mast)\s+hu)\b',
    r'^(tell\s+me\s+a\s+joke|joke\s+sunao|ek\s+joke|motivate\s+me|cheer\s+me\s+up)\b',
]

LANGUAGE_INSTRUCTIONS = {
    "auto": (
        "LANGUAGE RULE (MATCH USER AUTOMATICALLY):\n"
        "- Detect the exact language, script, and tone of the user's latest message and respond in that SAME language like ChatGPT.\n"
        "- If the user writes in Hinglish (Hindi words written in English/Roman letters mixed with English, e.g. 'kaise ho', 'ye topic samjha do'), "
        "reply naturally in friendly Hinglish (Roman script + English technical terms).\n"
        "- If the user writes in Hindi (Devanagari script like 'हिंदी'), reply in clear, natural Hindi (Devanagari script).\n"
        "- If the user writes in English or any other language (Spanish, French, Bengali, Tamil, Marathi, Urdu, Arabic, German, Japanese, etc.), "
        "reply fluently and accurately in that exact language."
    ),
    "en": "LANGUAGE RULE:\n- Always respond in clear, natural English.",
    "hinglish": (
        "LANGUAGE RULE:\n"
        "- Always respond in natural, friendly **Hinglish** (conversational Hindi written in Roman/English letters mixed with English technical terms, e.g., 'Yeh concept simple hai...'). "
        "Keep code snippets, math formulas, and PDF citation filenames/page numbers accurate."
    ),
    "hi": (
        "LANGUAGE RULE:\n"
        "- हमेशा स्पष्ट और स्वाभाविक **हिंदी (Devanagari script)** में उत्तर दें। तकनीकी शब्दों, कोड और फॉर्मूलों को स्पष्ट रखें।"
    ),
    "bn": "LANGUAGE RULE:\n- Always respond fluently in natural **Bengali (বাংলা)** while keeping technical terms, code, and formulas clear.",
    "ta": "LANGUAGE RULE:\n- Always respond fluently in natural **Tamil (தமிழ்)** while keeping technical terms, code, and formulas clear.",
    "mr": "LANGUAGE RULE:\n- Always respond fluently in natural **Marathi (मराठी)** while keeping technical terms, code, and formulas clear.",
    "ur": "LANGUAGE RULE:\n- Always respond fluently in natural **Urdu (اردو)** while keeping technical terms, code, and formulas clear.",
    "es": "LANGUAGE RULE:\n- Always respond fluently in natural **Spanish (Español)**.",
    "fr": "LANGUAGE RULE:\n- Always respond fluently in natural **French (Français)**.",
    "de": "LANGUAGE RULE:\n- Always respond fluently in natural **German (Deutsch)**.",
    "ar": "LANGUAGE RULE:\n- Always respond fluently in natural **Arabic (العربية)**.",
    "pt": "LANGUAGE RULE:\n- Always respond fluently in natural **Portuguese (Português)**.",
    "ja": "LANGUAGE RULE:\n- Always respond fluently in natural **Japanese (日本語)**.",
}


class GeminiService:
    FALLBACK_MODELS = [
        "gemini-flash-lite-latest",
        "gemini-3.1-flash-lite",
        "gemini-3.1-flash-lite-preview",
        "gemini-flash-latest",
        "gemini-3-flash-preview",
    ]

    def __init__(self):
        self.default_model = "gemini-flash-lite-latest"

    def is_configured(self) -> bool:
        return llm_router.has_any_provider()

    def detect_task_strategy(self, question: str, mode: str = "learn") -> Tuple[str, float]:
        """Selects an automatic task strategy and appropriate sampling temperature."""
        norm_mode = self.normalize_mode(mode)
        q_low = (question or "").strip().lower()

        if norm_mode == "code" or any(
            k in q_low
            for k in (
                "```", "def ", "class ", "function ", "traceback", "segfault", "syntaxerror",
                "debug", "fix this code", "time complexity", "big-o", "sql query", "c++", "python", "javascript", "java ",
            )
        ):
            return "code", 0.2

        if any(
            k in q_low
            for k in (
                "solve ", "integral", "derivative", "differentiate", "integrate", "equation",
                "matrix", "eigenvalue", "probability", "calculate ", "proof", "theorem", "simplify ",
            )
        ) or re.search(r"\d+\s*[\+\-\*/\^=]\s*\d+", q_low):
            return "math", 0.15

        if norm_mode == "writing" or any(
            k in q_low
            for k in (
                "write an email", "draft an email", "rewrite", "paraphrase", "cover letter",
                "essay", "blog post", "translate ", "proofread", "brainstorm", "poem", "story",
            )
        ):
            return "writing", 0.65

        if norm_mode == "research":
            return "research", 0.25
        if norm_mode in ("exam", "practice"):
            return norm_mode, 0.3
        return "learn", 0.4

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

    def _detect_script_language(self, question: str) -> str:
        q = (question or "").strip()
        if re.search(r"[\u0900-\u097F]", q):
            return "hi"
        q_low = q.lower()
        hinglish_markers = (
            "kaise ho", "kaisi ho", "kya haal", "kya hai", "samjhao", "samjha do", "batao",
            "shukriya", "dhanyawad", "theek hai", "thik hai", "namaste", "bhai", "yaar", "accha", "achha",
        )
        if any(m in q_low for m in hinglish_markers):
            return "hinglish"
        return "en"

    def _synthesize_conversational_reply(
        self,
        question: str,
        user_name: Optional[str] = None,
        language: str = "auto",
    ) -> str:
        q_lower = (question or "").strip().lower()
        first_name = (user_name or "").strip().split()[0] if user_name and user_name.strip() else ""
        name_comma = f", {first_name}" if first_name else ""
        lang = (language or "auto").strip().lower()
        if lang == "auto":
            lang = self._detect_script_language(question)

        if lang == "hi":
            if any(p in q_lower for p in ["कैसे", "कैसी", "हाल"]):
                return f"मैं बिल्कुल ठीक हूँ{name_comma}, पूछने के लिए धन्यवाद! 😊 आप कैसे हैं? आज किस विषय या टॉपिक पर बात करना चाहेंगे?"
            if any(p in q_lower for p in ["धन्यवाद", "शुक्रिया"]):
                return f"आपका स्वागत है{name_comma}! कभी भी कोई सवाल हो या कुछ नया सीखना हो तो बताइए।"
            return f"नमस्ते{name_comma}! 👋 बताइए, आज मैं आपकी पढ़ाई या किसी भी सवाल में कैसे मदद कर सकता हूँ?"

        if lang == "hinglish":
            if any(p in q_lower for p in ["kaise ho", "kaisi ho", "kya haal", "how are you", "how are u"]):
                return f"Main ekdum badhiya hoon{name_comma}, puchhne ke liye shukriya! 😊 Aap kaise ho? Aaj kya baat karein ya kaunsa topic samjhein?"
            if any(p in q_lower for p in ["shukriya", "dhanyawad", "thank", "thx"]):
                return f"Welcome{name_comma}! Jab bhi koi doubt ho ya bas baat karni ho, poochh lena."
            if any(p in q_lower for p in ["joke"]):
                return "Programmer ne dark mode kyun lagaya? Kyunki light mode mein bugs attract hote hain! 😄 Aur kuch poochhna hai?"
            return f"Hey{name_comma}! 👋 Sab badhiya? Aap Hindi, Hinglish ya English kisi bhi language mein baat kar sakte ho — batao aaj kya help chahiye?"

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
                f"You can chat with me normally in English, Hindi, Hinglish, or any language, ask for step-by-step explanations, debug code, solve math, or upload PDFs for page-cited answers."
            )
        if re.match(r"^(ok|okay|cool|great|nice|awesome|got it|alright|sure|fine|good)\b", q_lower):
            return f"Sounds good{name_comma}! What's on your mind next?"

        return (
            f"Hey{name_comma}! 👋 How's it going?\n\n"
            f"Feel free to chat with me normally in English, Hindi, Hinglish, or any language, or ask a question about your studies or uploaded PDFs."
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
        aliases = {"standard": "learn", "eli5": "learn", "exam rubric": "exam", "write": "writing"}
        val = aliases.get(val, val)
        return val if val in MODE_INSTRUCTIONS else "learn"

    def normalize_language(self, language: Optional[str]) -> str:
        val = (language or "auto").strip().lower()
        return val if val else "auto"

    def _build_language_rule(self, language: Optional[str] = "auto") -> str:
        lang = self.normalize_language(language)
        if lang in LANGUAGE_INSTRUCTIONS:
            return LANGUAGE_INSTRUCTIONS[lang]
        return f"LANGUAGE RULE:\n- Respond fluently and naturally in **{language}**."

    def build_system_instruction(
        self,
        level: Optional[str] = "intermediate",
        mode: Optional[str] = "learn",
        language: Optional[str] = "auto",
        task_strategy: Optional[str] = None,
        has_citations: bool = False,
        has_web_results: bool = False,
        web_unavailable_note: Optional[str] = None,
        strict_doc_missing: bool = False,
        is_casual: bool = False,
    ) -> str:
        lang_rule = self._build_language_rule(language)
        if is_casual:
            return (
                "You are StudyMind AI, a friendly, intelligent personal AI assistant and study companion. "
                "The user is chatting casually (greeting, check-in, thanks, small talk, or general everyday chat). "
                "Reply naturally, warmly, and concisely in plain conversational prose like ChatGPT. "
                "Do NOT force academic headings, bulleted rubrics, tables, or quizzes.\n\n"
                + lang_rule
            )

        lvl = self.normalize_level(level)
        md = self.normalize_mode(mode)
        parts = [SYSTEM_INSTRUCTION, lang_rule, LEVEL_INSTRUCTIONS[lvl]]

        # Attach task-specific instruction (auto-detected math/code/writing overrides generic learn rubric)
        active_strategy = task_strategy if task_strategy in MODE_INSTRUCTIONS else md
        if active_strategy in MODE_INSTRUCTIONS:
            parts.append(MODE_INSTRUCTIONS[active_strategy])

        if has_citations:
            parts.append(
                "DOCUMENT GROUNDING RULE:\n"
                "- Use the supplied STUDY MATERIALS CONTEXT as the primary source for document-specific claims, citing `[Filename, Page X]`.\n"
                "- If helpful, you may supplement with accurate general knowledge, clearly distinguishing what comes from the uploaded PDFs vs additional explanation.\n"
                "- NEVER invent filenames, quotes, or page numbers."
            )
        elif strict_doc_missing:
            parts.append(
                "DOCUMENT COVERAGE RULE:\n"
                "- The user asked about their uploaded PDFs, and no matching passages were found.\n"
                "- State clearly up front that the uploaded documents do not contain this information, then offer accurate general guidance clearly labeled as general knowledge."
            )

        if has_web_results:
            parts.append(
                "WEB SEARCH GROUNDING RULE:\n"
                "- Retrieved live web snippets are provided in WEB SEARCH CONTEXT.\n"
                "- Distinguish current web-retrieved information from your general model knowledge and include clickable Markdown links `[Source Title](URL)`."
            )
        elif web_unavailable_note:
            parts.append(
                f"WEB SEARCH LIMITATION:\n- Live web search could not retrieve current results ({web_unavailable_note}). "
                "Be transparent if the answer depends on real-time events or recent updates after your knowledge cutoff, and do NOT claim to have searched the web."
            )

        return "\n\n".join(parts)

    def _format_web_context(self, web_results: Optional[List[Dict[str, str]]]) -> str:
        if not web_results:
            return ""
        blocks = []
        for idx, item in enumerate(web_results, 1):
            title = item.get("title") or f"Web Source {idx}"
            url = item.get("url") or ""
            snippet = item.get("snippet") or ""
            blocks.append(f"[Web {idx}] {title}\nURL: {url}\nSummary: {snippet}")
        return "\n\n".join(blocks)

    def _prepare_general_prompt(
        self,
        question: str,
        user_name: Optional[str] = None,
        level: str = "intermediate",
        mode: str = "learn",
        language: str = "auto",
        strict_doc_missing: bool = False,
        searched_docs: Optional[List[str]] = None,
        web_results: Optional[List[Dict[str, str]]] = None,
        web_unavailable_note: Optional[str] = None,
    ) -> Tuple[str, str, bool, float]:
        is_casual = self.is_casual_conversation(question)
        strategy, temperature = ("learn", 0.55) if is_casual else self.detect_task_strategy(question, mode)
        sys_inst = self.build_system_instruction(
            level=level,
            mode=mode,
            language=language,
            task_strategy=strategy,
            has_citations=False,
            has_web_results=bool(web_results),
            web_unavailable_note=web_unavailable_note,
            strict_doc_missing=strict_doc_missing and not is_casual,
            is_casual=is_casual,
        )

        if is_casual:
            first_name = (user_name or "").strip().split()[0] if user_name and user_name.strip() else ""
            name_note = f" (Student's first name: {first_name})" if first_name else ""
            user_prompt = (
                f"USER MESSAGE{name_note}:\n{question}\n\n"
                f"Respond naturally, warmly, and concisely like ChatGPT."
            )
            return sys_inst, user_prompt, True, temperature

        blocks = []
        web_block = self._format_web_context(web_results)
        if web_block:
            blocks.append(f"WEB SEARCH CONTEXT:\n{web_block}")

        if strict_doc_missing:
            docs_desc = ", ".join(searched_docs[:4]) if searched_docs else "the uploaded documents"
            blocks.append(
                f"NOTE ON UPLOADED PDFS: The user referenced {docs_desc}, but no matching passages were retrieved. "
                f"Inform the student clearly that this wasn't found in {docs_desc}, then answer accurately using general knowledge."
            )

        blocks.append(f"USER QUESTION:\n{question}")
        user_prompt = "\n\n".join(blocks)
        return sys_inst, user_prompt, False, temperature

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

    def _build_chat_messages(
        self,
        prompt: str,
        conversation_history: Optional[List[Dict[str, str]]] = None,
    ) -> List[Dict[str, str]]:
        messages: List[Dict[str, str]] = []
        if conversation_history:
            for turn in conversation_history[-16:]:
                role_raw = (turn.get("role") or "").strip().lower()
                text = (turn.get("content") or turn.get("message") or "").strip()
                if not text:
                    continue
                if len(text) > 1800:
                    text = text[:1800] + "..."
                norm_role = "assistant" if role_raw == "assistant" else "user"
                messages.append({"role": norm_role, "content": text})
        messages.append({"role": "user", "content": prompt})
        return messages

    def _no_provider_error_text(self) -> str:
        return (
            "> **No AI Model Configured:** No LLM API key or local provider is currently active.\n\n"
            "Configure at least one provider in `backend/.env` or **Settings**:\n"
            "- `GEMINI_API_KEY` (Google Gemini)\n"
            "- `OPENAI_API_KEY` (OpenAI or compatible endpoint via `OPENAI_BASE_URL`)\n"
            "- `OLLAMA_BASE_URL` (Local Ollama server)"
        )

    def generate_follow_up_suggestions(
        self,
        question: str,
        answer: str,
        mode: str = "learn",
        has_citations: bool = False,
    ) -> List[str]:
        if self.is_casual_conversation(question) or not answer or len(answer) < 40:
            return []
        strategy, _ = self.detect_task_strategy(question, mode)
        if strategy == "code":
            return ["Walk through an edge case", "Optimize time/space complexity", "Write unit tests for this"]
        if strategy == "math":
            return ["Verify with another example", "Explain the intuition behind this", "Give a practice problem"]
        if has_citations:
            return ["Summarize key exam points", "Give a simple analogy", "Quiz me on this PDF section"]
        if strategy == "writing":
            return ["Make it more concise", "Make the tone more formal", "Translate into another language"]
        return ["Explain in simpler terms", "Give a concrete example", "Ask me a check question"]

    def generate_general_academic_answer(
        self,
        question: str,
        user_name: Optional[str] = None,
        conversation_history: Optional[List[Dict[str, str]]] = None,
        level: str = "intermediate",
        mode: str = "learn",
        model: Optional[str] = None,
        language: str = "auto",
        strict_doc_missing: bool = False,
        searched_docs: Optional[List[str]] = None,
        web_results: Optional[List[Dict[str, str]]] = None,
        web_unavailable_note: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Answers universal user queries and casual conversation using the configured LLM provider router.
        Reports missing configuration or provider errors transparently instead of pretending a provider responded.
        """
        sys_inst, user_prompt, is_casual, temperature = self._prepare_general_prompt(
            question=question,
            user_name=user_name,
            level=level,
            mode=mode,
            language=language,
            strict_doc_missing=strict_doc_missing,
            searched_docs=searched_docs,
            web_results=web_results,
            web_unavailable_note=web_unavailable_note,
        )

        if not llm_router.has_any_provider():
            if is_casual:
                return {
                    "answer": self._synthesize_conversational_reply(question, user_name=user_name, language=language),
                    "grounded": False,
                    "not_found_in_docs": False,
                    "model_used": "StudyMind Conversational",
                    "llm_provider": "Built-in",
                    "follow_up_suggestions": [],
                }
            return {
                "answer": self._no_provider_error_text(),
                "grounded": False,
                "not_found_in_docs": False,
                "model_used": "unconfigured",
                "llm_provider": "None",
                "follow_up_suggestions": [],
            }

        try:
            messages = self._build_chat_messages(user_prompt, conversation_history)
            answer, used_model, provider_label = llm_router.generate(
                system_instruction=sys_inst,
                messages=messages,
                requested_model=model,
                temperature=temperature,
            )
            return {
                "answer": answer,
                "grounded": False,
                "not_found_in_docs": strict_doc_missing and not is_casual,
                "model_used": used_model,
                "llm_provider": provider_label,
                "follow_up_suggestions": self.generate_follow_up_suggestions(question, answer, mode=mode, has_citations=False),
            }
        except Exception as exc:
            print(f"[LLMService] Provider call failed: {exc}")
            if is_casual:
                return {
                    "answer": self._synthesize_conversational_reply(question, user_name=user_name, language=language),
                    "grounded": False,
                    "not_found_in_docs": False,
                    "model_used": "StudyMind Conversational",
                    "llm_provider": "Built-in Fallback",
                    "follow_up_suggestions": [],
                }
            return {
                "answer": (
                    f"> **AI Provider Error:** Could not complete this request (`{str(exc)}`).\n\n"
                    f"Please retry in a moment or switch to another configured model in the composer."
                ),
                "grounded": False,
                "not_found_in_docs": False,
                "model_used": "provider-error",
                "llm_provider": "Error",
                "follow_up_suggestions": [],
            }

    def _synthesize_general_academic_fallback(
        self,
        question: str,
        user_name: Optional[str] = None,
        level: str = "intermediate",
        mode: str = "learn",
        language: str = "auto",
        conversation_history: Optional[List[Dict[str, str]]] = None,
        strict_doc_missing: bool = False,
        searched_docs: Optional[List[str]] = None,
    ) -> str:
        if self.is_casual_conversation(question):
            return self._synthesize_conversational_reply(question, user_name=user_name, language=language)

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
        language: str = "auto",
        web_results: Optional[List[Dict[str, str]]] = None,
        web_unavailable_note: Optional[str] = None,
    ) -> Tuple[str, str, float]:
        context_blocks = []
        for i, cite in enumerate(citations, 1):
            clean_c_text = self._clean_slide_text(cite.text)
            score_pct = int(round(max(0.0, min(1.0, cite.relevance_score)) * 100))
            context_blocks.append(
                f"[Source {i}: {cite.filename} | Page {cite.page_number} | Relevance: {score_pct}%]\n{clean_c_text}\n"
            )
        formatted_context = "\n---\n".join(context_blocks)
        strategy, temperature = self.detect_task_strategy(question, mode)
        sys_inst = self.build_system_instruction(
            level=level,
            mode=mode,
            language=language,
            task_strategy=strategy,
            has_citations=True,
            has_web_results=bool(web_results),
            web_unavailable_note=web_unavailable_note,
        )

        sections = [f"STUDY MATERIALS CONTEXT:\n{formatted_context}"]
        web_block = self._format_web_context(web_results)
        if web_block:
            sections.append(f"WEB SEARCH CONTEXT:\n{web_block}")

        sections.append(
            f"USER QUESTION:\n{question}\n\n"
            f"INSTRUCTIONS:\n"
            f"Answer clearly and directly. Ground document-specific claims in STUDY MATERIALS CONTEXT using inline citations `[Filename, Page X]`. "
            f"When additional explanation or general knowledge helps, combine it cleanly while distinguishing PDF evidence from extra explanation."
        )
        return sys_inst, "\n\n".join(sections), temperature

    def generate_rag_answer(
        self,
        question: str,
        citations: List[SourceCitation],
        user_name: Optional[str] = None,
        conversation_history: Optional[List[Dict[str, str]]] = None,
        level: str = "intermediate",
        mode: str = "learn",
        model: Optional[str] = None,
        language: str = "auto",
        strict_doc_missing: bool = False,
        searched_docs: Optional[List[str]] = None,
        web_results: Optional[List[Dict[str, str]]] = None,
        web_unavailable_note: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Generates an answer grounded in retrieved RAG context (+ optional web context) via llm_router.
        """
        if not citations:
            return self.generate_general_academic_answer(
                question=question,
                user_name=user_name,
                conversation_history=conversation_history,
                level=level,
                mode=mode,
                model=model,
                language=language,
                strict_doc_missing=strict_doc_missing,
                searched_docs=searched_docs,
                web_results=web_results,
                web_unavailable_note=web_unavailable_note,
            )

        sys_inst, user_prompt, temperature = self._prepare_rag_prompt(
            question,
            citations,
            level=level,
            mode=mode,
            language=language,
            web_results=web_results,
            web_unavailable_note=web_unavailable_note,
        )

        if not llm_router.has_any_provider():
            synthesized_answer = (
                "> **Offline Document Excerpts (No LLM API Key Configured):**\n\n"
                + self._synthesize_local_context(question, citations, level=level, mode=mode)
            )
            return {
                "answer": synthesized_answer,
                "grounded": True,
                "not_found_in_docs": False,
                "model_used": "local-rag-synthesizer",
                "llm_provider": "Offline Extractive RAG",
                "follow_up_suggestions": self.generate_follow_up_suggestions(question, synthesized_answer, mode=mode, has_citations=True),
            }

        try:
            messages = self._build_chat_messages(user_prompt, conversation_history)
            answer, used_model, provider_label = llm_router.generate(
                system_instruction=sys_inst,
                messages=messages,
                requested_model=model,
                temperature=temperature,
            )
            return {
                "answer": answer,
                "grounded": True,
                "not_found_in_docs": False,
                "model_used": used_model,
                "llm_provider": provider_label,
                "follow_up_suggestions": self.generate_follow_up_suggestions(question, answer, mode=mode, has_citations=True),
            }
        except Exception as e:
            print(f"[LLMService] Provider call failed for RAG query: {e}")
            local_ans = (
                f"> **Note:** Live LLM synthesis failed (`{str(e)}`). Showing retrieved document excerpts:\n\n"
                + self._synthesize_local_context(question, citations, level=level, mode=mode)
            )
            return {
                "answer": local_ans,
                "grounded": True,
                "not_found_in_docs": False,
                "model_used": "local-fallback",
                "llm_provider": "Extractive Fallback",
                "follow_up_suggestions": [],
            }

    def _call_gemini_api(self, api_key: str, model: str, prompt: str) -> str:
        text, _, _ = llm_router.generate(
            system_instruction=SYSTEM_INSTRUCTION,
            messages=[{"role": "user", "content": prompt}],
            requested_model=model,
            temperature=0.2,
        )
        return text

    def stream_chat_response(
        self,
        question: str,
        citations: List[SourceCitation],
        user_name: Optional[str] = None,
        conversation_history: Optional[List[Dict[str, str]]] = None,
        level: str = "intermediate",
        mode: str = "learn",
        model: Optional[str] = None,
        language: str = "auto",
        strict_doc_missing: bool = False,
        searched_docs: Optional[List[str]] = None,
        web_results: Optional[List[Dict[str, str]]] = None,
        web_unavailable_note: Optional[str] = None,
    ) -> Generator[Dict[str, Any], None, None]:
        """
        Yields streaming delta dicts {"text": ..., "model_used": ..., "llm_provider": ...} via llm_router
        with honest provider errors if no LLM is configured or all providers fail.
        """
        is_casual = False
        if citations:
            sys_inst, user_prompt, temperature = self._prepare_rag_prompt(
                question,
                citations,
                level=level,
                mode=mode,
                language=language,
                web_results=web_results,
                web_unavailable_note=web_unavailable_note,
            )
        else:
            sys_inst, user_prompt, is_casual, temperature = self._prepare_general_prompt(
                question=question,
                user_name=user_name,
                level=level,
                mode=mode,
                language=language,
                strict_doc_missing=strict_doc_missing,
                searched_docs=searched_docs,
                web_results=web_results,
                web_unavailable_note=web_unavailable_note,
            )

        if not llm_router.has_any_provider():
            if is_casual:
                msg = self._synthesize_conversational_reply(question, user_name=user_name, language=language)
                used, prov = "StudyMind Conversational", "Built-in"
            elif citations:
                msg = (
                    "> **Offline Document Excerpts (No LLM API Key Configured):**\n\n"
                    + self._synthesize_local_context(question, citations, level=level, mode=mode)
                )
                used, prov = "local-rag-synthesizer", "Offline Extractive RAG"
            else:
                msg = self._no_provider_error_text()
                used, prov = "unconfigured", "None"

            for piece in self._chunk_text_for_stream(msg):
                yield {"text": piece, "model_used": used, "llm_provider": prov}
            return

        yielded_any = False
        try:
            messages = self._build_chat_messages(user_prompt, conversation_history)
            for delta, used_model, provider_label in llm_router.stream(
                system_instruction=sys_inst,
                messages=messages,
                requested_model=model,
                temperature=temperature,
            ):
                yielded_any = True
                yield {"text": delta, "model_used": used_model, "llm_provider": provider_label}
            if yielded_any:
                return
        except Exception as e:
            print(f"[LLMService] Stream failed (yielded_any={yielded_any}): {e}")
            if yielded_any:
                raise
            if is_casual:
                fallback_text = self._synthesize_conversational_reply(question, user_name=user_name, language=language)
                used, prov = "StudyMind Conversational", "Built-in Fallback"
            elif citations:
                fallback_text = (
                    f"> **Note:** Live LLM synthesis failed (`{str(e)}`). Showing retrieved document excerpts:\n\n"
                    + self._synthesize_local_context(question, citations, level=level, mode=mode)
                )
                used, prov = "local-fallback", "Extractive Fallback"
            else:
                fallback_text = (
                    f"> **AI Provider Error:** Could not complete this request (`{str(e)}`).\n\n"
                    f"Please retry in a moment or switch to another configured model in the composer."
                )
                used, prov = "provider-error", "Error"

            for piece in self._chunk_text_for_stream(fallback_text):
                yield {"text": piece, "model_used": used, "llm_provider": prov}

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
