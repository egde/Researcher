pub mod annotations;
pub mod pydantic;

use rustpython_parser::Parse;
use rustpython_parser::ast as py;

use crate::ast::*;

pub fn parse_module(source: &str, filename: &str) -> Result<Module, String> {
    let suite = py::Suite::parse(source, filename).map_err(|e| format!("Parse error: {e}"))?;

    let mut items = Vec::new();
    for stmt in suite {
        if let Some(item) = lower_stmt_to_item(&stmt) {
            items.push(item);
        }
    }

    Ok(Module {
        name: filename.to_string(),
        items,
    })
}

fn lower_stmt_to_item(stmt: &py::Stmt) -> Option<Item> {
    match stmt {
        py::Stmt::FunctionDef(f) => Some(Item::Function(lower_function(f, false))),
        py::Stmt::AsyncFunctionDef(f) => Some(Item::Function(lower_async_function(f))),
        py::Stmt::ClassDef(c) => {
            if pydantic::is_base_model(c) {
                Some(Item::Struct(pydantic::lower_base_model(c)))
            } else {
                None
            }
        }
        py::Stmt::ImportFrom(imp) => Some(Item::Import(lower_import_from(imp))),
        _ => None,
    }
}

fn lower_function(f: &py::StmtFunctionDef, is_async: bool) -> Function {
    let params = lower_params(&f.args);
    let return_type = f
        .returns
        .as_ref()
        .map(|r| annotations::lower_type_annotation(r));
    let body = lower_body(&f.body);

    Function {
        name: f.name.to_string(),
        params,
        return_type,
        body,
        is_async,
        span: SourceSpan { start: 0, end: 0 },
    }
}

fn lower_async_function(f: &py::StmtAsyncFunctionDef) -> Function {
    let params = lower_params(&f.args);
    let return_type = f
        .returns
        .as_ref()
        .map(|r| annotations::lower_type_annotation(r));
    let body = lower_body(&f.body);

    Function {
        name: f.name.to_string(),
        params,
        return_type,
        body,
        is_async: true,
        span: SourceSpan { start: 0, end: 0 },
    }
}

fn lower_params(args: &py::Arguments) -> Vec<Param> {
    let mut params = Vec::new();
    for arg in args.args.iter().chain(args.posonlyargs.iter()) {
        let name = arg.def.arg.to_string();
        if name == "self" || name == "cls" {
            continue;
        }
        let annotation = arg
            .def
            .annotation
            .as_ref()
            .map(|a| annotations::lower_type_annotation(a));
        let default = arg.default.as_ref().map(|d| lower_expr(d));
        params.push(Param {
            name,
            annotation,
            default,
        });
    }
    params
}

fn lower_import_from(imp: &py::StmtImportFrom) -> Import {
    let module = imp
        .module
        .as_ref()
        .map(|m| m.to_string())
        .unwrap_or_default();
    let names = imp.names.iter().map(|a| a.name.to_string()).collect();

    Import {
        module,
        names,
        span: SourceSpan { start: 0, end: 0 },
    }
}

pub fn lower_body(stmts: &[py::Stmt]) -> Vec<Statement> {
    stmts.iter().filter_map(lower_statement).collect()
}

