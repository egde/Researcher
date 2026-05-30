from pydantic import BaseModel, Field, field_validator
from typing import Optional


class CustomerCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    email: str
    phone: Optional[str] = None

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        if "@" not in v:
            raise ValueError("invalid email address")
        return v


class Customer(BaseModel):
    id: str
    name: str
    email: str
    phone: Optional[str] = None


class CustomerUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None


class CustomerList(BaseModel):
    customers: list[Customer]
    total: int
