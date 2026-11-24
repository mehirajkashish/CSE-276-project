import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.core.database import SessionLocal
from app.models.db_models import User, Document
from app.services.study_service import study_service

def test_study_service():
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == "alex@university.edu").first()
        if not user:
            from app.api.auth import register
            from app.models.schemas import UserRegisterRequest
            reg = register(UserRegisterRequest(
                full_name="Alex Academic",
                email="alex@university.edu",
                password="password123",
                confirm_password="password123"
            ), db)
            user = db.query(User).filter(User.email == "alex@university.edu").first()

        doc = db.query(Document).filter(Document.user_id == user.id).first()
        if not doc:
            from fpdf import FPDF
            from app.services.document_service import document_service
            pdf = FPDF()
            pdf.add_page()
            pdf.set_font("Helvetica", "B", 16)
            pdf.cell(0, 10, "Chapter 1: Neural Networks and Backpropagation")
            pdf.ln(10)
            pdf.set_font("Helvetica", size=11)
            pdf.multi_cell(0, 7, "Neural networks learn representations through backpropagation, computing the gradient of the loss with respect to weights using the chain rule.")
            doc = document_service.process_and_add_pdf(
                db=db,
                user_id=user.id,
                filename="deep_learning_handbook.pdf",
                file_bytes=pdf.output()
            )
        
        print("Testing Study Service with doc:", doc.filename)
        
        # 1. Summary
        res_sum = study_service.generate_summary(db, user.id, doc.id)
        assert res_sum["summary"], "Summary is empty!"
        print("✓ Summary generated successfully")
        
        # 2. Flashcards
        res_fc = study_service.generate_flashcards(db, user.id, doc.id, count=4)
        assert len(res_fc.flashcards) > 0, "No flashcards generated!"
        print(f"✓ Flashcards generated: {len(res_fc.flashcards)} cards")
        
        # 3. Quiz
        res_quiz = study_service.generate_quiz(db, user.id, doc.id, count=4)
        assert len(res_quiz.quiz) > 0, "No quiz generated!"
        options_set = set(q.correct_option_id for q in res_quiz.quiz)
        print(f"✓ Quiz generated: {len(res_quiz.quiz)} MCQs (Options verified: {options_set})")
        
        # 4. Explain Simply
        res_exp = study_service.explain_simply(db, user.id, "Attention Mechanism", doc.id)
        assert res_exp["explanation"], "Explanation empty!"
        print("✓ Explain Simply generated successfully")
        
        print("\nALL STUDY TOOLKIT BACKEND TESTS PASSED!")
    finally:
        db.close()

if __name__ == "__main__":
    test_study_service()
