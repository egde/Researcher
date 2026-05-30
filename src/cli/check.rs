use std::fs;
use walkdir::WalkDir;

use crate::checker;
use crate::parser;

pub fn run() -> Result<(), String> {
    let src_dir = std::path::Path::new("src");
    if !src_dir.exists() {
        return Err("No src/ directory found".to_string());
    }

    let mut file_count = 0;
    let mut error_count = 0;

    for entry in WalkDir::new(src_dir).into_iter().filter_map(|e| e.ok()) {
        let path = entry.path();
        if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
            if !name.ends_with(".cu.py") {
                continue;
            }
        } else {
            continue;
        }

        let source = fs::read_to_string(path)
            .map_err(|e| format!("Failed to read {}: {e}", path.display()))?;

        let module = parser::parse_module(&source, &path.to_string_lossy())?;
        let errors = checker::check(&module);

        file_count += 1;
        error_count += errors.len();

        for err in &errors {
            eprintln!("{err}");
        }
    }

    if error_count > 0 {
        Err(format!(
            "Found {} error(s) in {} file(s)",
            error_count, file_count
        ))
    } else {
        println!("Checked {} file(s) — no errors", file_count);
        Ok(())
    }
}
