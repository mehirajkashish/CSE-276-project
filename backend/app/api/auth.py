import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.database import get_db
from app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user
)
from app.models.db_models import User, PasswordResetCode
from app.models.schemas import (
    UserRegisterRequest,
    UserLoginRequest,
    UserProfileUpdateRequest,
    ForgotPasswordRequest,
    ForgotPasswordVerifyRequest,
    ResetPasswordRequest,
    UserResponse,
    AuthTokenResponse
)
from app.services.email_service import email_service, EmailNotConfiguredError

router = APIRouter(prefix="/auth", tags=["Authentication"])

MAX_RESET_ATTEMPTS = 5
RESET_CODE_TTL_MINUTES = 15


def _hash_reset_code(email: str, code: str) -> str:
    """Hash reset OTP with JWT secret so raw codes are never stored in the database."""
    secret = (settings.jwt_secret or "studymind").encode("utf-8")
    msg = f"{email.lower().strip()}:{code.strip()}".encode("utf-8")
    return hmac.new(secret, msg, hashlib.sha256).hexdigest()


def _as_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)

@router.post("/register", response_model=AuthTokenResponse, status_code=status.HTTP_201_CREATED)
def register(req: UserRegisterRequest, db: Session = Depends(get_db)):
    """
    Registers a new user, hashes password, saves to database,
    and returns a JWT access token for immediate login.
    """
    # 1. Check password confirmation
    if req.password != req.confirm_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Passwords do not match."
        )

    # 2. Check password strength
    if len(req.password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 6 characters long."
        )

    # 3. Check duplicate email
    existing_user = db.query(User).filter(User.email == req.email.lower().strip()).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email address already exists. Please sign in."
        )

    # 4. Hash password and insert user
    hashed_pw = hash_password(req.password)
    user = User(
        full_name=req.full_name.strip(),
        email=req.email.lower().strip(),
        hashed_password=hashed_pw,
        created_at=datetime.now(timezone.utc)
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # 5. Generate JWT token
    token = create_access_token(data={"sub": user.id, "email": user.email})
    return AuthTokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserResponse.model_validate(user)
    )

@router.post("/login", response_model=AuthTokenResponse)
def login(req: UserLoginRequest, db: Session = Depends(get_db)):
    """
    Authenticates a user with email and password,
    returning a JWT access token.
    """
    user = db.query(User).filter(User.email == req.email.lower().strip()).first()
    if not user or not verify_password(req.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password. Please verify your credentials.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = create_access_token(data={"sub": user.id, "email": user.email})
    return AuthTokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserResponse.model_validate(user)
    )

@router.get("/me", response_model=UserResponse)
def get_current_user_profile(current_user: User = Depends(get_current_user)):
    """Returns the authenticated user's profile."""
    return UserResponse.model_validate(current_user)

