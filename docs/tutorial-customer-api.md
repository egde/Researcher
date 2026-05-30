# Tutorial: Building a REST API with Copperhead

This tutorial walks through building a complete Customer CRUD API using Copperhead. You'll write valid Python with Pydantic models and get a compiled Rust web server backed by SQLite.

**What you'll build:**
- A REST API with Create, Read, Update, Delete endpoints
- Pydantic models with field validation
- SQLite database storage
- JSON request/response handling

**What you'll learn:**
- Defining types with Pydantic `BaseModel`
- Using `Field()` constraints for validation
- Writing `@field_validator` custom validators
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

Open `copperhead.toml` and add the dependencies we need:

```toml
[project]
name = "customer-api"
version = "0.1.0"

[python]
requires = ["pydantic>=2.0"]

[dependencies]
actix-web = "4"
serde = { version = "1.0", features = ["derive"] }
rusqlite = { version = "0.31", features = ["bundled"] }
uuid = { version = "1", features = ["v4"] }
tokio = { version = "1", features = ["full"] }
```

The `[dependencies]` section maps directly to Cargo.toml -- these are real Rust crates that the generated code will use.

## Step 2: Define the Models

Create `src/models.cu.py`. This is where Pydantic shines -- you define your data types once and get validation on both the Python and Rust sides.

```python
# src/models.cu.py

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

### Customer -- the full entity (with ID)

```python
class Customer(BaseModel):
    id: str
    name: str
    email: str
    phone: Optional[str] = None
```

No constraints here -- this is the "read" model returned by the API.

### CustomerUpdate -- partial updates

```python
class CustomerUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
```

All fields are `Optional` because a PUT request only needs to include the fields being changed.

### CustomerList -- paginated response

```python
class CustomerList(BaseModel):
    customers: list[Customer]
    total: int
```

`list[Customer]` becomes `Vec<Customer>` in Rust.

### See what Copperhead generates

Run the transpiler to see the Rust output:

```bash
copperhead transpile src/models.cu.py
```

Output:

```rust
#[derive(Debug, Clone)]
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
        if !email.contains(&"@".to_string()) {
            return Err(ValidationError::field("email", "invalid email address"));
        }
        Ok(Self {
            name,
            email,
            phone: None,
        })
    }
}

#[derive(Debug, Clone)]
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

#[derive(Debug, Clone)]
struct CustomerUpdate {
    name: Option<String>,
    email: Option<String>,
    phone: Option<String>,
}

impl CustomerUpdate {
    fn new() -> Self {
        Self {
            name: None,
            email: None,
            phone: None,
        }
    }
}

#[derive(Debug, Clone)]
struct CustomerList {
    customers: Vec<Customer>,
    total: i64,
}

impl CustomerList {
    fn new(customers: Vec<Customer>, total: i64) -> Self {
        Self {
            customers,
            total,
        }
    }
}
```

Notice how:
- `Field(min_length=1, max_length=100)` became two `if` checks in `new()`
- `@field_validator` became an inline validation check
- `Optional[str] = None` became `Option<String>` with a default of `None`
- `list[Customer]` became `Vec<Customer>`
- Models without constraints get a simple constructor, while constrained models return `Result<Self, ValidationError>`

## Step 3: Understand the Pydantic-to-Rust Mapping

Here's the complete mapping table for reference:

| Pydantic (Python) | Rust Output |
|---|---|
| `class Foo(BaseModel)` | `struct Foo { ... }` |
| `field: int` | `field: i64` |
| `field: str` | `field: String` |
| `field: float` | `field: f64` |
| `field: bool` | `field: bool` |
| `field: Optional[T]` | `field: Option<T>` |
| `field: list[T]` | `field: Vec<T>` |
| `field: dict[K, V]` | `field: HashMap<K, V>` |
| `Field(default=x)` | field with default value in constructor |
| `Field(ge=0, le=100)` | validation checks in `new()` |
| `Field(min_length=1)` | `.len()` check in `new()` |
| `@field_validator` | validation logic inlined in `new()` |
| `Optional[T] = None` | `Option<T>` field, excluded from constructor params |
| Nested `BaseModel` | Owned nested struct field |

## Step 4: Build the Route Handlers

Create `src/routes.cu.py`. This defines the API endpoints using Copperhead's web framework integration:

```python
# src/routes.cu.py

