use std::cell::RefCell;
use std::collections::{HashMap, HashSet};

use crate::ast::types::Ownership;
use crate::ast::*;

struct CodegenContext {
    import_aliases: HashMap<String, String>,
    known_macros: HashSet<String>,
    fn_signatures: HashMap<String, Vec<Ownership>>,
}

thread_local! {
    static CODEGEN_CTX: RefCell<CodegenContext> = RefCell::new(CodegenContext {
        import_aliases: HashMap::new(),
        known_macros: HashSet::new(),
        fn_signatures: HashMap::new(),
    });
}

pub fn set_codegen_context(module: &Module) {
    CODEGEN_CTX.with(|ctx| {
        let mut ctx = ctx.borrow_mut();
        ctx.import_aliases.clear();
        ctx.known_macros.clear();
        ctx.fn_signatures.clear();
        for alias in &module.import_aliases {
            ctx.import_aliases
                .insert(alias.name.clone(), alias.crate_path.clone());
        }
        ctx.known_macros.insert("params".to_string());
        for item in &module.items {
            if let Item::Function(f) = item {
                let ownerships: Vec<Ownership> = f
                    .params
                    .iter()
                    .map(|p| {
                        p.annotation
                            .as_ref()
                            .map(|a| a.ownership.clone())
                            .unwrap_or(Ownership::Owned)
                    })
                    .collect();
                ctx.fn_signatures.insert(f.name.clone(), ownerships);
            }
        }
    });
}

fn get_param_ownership(fn_name: &str, idx: usize) -> Option<Ownership> {
    CODEGEN_CTX.with(|ctx| {
        ctx.borrow()
            .fn_signatures
            .get(fn_name)
            .and_then(|sigs| sigs.get(idx).cloned())
    })
}

fn is_import_alias(name: &str) -> bool {
    CODEGEN_CTX.with(|ctx| ctx.borrow().import_aliases.contains_key(name))
}

fn get_macro_crate(name: &str) -> Option<String> {
    CODEGEN_CTX.with(|ctx| {
        let ctx = ctx.borrow();
        if ctx.known_macros.contains(name) {
            ctx.import_aliases.get(name).cloned()
        } else {
            None
        }
    })
}

fn is_module_path(expr: &Expr) -> bool {
    match expr {
        Expr::Name(n) => n.chars().next().is_some_and(|c| c.is_uppercase()) || is_import_alias(n),
        Expr::Attribute(obj, _) => is_module_path(obj),
        _ => false,
    }
}

pub fn generate_expr_owned(expr: &Expr) -> String {
    match expr {
        Expr::StringLiteral(s) => format!("\"{}\".to_string()", escape_string(s)),
        _ => generate_expr(expr),
    }
}

