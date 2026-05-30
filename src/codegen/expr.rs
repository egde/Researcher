use crate::ast::*;

pub fn generate_expr(expr: &Expr) -> String {
    match expr {
        Expr::IntLiteral(i) => i.to_string(),
        Expr::FloatLiteral(f) => {
            let s = f.to_string();
            if s.contains('.') { s } else { format!("{s}.0") }
        }
        Expr::StringLiteral(s) => format!("\"{}\".to_string()", escape_string(s)),
        Expr::FStringLiteral(parts) => generate_fstring(parts),
        Expr::BoolLiteral(b) => b.to_string(),
        Expr::NoneLiteral => "None".to_string(),

        Expr::Name(name) => map_builtin_name(name),
        Expr::Attribute(obj, attr) => {
            format!("{}.{}", generate_expr(obj), attr)
        }
        Expr::Index(obj, idx) => {
            format!("{}[{}]", generate_expr(obj), generate_expr(idx))
        }

        Expr::BinOp(left, op, right) => {
            let l = generate_expr(left);
            let r = generate_expr(right);
            let op_str = match op {
                BinOp::Add => "+",
                BinOp::Sub => "-",
                BinOp::Mul => "*",
                BinOp::Div => "/",
                BinOp::FloorDiv => "/",
                BinOp::Mod => "%",
                BinOp::Pow => return format!("{l}.pow({r})"),
                BinOp::BitAnd => "&",
                BinOp::BitOr => "|",
                BinOp::BitXor => "^",
                BinOp::LShift => "<<",
                BinOp::RShift => ">>",
            };
            format!("{l} {op_str} {r}")
        }
        Expr::UnaryOp(op, operand) => {
            let o = generate_expr(operand);
            match op {
                UnaryOp::Neg => format!("-{o}"),
                UnaryOp::Not => format!("!{o}"),
                UnaryOp::BitNot => format!("!{o}"),
            }
        }
        Expr::Compare(left, op, right) => {
            let l = generate_expr(left);
            let r = generate_expr(right);
            let op_str = match op {
                CompareOp::Eq => "==",
                CompareOp::NotEq => "!=",
                CompareOp::Lt => "<",
                CompareOp::LtEq => "<=",
                CompareOp::Gt => ">",
                CompareOp::GtEq => ">=",
                CompareOp::In => return format!("{r}.contains(&{l})"),
                CompareOp::NotIn => return format!("!{r}.contains(&{l})"),
                CompareOp::Is => "==",
                CompareOp::IsNot => "!=",
            };
            format!("{l} {op_str} {r}")
        }
        Expr::BoolOp(left, op, right) => {
            let l = generate_expr(left);
            let r = generate_expr(right);
            let op_str = match op {
                BoolOp::And => "&&",
                BoolOp::Or => "||",
            };
            format!("{l} {op_str} {r}")
        }

        Expr::Call(func, args) => {
            let f = generate_expr(func);
            let mapped = map_builtin_call(&f, args);
            if let Some(m) = mapped {
                return m;
            }
            let arg_strs: Vec<String> = args.iter().map(generate_expr).collect();
            format!("{}({})", f, arg_strs.join(", "))
        }
        Expr::MethodCall(obj, method, args) => {
            let o = generate_expr(obj);
            let mapped = map_method_call(&o, method, args);
            if let Some(m) = mapped {
                return m;
            }
            let arg_strs: Vec<String> = args.iter().map(generate_expr).collect();
            format!("{o}.{method}({})", arg_strs.join(", "))
        }

        Expr::List(elts) => {
            let items: Vec<String> = elts.iter().map(generate_expr).collect();
            format!("vec![{}]", items.join(", "))
        }
        Expr::Dict(pairs) => {
            if pairs.is_empty() {
                "HashMap::new()".to_string()
            } else {
                let entries: Vec<String> = pairs
                    .iter()
                    .map(|(k, v)| format!("({}, {})", generate_expr(k), generate_expr(v)))
                    .collect();
                format!("HashMap::from([{}])", entries.join(", "))
            }
        }
        Expr::Tuple(elts) => {
            let items: Vec<String> = elts.iter().map(generate_expr).collect();
            format!("({})", items.join(", "))
        }

        Expr::Lambda(params, body) => {
            let param_strs: Vec<String> = params.iter().map(|p| p.name.clone()).collect();
            let b = generate_expr(body);
            format!("|{}| {}", param_strs.join(", "), b)
        }
        Expr::Await(inner) => {
            let i = generate_expr(inner);
            format!("{i}.await")
        }
        Expr::Try(inner) => {
            let i = generate_expr(inner);
            format!("{i}?")
        }
    }
}

fn generate_fstring(parts: &[FStringPart]) -> String {
    let mut fmt_str = String::new();
    let mut args = Vec::new();

    for part in parts {
        match part {
            FStringPart::Literal(s) => fmt_str.push_str(s),
            FStringPart::Expr(e) => {
                fmt_str.push_str("{}");
                args.push(generate_expr(e));
            }
        }
    }

    if args.is_empty() {
        format!("\"{fmt_str}\".to_string()")
    } else {
        format!("format!(\"{fmt_str}\", {})", args.join(", "))
    }
}

