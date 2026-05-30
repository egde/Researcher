from pydantic import BaseModel, Field, field_validator
from typing import Optional


class User(BaseModel):
    name: str
    age: int = Field(ge=0, le=150)
    email: str

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        if "@" not in v:
            raise ValueError("must contain @")
        return v


class Config(BaseModel):
    max_retries: int = Field(default=3, ge=1, le=10)
    timeout_ms: int = Field(default=5000, gt=0)
    base_url: str = "https://api.example.com"


class Address(BaseModel):
    street: str
    city: str
    zip_code: str


class Company(BaseModel):
    name: str
    address: Address
    ceo: Optional[str] = None


def main():
    user = User(name="Alice", age=30, email="alice@example.com")
    print(user.name)
    print(user.age)
