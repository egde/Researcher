use copperhead::parser;
use copperhead::codegen;

fn transpile(source: &str) -> String {
    let module = parser::parse_module(source, "test.cu.py").unwrap();
    codegen::generate_module(&module)
}

#[test]
fn test_hello_world() {
    let source = r#"
def main():
    print("Hello, world!")
"#;
    insta::assert_snapshot!(transpile(source));
}

#[test]
fn test_function_with_types() {
    let source = r#"
def add(a: int, b: int) -> int:
    return a + b
"#;
    insta::assert_snapshot!(transpile(source));
}

#[test]
fn test_ownership_borrow() {
    let source = r#"
from copperhead import borrow

def inspect(s: borrow[str]) -> int:
    return len(s)
"#;
    insta::assert_snapshot!(transpile(source));
}

#[test]
fn test_ownership_mut() {
    let source = r#"
from copperhead import mut

def modify(items: mut[list[int]]):
    items.append(42)
"#;
    insta::assert_snapshot!(transpile(source));
}

#[test]
fn test_pydantic_basic_struct() {
    let source = r#"
from pydantic import BaseModel

class Point(BaseModel):
    x: float
    y: float
"#;
    insta::assert_snapshot!(transpile(source));
}

#[test]
fn test_pydantic_with_constraints() {
    let source = r#"
from pydantic import BaseModel, Field

class User(BaseModel):
    name: str
    age: int = Field(ge=0, le=150)
"#;
    insta::assert_snapshot!(transpile(source));
}

#[test]
fn test_pydantic_optional_with_default() {
    let source = r#"
from pydantic import BaseModel
from typing import Optional

class Company(BaseModel):
    name: str
    ceo: Optional[str] = None
"#;
    insta::assert_snapshot!(transpile(source));
}

#[test]
fn test_fstring() {
    let source = r#"
def greet(name: str) -> str:
    return f"Hello, {name}!"
"#;
    insta::assert_snapshot!(transpile(source));
}

#[test]
fn test_for_range() {
    let source = r#"
def count():
    for i in range(10):
        print(i)
"#;
    insta::assert_snapshot!(transpile(source));
}

#[test]
fn test_while_loop() {
    let source = r#"
def countdown(n: int):
    while n > 0:
        print(n)
        n = n - 1
"#;
    insta::assert_snapshot!(transpile(source));
}

#[test]
fn test_result_type() {
    let source = r#"
from copperhead import Result, Ok, Err

def divide(a: float, b: float) -> Result[float, str]:
    if b == 0.0:
        return Err("division by zero")
    return Ok(a / b)
"#;
    insta::assert_snapshot!(transpile(source));
}

#[test]
fn test_try_operator() {
    let source = r#"
from copperhead import Result, Ok, try_

def calculate() -> Result[float, str]:
    x = try_(divide(10.0, 3.0))
    return Ok(x)
"#;
    insta::assert_snapshot!(transpile(source));
}

#[test]
fn test_list_operations() {
    let source = r#"
def make_list() -> list[int]:
    items = [1, 2, 3]
    items.append(4)
    return items
"#;
    insta::assert_snapshot!(transpile(source));
}

#[test]
fn test_string_methods() {
    let source = r#"
def process(s: str) -> str:
    return s.upper()
"#;
    insta::assert_snapshot!(transpile(source));
}

#[test]
fn test_pydantic_validator() {
    let source = r#"
from pydantic import BaseModel, field_validator

class Email(BaseModel):
    address: str

    @field_validator("address")
    @classmethod
    def must_contain_at(cls, v: str) -> str:
        if "@" not in v:
            raise ValueError("must contain @")
        return v
"#;
    insta::assert_snapshot!(transpile(source));
}

#[test]
fn test_if_else() {
    let source = r#"
def classify(n: int) -> str:
    if n > 0:
        return "positive"
    else:
        return "non-positive"
"#;
    insta::assert_snapshot!(transpile(source));
}

#[test]
fn test_async_function() {
    let source = r#"
async def fetch(url: str) -> str:
    response = await get(url)
    return response
"#;
    insta::assert_snapshot!(transpile(source));
}
