from pydantic import BaseModel
from copperhead.actix_web import web, App, HttpServer, HttpResponse
from copperhead.rusqlite import Connection, params
from copperhead.serde import Serialize, Deserialize
from copperhead.uuid import Uuid
from copperhead.std.sync import Mutex


class AppState:
    db: Mutex[Connection]


class ErrorResponse(BaseModel):
    error: str


def init_db(conn: borrow[Connection]):
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS customers (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL, phone TEXT)"
    ).expect("Failed to create table")


async def list_customers(data: web.Data[AppState]) -> HttpResponse:
    db = data.db.lock().unwrap()
    customers: list[Customer] = db.prepare("SELECT id, name, email, phone FROM customers").unwrap().query_map(
        [], lambda row: Ok(Customer(
            id=try_(row.get(0)),
            name=try_(row.get(1)),
            email=try_(row.get(2)),
            phone=try_(row.get(3))
        ))
    ).unwrap().filter_map(lambda r: r.ok()).collect()
    total = int(customers.len())
    return HttpResponse.Ok().json(CustomerList(customers=customers, total=total))


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


async def get_customer(
    data: web.Data[AppState],
    path: web.Path[str],
) -> HttpResponse:
    id = path.into_inner()
    db = data.db.lock().unwrap()
    result = db.query_row(
        "SELECT id, name, email, phone FROM customers WHERE id = ?1",
        params(id),
        lambda row: Ok(Customer(
            id=try_(row.get(0)), name=try_(row.get(1)),
            email=try_(row.get(2)), phone=try_(row.get(3)),
        )),
    )

    if result.is_ok():
        return HttpResponse.Ok().json(result.unwrap())
    else:
        return HttpResponse.NotFound().json(ErrorResponse(error="customer not found"))


async def update_customer(
    data: web.Data[AppState],
    path: web.Path[str],
    body: web.Json[CustomerUpdate],
) -> HttpResponse:
    id = path.into_inner()
    db = data.db.lock().unwrap()

    existing = db.query_row(
        "SELECT id, name, email, phone FROM customers WHERE id = ?1",
        params(id),
        lambda row: Ok(Customer(
            id=try_(row.get(0)), name=try_(row.get(1)),
            email=try_(row.get(2)), phone=try_(row.get(3)),
        )),
    )

    if existing.is_err():
        return HttpResponse.NotFound().json(ErrorResponse(error="customer not found"))

    customer = existing.unwrap()
    if body.name.is_some():
        customer.name = body.name.clone().unwrap()
    if body.email.is_some():
        customer.email = body.email.clone().unwrap()
    if body.phone.is_some():
        customer.phone = body.phone.clone()

    db.execute(
        "UPDATE customers SET name = ?1, email = ?2, phone = ?3 WHERE id = ?4",
        params(customer.name, customer.email, customer.phone, customer.id),
    ).unwrap()

    return HttpResponse.Ok().json(customer)


async def delete_customer(
    data: web.Data[AppState],
    path: web.Path[str],
) -> HttpResponse:
    id = path.into_inner()
    db = data.db.lock().unwrap()
    rows = db.execute(
        "DELETE FROM customers WHERE id = ?1",
        params(id),
    ).unwrap()

    if rows == 0:
        return HttpResponse.NotFound().json(ErrorResponse(error="customer not found"))
    else:
        return HttpResponse.NoContent().finish()


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
