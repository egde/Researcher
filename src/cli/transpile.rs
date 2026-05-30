use std::fs;

use crate::parser;
use crate::codegen;

pub fn run(file: &str) -> Result<(), String> {
    let source = fs::read_to_string(file)
        .map_err(|e| format!("Failed to read '{}': {}", file, e))?;

    let module = parser::parse_module(&source, file)?;
    let rust_code = codegen::generate_module(&module);

    println!("{rust_code}");
    Ok(())
}
