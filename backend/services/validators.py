"""Input rules shared by several services. Messages are user-facing (Spanish, es-PE)."""
import io
import re

from PIL import Image, UnidentifiedImageError

from backend.core.errors import InvalidInput, require

_PHONE_RE = re.compile(r"^9\d{8}$")
_EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
_COMMON_PASSWORDS = {"password", "12345678", "contraseña", "qwerty123"}

MAX_RECEIPT_BYTES = 5 * 1024 * 1024
_IMAGE_SIGNATURES = {b"\xff\xd8\xff": "image/jpeg", b"\x89PNG\r\n\x1a\n": "image/png"}


def clean_name_phone(name: str, phone: str) -> tuple[str, str]:
    name, phone = (name or "").strip(), (phone or "").strip()
    require(
        2 <= len(name) <= 100 and _PHONE_RE.match(phone),
        InvalidInput("Ingresa tu nombre y un celular peruano de 9 dígitos que empiece con 9."),
    )
    return name, phone


def clean_email(email: str) -> str:
    email = (email or "").strip().lower()
    require(len(email) <= 150 and _EMAIL_RE.match(email), InvalidInput("Ingresa un correo válido."))
    return email


def check_password(password: str) -> None:
    password = password or ""
    require(
        len(password) >= 8 and not password.isdigit() and password.lower() not in _COMMON_PASSWORDS,
        InvalidInput("Usa una contraseña de al menos 8 caracteres, que no sea común ni solo números."),
    )


MAX_RECEIPT_PIXELS = 40_000_000


def image_type(content: bytes) -> str:
    """Validate JPG/PNG by magic bytes AND by fully decoding it, so truncated files are rejected.

    The client-declared content type is never trusted.
    """
    require(0 < len(content) <= MAX_RECEIPT_BYTES, InvalidInput("Adjunta una imagen de hasta 5 MB."))
    mime = next((m for sig, m in _IMAGE_SIGNATURES.items() if content.startswith(sig)), None)
    require(mime, InvalidInput("Solo se aceptan imágenes JPG o PNG."))
    try:
        with Image.open(io.BytesIO(content)) as image:
            require(
                image.width * image.height <= MAX_RECEIPT_PIXELS,
                InvalidInput("La imagen es demasiado grande. Reduce su resolución."),
            )
            image.load()  # decodes every pixel: truncated or corrupt files fail here
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError):
        raise InvalidInput("El archivo no es una imagen JPG o PNG válida.") from None
    return mime
