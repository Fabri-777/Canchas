"""Password hashing (PBKDF2-SHA256) and opaque session tokens."""
import hashlib
import hmac
import secrets

_ITERATIONS = 200_000


def hash_password(password: str, salt: str | None = None) -> tuple[str, str]:
    salt = salt or secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), _ITERATIONS)
    return digest.hex(), salt


def verify_password(password: str, expected_hash: str | None, salt: str | None) -> bool:
    if not expected_hash or not salt:
        return False
    candidate, _ = hash_password(password, salt)
    return hmac.compare_digest(candidate, expected_hash)


def new_session_token() -> str:
    return secrets.token_urlsafe(32)


def hash_token(token: str) -> str:
    """Only the hash is stored, so a leaked sessions table cannot be replayed."""
    return hashlib.sha256(token.encode()).hexdigest()
