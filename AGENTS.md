# Copperhead — Python-to-Rust Transpiler

A Rust project that compiles a strict Python subset (.cu.py files) to idiomatic Rust.

## Project Structure

- `src/main.rs` — CLI entry point (clap)
- `src/lib.rs` — Library root
- `src/cli/` — CLI commands (init, build, run, check, transpile)
- `src/parser/` — Python AST → Copperhead AST (uses rustpython-parser)
- `src/ast/` — Copperhead AST node types
- `src/checker/` — Type + ownership checker
- `src/codegen/` — Copperhead AST → Rust source code
- `src/errors/` — Educational error messages
- `examples/` — .cu.py example files

## Key Design Decisions

- Pydantic BaseModel subclasses are the standard way to define structs
- Ownership expressed via `own[T]`, `borrow[T]`, `mut[T]` type wrappers
- Files are valid Python (run with CPython) AND compile to Rust
