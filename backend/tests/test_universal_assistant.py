"""
Automated Evaluation & Reliability Suite for StudyMind AI Universal Assistant.

Covers all 11 required evaluation categories:
1. General knowledge
2. Mathematics (steps & verification)
3. Programming & debugging
4. Multi-turn conversations
5. Follow-up questions
6. Long-context conversations (>14 turns with rolling summary & older-turn retrieval)
7. PDF-based questions & exact page citations
8. General questions when PDFs exist (ensuring zero false PDF interference)
9. Unknown/ambiguous queries & false-assumption correction
10. API failures, timeouts, and unconfigured provider transparency
11. User isolation & authentication

Run with:
    python backend/tests/test_universal_assistant.py
    python backend/tests/test_universal_assistant.py --live   # includes live Gemini API evaluation
"""

import os
import sys
import time
import uuid
import unittest
from pathlib import Path
from unittest.mock import patch

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

# Use isolated test DB so production backend/data/studymind.db is never touched
TEST_DB_PATH = BACKEND_DIR / "data" / "test_eval_suite.db"
if TEST_DB_PATH.exists():
    TEST_DB_PATH.unlink()
os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DB_PATH.as_posix()}"

from fastapi.testclient import TestClient  # noqa: E402
from app.main import app  # noqa: E402
from app.core.config import settings  # noqa: E402
from app.core.database import SessionLocal, init_db  # noqa: E402
from app.models.db_models import User, Document, ChatConversation, ChatMessage  # noqa: E402
from app.models.schemas import DocumentChunk  # noqa: E402
from app.rag.embeddings import embedding_service  # noqa: E402
from app.rag.vector_store import vector_store  # noqa: E402
from app.services.gemini_service import gemini_service  # noqa: E402
from app.services.llm_providers import llm_router, LLMProviderError  # noqa: E402


