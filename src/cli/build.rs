use std::fs;
use std::path::Path;
use std::process::Command;
use walkdir::WalkDir;

use crate::codegen;
use crate::parser;

pub fn run() -> Result<(), String> {
    let config = find_config()?;
    let project_dir = Path::new(&config).parent().ok_or("Invalid config path")?;

    let src_dir = project_dir.join("src");
    if !src_dir.exists() {
        return Err("No src/ directory found".to_string());
    }

    let gen_dir = project_dir.join(".copperhead").join("gen").join("src");
    fs::create_dir_all(&gen_dir).map_err(|e| format!("Failed to create output directory: {e}"))?;

    let mut sources = Vec::new();
    for entry in WalkDir::new(&src_dir).into_iter().filter_map(|e| e.ok()) {
        let path = entry.path();
        if path.extension().map(|e| e == "py").unwrap_or(false)
            && let Some(name) = path.file_name().and_then(|n| n.to_str())
            && name.ends_with(".cu.py")
        {
            sources.push(path.to_path_buf());
        }
    }

    if sources.is_empty() {
        return Err("No .cu.py files found in src/".to_string());
    }

    println!("Transpiling {} file(s)...", sources.len());

    // Parse all source files and merge into a single module
    let mut merged = crate::ast::Module {
        name: "main".to_string(),
        items: Vec::new(),
        import_aliases: Vec::new(),
    };

    // Sort: non-main files first, main.cu.py last
    sources.sort_by(|a, b| {
        let a_is_main = a
            .file_name()
            .map(|n| n.to_str().unwrap_or("").starts_with("main"))
            .unwrap_or(false);
        let b_is_main = b
            .file_name()
            .map(|n| n.to_str().unwrap_or("").starts_with("main"))
            .unwrap_or(false);
        a_is_main.cmp(&b_is_main)
    });

    for source_path in &sources {
        let source = fs::read_to_string(source_path)
            .map_err(|e| format!("Failed to read {}: {e}", source_path.display()))?;

        let module = parser::parse_module(&source, &source_path.to_string_lossy())?;

        // Merge imports (deduplicate by name)
        for alias in &module.import_aliases {
            if !merged.import_aliases.iter().any(|a| a.name == alias.name) {
                merged.import_aliases.push(alias.clone());
            }
        }

        // Merge items, deduplicating imports by module path
        for item in module.items {
            if let crate::ast::Item::Import(ref imp) = item {
                let already_exists = merged.items.iter().any(|existing| {
                    if let crate::ast::Item::Import(e) = existing {
                        e.module == imp.module
                    } else {
                        false
                    }
                });
                if already_exists {
                    continue;
                }
            }
            merged.items.push(item);
        }

        println!("  {}", source_path.display());
    }

    // Reorder: imports → structs → functions (main last)
    merged.items.sort_by_key(|item| match item {
        crate::ast::Item::Import(_) => 0,
        crate::ast::Item::Struct(_) => 1,
        crate::ast::Item::Function(f) if f.name == "main" => 3,
        crate::ast::Item::Function(_) => 2,
    });

    let rust_code = codegen::generate_module(&merged);
    let out_path = gen_dir.join("main.rs");
    fs::write(&out_path, &rust_code)
        .map_err(|e| format!("Failed to write {}: {e}", out_path.display()))?;

    println!("  → {}", out_path.display());

    // Generate Cargo.toml in .copperhead/gen/
    let cargo_toml = generate_cargo_toml(project_dir)?;
    fs::write(gen_dir.parent().unwrap().join("Cargo.toml"), cargo_toml)
        .map_err(|e| format!("Failed to write Cargo.toml: {e}"))?;

    println!("Building with Cargo...");
    let status = Command::new("cargo")
        .arg("build")
        .current_dir(gen_dir.parent().unwrap())
        .status()
        .map_err(|e| format!("Failed to run cargo: {e}"))?;

    if !status.success() {
        return Err("Cargo build failed".to_string());
    }

    println!("Build successful!");
    Ok(())
}

fn find_config() -> Result<String, String> {
    let mut dir =
        std::env::current_dir().map_err(|e| format!("Failed to get current directory: {e}"))?;

    loop {
        let config = dir.join("copperhead.toml");
        if config.exists() {
            return Ok(config.to_string_lossy().to_string());
        }
        if !dir.pop() {
            break;
        }
    }

    Err("No copperhead.toml found. Run 'copperhead init' first.".to_string())
}

fn generate_cargo_toml(project_dir: &Path) -> Result<String, String> {
    let config_path = project_dir.join("copperhead.toml");
    let config_str = fs::read_to_string(&config_path)
        .map_err(|e| format!("Failed to read copperhead.toml: {e}"))?;

    let config: toml::Value = config_str
        .parse()
        .map_err(|e| format!("Failed to parse copperhead.toml: {e}"))?;

    let name = config
        .get("project")
        .and_then(|p| p.get("name"))
        .and_then(|n| n.as_str())
        .unwrap_or("copperhead-project");

    let version = config
        .get("project")
        .and_then(|p| p.get("version"))
        .and_then(|v| v.as_str())
        .unwrap_or("0.1.0");

    let mut deps = String::new();
    if let Some(dep_table) = config.get("dependencies").and_then(|d| d.as_table()) {
        for (key, value) in dep_table {
            deps.push_str(&format!("{key} = {value}\n"));
        }
    }

    Ok(format!(
        r#"[package]
name = "{name}"
version = "{version}"
edition = "2024"

[dependencies]
{deps}"#
    ))
}