from copperhead import async_fn, borrow, mut, own, Result, Ok, Err
import copperhead.actix_web as web
from models import Customer, CustomerCreate, CustomerUpdate, CustomerList


@async_fn
@web.get("/customers")
async def list_customers(db: borrow[web.Data[DbPool]]) -> web.Json[CustomerList]:
    customers = await db.query_all("SELECT * FROM customers")
    return web.Json(CustomerList(customers=customers, total=len(customers)))


@async_fn
@web.post("/customers")
async def create_customer(
    db: borrow[web.Data[DbPool]],
    body: web.Json[CustomerCreate],
) -> Result[web.Json[Customer], web.Error]:
    customer = await db.insert("customers", body.into_inner())
    return Ok(web.Json(customer))


@async_fn
@web.get("/customers/{id}")
async def get_customer(
    db: borrow[web.Data[DbPool]],
    path: web.Path[str],
) -> Result[web.Json[Customer], web.Error]:
    customer = await db.query_one(
        "SELECT * FROM customers WHERE id = $1",
        path.into_inner()
    )
    match customer:
        case Some(c):
            return Ok(web.Json(c))
        case None_:
            return Err(web.Error.not_found("customer not found"))


@async_fn
@web.put("/customers/{id}")
async def update_customer(
    db: borrow[web.Data[DbPool]],
    path: web.Path[str],
    body: web.Json[CustomerUpdate],
) -> Result[web.Json[Customer], web.Error]:
    updated = await db.update("customers", path.into_inner(), body.into_inner())
    return Ok(web.Json(updated))


@async_fn
@web.delete("/customers/{id}")
async def delete_customer(
    db: borrow[web.Data[DbPool]],
    path: web.Path[str],
) -> Result[web.HttpResponse, web.Error]:
    await db.delete("customers", path.into_inner())
    return Ok(web.HttpResponse.no_content())
```

Each route handler maps to an Actix-web async handler in Rust:

- `@web.get("/customers")` becomes `#[get("/customers")]` in Rust
- `web.Json[CustomerCreate]` becomes `web::Json<CustomerCreate>` (actix extractor)
- `web.Path[str]` becomes `web::Path<String>`
- `web.Data[DbPool]` becomes `web::Data<DbPool>` (shared application state)
- `Result[web.Json[Customer], web.Error]` becomes `Result<HttpResponse, Error>`

## Step 5: Write the Entry Point

Create `src/main.cu.py`:

```python
# src/main.cu.py

from copperhead import async_fn
import copperhead.actix_web as web
from routes import (
    list_customers,
    create_customer,
    get_customer,
    update_customer,
    delete_customer,
)


@async_fn
async def main():
    db = web.Data(DbPool.connect("sqlite://customers.db"))
    app = web.App()
    app.app_data(db)
    app.service(list_customers)
    app.service(create_customer)
    app.service(get_customer)
    app.service(update_customer)
    app.service(delete_customer)
    web.serve(app, "127.0.0.1:8080")
```

This sets up an Actix-web server on port 8080, connects to a SQLite database, and registers all the CRUD routes.

## Step 6: What the Generated Rust Looks Like

Here's the complete Rust server that Copperhead generates from the three `.cu.py` files above. This is what you'd see in `.copperhead/gen/src/main.rs` after running `copperhead build`:

