use std::fs;
use std::path::Path;

pub fn run(name: &str) -> Result<(), String> {
    let project_dir = Path::new(name);

    if project_dir.exists() {
        return Err(format!("Directory '{}' already exists", name));
    }

    fs::create_dir_all(project_dir.join("src"))
        .map_err(|e| format!("Failed to create directory: {e}"))?;

    let toml_content = format!(
        r#"[project]
name = "{name}"
version = "0.1.0"

[python]
requires = ["pydantic>=2.0"]

[dependencies]
"#
    );

    fs::write(project_dir.join("copperhead.toml"), toml_content)
        .map_err(|e| format!("Failed to write copperhead.toml: {e}"))?;

    let main_content = r#"from pydantic import BaseModel
from copperhead import own, borrow


class Greeting(BaseModel):
    message: str


def greet(name: borrow[str]) -> str:
    return f"Hello, {name}!"


def main():
    g = Greeting(message=greet("world"))
    print(g.message)
"#;

    fs::write(project_dir.join("src/main.cu.py"), main_content)
        .map_err(|e| format!("Failed to write main.cu.py: {e}"))?;

    println!("Created new Copperhead project '{name}'");
    println!();
    println!("  cd {name}");
    println!("  copperhead build");
    println!("  copperhead run");

    Ok(())
}
