# Copperhead -- Python-to-Rust Transpiler

A Rust CLI binary that compiles a strict Python subset (`.cu.py` files) to idiomatic Rust.

**GitHub repo:** `egde/copperhead` (renamed from `egde/Researcher`)

## Build & Test

```bash
cargo build              # build the compiler
cargo test               # run 27 insta snapshot tests
cargo fmt --check        # check formatting
cargo clippy -- -D warnings  # lint
```

## Project Structure

```
src/
├── main.rs                 # CLI entry point (clap)
├── lib.rs                  # Library root (re-exports all modules)
├── cli/
│   ├── mod.rs              # CLI command definitions (Commands enum)
│   ├── init.rs             # `copperhead init <name>` — scaffold new project
│   ├── build.rs            # `copperhead build` — multi-file merge + transpile + cargo build
│   ├── run.rs              # `copperhead run` — build + execute
│   ├── check.rs            # `copperhead check` — type/ownership check only
│   └── transpile.rs        # `copperhead transpile <file>` — print generated Rust
├── parser/
│   ├── mod.rs              # Python AST → Copperhead AST (uses rustpython-parser 0.4)
│   ├── annotations.rs      # Parse type annotations: own[T], borrow[T], mut[T], Optional, Result, dotted types (web.Data[T])
│   └── pydantic.rs         # Recognize BaseModel subclasses, Field() constraints, @field_validator
├── ast/
│   ├── mod.rs              # Copperhead AST nodes: Module, Item, Statement, Expr, StructDef, FieldDef, ImportAlias
│   └── types.rs            # CopperheadType enum + Ownership enum + TypeAnnotation
├── checker/                # Type + ownership checker (stub)
├── hir/                    # High-level IR (stub)
├── codegen/
│   ├── mod.rs              # Main codegen: structs, constructors, validators, methods, imports→use, web main, mutable detection
│   ├── expr.rs             # Expression codegen: builtins, string methods, f-strings, try_(), static methods, module paths, struct init, macros
│   ├── stmt.rs             # Statement codegen: let, assign, return, if, while, for, raise→ValidationError
│   └── types.rs            # TypeAnnotation → Rust type string with ownership
├── errors/                 # Educational error messages (stub)
└── mapping/                # Python→Rust stdlib mappings (stub)

tests/
├── codegen_tests.rs        # 27 snapshot tests (insta)
└── snapshots/              # .snap files for each test

examples/
├── hello.cu.py
├── fibonacci.cu.py
├── ownership_demo.cu.py
├── pydantic_models.cu.py
├── customer_api/           # Working CRUD API: models.cu.py + main.cu.py → compiles with `copperhead build`
│   ├── copperhead.toml
│   └── src/
│       ├── models.cu.py    # Pydantic models with Field() constraints and @field_validator
│       └── main.cu.py      # Actix-web handlers, rusqlite queries, server setup
└── customer_api_generated/ # Hand-written reference Rust output (for comparison)

docs/
└── tutorial-customer-api.md  # Step-by-step tutorial for building the customer API

.github/workflows/
├── ci.yml                  # Rust CI: fmt, clippy, test, build (on push/PR to main)
└── release.yml             # Multi-platform release: 4 binaries on tag push (v*)
```

## Key Design Decisions

- **Pydantic BaseModel** subclasses are the standard way to define structs (not custom decorators)
- **Ownership** expressed via `own[T]`, `borrow[T]`, `mut[T]` type wrappers
- `.cu.py` files are **dual-target**: valid Python (run with CPython) AND compile to Rust
- `Field()` constraints (ge, le, gt, lt, min_length, max_length) → Rust constructor validation
- `@field_validator` → inline validation logic in Rust `new()` method
- Validator parameter rewriting: Python validator params (v, value, val) → actual field name in generated Rust
- `raise ValueError(msg)` in validators → `return Err(ValidationError::field(...))`
- Edition 2024 — `gen` is a reserved keyword, avoid using it as a variable name

### Generic Crate Integration (v0.2.0)

The transpiler uses **generic rules** to produce correct Rust for any crate declared in `copperhead.toml`. No crate-specific knowledge is hardcoded.

- **`from copperhead.X import A, B`** → `use X::{A, B};` (crate imports)
- **Uppercase static calls**: `Connection.open(x)` → `Connection::open(x)` (`.` → `::` when receiver starts uppercase)
- **Import alias paths**: `web.get()` → `web::get()` (`.` → `::` when base is an import alias)
- **Struct init via kwargs**: `Customer(id=x, name=y)` → `Customer { id: x, name: y }` (uppercase name + keyword args)
- **Dotted types**: `web.Data[T]` → `web::Data<T>` in type annotations
- **Macro expansion**: `params(a, b)` → `rusqlite::params![a, b]` (known macros from imports)
- **Call-site borrow insertion**: if `fn foo(x: &T)`, then `foo(val)` → `foo(&val)` automatically
- **Mutable detection**: if a variable's field is assigned later, its `let` becomes `let mut`
- **Web main**: `async def main()` with actix imports → `#[actix_web::main]` + `-> std::io::Result<()>`
- **Serde derives**: BaseModel structs get `Serialize, Deserialize` when serde is imported
- **Plain classes**: non-BaseModel classes get only `#[derive(Debug)]`, no constructor
- **Thread-local CodegenContext**: stores import aliases, known macros, and function signatures for use during recursive expression codegen
- **Multi-file merging**: `copperhead build` merges all `.cu.py` ASTs into one `main.rs`, deduplicating imports, ordering: imports → structs → functions → main

## CI/CD

- **CI** runs on every push/PR to `main`: cargo fmt, clippy, test, build
- **Release** triggers on `v*` tag push, builds 4 platform binaries:
  - `copperhead-linux-x86_64` (native on ubuntu-latest)
  - `copperhead-linux-aarch64` (cross-compiled via `cross`)
  - `copperhead-macos-x86_64` (native on macos-latest)
  - `copperhead-macos-aarch64` (native on macos-latest)
- Release binaries are attached to a GitHub Release with auto-generated notes
- `[profile.release]` has `strip = true` and `lto = true` for small binaries

## Snapshot Tests

All 27 tests in `tests/codegen_tests.rs` use `insta::assert_snapshot!` with file-based snapshots.
To update snapshots: `cargo insta review`

Test coverage:
- **Core:** hello_world, function_with_types, fstring, for_range, while_loop, if_else, async_function
- **Ownership:** ownership_borrow, ownership_mut
- **Pydantic:** pydantic_basic_struct, pydantic_with_constraints, pydantic_optional_with_default, pydantic_validator
- **Error handling:** result_type, try_operator
- **Builtins:** list_operations, string_methods
- **Crate integration (v0.2.0):** static_method_call, struct_init_kwargs, import_to_use, plain_class, dotted_type, serde_derives, call_site_borrow, mutable_detection
- **End-to-end:** customer_api_models, customer_api_main
