# Copperhead

A Python subset that compiles to Rust. Write valid Python with Pydantic models, get idiomatic Rust binaries.

Copperhead files (`.cu.py`) are **dual-target**: run them with CPython for rapid prototyping, then compile to Rust for production performance. Types are defined using **Pydantic `BaseModel`** -- the same library Python developers already know -- and ownership is expressed through `own[T]`, `borrow[T]`, `mut[T]` wrappers.

## Quick Start

```bash
# Build the compiler
cargo build --release

# Create a new project
./target/release/copperhead init my-project
cd my-project

# See the generated Rust
copperhead transpile src/main.cu.py

# Build and run
copperhead build
copperhead run
```

## Installation

Copperhead requires the Rust toolchain (rustc + cargo). Install from [rustup.rs](https://rustup.rs) if you don't have it.

```bash
git clone <this-repo>
cd copperhead
cargo build --release

# Optionally add to your PATH
cp target/release/copperhead ~/.local/bin/
```

## CLI Commands

| Command | Description |
|---------|-------------|
| `copperhead init <name>` | Create a new project with `copperhead.toml` + `src/main.cu.py` |
| `copperhead build` | Transpile all `.cu.py` to Rust, then `cargo build` |
| `copperhead run` | Build and run the binary |
| `copperhead check` | Type-check and ownership-check without compiling |
| `copperhead transpile <file>` | Output the generated Rust to stdout |

## Language Guide

### Functions and Basic Types

Copperhead maps Python types directly to Rust:

```python
# src/main.cu.py

def add(a: int, b: int) -> int:
    return a + b

def greet(name: str) -> str:
    return f"Hello, {name}!"

def main():
    result = add(2, 3)
    print(result)
    print(greet("world"))
```

**Compiles to:**

```rust
fn add(a: i64, b: i64) -> i64 {
    return a + b;
}

fn greet(name: String) -> String {
    return format!("Hello, {}!", name);
}

fn main() {
    let result = add(2, 3);
    println!("{}", result);
    println!("{}", greet("world".to_string()));
}
```

### Type Mapping

| Python | Rust |
|--------|------|
| `int` | `i64` |
| `float` | `f64` |
| `bool` | `bool` |
| `str` | `String` |
| `list[T]` | `Vec<T>` |
| `dict[K, V]` | `HashMap<K, V>` |
| `set[T]` | `HashSet<T>` |
| `Optional[T]` | `Option<T>` |
| `tuple[A, B]` | `(A, B)` |
| `Result[T, E]` | `Result<T, E>` |

### Structs with Pydantic

Every `BaseModel` subclass compiles to a Rust `struct`. Field constraints become validation logic in the constructor:

```python
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

class Company(BaseModel):
    name: str
    address: str
    ceo: Optional[str] = None
```

**Compiles to:**

```rust
#[derive(Debug, Clone)]
struct User {
    name: String,
    age: i64,
    email: String,
}

impl User {
    fn new(name: String, age: i64, email: String) -> Result<Self, ValidationError> {
        if age < 0 {
            return Err(ValidationError::field("age", "must be >= 0"));
        }
        if age > 150 {
            return Err(ValidationError::field("age", "must be <= 150"));
        }
        if !email.contains(&"@") {
            return Err(ValidationError::field("email", "must contain @"));
        }
        Ok(Self { name, age, email })
    }
}

#[derive(Debug, Clone)]
struct Company {
    name: String,
    address: String,
    ceo: Option<String>,
}

impl Company {
    fn new(name: String, address: String) -> Self {
        Self { name, address, ceo: None }
    }
}
```

### Ownership

Rust's ownership system is expressed through three wrappers imported from `copperhead`:

```python
from copperhead import own, borrow, mut

def consume(s: own[str]) -> str:     # Takes ownership (Rust: String)
    return s.upper()

def inspect(s: borrow[str]) -> int:  # Immutable borrow (Rust: &String)
    return len(s)

def modify(items: mut[list[int]]):   # Mutable borrow (Rust: &mut Vec<i64>)
    items.append(42)
```

**Compiles to:**

```rust
fn consume(s: String) -> String {
    return s.to_uppercase();
}

fn inspect(s: &String) -> i64 {
    return s.len();
}

fn modify(items: &mut Vec<i64>) {
    items.push(42);
}
```

When a function parameter uses `borrow[T]` or `mut[T]`, Copperhead automatically inserts `&` or `&mut` at call sites:

```python
def init_db(conn: borrow[Connection]):
    conn.execute_batch("CREATE TABLE ...").expect("Failed")

# At the call site, you write:
init_db(conn)

# Copperhead generates:
# init_db(&conn);
```

| Wrapper | Rust | When to use |
|---------|------|-------------|
| `own[T]` | `T` | Function takes full ownership of the value |
| `borrow[T]` | `&T` | Function only reads the value |
| `mut[T]` | `&mut T` | Function needs to modify the value |
| *(none)* | `T` | Default -- owned, inferred by the checker |

### Using Rust Crates

Any Rust crate declared in `copperhead.toml` can be imported and used. Copperhead applies **generic rules** -- it doesn't hardcode knowledge of any specific crate.

#### Importing

```python
from copperhead.actix_web import web, App, HttpServer, HttpResponse
from copperhead.rusqlite import Connection, params
from copperhead.std.sync import Mutex
```

The prefix `copperhead.` is stripped and dots become `::`:

```rust
use actix_web::{web, App, HttpServer, HttpResponse};
use rusqlite::Connection;
use std::sync::Mutex;
```

#### Static method calls

When a method is called on an uppercase name, `.` becomes `::`:

```python
conn = Connection.open(":memory:")     # → Connection::open(":memory:")
id = Uuid.new_v4().to_string()         # → Uuid::new_v4().to_string()
response = HttpResponse.Ok().json(obj) # → HttpResponse::Ok().json(obj)
```

Import aliases also trigger `::` resolution:

```python
from copperhead.actix_web import web
web.get().to(handler)                  # → web::get().to(handler)
web.Data.new(state)                    # → web::Data::new(state)
```

#### Struct initialization

Keyword arguments to an uppercase name produce a struct literal:

```python
customer = Customer(id=id, name=name, email=email)
# → Customer { id, name, email }

data = AppState(db=Mutex.new(conn))
# → AppState { db: Mutex::new(conn) }
```

When the field name matches the value, Copperhead uses Rust shorthand (`id` instead of `id: id`).

#### Generic types

Square brackets in type annotations become angle brackets:

```python
data: web.Data[AppState]    # → web::Data<AppState>
db: Mutex[Connection]       # → Mutex<Connection>
body: web.Json[Customer]    # → web::Json<Customer>
```

#### Macro calls

Certain imports are recognized as Rust macros (currently `params` from rusqlite). They generate `crate::name![args]`:

```python
from copperhead.rusqlite import params

db.execute("INSERT INTO ... VALUES (?1, ?2)", params(name, email))
# → db.execute("INSERT ...", rusqlite::params![name, email])
```

### Error Handling

Copperhead provides `Result` and `Option` types that map directly to Rust:

```python
from copperhead import Result, Ok, Err, Option, Some, None_

def divide(a: float, b: float) -> Result[float, str]:
    if b == 0.0:
        return Err("division by zero")
    return Ok(a / b)

def calculate() -> Result[float, str]:
    x = try_(divide(10.0, 3.0))    # ? operator
    return Ok(x)
```

### Control Flow

```python
# If/else
if n > 0:
    return "positive"
else:
    return "non-positive"

# While loops
while i < 10:
    i = i + 1

# For loops with range
for i in range(10):
    print(i)

for i in range(1, 100):
    print(i)
```

### Async Functions

```python
async def fetch(url: str) -> str:
    response = await get(url)
    return response
```

When Copperhead detects `actix_web` imports, `async def main()` automatically gets the `#[actix_web::main]` attribute and a `-> std::io::Result<()>` return type.

### Python Builtins Mapping

| Python | Rust |
|--------|------|
| `print(x)` | `println!("{}", x)` |
| `len(x)` | `x.len()` |
| `range(n)` | `0..n` |
| `range(a, b)` | `a..b` |
| `abs(x)` | `x.abs()` |
| `str(x)` | `x.to_string()` |
| `int(x)` | `x as i64` |
| `float(x)` | `x as f64` |
| `s.upper()` | `s.to_uppercase()` |
| `s.lower()` | `s.to_lowercase()` |
| `s.strip()` | `s.trim().to_string()` |
| `s.split(x)` | `s.split(x).collect::<Vec<&str>>()` |
| `s.startswith(x)` | `s.starts_with(x)` |
| `s.replace(a, b)` | `s.replace(a, b)` |
| `items.append(x)` | `items.push(x)` |
| `items.pop()` | `items.pop()` |
| `f"Hello, {name}!"` | `format!("Hello, {}!", name)` |

## Project Structure

A Copperhead project looks like this:

```
my-project/
  copperhead.toml       # Project config (like Cargo.toml)
  src/
    main.cu.py          # Entry point
    models.cu.py        # Pydantic models
```

### copperhead.toml

```toml
[project]
name = "my-app"
version = "0.1.0"

[python]
requires = ["pydantic>=2.0"]

[dependencies]
actix-web = "4"
serde = { version = "1", features = ["derive"] }
rusqlite = { version = "0.31", features = ["bundled"] }
```

The `[dependencies]` section maps directly to Cargo dependencies in the generated Rust project. Add any crate here and import it with `from copperhead.X import ...`.

### Multi-file builds

When you run `copperhead build`, all `.cu.py` files in `src/` are parsed and merged into a single `main.rs`:

1. Non-main files are processed first, then `main.cu.py`
2. Imports are deduplicated
3. Items are ordered: imports, then structs, then functions, then `main()`

The output goes to `.copperhead/gen/src/main.rs` alongside a generated `Cargo.toml`.

## Examples

The `examples/` directory contains working examples:

- **`hello.cu.py`** -- Hello world
- **`fibonacci.cu.py`** -- Fibonacci with loops
- **`ownership_demo.cu.py`** -- own/borrow/mut wrappers
- **`pydantic_models.cu.py`** -- BaseModel, Field, validators
- **`customer_api/`** -- Full CRUD web API (see [tutorial](docs/tutorial-customer-api.md))

Try any example:

```bash
copperhead transpile examples/hello.cu.py
copperhead transpile examples/pydantic_models.cu.py

# Build and run the full web API
cd examples/customer_api
copperhead build
copperhead run
```

## Tutorial

See [Building a REST API with Copperhead](docs/tutorial-customer-api.md) for a step-by-step guide to building a full CRUD API with Pydantic models, SQLite, and Actix-web.

## Architecture

```
.cu.py source --> Parser --> Copperhead AST --> Checker --> Codegen --> .rs output --> Cargo
                    |                            |                       |
                Python AST                  ownership +             idiomatic
              (rustpython-                 type validation          Rust code
               parser crate)                    |
                                         educational errors
```

The compiler is written in Rust and uses `rustpython-parser` to parse Python source into an AST, then lowers it to a Copperhead-specific AST that captures ownership semantics, Pydantic model structure, and crate import mappings. The codegen pass emits idiomatic Rust source code.

## License

MIT
