use colored::Colorize;

pub fn format_error(
    code: &str,
    message: &str,
    file: &str,
    line: usize,
    col: usize,
    source_line: &str,
    explanation: &str,
    rust_equivalent: &str,
    fix: &str,
) -> String {
    let mut out = String::new();

    out.push_str(&format!(
        "{}: {}\n",
        format!("error[{code}]").red().bold(),
        message.bold()
    ));
    out.push_str(&format!(
        "  {} {}:{}:{}\n",
        "-->".blue().bold(),
        file,
        line,
        col
    ));
    out.push_str(&format!("   {}\n", "|".blue().bold()));
    out.push_str(&format!(
        "{:>3} {} {}\n",
        line.to_string().blue().bold(),
        "|".blue().bold(),
        source_line
    ));
    out.push_str(&format!("   {}\n", "|".blue().bold()));

    if !explanation.is_empty() {
        out.push_str(&format!(
            "  {} {}\n",
            "=".blue().bold(),
            explanation
        ));
    }

    if !rust_equivalent.is_empty() {
        out.push_str(&format!(
            "\n  {} Rust equivalent:\n    {}\n",
            "=".blue().bold(),
            rust_equivalent
        ));
    }

    if !fix.is_empty() {
        out.push_str(&format!(
            "\n  {} Fix: {}\n",
            "=".blue().bold(),
            fix
        ));
    }

    out
}
