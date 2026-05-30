use super::expr::{generate_expr, generate_expr_owned};
use super::types::to_rust_type;
use crate::ast::*;

pub fn generate_statement(
    stmt: &Statement,
    indent: usize,
    validator_field: Option<&str>,
) -> String {
    let pad = "    ".repeat(indent);

    match stmt {
        Statement::Let {
            name,
            annotation,
            value,
            mutable,
        } => {
            let mut_kw = if *mutable { "mut " } else { "" };
            let ty = annotation
                .as_ref()
                .map(|a| format!(": {}", to_rust_type(a)))
                .unwrap_or_default();
            format!(
                "{pad}let {mut_kw}{name}{ty} = {};\n",
                generate_expr_owned(value)
            )
        }
        Statement::Assign { target, value } => {
            format!(
                "{pad}{} = {};\n",
                generate_expr(target),
                generate_expr_owned(value)
            )
        }
        Statement::Return(Some(expr)) => {
            format!("{pad}return {};\n", generate_expr_owned(expr))
        }
        Statement::Return(None) => {
            format!("{pad}return;\n")
        }
        Statement::If {
            condition,
            then_body,
            elif_clauses,
            else_body,
        } => {
            let mut out = String::new();

            // In validator context, translate `if condition: raise ValueError(...)`
            // into Rust validation error returns
            if let Some(field_name) = validator_field
                && let Some(translated) =
                    try_translate_validator_if(condition, then_body, field_name, indent)
            {
                return translated;
            }

            out.push_str(&format!("{pad}if {} {{\n", generate_expr(condition)));
            for s in then_body {
                out.push_str(&generate_statement(s, indent + 1, validator_field));
            }
            out.push_str(&format!("{pad}}}"));

            for (cond, body) in elif_clauses {
                out.push_str(&format!(" else if {} {{\n", generate_expr(cond)));
                for s in body {
                    out.push_str(&generate_statement(s, indent + 1, validator_field));
                }
                out.push_str(&format!("{pad}}}"));
            }

            if let Some(else_stmts) = else_body {
                out.push_str(" else {\n");
                for s in else_stmts {
                    out.push_str(&generate_statement(s, indent + 1, validator_field));
                }
                out.push_str(&format!("{pad}}}"));
            }

            out.push('\n');
            out
        }
        Statement::While { condition, body } => {
            let mut out = String::new();
            out.push_str(&format!("{pad}while {} {{\n", generate_expr(condition)));
            for s in body {
                out.push_str(&generate_statement(s, indent + 1, validator_field));
            }
            out.push_str(&format!("{pad}}}\n"));
            out
        }
        Statement::For { target, iter, body } => {
            let mut out = String::new();
            out.push_str(&format!(
                "{pad}for {target} in {} {{\n",
                generate_expr(iter)
            ));
            for s in body {
                out.push_str(&generate_statement(s, indent + 1, validator_field));
            }
            out.push_str(&format!("{pad}}}\n"));
            out
        }
        Statement::Expr(expr) => {
            format!("{pad}{};\n", generate_expr(expr))
        }
        Statement::Pass => String::new(),
        Statement::Break => format!("{pad}break;\n"),
        Statement::Continue => format!("{pad}continue;\n"),
    }
}

fn try_translate_validator_if(
    condition: &Expr,
    then_body: &[Statement],
    field_name: &str,
    indent: usize,
) -> Option<String> {
    let pad = "    ".repeat(indent);

    for stmt in then_body {
        let msg = extract_raise_message(stmt);
        if let Some(msg) = msg {
            return Some(format!(
                "{pad}if {} {{\n{pad}    return Err(ValidationError::field(\"{field_name}\", \"{msg}\"));\n{pad}}}\n",
                generate_expr(condition),
            ));
        }
    }
    None
}

fn extract_raise_message(stmt: &Statement) -> Option<String> {
    if let Statement::Expr(Expr::Call(func, args)) = stmt
        && let Expr::Name(name) = func.as_ref()
        && name == "ValueError"
    {
        return Some(if let Some(Expr::StringLiteral(s)) = args.first() {
            s.clone()
        } else {
            "validation failed".to_string()
        });
    }
    None
}