pub fn generate_expr(expr: &Expr) -> String {
    match expr {
        Expr::IntLiteral(i) => i.to_string(),
        Expr::FloatLiteral(f) => {
            let s = f.to_string();
            if s.contains('.') { s } else { format!("{s}.0") }
        }
        Expr::StringLiteral(s) => format!("\"{}\"", escape_string(s)),
        Expr::FStringLiteral(parts) => generate_fstring(parts),
        Expr::BoolLiteral(b) => b.to_string(),
        Expr::NoneLiteral => "None".to_string(),

        Expr::Name(name) => map_builtin_name(name),
        Expr::Attribute(obj, attr) => {
            let sep = if is_module_path(obj) { "::" } else { "." };
            format!("{}{sep}{}", generate_expr(obj), attr)
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
            if let Expr::Name(name) = func.as_ref()
                && let Some(crate_path) = get_macro_crate(name)
            {
                let arg_strs: Vec<String> = args.iter().map(generate_expr).collect();
                return format!("{}::{}![{}]", crate_path, name, arg_strs.join(", "));
            }
            let fn_name = if let Expr::Name(name) = func.as_ref() {
                Some(name.as_str())
            } else {
                None
            };
            let arg_strs: Vec<String> = args
                .iter()
                .enumerate()
                .map(|(i, arg)| {
                    let expr_str = generate_expr(arg);
                    if let Some(name) = fn_name {
                        match get_param_ownership(name, i) {
                            Some(Ownership::Borrowed) => format!("&{expr_str}"),
                            Some(Ownership::MutBorrowed) => format!("&mut {expr_str}"),
                            _ => expr_str,
                        }
                    } else {
                        expr_str
                    }
                })
                .collect();
            format!("{}({})", f, arg_strs.join(", "))
        }
        Expr::MethodCall(obj, method, args) => {
            let o = generate_expr(obj);
            let mapped = map_method_call(&o, method, args);
            if let Some(m) = mapped {
                return m;
            }
            let is_static = is_module_path(obj);
            let sep = if is_static { "::" } else { "." };
            let add_move = is_static && method == "new";
            let arg_strs: Vec<String> = args
                .iter()
                .map(|arg| {
                    if add_move && let Expr::Lambda(_, _) = arg {
                        let s = generate_expr(arg);
                        return format!("move {s}");
                    }
                    generate_expr(arg)
                })
                .collect();
            format!("{o}{sep}{method}({})", arg_strs.join(", "))
        }

        Expr::List(elts) => {
            if elts.is_empty() {
                "[]".to_string()
            } else {
                let items: Vec<String> = elts.iter().map(generate_expr).collect();
                format!("vec![{}]", items.join(", "))
            }
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

        Expr::StructInit { name, fields } => {
            let field_strs: Vec<String> = fields
                .iter()
                .map(|(k, v)| {
                    let val = generate_expr_owned(v);
                    if val == *k {
                        k.clone()
                    } else {
                        format!("{k}: {val}")
                    }
                })
                .collect();
            format!("{name} {{ {} }}", field_strs.join(", "))
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
        "len" => args
            .first()
            .map(|arg| format!("{}.len()", generate_expr(arg))),
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
        "int" => args
            .first()
            .map(|arg| format!("{} as i64", generate_expr(arg))),
        "float" => args
            .first()
            .map(|arg| format!("{} as f64", generate_expr(arg))),
        "str" => args
            .first()
            .map(|arg| format!("{}.to_string()", generate_expr(arg))),
        "abs" => args
            .first()
            .map(|arg| format!("{}.abs()", generate_expr(arg))),
        "enumerate" => args
            .first()
            .map(|arg| format!("{}.iter().enumerate()", generate_expr(arg))),
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
        "Err" | "Ok" | "Some" => {
            let arg_strs: Vec<String> = args.iter().map(generate_expr_owned).collect();
            Some(format!("{}({})", func, arg_strs.join(", ")))
        }
        _ => None,
    }
}

fn map_method_call(obj: &str, method: &str, args: &[Expr]) -> Option<String> {
    match method {
        "append" => args
            .first()
            .map(|arg| format!("{obj}.push({})", generate_expr(arg))),
        "pop" => {
            if args.is_empty() {
                Some(format!("{obj}.pop()"))
            } else {
                None
            }
        }
        "extend" => args
            .first()
            .map(|arg| format!("{obj}.extend({})", generate_expr(arg))),
        "upper" => Some(format!("{obj}.to_uppercase()")),
        "lower" => Some(format!("{obj}.to_lowercase()")),
        "strip" => Some(format!("{obj}.trim().to_string()")),
        "lstrip" => Some(format!("{obj}.trim_start().to_string()")),
        "rstrip" => Some(format!("{obj}.trim_end().to_string()")),
        "startswith" => args
            .first()
            .map(|arg| format!("{obj}.starts_with({})", generate_expr(arg))),
        "endswith" => args
            .first()
            .map(|arg| format!("{obj}.ends_with({})", generate_expr(arg))),
        "split" => {
            if let Some(arg) = args.first() {
                Some(format!(
                    "{obj}.split({}).collect::<Vec<&str>>()",
                    generate_expr(arg)
                ))
            } else {
                Some(format!("{obj}.split_whitespace().collect::<Vec<&str>>()"))
            }
        }
        "join" => args
            .first()
            .map(|arg| format!("{}.join({})", generate_expr(arg), obj)),
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
        "contains" | "__contains__" => args
            .first()
            .map(|arg| format!("{obj}.contains({})", generate_expr(arg))),
        "keys" => Some(format!("{obj}.keys()")),
        "values" => Some(format!("{obj}.values()")),
        "items" => Some(format!("{obj}.iter()")),
        "get" => args
            .first()
            .map(|arg| format!("{obj}.get({})", generate_expr(arg))),
        _ => None,
    }
}
