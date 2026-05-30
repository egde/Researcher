# Copperhead

A Python subset that compiles to Rust. Write valid Python with Pydantic models, get idiomatic Rust binaries.

## Quick Start

```bash
cargo build --release
./target/release/copperhead init my-project
cd my-project
copperhead build
copperhead run
```

## Usage

```bash
copperhead init <name>       # Create a new project
copperhead build             # Transpile + cargo build
copperhead run               # Build + run
copperhead check             # Type + ownership check
copperhead transpile <file>  # Output Rust to stdout
```

## Example

```python
# src/main.cu.py
from pydantic import BaseModel, Field

class User(BaseModel):
    name: str
    age: int = Field(ge=0, le=150)

def greet(user: User) -> str:
    return f"Hello, {user.name}!"

def main():
    u = User(name="Alice", age=30)
    print(greet(u))
```

Transpiles to:

```rust
#[derive(Debug, Clone)]
struct User {
    name: String,
    age: i64,
}

impl User {
    fn new(name: String, age: i64) -> Result<Self, ValidationError> {
        if age < 0 {
            return Err(ValidationError::field("age", "must be >= 0"));
        }
        if age > 150 {
            return Err(ValidationError::field("age", "must be <= 150"));
        }
        Ok(Self { name, age })
    }
}

fn greet(user: User) -> String {
    format!("Hello, {}!", user.name)
}

fn main() {
    let u = User::new("Alice".to_string(), 30);
    println!("{}", greet(u));
}
```
