"""Request bodies. Pydantic checks types; business rules live in the services.

The browser sends form values as strings ("18", "80.00"); Pydantic's lax mode coerces them.
"""
from decimal import Decimal

from pydantic import BaseModel


class RegisterIn(BaseModel):
    name: str
    email: str
    phone: str
    password: str


class LoginIn(BaseModel):
    email: str
    password: str


class DemoLoginIn(BaseModel):
    role: str


class ProfileIn(BaseModel):
    name: str
    phone: str


class BookingIn(BaseModel):
    court_id: int
    date: str
    hour: int
    method: str


class PayIn(BaseModel):
    result: str


class CourtIn(BaseModel):
    id: int | None = None
    name: str
    sport: str
    description: str
    district: str
    price: Decimal
    capacity: int
    opens_at: int
    closes_at: int
    active: bool = False


class BlockIn(BaseModel):
    court_id: int
    date: str
    hour: int
    reason: str


class BlockDeleteIn(BaseModel):
    id: int