class TestUniversalAssistantSuite(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        init_db()
        cls.client = TestClient(app)
        cls.user_a_email = f"eval_a_{uuid.uuid4().hex[:6]}@studymind.ai"
        cls.user_b_email = f"eval_b_{uuid.uuid4().hex[:6]}@studymind.ai"
        cls.password = "StudyMindPass123!"

        r_a = cls.client.post(
            "/api/auth/register",
            json={
                "full_name": "Eval User A",
                "email": cls.user_a_email,
                "password": cls.password,
                "confirm_password": cls.password,
            },
        )
        assert r_a.status_code in (200, 201), r_a.text
        cls.token_a = r_a.json()["access_token"]
        cls.user_a_id = r_a.json()["user"]["id"]

        r_b = cls.client.post(
            "/api/auth/register",
            json={
                "full_name": "Eval User B",
                "email": cls.user_b_email,
                "password": cls.password,
                "confirm_password": cls.password,
            },
        )
        assert r_b.status_code in (200, 201), r_b.text
        cls.token_b = r_b.json()["access_token"]
        cls.user_b_id = r_b.json()["user"]["id"]

        cls.headers_a = {"Authorization": f"Bearer {cls.token_a}"}
        cls.headers_b = {"Authorization": f"Bearer {cls.token_b}"}

        # Seed a real isolated PDF record & vector chunk for User A (TCP/IP Networking)
        cls.doc_a_id = str(uuid.uuid4())
        db = SessionLocal()
        try:
            db.add(
                Document(
                    id=cls.doc_a_id,
                    user_id=cls.user_a_id,
                    filename="CSE306_Networking_Notes.pdf",
                    file_path="/uploads/eval_cse306.pdf",
                    file_size=1234,
                    total_pages=5,
                    total_chunks=1,
                )
            )
            db.commit()
        finally:
            db.close()

        chunk_text = (
            "TCP (Transmission Control Protocol) is a connection-oriented transport layer protocol "
            "that uses a 3-way handshake (SYN, SYN-ACK, ACK) to establish reliable byte-stream delivery."
        )
        chunk = DocumentChunk(
            id=f"{cls.doc_a_id}_p3_c1",
            document_id=cls.doc_a_id,
            user_id=cls.user_a_id,
            filename="CSE306_Networking_Notes.pdf",
            page_number=3,
            chunk_index=1,
            text=chunk_text,
            metadata={"page_number": 3, "filename": "CSE306_Networking_Notes.pdf"},
        )
        vecs = embedding_service.embed_texts([chunk_text])
        vector_store.add_chunks([chunk], vecs)

    @classmethod
    def tearDownClass(cls):
        vector_store.delete_document_chunks(cls.doc_a_id, user_id=cls.user_a_id)
        if TEST_DB_PATH.exists():
            try:
                TEST_DB_PATH.unlink()
            except Exception:
                pass

    def test_01_general_knowledge_routing_without_pdf_interference(self):
        """General question while PDFs exist must NOT falsely trigger PDF warning."""
        with patch.object(
            llm_router,
            "generate",
            return_value=("Paris is the capital of France.", "gemini-flash-lite-latest", "Google Gemini"),
        ) as mock_gen:
            resp = self.client.post(
                "/api/chat",
                headers=self.headers_a,
                json={"question": "What is the capital of France?", "mode": "learn"},
            )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["answer"], "Paris is the capital of France.")
        self.assertFalse(data["not_found_in_docs"])
        self.assertEqual(data["sources"], [])
        mock_gen.assert_called_once()

    def test_02_mathematics_strategy_and_low_temperature(self):
        """Math query auto-selects math strategy and low temperature for precision."""
        strategy, temp = gemini_service.detect_task_strategy("Solve the integral of x^2 dx from 0 to 3", "learn")
        self.assertEqual(strategy, "math")
        self.assertLessEqual(temp, 0.2)

        with patch.object(
            llm_router,
            "generate",
            return_value=("$$\\int_0^3 x^2\\,dx = \\left[\\frac{x^3}{3}\\right]_0^3 = 9$$", "gemini-flash-lite-latest", "Google Gemini"),
        ) as mock_gen:
            resp = self.client.post(
                "/api/chat",
                headers=self.headers_a,
                json={"question": "Solve the integral of x^2 dx from 0 to 3"},
            )
        self.assertEqual(resp.status_code, 200)
        self.assertIn("9", resp.json()["answer"])
        self.assertLessEqual(mock_gen.call_args.kwargs["temperature"], 0.2)

    def test_03_programming_debugging_strategy(self):
        """Programming/debugging query selects code strategy and instructs complexity + explanation."""
        strategy, temp = gemini_service.detect_task_strategy("Fix this Python bug: for i in range(len(arr)): arr.pop(i)", "learn")
        self.assertEqual(strategy, "code")
        self.assertLessEqual(temp, 0.25)
        sys_inst = gemini_service.build_system_instruction(task_strategy="code")
        self.assertIn("Time/Space complexity", sys_inst)

    def test_04_and_05_multi_turn_and_followup_questions(self):
        """Multi-turn conversation preserves prior turns & expands short follow-ups."""
        with patch.object(
            llm_router,
            "generate",
            side_effect=[
                ("Binary search halves a sorted array in O(log n).", "gemini-flash-lite-latest", "Google Gemini"),
                ("Here is another example with sorted prices [10, 20, 30, 40].", "gemini-flash-lite-latest", "Google Gemini"),
            ],
        ) as mock_gen:
            r1 = self.client.post(
                "/api/chat",
                headers=self.headers_a,
                json={"question": "Explain binary search"},
            )
            conv_id = r1.json()["conversation_id"]

            r2 = self.client.post(
                "/api/chat",
                headers=self.headers_a,
                json={"question": "give another example", "conversation_id": conv_id},
            )
        self.assertEqual(r2.status_code, 200)
        second_call_messages = mock_gen.call_args_list[1].kwargs["messages"]
        combined_history = " ".join(m["content"] for m in second_call_messages)
        self.assertIn("Explain binary search", combined_history)
        self.assertIn("O(log n)", combined_history)

    def test_06_long_context_conversation_summarization_and_recall(self):
        """Conversations > 12 messages summarize older turns and recall keyword-relevant older turns."""
        db = SessionLocal()
        conv_id = str(uuid.uuid4())
        try:
            db.add(ChatConversation(id=conv_id, user_id=self.user_a_id, title="Long Context Test"))
            # Add 16 turns; turn 1 mentions Dijkstra's shortest path
            for i in range(16):
                u_text = "Explain Dijkstra shortest path algorithm with min-heap" if i == 0 else f"General turn number {i}"
                a_text = "Dijkstra uses a priority queue to relax edges." if i == 0 else f"Reply number {i}"
                db.add(ChatMessage(id=str(uuid.uuid4()), conversation_id=conv_id, role="user", message=u_text))
                db.add(ChatMessage(id=str(uuid.uuid4()), conversation_id=conv_id, role="assistant", message=a_text))
            db.commit()
        finally:
            db.close()

        with patch.object(
            llm_router,
            "generate",
            return_value=("Returning to Dijkstra: its complexity with a binary heap is O((V+E) log V).", "gemini-flash-lite-latest", "Google Gemini"),
        ) as mock_gen:
            resp = self.client.post(
                "/api/chat",
                headers=self.headers_a,
                json={"question": "Go back to Dijkstra complexity we discussed earlier", "conversation_id": conv_id},
            )
        self.assertEqual(resp.status_code, 200)
        sent_msgs = mock_gen.call_args.kwargs["messages"]
        joined = "\n".join(m["content"] for m in sent_msgs)
        self.assertIn("Earlier conversation summary", joined)
        self.assertIn("Dijkstra", joined)

    def test_07_pdf_based_question_with_exact_citation(self):
        """Explicit PDF query retrieves exact document & page number and grounds answer."""
        with patch.object(
            llm_router,
            "generate",
            return_value=("TCP establishes connections via a 3-way handshake [CSE306_Networking_Notes.pdf, Page 3].", "gemini-flash-lite-latest", "Google Gemini"),
        ):
            resp = self.client.post(
                "/api/chat",
                headers=self.headers_a,
                json={
                    "question": "According to my PDF notes, how does TCP 3-way handshake work?",
                    "document_ids": [self.doc_a_id],
                },
            )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertTrue(data["grounded"])
        self.assertGreaterEqual(len(data["sources"]), 1)
        self.assertEqual(data["sources"][0]["filename"], "CSE306_Networking_Notes.pdf")
        self.assertEqual(data["sources"][0]["page_number"], 3)

    def test_08_question_unrelated_to_uploaded_pdf_when_doc_requested(self):
        """If user explicitly asks about their PDF on an unrelated topic, report not_found_in_docs transparently."""
        with patch.object(
            llm_router,
            "generate",
            return_value=("That topic was not found in your uploaded notes. Photosynthesis occurs in chloroplasts.", "gemini-flash-lite-latest", "Google Gemini"),
        ):
            resp = self.client.post(
                "/api/chat",
                headers=self.headers_a,
                json={
                    "question": "From my uploaded PDF document, explain photosynthesis Calvin cycle",
                    "document_ids": [self.doc_a_id],
                },
            )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertTrue(data["not_found_in_docs"])
        self.assertEqual(data["sources"], [])

    def test_09_unknown_and_false_assumption_prompt_rules(self):
        """System prompt explicitly forbids blindly agreeing with wrong assumptions or fabricating facts."""
        sys_inst = gemini_service.build_system_instruction(level="intermediate", mode="learn")
        self.assertIn("Do NOT blindly agree with incorrect premises", sys_inst)
        self.assertIn("Admit uncertainty", sys_inst)

    def test_10_api_failure_timeout_and_unconfigured_provider_honesty(self):
        """When no provider is configured or API fails, return honest error instead of faking an answer."""
        with patch.object(settings, "gemini_api_key", ""), patch.object(settings, "openai_api_key", ""), patch.object(settings, "ollama_base_url", ""):
            models_resp = self.client.get("/api/chat/models", headers=self.headers_a)
            self.assertEqual(models_resp.status_code, 200)
            self.assertFalse(models_resp.json()["configured"])
            self.assertEqual(models_resp.json()["models"], [])

            chat_resp = self.client.post(
                "/api/chat",
                headers=self.headers_a,
                json={"question": "Explain quantum entanglement"},
            )
            self.assertEqual(chat_resp.status_code, 200)
            self.assertEqual(chat_resp.json()["model_used"], "unconfigured")
            self.assertIn("No AI Model Configured", chat_resp.json()["answer"])

        with patch.object(llm_router, "generate", side_effect=LLMProviderError("Read timed out (30s)")):
            err_resp = self.client.post(
                "/api/chat",
                headers=self.headers_a,
                json={"question": "Explain virtual memory"},
            )
            self.assertEqual(err_resp.status_code, 200)
            self.assertEqual(err_resp.json()["model_used"], "provider-error")
            self.assertIn("Read timed out", err_resp.json()["answer"])

    def test_11_user_isolation_and_authentication(self):
        """Unauthenticated requests are rejected; User B cannot read or delete User A's conversations or PDFs."""
        unauth = self.client.post("/api/chat", json={"question": "Hello"})
        self.assertIn(unauth.status_code, (401, 403))

        with patch.object(
            llm_router,
            "generate",
            return_value=("Private answer for A.", "gemini-flash-lite-latest", "Google Gemini"),
        ):
            r_a = self.client.post("/api/chat", headers=self.headers_a, json={"question": "Secret topic A"})
        conv_a_id = r_a.json()["conversation_id"]

        # User B tries to read or delete User A's conversation
        b_read = self.client.get(f"/api/chat/{conv_a_id}", headers=self.headers_b)
        self.assertEqual(b_read.status_code, 404)
        b_del = self.client.delete(f"/api/chat/{conv_a_id}", headers=self.headers_b)
        self.assertEqual(b_del.status_code, 404)

        # User B cannot access User A's document details
        b_doc = self.client.get(f"/api/documents/{self.doc_a_id}", headers=self.headers_b)
        self.assertEqual(b_doc.status_code, 404)


