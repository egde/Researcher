use super::build;

pub fn run() -> Result<(), String> {
    build::run()?;

    let gen_dir = find_gen_dir()?;

    println!("Running...\n");
    let status = std::process::Command::new("cargo")
        .arg("run")
        .current_dir(&gen_dir)
        .status()
        .map_err(|e| format!("Failed to run cargo: {e}"))?;

    if !status.success() {
        return Err("Execution failed".to_string());
    }

    Ok(())
}

fn find_gen_dir() -> Result<String, String> {
    let mut dir = std::env::current_dir()
        .map_err(|e| format!("Failed to get current directory: {e}"))?;

    loop {
        let output_dir = dir.join(".copperhead").join("gen");
        if output_dir.exists() {
            return Ok(output_dir.to_string_lossy().to_string());
        }
        if !dir.pop() {
            return Err(
                "No .copperhead/gen directory found. Run 'copperhead build' first.".to_string(),
            );
        }
    }
}