fn lower_statement(stmt: &py::Stmt) -> Option<Statement> {
    match stmt {
        py::Stmt::Assign(a) => {
            if a.targets.len() == 1 {
                let target_expr = lower_expr(&a.targets[0]);
                let value = lower_expr(&a.value);
                match &target_expr {
                    Expr::Name(name) => Some(Statement::Let {
                        name: name.clone(),
                        annotation: None,
                        value,
                        mutable: false,
                    }),
                    _ => Some(Statement::Assign {
                        target: target_expr,
                        value,
                    }),
                }
            } else {
                None
            }
        }
        py::Stmt::AnnAssign(a) => {
            let name = match a.target.as_ref() {
                py::Expr::Name(n) => n.id.to_string(),
                _ => return None,
            };
            let annotation = Some(annotations::lower_type_annotation(&a.annotation));
            let value = a
                .value
                .as_ref()
                .map(|v| lower_expr(v))
                .unwrap_or(Expr::NoneLiteral);

            Some(Statement::Let {
                name,
                annotation,
                value,
                mutable: false,
            })
        }
        py::Stmt::Return(r) => {
            let value = r.value.as_ref().map(|v| lower_expr(v));
            Some(Statement::Return(value))
        }
        py::Stmt::If(i) => {
            let condition = lower_expr(&i.test);
            let then_body = lower_body(&i.body);
            let else_body = if i.orelse.is_empty() {
                None
            } else {
                Some(lower_body(&i.orelse))
            };
            Some(Statement::If {
                condition,
                then_body,
                elif_clauses: vec![],
                else_body,
            })
        }
        py::Stmt::While(w) => {
            let condition = lower_expr(&w.test);
            let body = lower_body(&w.body);
            Some(Statement::While { condition, body })
        }
        py::Stmt::For(f) => {
            let target = match f.target.as_ref() {
                py::Expr::Name(n) => n.id.to_string(),
                _ => return None,
            };
            let iter = lower_expr(&f.iter);
            let body = lower_body(&f.body);
            Some(Statement::For { target, iter, body })
        }
        py::Stmt::Raise(r) => r.exc.as_ref().map(|exc| Statement::Expr(lower_expr(exc))),
        py::Stmt::Expr(e) => Some(Statement::Expr(lower_expr(&e.value))),
        py::Stmt::Pass(_) => Some(Statement::Pass),
        py::Stmt::Break(_) => Some(Statement::Break),
        py::Stmt::Continue(_) => Some(Statement::Continue),
        _ => None,
    }
}