```rust
use actix_web::{web, App, HttpServer, HttpResponse};
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use uuid::Uuid;

// ── Models (from models.cu.py) ──────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
struct CustomerCreate {
    name: String,
    email: String,
    phone: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct Customer {
    id: String,
    name: String,
    email: String,
    phone: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct CustomerUpdate {
    name: Option<String>,
    email: Option<String>,
    phone: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct CustomerList {
    customers: Vec<Customer>,
    total: i64,
}

#[derive(Debug, Serialize)]
struct ValidationError {
    field: String,
    message: String,
}

#[derive(Debug, Serialize)]
struct ErrorResponse {
    error: String,
}

// ── Validation (from Field() + @field_validator) ────────────────────────

impl CustomerCreate {
    fn validate(&self) -> Result<(), ValidationError> {
        if self.name.is_empty() {
            return Err(ValidationError {
                field: "name".to_string(),
                message: "length must be >= 1".to_string(),
            });
        }
        if self.name.len() > 100 {
            return Err(ValidationError {
                field: "name".to_string(),
                message: "length must be <= 100".to_string(),
            });
        }
        if !self.email.contains('@') {
            return Err(ValidationError {
                field: "email".to_string(),
                message: "invalid email address".to_string(),
            });
        }
        Ok(())
    }
}

// ── Database ────────────────────────────────────────────────────────────

struct AppState {
    db: Mutex<Connection>,
}

fn init_db(conn: &Connection) {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS customers (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT NOT NULL,
            phone TEXT
        )"
    ).expect("Failed to create table");
}

// ── Route handlers (from routes.cu.py) ──────────────────────────────────

async fn list_customers(data: web::Data<AppState>) -> HttpResponse {
    let db = data.db.lock().unwrap();
    let mut stmt = db
        .prepare("SELECT id, name, email, phone FROM customers")
        .unwrap();
    let customers: Vec<Customer> = stmt
        .query_map([], |row| {
            Ok(Customer {
                id: row.get(0)?,
                name: row.get(1)?,
                email: row.get(2)?,
                phone: row.get(3)?,
            })
        })
        .unwrap()
        .filter_map(|r| r.ok())
        .collect();
    let total = customers.len() as i64;
    HttpResponse::Ok().json(CustomerList { customers, total })
}

async fn create_customer(
    data: web::Data<AppState>,
    body: web::Json<CustomerCreate>,
) -> HttpResponse {
    if let Err(e) = body.validate() {
        return HttpResponse::BadRequest().json(e);
    }

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
        rusqlite::params![
            customer.id, customer.name, customer.email, customer.phone
        ],
    ).unwrap();

    HttpResponse::Created().json(customer)
}

async fn get_customer(
    data: web::Data<AppState>,
    path: web::Path<String>,
) -> HttpResponse {
    let id = path.into_inner();
    let db = data.db.lock().unwrap();
    let result = db.query_row(
        "SELECT id, name, email, phone FROM customers WHERE id = ?1",
        rusqlite::params![id],
        |row| {
            Ok(Customer {
                id: row.get(0)?,
                name: row.get(1)?,
                email: row.get(2)?,
                phone: row.get(3)?,
            })
        },
    );

    match result {
        Ok(customer) => HttpResponse::Ok().json(customer),
        Err(_) => HttpResponse::NotFound().json(ErrorResponse {
            error: "customer not found".to_string(),
        }),
    }
}

async fn update_customer(
    data: web::Data<AppState>,
    path: web::Path<String>,
    body: web::Json<CustomerUpdate>,
) -> HttpResponse {
    let id = path.into_inner();
    let db = data.db.lock().unwrap();

    let existing = db.query_row(
        "SELECT id, name, email, phone FROM customers WHERE id = ?1",
        rusqlite::params![id],
        |row| {
            Ok(Customer {
                id: row.get(0)?,
                name: row.get(1)?,
                email: row.get(2)?,
                phone: row.get(3)?,
            })
        },
    );

    match existing {
        Ok(mut customer) => {
            if let Some(ref name) = body.name {
                customer.name = name.clone();
            }
            if let Some(ref email) = body.email {
                customer.email = email.clone();
            }
            if body.phone.is_some() {
                customer.phone = body.phone.clone();
            }

            db.execute(
                "UPDATE customers SET name = ?1, email = ?2, phone = ?3 WHERE id = ?4",
                rusqlite::params![
                    customer.name, customer.email, customer.phone, customer.id
                ],
            ).unwrap();

            HttpResponse::Ok().json(customer)
        }
        Err(_) => HttpResponse::NotFound().json(ErrorResponse {
            error: "customer not found".to_string(),
        }),
    }
}

async fn delete_customer(
    data: web::Data<AppState>,
    path: web::Path<String>,
) -> HttpResponse {
    let id = path.into_inner();
    let db = data.db.lock().unwrap();
    let rows = db.execute(
        "DELETE FROM customers WHERE id = ?1",
        rusqlite::params![id],
    ).unwrap();

    if rows == 0 {
        HttpResponse::NotFound().json(ErrorResponse {
            error: "customer not found".to_string(),
        })
    } else {
        HttpResponse::NoContent().finish()
    }
}

// ── Main (from main.cu.py) ──────────────────────────────────────────────

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let conn = Connection::open(":memory:")
        .expect("Failed to open database");
    init_db(&conn);

    let data = web::Data::new(AppState {
        db: Mutex::new(conn),
    });

    println!("Starting server at http://127.0.0.1:8080");

    HttpServer::new(move || {
        App::new()
            .app_data(data.clone())
            .route("/customers", web::get().to(list_customers))
            .route("/customers", web::post().to(create_customer))
            .route("/customers/{id}", web::get().to(get_customer))
            .route("/customers/{id}", web::put().to(update_customer))
            .route("/customers/{id}", web::delete().to(delete_customer))
    })
    .bind("127.0.0.1:8080")?
    .run()
    .await
}
```

