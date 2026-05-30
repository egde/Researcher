pub mod expr;
pub mod stmt;
pub mod types;

use crate::ast::*;

pub fn generate_module(module: &Module) -> String {
    let mut out = String::new();

    for item in &module.items {
        match item {
            Item::Function(f) => {
                out.push_str(&generate_function(f, 0));
                out.push('\n');
            }
            Item::Struct(s) => {
                out.push_str(&generate_struct(s));
                out.push('\n');
            }
            Item::Import(_) => {}
        }
    }

    out
}

fn generate_struct(s: &StructDef) -> String {
    let mut out = String::new();

    let has_constraints = s.fields.iter().any(|f| f.constraints.is_some())
        || !s.validators.is_empty();

    out.push_str("#[derive(Debug, Clone)]\n");
    out.push_str(&format!("struct {} {{\n", s.name));

    for field in &s.fields {
        let rust_type = types::to_rust_type(&field.ty);
        out.push_str(&format!("    {}: {},\n", field.name, rust_type));
    }

    out.push_str("}\n\n");

    // Generate impl block
    if has_constraints || !s.fields.is_empty() {
        out.push_str(&format!("impl {} {{\n", s.name));

        if has_constraints {
            out.push_str(&generate_validated_constructor(s));
        } else {
            out.push_str(&generate_simple_constructor(s));
        }

        for method in &s.methods {
            out.push_str(&generate_method(method, 1));
        }

        out.push_str("}\n");
    }

    out
}

fn generate_simple_constructor(s: &StructDef) -> String {
    let mut out = String::new();
    let params: Vec<String> = s
        .fields
        .iter()
        .filter(|f| f.default.is_none())
        .map(|f| format!("{}: {}", f.name, types::to_rust_type(&f.ty)))
        .collect();

    out.push_str(&format!("    fn new({}) -> Self {{\n", params.join(", ")));
    out.push_str("        Self {\n");
    for field in &s.fields {
        if let Some(default) = &field.default {
            out.push_str(&format!(
                "            {}: {},\n",
                field.name,
                expr::generate_expr(default)
            ));
        } else {
            out.push_str(&format!("            {},\n", field.name));
        }
    }
    out.push_str("        }\n");
    out.push_str("    }\n");
    out
}

fn generate_validated_constructor(s: &StructDef) -> String {
    let mut out = String::new();

    let params: Vec<String> = s
        .fields
        .iter()
        .filter(|f| f.default.is_none())
        .map(|f| format!("{}: {}", f.name, types::to_rust_type(&f.ty)))
        .collect();

    out.push_str(&format!(
        "    fn new({}) -> Result<Self, ValidationError> {{\n",
        params.join(", ")
    ));

    for field in &s.fields {
        if let Some(constraints) = &field.constraints {
            out.push_str(&generate_constraint_checks(&field.name, constraints));
        }
    }

    for validator in &s.validators {
        out.push_str(&generate_validator_body(validator));
    }

    out.push_str("        Ok(Self {\n");
    for field in &s.fields {
        if let Some(default) = &field.default {
            out.push_str(&format!(
                "            {}: {},\n",
                field.name,
                expr::generate_expr(default)
            ));
        } else {
            out.push_str(&format!("            {},\n", field.name));
        }
    }
    out.push_str("        })\n");
    out.push_str("    }\n");
    out
}

fn generate_constraint_checks(field_name: &str, constraints: &FieldConstraint) -> String {
    let mut out = String::new();

    if let Some(ge) = &constraints.ge {
        out.push_str(&format!(
            "        if {field_name} < {} {{\n            return Err(ValidationError::field(\"{field_name}\", \"must be >= {}\"));\n        }}\n",
            expr::generate_expr(ge),
            expr::generate_expr(ge),
        ));
    }
    if let Some(le) = &constraints.le {
        out.push_str(&format!(
            "        if {field_name} > {} {{\n            return Err(ValidationError::field(\"{field_name}\", \"must be <= {}\"));\n        }}\n",
            expr::generate_expr(le),
            expr::generate_expr(le),
        ));
    }
    if let Some(gt) = &constraints.gt {
        out.push_str(&format!(
            "        if {field_name} <= {} {{\n            return Err(ValidationError::field(\"{field_name}\", \"must be > {}\"));\n        }}\n",
            expr::generate_expr(gt),
            expr::generate_expr(gt),
        ));
    }
    if let Some(lt) = &constraints.lt {
        out.push_str(&format!(
            "        if {field_name} >= {} {{\n            return Err(ValidationError::field(\"{field_name}\", \"must be < {}\"));\n        }}\n",
            expr::generate_expr(lt),
            expr::generate_expr(lt),
        ));
    }
    if let Some(min_len) = &constraints.min_length {
        out.push_str(&format!(
            "        if {field_name}.len() < {} {{\n            return Err(ValidationError::field(\"{field_name}\", \"length must be >= {}\"));\n        }}\n",
            expr::generate_expr(min_len),
            expr::generate_expr(min_len),
        ));
    }
    if let Some(max_len) = &constraints.max_length {
        out.push_str(&format!(
            "        if {field_name}.len() > {} {{\n            return Err(ValidationError::field(\"{field_name}\", \"length must be <= {}\"));\n        }}\n",
            expr::generate_expr(max_len),
            expr::generate_expr(max_len),
        ));
    }

    out
}