pub fn lower_expr(expr: &py::Expr) -> Expr {
    match expr {
        py::Expr::Constant(c) => match &c.value {
            py::Constant::Int(i) => {
                let val = i.to_string().parse::<i64>().unwrap_or(0);
                Expr::IntLiteral(val)
            }
            py::Constant::Float(f) => Expr::FloatLiteral(*f),
            py::Constant::Str(s) => Expr::StringLiteral(s.clone()),
            py::Constant::Bool(b) => Expr::BoolLiteral(*b),
            py::Constant::None => Expr::NoneLiteral,
            _ => Expr::NoneLiteral,
        },
        py::Expr::Name(n) => Expr::Name(n.id.to_string()),
        py::Expr::BinOp(b) => {
            let left = lower_expr(&b.left);
            let right = lower_expr(&b.right);
            let op = match b.op {
                py::Operator::Add => BinOp::Add,
                py::Operator::Sub => BinOp::Sub,
                py::Operator::Mult => BinOp::Mul,
                py::Operator::Div => BinOp::Div,
                py::Operator::FloorDiv => BinOp::FloorDiv,
                py::Operator::Mod => BinOp::Mod,
                py::Operator::Pow => BinOp::Pow,
                py::Operator::BitAnd => BinOp::BitAnd,
                py::Operator::BitOr => BinOp::BitOr,
                py::Operator::BitXor => BinOp::BitXor,
                py::Operator::LShift => BinOp::LShift,
                py::Operator::RShift => BinOp::RShift,
                py::Operator::MatMult => BinOp::Mul,
            };
            Expr::BinOp(Box::new(left), op, Box::new(right))
        }
        py::Expr::UnaryOp(u) => {
            let operand = lower_expr(&u.operand);
            let op = match u.op {
                py::UnaryOp::USub => UnaryOp::Neg,
                py::UnaryOp::Not => UnaryOp::Not,
                py::UnaryOp::Invert => UnaryOp::BitNot,
                py::UnaryOp::UAdd => return operand,
            };
            Expr::UnaryOp(op, Box::new(operand))
        }
        py::Expr::Compare(c) => {
            if c.ops.len() == 1 && c.comparators.len() == 1 {
                let left = lower_expr(&c.left);
                let right = lower_expr(&c.comparators[0]);
                let op = match c.ops[0] {
                    py::CmpOp::Eq => CompareOp::Eq,
                    py::CmpOp::NotEq => CompareOp::NotEq,
                    py::CmpOp::Lt => CompareOp::Lt,
                    py::CmpOp::LtE => CompareOp::LtEq,
                    py::CmpOp::Gt => CompareOp::Gt,
                    py::CmpOp::GtE => CompareOp::GtEq,
                    py::CmpOp::In => CompareOp::In,
                    py::CmpOp::NotIn => CompareOp::NotIn,
                    py::CmpOp::Is => CompareOp::Is,
                    py::CmpOp::IsNot => CompareOp::IsNot,
                };
                Expr::Compare(Box::new(left), op, Box::new(right))
            } else {
                Expr::BoolLiteral(true)
            }
        }
        py::Expr::BoolOp(b) => {
            let op = match b.op {
                py::BoolOp::And => BoolOp::And,
                py::BoolOp::Or => BoolOp::Or,
            };
            let mut exprs = b.values.iter().map(lower_expr);
            let first = exprs.next().unwrap_or(Expr::BoolLiteral(true));
            exprs.fold(first, |acc, e| Expr::BoolOp(Box::new(acc), op, Box::new(e)))
        }
        py::Expr::Call(c) => {
            let func = lower_expr(&c.func);
            let args: Vec<Expr> = c.args.iter().map(lower_expr).collect();

            match &func {
                Expr::Attribute(obj, method) => Expr::MethodCall(obj.clone(), method.clone(), args),
                Expr::Name(name) if name == "try_" => {
                    if let Some(inner) = args.into_iter().next() {
                        Expr::Try(Box::new(inner))
                    } else {
                        Expr::Call(Box::new(func), vec![])
                    }
                }
                _ => Expr::Call(Box::new(func), args),
            }
        }
        py::Expr::Attribute(a) => {
            let value = lower_expr(&a.value);
            Expr::Attribute(Box::new(value), a.attr.to_string())
        }
        py::Expr::Subscript(s) => {
            let value = lower_expr(&s.value);
            let slice = lower_expr(&s.slice);
            Expr::Index(Box::new(value), Box::new(slice))
        }
        py::Expr::List(l) => {
            let elts: Vec<Expr> = l.elts.iter().map(lower_expr).collect();
            Expr::List(elts)
        }
        py::Expr::Tuple(t) => {
            let elts: Vec<Expr> = t.elts.iter().map(lower_expr).collect();
            Expr::Tuple(elts)
        }
        py::Expr::Dict(d) => {
            let pairs: Vec<(Expr, Expr)> = d
                .keys
                .iter()
                .zip(d.values.iter())
                .filter_map(|(k, v)| k.as_ref().map(|key| (lower_expr(key), lower_expr(v))))
                .collect();
            Expr::Dict(pairs)
        }
        py::Expr::JoinedStr(j) => {
            let parts: Vec<FStringPart> = j
                .values
                .iter()
                .map(|v| match v {
                    py::Expr::Constant(c) => {
                        if let py::Constant::Str(s) = &c.value {
                            FStringPart::Literal(s.clone())
                        } else {
                            FStringPart::Literal(String::new())
                        }
                    }
                    py::Expr::FormattedValue(fv) => FStringPart::Expr(lower_expr(&fv.value)),
                    other => FStringPart::Expr(lower_expr(other)),
                })
                .collect();
            Expr::FStringLiteral(parts)
        }
        py::Expr::Await(a) => {
            let value = lower_expr(&a.value);
            Expr::Await(Box::new(value))
        }
        py::Expr::Lambda(l) => {
            let params = lower_params(&l.args);
            let body = lower_expr(&l.body);
            Expr::Lambda(params, Box::new(body))
        }
        py::Expr::IfExp(i) => {
            let test = lower_expr(&i.test);
            let body = lower_expr(&i.body);
            let orelse = lower_expr(&i.orelse);
            Expr::Call(
                Box::new(Expr::Name("__if_expr".into())),
                vec![test, body, orelse],
            )
        }
        _ => Expr::NoneLiteral,
    }
}