## Step 7: Build and Run

```bash
copperhead build
copperhead run
```

The server starts at `http://127.0.0.1:8080`.

## Step 8: Test the API

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

## Step 9: Test Validation

The Pydantic `Field()` constraints and `@field_validator` produce real validation errors:

### Empty name (violates `min_length=1`)

```bash
curl -s -X POST http://127.0.0.1:8080/customers \
  -H "Content-Type: application/json" \
  -d '{"name": "", "email": "test@example.com"}' \
  | python3 -m json.tool
```

```json
{
    "field": "name",
    "message": "length must be >= 1"
}
```

### Invalid email (violates `@field_validator`)

```bash
curl -s -X POST http://127.0.0.1:8080/customers \
  -H "Content-Type: application/json" \
  -d '{"name": "Test", "email": "not-an-email"}' \
  | python3 -m json.tool
```

```json
{
    "field": "email",
    "message": "invalid email address"
}
```

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

## How It All Connects

Here's a summary of how each Python concept maps to the final Rust API:

| You write (Python) | Copperhead generates (Rust) |
|---|---|
| `class CustomerCreate(BaseModel)` | `struct CustomerCreate { ... }` with `#[derive(Serialize, Deserialize)]` |
| `name: str = Field(min_length=1)` | `if self.name.is_empty() { return Err(...) }` |
| `@field_validator("email")` | Inline validation in the constructor |
| `Optional[str] = None` | `phone: Option<String>` excluded from required params |
| `list[Customer]` | `Vec<Customer>` |
| `@web.post("/customers")` | `web::post().to(create_customer)` route |
| `web.Json[CustomerCreate]` | `web::Json<CustomerCreate>` actix extractor |
| `web.Path[str]` | `web::Path<String>` path parameter |
| `DbPool.connect("sqlite://...")` | `Connection::open(...)` via rusqlite |

## Next Steps

- Add more models (orders, products) following the same `BaseModel` pattern
- Add authentication middleware
- Switch from in-memory SQLite to a file (`"customers.db"` instead of `":memory:"`)
- Use `copperhead graduate` to view the pure Rust equivalent of any `.cu.py` file
- Run `.cu.py` files directly with CPython + Pydantic for quick testing before compiling

## Full Source

The complete example is in the repository at:

- **Copperhead source:** `examples/customer_api/`
- **Generated Rust server:** `examples/customer_api_generated/`
