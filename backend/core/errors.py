"""Domain errors. Services raise these; the API layer maps them to HTTP status codes."""


class AppError(Exception):
    status_code = 400

    def __init__(self, message: str):
        super().__init__(message)
        self.message = message


class InvalidInput(AppError):
    status_code = 400


class NotAuthenticated(AppError):
    status_code = 401


class Forbidden(AppError):
    status_code = 403


class NotFound(AppError):
    status_code = 404


class Conflict(AppError):
    status_code = 409


class ServiceUnavailable(AppError):
    status_code = 503


def require(condition: object, error: AppError) -> None:
    if not condition:
        raise error