@router.put("/profile", response_model=UserResponse)
def update_profile(
    req: UserProfileUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Updates user credentials: full name, email, and password.
    """
    # 1. Update Full Name
    if req.full_name and req.full_name.strip():
        current_user.full_name = req.full_name.strip()

    # 2. Update Email if changed
    if req.email and req.email.lower().strip() != current_user.email:
        new_email = req.email.lower().strip()
        existing = db.query(User).filter(User.email == new_email).first()
        if existing and existing.id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Email address is already taken by another account."
            )
        current_user.email = new_email

    # 3. Update Password if requested
    if req.new_password:
        if not req.current_password:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Current password is required to set a new password."
            )
        if not verify_password(req.current_password, current_user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Current password is incorrect."
            )
        if len(req.new_password) < 6:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="New password must be at least 6 characters."
            )
        if req.confirm_new_password and req.new_password != req.confirm_new_password:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="New passwords do not match."
            )
        current_user.hashed_password = hash_password(req.new_password)

    db.commit()
    db.refresh(current_user)
    return UserResponse.model_validate(current_user)

@router.post("/forgot-password")
def forgot_password(req: ForgotPasswordRequest, db: Session = Depends(get_db)):
    """
    Initiates password reset by emailing a cryptographically random 6-digit code.
    Never exposes the reset code in API responses or prevents user enumeration.
    """
    clean_email = req.email.lower().strip()
    if not email_service.is_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "Password reset email delivery is not configured on this server. "
                "Configure RESEND_API_KEY or SMTP_HOST/SMTP_USER/SMTP_PASSWORD to send verification emails."
            ),
        )

    user = db.query(User).filter(User.email == clean_email).first()
    if user:
        code = f"{secrets.randbelow(900000) + 100000}"
        expires_at = datetime.now(timezone.utc) + timedelta(minutes=RESET_CODE_TTL_MINUTES)
        code_hash = _hash_reset_code(clean_email, code)

        existing = db.query(PasswordResetCode).filter(PasswordResetCode.email == clean_email).first()
        if existing:
            existing.code_hash = code_hash
            existing.expires_at = expires_at
            existing.attempts = 0
            existing.created_at = datetime.now(timezone.utc)
        else:
            db.add(
                PasswordResetCode(
                    email=clean_email,
                    code_hash=code_hash,
                    expires_at=expires_at,
                    attempts=0,
                )
            )
        db.commit()

        try:
            email_service.send_password_reset_code(clean_email, code, expires_minutes=RESET_CODE_TTL_MINUTES)
        except EmailNotConfiguredError as exc:
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc))
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Could not deliver verification email: {exc}",
            )

    return {
        "status": "success",
        "message": f"If an account exists for {clean_email}, a 6-digit verification code has been sent to your inbox.",
        "email": clean_email,
        "expires_in_minutes": RESET_CODE_TTL_MINUTES,
    }


def _validate_and_consume_entry(db: Session, clean_email: str, raw_code: str, consume: bool) -> None:
    entry = db.query(PasswordResetCode).filter(PasswordResetCode.email == clean_email).first()
    if not entry:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No active password reset request found for this email. Please request a new code.",
        )

    if datetime.now(timezone.utc) > _as_utc(entry.expires_at):
        db.delete(entry)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification code has expired. Please request a new one.",
        )

    if entry.attempts >= MAX_RESET_ATTEMPTS:
        db.delete(entry)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many invalid code attempts. Please request a new verification code.",
        )

    expected_hash = _hash_reset_code(clean_email, raw_code)
    if not hmac.compare_digest(expected_hash, entry.code_hash):
        entry.attempts += 1
        db.commit()
        remaining = max(0, MAX_RESET_ATTEMPTS - entry.attempts)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid verification code ({remaining} attempts remaining).",
        )

    if consume:
        db.delete(entry)
        db.commit()


@router.post("/verify-reset-code")
def verify_reset_code(req: ForgotPasswordVerifyRequest, db: Session = Depends(get_db)):
    """Validates whether the 6-digit verification code is correct, unexpired, and within attempt limits."""
    clean_email = req.email.lower().strip()
    _validate_and_consume_entry(db, clean_email, req.reset_code, consume=False)
    return {
        "status": "success",
        "valid": True,
        "message": "Verification code is valid.",
    }


@router.post("/reset-password")
def reset_password(req: ResetPasswordRequest, db: Session = Depends(get_db)):
    """Resets the user's password after verifying the emailed 6-digit code."""
    clean_email = req.email.lower().strip()

    if req.new_password != req.confirm_new_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New passwords do not match.",
        )
    if len(req.new_password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 6 characters long.",
        )

    _validate_and_consume_entry(db, clean_email, req.reset_code, consume=True)

    user = db.query(User).filter(User.email == clean_email).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User account not found.",
        )

    user.hashed_password = hash_password(req.new_password)
    db.commit()

    return {
        "status": "success",
        "message": "Your password has been reset successfully! You can now sign in with your new password.",
    }
