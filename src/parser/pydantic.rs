use rustpython_parser::ast as py;

use crate::ast::types::Ownership;
use crate::ast::*;
use super::annotations::lower_type_annotation;
use super::{lower_body, lower_expr};

pub fn is_base_model(class: &py::StmtClassDef) -> bool {
    class.bases.iter().any(|base| match base {
        py::Expr::Name(n) => n.id.as_str() == "BaseModel",
        _ => false,
    })
}

pub fn lower_base_model(class: &py::StmtClassDef) -> StructDef {
    let mut fields = Vec::new();
    let mut validators = Vec::new();
    let mut methods = Vec::new();

    for stmt in &class.body {
        match stmt {
            py::Stmt::AnnAssign(ann) => {
                if let Some(field) = lower_field(ann) {
                    fields.push(field);
                }
            }
            py::Stmt::FunctionDef(f) => {
                if is_field_validator(f) {
                    if let Some(v) = lower_validator(f) {
                        validators.push(v);
                    }
                } else if f.name.as_str() != "__init__" {
                    if let Some(m) = lower_method(f) {
                        methods.push(m);
                    }
                }
            }
            _ => {}
        }
    }

    StructDef {
        name: class.name.to_string(),
        fields,
        validators,
        methods,
        span: SourceSpan { start: 0, end: 0 },
    }
}

fn lower_field(ann: &py::StmtAnnAssign) -> Option<FieldDef> {
    let name = match ann.target.as_ref() {
        py::Expr::Name(n) => n.id.to_string(),
        _ => return None,
    };

    let ty = lower_type_annotation(&ann.annotation);

    let (default, constraints) = match &ann.value {
        Some(val) => extract_field_info(val),
        None => (None, None),
    };

    Some(FieldDef {
        name,
        ty,
        default,
        constraints,
    })
}

fn extract_field_info(expr: &py::Expr) -> (Option<Expr>, Option<FieldConstraint>) {
    match expr {
        py::Expr::Call(call) => {
            if is_field_call(&call.func) {
                let constraints = extract_field_constraints(call);
                let default = extract_field_default(call);
                (default, Some(constraints))
            } else {
                (Some(lower_expr(expr)), None)
            }
        }
        _ => (Some(lower_expr(expr)), None),
    }
}

fn is_field_call(func: &py::Expr) -> bool {
    match func {
        py::Expr::Name(n) => n.id.as_str() == "Field",
        _ => false,
    }
}

fn extract_field_constraints(call: &py::ExprCall) -> FieldConstraint {
    let mut constraint = FieldConstraint {
        ge: None,
        le: None,
        gt: None,
        lt: None,
        min_length: None,
        max_length: None,
    };

    for kw in &call.keywords {
        if let Some(arg) = &kw.arg {
            let val = lower_expr(&kw.value);
            match arg.as_str() {
                "ge" => constraint.ge = Some(val),
                "le" => constraint.le = Some(val),
                "gt" => constraint.gt = Some(val),
                "lt" => constraint.lt = Some(val),
                "min_length" => constraint.min_length = Some(val),
                "max_length" => constraint.max_length = Some(val),
                _ => {}
            }
        }
    }

    constraint
}

fn extract_field_default(call: &py::ExprCall) -> Option<Expr> {
    if let Some(first) = call.args.first() {
        return Some(lower_expr(first));
    }

    for kw in &call.keywords {
        if let Some(arg) = &kw.arg {
            if arg.as_str() == "default" {
                return Some(lower_expr(&kw.value));
            }
        }
    }

    None
}

fn is_field_validator(f: &py::StmtFunctionDef) -> bool {
    f.decorator_list.iter().any(|d| match d {
        py::Expr::Call(call) => match call.func.as_ref() {
            py::Expr::Name(n) => n.id.as_str() == "field_validator",
            _ => false,
        },
        py::Expr::Name(n) => n.id.as_str() == "field_validator",
        _ => false,
    })
}

fn lower_validator(f: &py::StmtFunctionDef) -> Option<ValidatorDef> {
    let field_name = f
        .decorator_list
        .iter()
        .find_map(|d| {
            if let py::Expr::Call(call) = d {
                call.args.first().and_then(|a| {
                    if let py::Expr::Constant(c) = a {
                        if let py::Constant::Str(s) = &c.value {
                            return Some(s.clone());
                        }
                    }
                    None
                })
            } else {
                None
            }
        })?;

    let body = lower_body(&f.body);

    Some(ValidatorDef {
        field_name,
        method_name: f.name.to_string(),
        body,
    })
}

fn lower_method(f: &py::StmtFunctionDef) -> Option<MethodDef> {
    let self_ownership = extract_self_ownership(f);

    let mut params = Vec::new();
    for arg in f.args.args.iter().chain(f.args.posonlyargs.iter()) {
        let name = arg.def.arg.to_string();
        if name == "self" || name == "cls" {
            continue;
        }
        let annotation = arg.def.annotation.as_ref().map(|a| lower_type_annotation(a));
        let default = arg.default.as_ref().map(|d| lower_expr(d));
        params.push(Param {
            name,
            annotation,
            default,
        });
    }

    let return_type = f.returns.as_ref().map(|r| lower_type_annotation(r));
    let body = lower_body(&f.body);

    Some(MethodDef {
        name: f.name.to_string(),
        self_ownership,
        params,
        return_type,
        body,
    })
}

fn extract_self_ownership(f: &py::StmtFunctionDef) -> Ownership {
    if let Some(first) = f.args.args.first() {
        if first.def.arg.as_str() == "self" {
            if let Some(ann) = &first.def.annotation {
                if let py::Expr::Name(n) = ann.as_ref() {
                    return match n.id.as_str() {
                        "mut" => Ownership::MutBorrowed,
                        "borrow" => Ownership::Borrowed,
                        "own" => Ownership::Owned,
                        _ => Ownership::Borrowed,
                    };
                }
            }
        }
    }
    Ownership::Borrowed
}
