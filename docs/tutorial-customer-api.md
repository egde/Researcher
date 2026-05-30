# Tutorial: Building a REST API with Copperhead

This tutorial walks through building a complete Customer CRUD API using Copperhead. You'll write valid Python with Pydantic models and get a compiled Rust web server backed by SQLite.

**What you'll build:**
- A REST API with Create, Read, Update, Delete endpoints
- Pydantic models with field validation
- SQLite database storage (in-memory)
- JSON request/response handling

**What you'll learn:**
- Defining types with Pydantic `BaseModel`
- Using `Field()` constraints for validation
- Writing `@field_validator` custom validators
- Importing and using any Rust crate via `from copperhead.X import ...`
- How Copperhead maps each Python concept to Rust

## Prerequisites

- Copperhead compiler built (`cargo build --release` in the repo root)
- Basic Python knowledge
- No Rust knowledge required (that's the point)

## Step 1: Create the Project

```bash
copperhead init customer-api
cd customer-api
```

This generates:

```
customer-api/
  copperhead.toml
  src/
    main.cu.py
```

Open `copperhead.toml` and set up the dependencies:

```toml
[project]
name = "customer-api"
version = "0.1.0"

[python]
requires = ["pydantic>=2.0"]

[dependencies]
actix-web = "4"
actix-rt = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
rusqlite = { version = "0.31", features = ["bundled"] }
uuid = { version = "1", features = ["v4"] }
tokio = { version = "1", features = ["full"] }
```

The `[dependencies]` section maps directly to Cargo.toml -- these are real Rust crates that the generated code will use. Copperhead doesn't hardcode knowledge of any crate; it uses **generic rules** to produce correct Rust for any dependency.

## Step 2: Define the Models

Create `src/models.cu.py`. This is where Pydantic shines -- you define your data types once and get validation on both the Python and Rust sides.

```python
# src/models.cu.py

from pydantic import BaseModel, Field, field_validator
from typing import Optional
from copperhead.serde import Serialize, Deserialize


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
```

Let's break down what each model does:

### CustomerCreate -- the input for creating a customer

```python
class CustomerCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    email: str
    phone: Optional[str] = None
```

- `name` has a `Field()` with length constraints. Copperhead turns these into runtime checks in the generated Rust constructor.
- `email` is a plain string, but the `@field_validator` below adds custom validation.
- `phone` is `Optional[str]` with a default of `None`. This becomes `Option<String>` in Rust.

### The email validator

```python
@field_validator("email")
@classmethod
def validate_email(cls, v: str) -> str:
    if "@" not in v:
        raise ValueError("invalid email address")
    return v
```

Copperhead translates this into validation logic inside the Rust constructor. The `raise ValueError(...)` becomes `return Err(ValidationError::field(...))`.

### The serde import

```python
from copperhead.serde import Serialize, Deserialize
```

This tells Copperhead that these models need JSON serialization. When this import is present, `BaseModel` structs get `#[derive(Serialize, Deserialize)]` in the generated Rust. The import itself becomes `use serde::{Serialize, Deserialize};`.

### See what Copperhead generates

Run the transpiler to see the Rust output:

```bash
copperhead transpile src/models.cu.py
```

Output:

```rust
use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
struct CustomerCreate {
    name: String,
    email: String,
    phone: Option<String>,
}

impl CustomerCreate {
    fn new(name: String, email: String) -> Result<Self, ValidationError> {
        if name.len() < 1 {
            return Err(ValidationError::field("name", "length must be >= 1"));
        }
        if name.len() > 100 {
            return Err(ValidationError::field("name", "length must be <= 100"));
        }
        if !email.contains(&"@") {
            return Err(ValidationError::field("email", "invalid email address"));
        }
        Ok(Self {
            name,
            email,
            phone: None,
        })
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct Customer {
    id: String,
    name: String,
    email: String,
    phone: Option<String>,
}

impl Customer {
    fn new(id: String, name: String, email: String) -> Self {
        Self {
            id,
            name,
            email,
            phone: None,
        }
    }
}

// ... CustomerUpdate and CustomerList follow the same pattern
```

Notice how:
- `from copperhead.serde import Serialize, Deserialize` became `use serde::{Serialize, Deserialize};` and added derive macros
- `Field(min_length=1, max_length=100)` became two `if` checks in `new()`
- `@field_validator` became an inline validation check
- `Optional[str] = None` became `Option<String>` with a default of `None`
- `list[Customer]` became `Vec<Customer>`
- Models without constraints get a simple constructor, while constrained models return `Result<Self, ValidationError>`

## Step 3: Write the Server

Create `src/main.cu.py`. This file contains the application state, database setup, route handlers, and entry point.

### Imports

```python
from pydantic import BaseModel
from copperhead.actix_web import web, App, HttpServer, HttpResponse
from copperhead.rusqlite import Connection, params
from copperhead.serde import Serialize, Deserialize
from copperhead.uuid import Uuid
from copperhead.std.sync import Mutex
```

Every `from copperhead.X import ...` statement becomes a Rust `use` statement. The naming follows a simple rule: `copperhead.` is stripped, dots become `::`:

| Python import | Rust `use` |
|---|---|
| `from copperhead.actix_web import web, App` | `use actix_web::{web, App};` |
| `from copperhead.rusqlite import Connection` | `use rusqlite::Connection;` |
| `from copperhead.std.sync import Mutex` | `use std::sync::Mutex;` |

### Application state

```python
class AppState:
    db: Mutex[Connection]
```

A plain class (not extending `BaseModel`) becomes a simple Rust struct without constructors or serde derives. `Mutex[Connection]` becomes `Mutex<Connection>` in Rust.

### Error response

```python
class ErrorResponse(BaseModel):
    error: str
```

This extends `BaseModel` so it gets `Serialize, Deserialize` derives, allowing it to be returned as JSON.

### Database initialization

```python
def init_db(conn: borrow[Connection]):
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS customers (...)"
    ).expect("Failed to create table")
```

The `borrow[Connection]` type annotation tells Copperhead to generate `conn: &Connection`. When `init_db` is called elsewhere, Copperhead automatically inserts `&` at the call site.

### Route handlers

Here's the full `list_customers` handler:

```python
async def list_customers(data: web.Data[AppState]) -> HttpResponse:
    db = data.db.lock().unwrap()
    customers: list[Customer] = db.prepare(
        "SELECT id, name, email, phone FROM customers"
    ).unwrap().query_map(
        [], lambda row: Ok(Customer(
            id=try_(row.get(0)),
            name=try_(row.get(1)),
            email=try_(row.get(2)),
            phone=try_(row.get(3))
        ))
    ).unwrap().filter_map(lambda r: r.ok()).collect()
    total = int(customers.len())
    return HttpResponse.Ok().json(CustomerList(customers=customers, total=total))
```

Key patterns at work:

- **`web.Data[AppState]`** -- `web` is an import alias from `copperhead.actix_web`, so the type becomes `web::Data<AppState>`
- **`HttpResponse.Ok()`** -- `HttpResponse` starts with uppercase, so `.` becomes `::` giving `HttpResponse::Ok()`
- **`Customer(id=..., name=...)`** -- keyword args to an uppercase name become a struct literal: `Customer { id: ..., name: ... }`
- **`lambda row: Ok(...)`** -- becomes a Rust closure: `|row| Ok(...)`
- **`try_(row.get(0))`** -- becomes the `?` operator: `row.get(0)?`
- **`params(id)`** -- `params` is a known macro imported from `copperhead.rusqlite`, so it becomes `rusqlite::params![id]`

### The CRUD handlers

```python
async def create_customer(
    data: web.Data[AppState],
    body: web.Json[CustomerCreate],
) -> HttpResponse:
    id = Uuid.new_v4().to_string()
    customer = Customer(
        id=id.clone(), name=body.name.clone(),
        email=body.email.clone(), phone=body.phone.clone(),
    )

    db = data.db.lock().unwrap()
    db.execute(
        "INSERT INTO customers (id, name, email, phone) VALUES (?1, ?2, ?3, ?4)",
        params(customer.id, customer.name, customer.email, customer.phone),
    ).unwrap()

    return HttpResponse.Created().json(customer)
```

- `Uuid.new_v4()` becomes `Uuid::new_v4()` (static method call)
- `params(...)` becomes `rusqlite::params![...]` (macro expansion)
- `HttpResponse.Created()` becomes `HttpResponse::Created()`

```python
async def update_customer(
    data: web.Data[AppState],
    path: web.Path[str],
    body: web.Json[CustomerUpdate],
) -> HttpResponse:
    id = path.into_inner()
    db = data.db.lock().unwrap()

    existing = db.query_row(...)

    if existing.is_err():
        return HttpResponse.NotFound().json(ErrorResponse(error="customer not found"))

    customer = existing.unwrap()
    if body.name.is_some():
        customer.name = body.name.clone().unwrap()
    if body.email.is_some():
        customer.email = body.email.clone().unwrap()
    if body.phone.is_some():
        customer.phone = body.phone.clone()

    db.execute(...)
    return HttpResponse.Ok().json(customer)
```

Notice that `customer` is assigned and later has its fields modified. Copperhead detects this pattern and automatically generates `let mut customer` in the Rust output.

### Entry point

```python
async def main():
    conn = Connection.open(":memory:").expect("Failed to open database")
    init_db(conn)

    data = web.Data.new(AppState(db=Mutex.new(conn)))

    print("Starting server at http://127.0.0.1:8080")

    server = HttpServer.new(lambda: App.new()
        .app_data(data.clone())
        .route("/customers", web.get().to(list_customers))
        .route("/customers", web.post().to(create_customer))
        .route("/customers/{id}", web.get().to(get_customer))
        .route("/customers/{id}", web.put().to(update_customer))
        .route("/customers/{id}", web.delete().to(delete_customer))
    )
    await try_(server.bind("127.0.0.1:8080")).run()
```

Several things happen automatically here:

- `Connection.open(...)` becomes `Connection::open(...)` (static call)
- `web.Data.new(...)` becomes `web::Data::new(...)` (chained module path)
- `AppState(db=Mutex.new(conn))` becomes `AppState { db: Mutex::new(conn) }` (struct init)
- `init_db(conn)` becomes `init_db(&conn)` (auto borrow insertion based on function signature)
- The lambda in `HttpServer.new(...)` gets a `move` keyword: `HttpServer::new(move || ...)`
- When Copperhead detects `actix_web` imports, `async def main()` becomes `#[actix_web::main] async fn main() -> std::io::Result<()>`
- `await try_(server.bind(...)).run()` becomes `server.bind(...)?.run().await`

## Step 4: Build and Run

```bash
copperhead build
```

This does three things:
1. Parses all `.cu.py` files in `src/`
2. Merges them into a single `main.rs` (imports first, then structs, then functions, main last)
3. Generates a `Cargo.toml` from `copperhead.toml` and runs `cargo build`

The output lands in `.copperhead/gen/`:

```
.copperhead/gen/
  Cargo.toml
  src/
    main.rs
```

To run the server:

```bash
copperhead run
```

The server starts at `http://127.0.0.1:8080`.

## Step 5: Test the API

Open another terminal and test with curl:

### Create a customer

```bash
curl -s -X POST http://127.0.0.1:8080/customers \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Alice Smith",
    "email": "alice@example.com",
    "phone": "+1-555-0101"
  }' | python3 -m json.tool
```

```json
{
    "id": "c1345bc5-d53c-46ef-a8a2-24c49e47b0a5",
    "name": "Alice Smith",
    "email": "alice@example.com",
    "phone": "+1-555-0101"
}
```

### Create another customer (without phone)

```bash
curl -s -X POST http://127.0.0.1:8080/customers \
  -H "Content-Type: application/json" \
  -d '{"name": "Bob Jones", "email": "bob@example.com"}' \
  | python3 -m json.tool
```

```json
{
    "id": "4e0f0228-57eb-4ef1-b16a-49a166f34d51",
    "name": "Bob Jones",
    "email": "bob@example.com",
    "phone": null
}
```

The `phone` field defaults to `null` (`None` in Rust) because it was declared as `Optional[str] = None`.

### List all customers

```bash
curl -s http://127.0.0.1:8080/customers | python3 -m json.tool
```

```json
{
    "customers": [
        {
            "id": "c1345bc5-...",
            "name": "Alice Smith",
            "email": "alice@example.com",
            "phone": "+1-555-0101"
        },
        {
            "id": "4e0f0228-...",
            "name": "Bob Jones",
            "email": "bob@example.com",
            "phone": null
        }
    ],
    "total": 2
}
```

### Get a single customer

```bash
curl -s http://127.0.0.1:8080/customers/<id> | python3 -m json.tool
```

### Update a customer

```bash
curl -s -X PUT http://127.0.0.1:8080/customers/<id> \
  -H "Content-Type: application/json" \
  -d '{"name": "Alice Johnson", "email": "alice.johnson@example.com"}' \
  | python3 -m json.tool
```

```json
{
    "id": "c1345bc5-...",
    "name": "Alice Johnson",
    "email": "alice.johnson@example.com",
    "phone": "+1-555-0101"
}
```

Only the fields you include in the request body are updated. The `phone` field stays unchanged because `CustomerUpdate` has all-`Optional` fields.

### Delete a customer

```bash
curl -s -o /dev/null -w "%{http_code}" \
  -X DELETE http://127.0.0.1:8080/customers/<id>
```

```
204
```

A successful delete returns HTTP 204 No Content.

### Nonexistent customer (404)

```bash
curl -s http://127.0.0.1:8080/customers/nonexistent-id \
  | python3 -m json.tool
```

```json
{
    "error": "customer not found"
}
```

## Step 6: Understanding the Transpilation Rules

Copperhead uses a set of **generic rules** to produce correct Rust from `.cu.py` files. It does not hardcode knowledge of specific crates -- the same rules work for Actix-web, rusqlite, or any other Rust library.

### The complete rule table

| Python pattern | Rust output | Rule |
|---|---|---|
| `from copperhead.X import A, B` | `use X::{A, B};` | **crate-import** |
| `from copperhead.X.Y import A` | `use X::Y::A;` | **nested-crate-import** |
| `Connection.open(x)` | `Connection::open(x)` | **static-method** (uppercase `.` becomes `::`) |
| `web.Data.new(x)` | `web::Data::new(x)` | **module-path** (import alias `.` becomes `::`) |
| `Customer(id=x, name=y)` | `Customer { id: x, name: y }` | **struct-init** (uppercase + kwargs) |
| `web.Data[T]` in type | `web::Data<T>` | **dotted-generic** |
| `Mutex[Connection]` in type | `Mutex<Connection>` | **generic-type** |
| `params(a, b, c)` | `rusqlite::params![a, b, c]` | **macro-import** |
| `lambda row: expr` | `\|row\| expr` | **lambda** |
| `try_(expr)` | `expr?` | **try-operator** |
| `borrow[T]` parameter | `&T` + auto `&` at call site | **borrow-insertion** |
| `x.field = val` after `x = ...` | `let mut x = ...` | **mutable-detection** |
| `async def main()` with actix imports | `#[actix_web::main] async fn main()` | **web-main** |
| `class Foo(BaseModel)` with serde | `#[derive(Serialize, Deserialize)]` | **serde-derives** |
| `class Foo:` (plain) | `#[derive(Debug)]` struct | **plain-class** |

### How module paths are resolved

The transpiler tracks which names are **import aliases** (came from `copperhead.*` imports). When such a name appears as the base of an attribute access:

- `web` imported from `copperhead.actix_web` -- `web.get()` becomes `web::get()`
- `data` is a local variable -- `data.db` stays as `data.db`

Names starting with an uppercase letter also trigger `::` resolution: `HttpResponse.Ok()` becomes `HttpResponse::Ok()`.

## Step 7: What the Generated Rust Looks Like

After running `copperhead build`, the merged output in `.copperhead/gen/src/main.rs` looks like this (reformatted for clarity):

```rust
use actix_web::{web, App, HttpServer, HttpResponse};
use rusqlite::Connection;
use serde::{Serialize, Deserialize};
use uuid::Uuid;
use std::sync::Mutex;

// -- Models (from models.cu.py) --

#[derive(Debug, Clone, Serialize, Deserialize)]
struct CustomerCreate {
    name: String,
    email: String,
    phone: Option<String>,
}

impl CustomerCreate {
    fn new(name: String, email: String) -> Result<Self, ValidationError> {
        if name.len() < 1 {
            return Err(ValidationError::field("name", "length must be >= 1"));
        }
        if name.len() > 100 {
            return Err(ValidationError::field("name", "length must be <= 100"));
        }
        if !email.contains(&"@") {
            return Err(ValidationError::field("email", "invalid email address"));
        }
        Ok(Self { name, email, phone: None })
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct Customer {
    id: String,
    name: String,
    email: String,
    phone: Option<String>,
}

// ... other model structs ...

#[derive(Debug)]
struct AppState {
    db: Mutex<Connection>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ErrorResponse {
    error: String,
}

// -- Handlers (from main.cu.py) --

fn init_db(conn: &Connection) {
    conn.execute_batch("CREATE TABLE IF NOT EXISTS customers (...)").expect("Failed to create table");
}

async fn list_customers(data: web::Data<AppState>) -> HttpResponse {
    let db = data.db.lock().unwrap();
    let customers: Vec<Customer> = db.prepare("SELECT id, name, email, phone FROM customers")
        .unwrap()
        .query_map([], |row| Ok(Customer {
            id: row.get(0)?,
            name: row.get(1)?,
            email: row.get(2)?,
            phone: row.get(3)?,
        }))
        .unwrap()
        .filter_map(|r| r.ok())
        .collect();
    let total = customers.len() as i64;
    return HttpResponse::Ok().json(CustomerList { customers, total });
}

async fn create_customer(
    data: web::Data<AppState>,
    body: web::Json<CustomerCreate>,
) -> HttpResponse {
    let id = Uuid::new_v4().to_string();
    let customer = Customer {
        id: id.clone(),
        name: body.name.clone(),
        email: body.email.clone(),
        phone: body.phone.clone(),
    };
    let db = data.db.lock().unwrap();
    db.execute(
        "INSERT INTO customers (id, name, email, phone) VALUES (?1, ?2, ?3, ?4)",
        rusqlite::params![customer.id, customer.name, customer.email, customer.phone],
    ).unwrap();
    return HttpResponse::Created().json(customer);
}

// ... get_customer, update_customer, delete_customer follow the same pattern ...

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let conn = Connection::open(":memory:").expect("Failed to open database");
    init_db(&conn);
    let data = web::Data::new(AppState { db: Mutex::new(conn) });
    println!("{}", "Starting server at http://127.0.0.1:8080");
    HttpServer::new(move || App::new()
        .app_data(data.clone())
        .route("/customers", web::get().to(list_customers))
        .route("/customers", web::post().to(create_customer))
        .route("/customers/{id}", web::get().to(get_customer))
        .route("/customers/{id}", web::put().to(update_customer))
        .route("/customers/{id}", web::delete().to(delete_customer))
    )
    .bind("127.0.0.1:8080")?
    .run()
    .await;
    Ok(())
}
```

## How It All Connects

Here's a summary of how each Python concept maps to the final Rust API:

| You write (Python) | Copperhead generates (Rust) |
|---|---|
| `from copperhead.actix_web import web` | `use actix_web::web;` |
| `class Customer(BaseModel)` | `struct Customer { ... }` with `#[derive(Serialize, Deserialize)]` |
| `class AppState:` (no BaseModel) | `struct AppState { ... }` with `#[derive(Debug)]` only |
| `name: str = Field(min_length=1)` | `if name.len() < 1 { return Err(...) }` in constructor |
| `@field_validator("email")` | Inline validation in the constructor |
| `Optional[str] = None` | `phone: Option<String>` excluded from required params |
| `list[Customer]` | `Vec<Customer>` |
| `web.Data[AppState]` | `web::Data<AppState>` |
| `HttpResponse.Ok()` | `HttpResponse::Ok()` |
| `Customer(id=x, name=y)` | `Customer { id: x, name: y }` |
| `params(a, b)` | `rusqlite::params![a, b]` |
| `lambda row: Ok(...)` | `\|row\| Ok(...)` |
| `try_(expr)` | `expr?` |
| `borrow[Connection]` | `&Connection` + auto `&` at call site |
| `async def main()` | `#[actix_web::main] async fn main() -> std::io::Result<()>` |

## Next Steps

- Add more models (orders, products) following the same `BaseModel` pattern
- Switch from in-memory SQLite to a file (`"customers.db"` instead of `":memory:"`)
- Add authentication middleware
- Use any Rust crate -- just add it to `[dependencies]` in `copperhead.toml` and import with `from copperhead.X import ...`

## Full Source

The complete example is in the repository at:

- **Copperhead source:** `examples/customer_api/src/models.cu.py` and `examples/customer_api/src/main.cu.py`
- **Generated Rust:** run `copperhead build` in `examples/customer_api/` to see `.copperhead/gen/src/main.rs`
