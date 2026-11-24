import random
from datetime import datetime, timedelta, timezone
from typing import Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user
)
from app.models.db_models import User
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

router = APIRouter(prefix="/auth", tags=["Authentication"])

# In-memory storage for password reset verification codes
RESET_CODES: Dict[str, Dict[str, Any]] = {}

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
    Initiates password reset by verifying email and generating a 6-digit verification code.
    Valid for 15 minutes.
    """
    clean_email = req.email.lower().strip()
    user = db.query(User).filter(User.email == clean_email).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No registered account found with this email address."
        )

    # Generate 6-digit code
    code = f"{random.randint(100000, 999999)}"
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=15)
    RESET_CODES[clean_email] = {
        "code": code,
        "expires_at": expires_at
    }

    return {
        "status": "success",
        "message": f"Verification code sent to {clean_email}.",
        "email": clean_email,
        "reset_code": code,  # Provided for local/student testability
        "expires_in_minutes": 15
    }

@router.post("/verify-reset-code")
def verify_reset_code(req: ForgotPasswordVerifyRequest):
    """
    Validates whether the 6-digit verification code is correct and not expired.
    """
    clean_email = req.email.lower().strip()
    entry = RESET_CODES.get(clean_email)
    if not entry:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No password reset request found for this email. Please request a new code."
        )

    if datetime.now(timezone.utc) > entry["expires_at"]:
        del RESET_CODES[clean_email]
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification code has expired. Please request a new one."
        )

    if req.reset_code.strip() != entry["code"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid 6-digit verification code. Please check and try again."
        )

    return {
        "status": "success",
        "valid": True,
        "message": "Verification code is valid."
    }

@router.post("/reset-password")
def reset_password(req: ResetPasswordRequest, db: Session = Depends(get_db)):
    """
    Resets the user's password after verifying the 6-digit code.
    """
    clean_email = req.email.lower().strip()
    
    # 1. Check passwords
    if req.new_password != req.confirm_new_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New passwords do not match."
        )
    if len(req.new_password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 6 characters long."
        )

    # 2. Check reset code
    entry = RESET_CODES.get(clean_email)
    if not entry:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No active password reset found. Please request a new code."
        )

    if datetime.now(timezone.utc) > entry["expires_at"]:
        del RESET_CODES[clean_email]
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification code has expired. Please request a new code."
        )

    if req.reset_code.strip() != entry["code"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid verification code. Please try again."
        )

    # 3. Update user password in database
    user = db.query(User).filter(User.email == clean_email).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User account not found."
        )

    user.hashed_password = hash_password(req.new_password)
    db.commit()

    # Clear used reset code
    del RESET_CODES[clean_email]

    return {
        "status": "success",
        "message": "Your password has been reset successfully! You can now sign in with your new password."
    }
