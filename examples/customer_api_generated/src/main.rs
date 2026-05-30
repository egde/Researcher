use actix_web::{web, App, HttpServer, HttpResponse};
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use uuid::Uuid;

// ── Models (generated from Pydantic BaseModel) ──────────────────────────

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

// ── Validation (generated from Field() constraints + @field_validator) ──

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

// ── Route handlers (generated from @web.get / @web.post / etc.) ─────────

async fn list_customers(data: web::Data<AppState>) -> HttpResponse {
    let db = data.db.lock().unwrap();
    let mut stmt = db.prepare("SELECT id, name, email, phone FROM customers").unwrap();
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
        rusqlite::params![customer.id, customer.name, customer.email, customer.phone],
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
                rusqlite::params![customer.name, customer.email, customer.phone, customer.id],
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

// ── Main (generated from copperhead main) ───────────────────────────────

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let conn = Connection::open(":memory:").expect("Failed to open database");
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
