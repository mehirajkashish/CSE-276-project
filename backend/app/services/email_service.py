import smtplib
import ssl
from email.message import EmailMessage
import requests

from app.core.config import settings


class EmailNotConfiguredError(RuntimeError):
    """Raised when no SMTP or Resend email provider is configured."""


class EmailDeliveryError(RuntimeError):
    """Raised when an email provider fails to deliver a message."""


class EmailService:
    """Sends transactional verification emails via Resend API or SMTP (STARTTLS/SSL)."""

    def has_resend(self) -> bool:
        return bool((settings.resend_api_key or "").strip())

    def has_smtp(self) -> bool:
        return bool(
            (settings.smtp_host or "").strip()
            and (settings.smtp_user or "").strip()
            and (settings.smtp_password or "").strip()
        )

    def is_configured(self) -> bool:
        return self.has_resend() or self.has_smtp()

    def send_password_reset_code(self, to_email: str, code: str, expires_minutes: int = 15) -> str:
        """Deliver a 6-digit password reset code. Returns provider used ('resend' | 'smtp')."""
        if not self.is_configured():
            raise EmailNotConfiguredError(
                "Password reset email service is not configured. Configure RESEND_API_KEY or SMTP_HOST/SMTP_USER/SMTP_PASSWORD on the server."
            )

        subject = "StudyMind AI — Password Reset Verification Code"
        plain_body = (
            f"Hello,\n\n"
            f"Your StudyMind AI password reset verification code is: {code}\n\n"
            f"This code expires in {expires_minutes} minutes.\n"
            f"If you did not request a password reset, you can safely ignore this email.\n"
        )
        html_body = (
            "<div style='font-family:Inter,Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;"
            "background:#0D0D0D;color:#FFFFFF;border-radius:14px;border:1px solid #262626;'>"
            "<h2 style='margin:0 0 8px;font-size:18px;color:#FFFFFF;'>StudyMind AI</h2>"
            "<p style='margin:0 0 16px;font-size:13px;color:#9A9A9A;'>"
            "Use this 6-digit code to reset your password:"
            "</p>"
            f"<div style='font-family:monospace;font-size:28px;font-weight:700;letter-spacing:6px;"
            f"text-align:center;padding:14px;background:#1A1A1A;border:1px solid #3A3A3A;"
            f"border-radius:10px;color:#FFFFFF;'>{code}</div>"
            f"<p style='margin:16px 0 0;font-size:12px;color:#9A9A9A;'>"
            f"Expires in {expires_minutes} minutes. If you did not request this, ignore this email."
            "</p></div>"
        )

        sender = (settings.smtp_from or settings.smtp_user or "StudyMind AI <onboarding@resend.dev>").strip()

        if self.has_resend():
            try:
                resp = requests.post(
                    "https://api.resend.com/emails",
                    headers={
                        "Authorization": f"Bearer {settings.resend_api_key.strip()}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "from": sender,
                        "to": [to_email],
                        "subject": subject,
                        "text": plain_body,
                        "html": html_body,
                    },
                    timeout=15.0,
                )
                if resp.status_code in (200, 201):
                    return "resend"
                raise EmailDeliveryError(f"Resend error ({resp.status_code}): {resp.text[:200]}")
            except requests.RequestException as exc:
                if not self.has_smtp():
                    raise EmailDeliveryError(f"Email delivery network error: {exc}") from exc

        # SMTP delivery
        msg = EmailMessage()
        msg["Subject"] = subject
        msg["From"] = sender
        msg["To"] = to_email
        msg.set_content(plain_body)
        msg.add_alternative(html_body, subtype="html")

        host = settings.smtp_host.strip()
        port = int(settings.smtp_port or 587)
        user = settings.smtp_user.strip()
        pw = settings.smtp_password.strip()

        try:
            ctx = ssl.create_default_context()
            if port == 465:
                with smtplib.SMTP_SSL(host, port, timeout=15, context=ctx) as server:
                    server.login(user, pw)
                    server.send_message(msg)
            else:
                with smtplib.SMTP(host, port, timeout=15) as server:
                    server.starttls(context=ctx)
                    server.login(user, pw)
                    server.send_message(msg)
            return "smtp"
        except Exception as exc:
            raise EmailDeliveryError(f"SMTP email delivery failed: {exc}") from exc


email_service = EmailService()