def run_live_evaluation():
    """Runs live end-to-end prompts against the configured LLM provider and prints latency & quality checks."""
    if not llm_router.has_any_provider():
        print("[LIVE EVAL] Skipped: no live LLM provider configured.")
        return

    client = TestClient(app)
    email = f"live_eval_{uuid.uuid4().hex[:6]}@studymind.ai"
    reg = client.post(
        "/api/auth/register",
        json={
            "full_name": "Live Eval",
            "email": email,
            "password": "EvalPass123!",
            "confirm_password": "EvalPass123!",
        },
    )
    assert reg.status_code in (200, 201), reg.text
    headers = {"Authorization": f"Bearer {reg.json()['access_token']}"}

    prompts = [
        ("General Knowledge", "What causes seasons on Earth? Answer in 2 crisp sentences.", {}),
        ("Mathematics", "Solve 2x^2 - 5x - 3 = 0 step by step and verify both roots.", {}),
        ("Programming", "Fix this Python bug and explain why: def add_item(x, items=[]): items.append(x); return items", {"mode": "code"}),
        ("False Assumption Correction", "Isn't Python a compiled static-only language with no garbage collector? Explain.", {}),
        ("Hinglish Chat", "bhai binary tree aur BST me kya difference hota hai simple hinglish me batao", {"language": "auto"}),
    ]

    print("\n=== LIVE UNIVERSAL ASSISTANT EVALUATION ===")
    conv_id = None
    for label, q, extra in prompts:
        t0 = time.perf_counter()
        payload = {"question": q, **extra}
        res = client.post("/api/chat", headers=headers, json=payload)
        latency_ms = round((time.perf_counter() - t0) * 1000, 1)
        data = res.json()
        if label == "Programming":
            conv_id = data.get("conversation_id")
        print(f"[{label}] HTTP={res.status_code} | model={data.get('model_used')} | {latency_ms}ms | len={len(data.get('answer',''))}")
        print(f"  Snippet: {data.get('answer', '')[:160].replace(chr(10), ' ')}")

    if conv_id:
        t0 = time.perf_counter()
        fu = client.post("/api/chat", headers=headers, json={"question": "give another short example of that bug", "conversation_id": conv_id})
        latency_ms = round((time.perf_counter() - t0) * 1000, 1)
        fu_data = fu.json()
        print(f"[Follow-up] HTTP={fu.status_code} | model={fu_data.get('model_used')} | {latency_ms}ms | len={len(fu_data.get('answer',''))}")
        print(f"  Snippet: {fu_data.get('answer', '')[:160].replace(chr(10), ' ')}")


if __name__ == "__main__":
    live_flag = "--live" in sys.argv
    if live_flag:
        sys.argv.remove("--live")
    suite = unittest.defaultTestLoader.loadTestsFromTestCase(TestUniversalAssistantSuite)
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    if live_flag and result.wasSuccessful():
        run_live_evaluation()
    sys.exit(0 if result.wasSuccessful() else 1)