fn escape_string(s: &str) -> String {
    s.replace('\\', "\\\\")
        .replace('"', "\\\"")
        .replace('\n', "\\n")
        .replace('\r', "\\r")
        .replace('\t', "\\t")
}

fn map_builtin_name(name: &str) -> String {
    match name {
        "True" => "true".to_string(),
        "False" => "false".to_string(),
        "None_" => "None".to_string(),
        "Ok" => "Ok".to_string(),
        "Err" => "Err".to_string(),
        "Some" => "Some".to_string(),
        other => other.to_string(),
    }
}

fn map_builtin_call(func: &str, args: &[Expr]) -> Option<String> {
    match func {
        "print" => {
            let arg_strs: Vec<String> = args.iter().map(generate_expr).collect();
            if arg_strs.is_empty() {
                Some("println!()".to_string())
            } else {
                let placeholders = vec!["{}"; arg_strs.len()].join(" ");
                Some(format!(
                    "println!(\"{}\", {})",
                    placeholders,
                    arg_strs.join(", ")
                ))
            }
        }
        "len" => {
            if let Some(arg) = args.first() {
                Some(format!("{}.len()", generate_expr(arg)))
            } else {
                None
            }
        }
        "range" => match args.len() {
            1 => Some(format!("0..{}", generate_expr(&args[0]))),
            2 => Some(format!(
                "{}..{}",
                generate_expr(&args[0]),
                generate_expr(&args[1])
            )),
            3 => Some(format!(
                "({}..{}).step_by({} as usize)",
                generate_expr(&args[0]),
                generate_expr(&args[1]),
                generate_expr(&args[2])
            )),
            _ => None,
        },
        "int" => {
            if let Some(arg) = args.first() {
                Some(format!("{} as i64", generate_expr(arg)))
            } else {
                None
            }
        }
        "float" => {
            if let Some(arg) = args.first() {
                Some(format!("{} as f64", generate_expr(arg)))
            } else {
                None
            }
        }
        "str" => {
            if let Some(arg) = args.first() {
                Some(format!("{}.to_string()", generate_expr(arg)))
            } else {
                None
            }
        }
        "abs" => {
            if let Some(arg) = args.first() {
                Some(format!("{}.abs()", generate_expr(arg)))
            } else {
                None
            }
        }
        "enumerate" => {
            if let Some(arg) = args.first() {
                Some(format!("{}.iter().enumerate()", generate_expr(arg)))
            } else {
                None
            }
        }
        "zip" => {
            if args.len() == 2 {
                Some(format!(
                    "{}.iter().zip({}.iter())",
                    generate_expr(&args[0]),
                    generate_expr(&args[1])
                ))
            } else {
                None
            }
        }
        "isinstance" => {
            // No direct Rust equivalent; leave as comment
            None
        }
        _ => None,
    }
}

fn map_method_call(obj: &str, method: &str, args: &[Expr]) -> Option<String> {
    match method {
        "append" => {
            if let Some(arg) = args.first() {
                Some(format!("{obj}.push({})", generate_expr(arg)))
            } else {
                None
            }
        }
        "pop" => {
            if args.is_empty() {
                Some(format!("{obj}.pop()"))
            } else {
                None
            }
        }
        "extend" => {
            if let Some(arg) = args.first() {
                Some(format!("{obj}.extend({})", generate_expr(arg)))
            } else {
                None
            }
        }
        "upper" => Some(format!("{obj}.to_uppercase()")),
        "lower" => Some(format!("{obj}.to_lowercase()")),
        "strip" => Some(format!("{obj}.trim().to_string()")),
        "lstrip" => Some(format!("{obj}.trim_start().to_string()")),
        "rstrip" => Some(format!("{obj}.trim_end().to_string()")),
        "startswith" => {
            if let Some(arg) = args.first() {
                Some(format!("{obj}.starts_with({})", generate_expr(arg)))
            } else {
                None
            }
        }
        "endswith" => {
            if let Some(arg) = args.first() {
                Some(format!("{obj}.ends_with({})", generate_expr(arg)))
            } else {
                None
            }
        }
        "split" => {
            if let Some(arg) = args.first() {
                Some(format!(
                    "{obj}.split({}).collect::<Vec<&str>>()",
                    generate_expr(arg)
                ))
            } else {
                Some(format!(
                    "{obj}.split_whitespace().collect::<Vec<&str>>()"
                ))
            }
        }
        "join" => {
            if let Some(arg) = args.first() {
                Some(format!("{}.join({})", generate_expr(arg), obj))
            } else {
                None
            }
        }
        "replace" => {
            if args.len() == 2 {
                Some(format!(
                    "{obj}.replace({}, {})",
                    generate_expr(&args[0]),
                    generate_expr(&args[1])
                ))
            } else {
                None
            }
        }
        "contains" | "__contains__" => {
            if let Some(arg) = args.first() {
                Some(format!("{obj}.contains({})", generate_expr(arg)))
            } else {
                None
            }
        }
        "keys" => Some(format!("{obj}.keys()")),
        "values" => Some(format!("{obj}.values()")),
        "items" => Some(format!("{obj}.iter()")),
        "get" => {
            if let Some(arg) = args.first() {
                Some(format!("{obj}.get({})", generate_expr(arg)))
            } else {
                None
            }
        }
        _ => None,
    }
}