fn generate_validator_body(validator: &ValidatorDef) -> String {
    let mut out = String::new();
    let rewritten_body = rewrite_validator_param(&validator.body, &validator.field_name);
    for s in &rewritten_body {
        if let Statement::Return(_) = s {
            continue;
        }
        out.push_str(&stmt::generate_statement(s, 2, Some(&validator.field_name)));
    }
    out
}

fn rewrite_validator_param(stmts: &[Statement], field_name: &str) -> Vec<Statement> {
    stmts
        .iter()
        .map(|s| rewrite_stmt_names(s, field_name))
        .collect()
}

fn rewrite_stmt_names(stmt: &Statement, field_name: &str) -> Statement {
    match stmt {
        Statement::If {
            condition,
            then_body,
            elif_clauses,
            else_body,
        } => Statement::If {
            condition: rewrite_expr_validator_param(condition, field_name),
            then_body: rewrite_validator_param(then_body, field_name),
            elif_clauses: elif_clauses
                .iter()
                .map(|(c, b)| {
                    (
                        rewrite_expr_validator_param(c, field_name),
                        rewrite_validator_param(b, field_name),
                    )
                })
                .collect(),
            else_body: else_body
                .as_ref()
                .map(|b| rewrite_validator_param(b, field_name)),
        },
        Statement::Expr(e) => Statement::Expr(rewrite_expr_validator_param(e, field_name)),
        other => other.clone(),
    }
}

fn rewrite_expr_validator_param(expr: &Expr, field_name: &str) -> Expr {
    match expr {
        Expr::Name(n) if is_validator_param(n) => Expr::Name(field_name.to_string()),
        Expr::Compare(left, op, right) => Expr::Compare(
            Box::new(rewrite_expr_validator_param(left, field_name)),
            *op,
            Box::new(rewrite_expr_validator_param(right, field_name)),
        ),
        Expr::BoolOp(left, op, right) => Expr::BoolOp(
            Box::new(rewrite_expr_validator_param(left, field_name)),
            *op,
            Box::new(rewrite_expr_validator_param(right, field_name)),
        ),
        Expr::UnaryOp(op, operand) => Expr::UnaryOp(
            *op,
            Box::new(rewrite_expr_validator_param(operand, field_name)),
        ),
        Expr::Call(func, args) => Expr::Call(
            Box::new(rewrite_expr_validator_param(func, field_name)),
            args.iter()
                .map(|a| rewrite_expr_validator_param(a, field_name))
                .collect(),
        ),
        Expr::MethodCall(obj, method, args) => Expr::MethodCall(
            Box::new(rewrite_expr_validator_param(obj, field_name)),
            method.clone(),
            args.iter()
                .map(|a| rewrite_expr_validator_param(a, field_name))
                .collect(),
        ),
        other => other.clone(),
    }
}

fn is_validator_param(name: &str) -> bool {
    matches!(name, "v" | "value" | "val" | "cls")
}

fn generate_method(method: &MethodDef, indent: usize) -> String {
    let pad = "    ".repeat(indent);
    let mut out = String::new();

    let self_param = match method.self_ownership {
        crate::ast::types::Ownership::Owned => "self",
        crate::ast::types::Ownership::Borrowed => "&self",
        crate::ast::types::Ownership::MutBorrowed => "&mut self",
    };

    let params: Vec<String> = method
        .params
        .iter()
        .map(|p| {
            let ty = p
                .annotation
                .as_ref()
                .map(|a| types::to_rust_type(a))
                .unwrap_or_else(|| "/* unknown */".to_string());
            format!("{}: {}", p.name, ty)
        })
        .collect();

    let all_params = if params.is_empty() {
        self_param.to_string()
    } else {
        format!("{}, {}", self_param, params.join(", "))
    };

    let ret = method
        .return_type
        .as_ref()
        .map(|r| format!(" -> {}", types::to_rust_type(r)))
        .unwrap_or_default();

    out.push_str(&format!(
        "\n{pad}fn {}({}){} {{\n",
        method.name, all_params, ret
    ));

    for s in &method.body {
        out.push_str(&stmt::generate_statement(s, indent + 1, None));
    }

    out.push_str(&format!("{pad}}}\n"));
    out
}

pub fn generate_function(func: &Function, indent: usize) -> String {
    let pad = "    ".repeat(indent);
    let mut out = String::new();

    let params: Vec<String> = func
        .params
        .iter()
        .map(|p| {
            let ty = p
                .annotation
                .as_ref()
                .map(|a| types::to_rust_type(a))
                .unwrap_or_else(|| "/* unknown */".to_string());
            format!("{}: {}", p.name, ty)
        })
        .collect();

    let ret = func
        .return_type
        .as_ref()
        .map(|r| format!(" -> {}", types::to_rust_type(r)))
        .unwrap_or_default();

    let async_kw = if func.is_async { "async " } else { "" };

    out.push_str(&format!(
        "{pad}{async_kw}fn {}({}){} {{\n",
        func.name,
        params.join(", "),
        ret
    ));

    for s in &func.body {
        out.push_str(&stmt::generate_statement(s, indent + 1, None));
    }

    out.push_str(&format!("{pad}}}\n"));
    out
}
