"""Time source and Lima (UTC-5, no DST) helpers. Injecting the clock keeps services testable."""
import re
from datetime import UTC, date, datetime, timedelta, timezone

from backend.core.errors import InvalidInput, require

LIMA = timezone(timedelta(hours=-5), "America/Lima")
HOUR = timedelta(hours=1)
_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


class Clock:
    def now(self) -> datetime:
        # Whole seconds: MySQL DATETIME stores no fractions, so API, SQLite and MySQL agree.
        return datetime.now(UTC).replace(microsecond=0)


def today_in_lima(moment: datetime) -> date:
    return moment.astimezone(LIMA).date()


def lima_hour(moment: datetime) -> int:
    return moment.astimezone(LIMA).hour


def slot_start(day: str, hour: int) -> datetime:
    """Return the UTC instant for `day` at `hour`:00 Lima time, validating both."""
    error = InvalidInput("Selecciona una fecha y un horario válidos.")
    require(isinstance(day, str) and _DATE_RE.match(day), error)
    require(isinstance(hour, int) and 0 <= hour <= 23, error)
    try:
        parsed = date.fromisoformat(day)
    except ValueError:
        raise error from None
    return datetime(parsed.year, parsed.month, parsed.day, hour, tzinfo=LIMA).astimezone(UTC)


def to_db(moment: datetime) -> datetime:
    """Store instants as naive UTC (portable across MySQL DATETIME and SQLite)."""
    return moment.astimezone(UTC).replace(tzinfo=None)


def from_db(value: datetime) -> datetime:
    return value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)


def iso(moment: datetime) -> str:
    return moment.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%S.000Z")


def short_lima(moment: datetime) -> str:
    return moment.astimezone(LIMA).strftime("%d/%m/%y, %H:%M")
