use rustpython_parser::ast as py;

use crate::ast::types::{CopperheadType, Ownership, TypeAnnotation};

pub fn lower_type_annotation(expr: &py::Expr) -> TypeAnnotation {
    match expr {
        py::Expr::Subscript(s) => {
            if let Some(wrapper) = extract_ownership_wrapper(&s.value) {
                let inner = lower_copperhead_type(&s.slice);
                return TypeAnnotation {
                    ty: inner,
                    ownership: wrapper,
                };
            }
            let ty = lower_subscript_type(&s.value, &s.slice);
            TypeAnnotation {
                ty,
                ownership: Ownership::Owned,
            }
        }
        _ => {
            let ty = lower_copperhead_type(expr);
            TypeAnnotation {
                ty,
                ownership: Ownership::Owned,
            }
        }
    }
}

fn extract_ownership_wrapper(expr: &py::Expr) -> Option<Ownership> {
    match expr {
        py::Expr::Name(n) => match n.id.as_str() {
            "own" => Some(Ownership::Owned),
            "borrow" => Some(Ownership::Borrowed),
            "mut" => Some(Ownership::MutBorrowed),
            _ => None,
        },
        _ => None,
    }
}

fn lower_copperhead_type(expr: &py::Expr) -> CopperheadType {
    match expr {
        py::Expr::Name(n) => match n.id.as_str() {
            "int" => CopperheadType::Int,
            "float" => CopperheadType::Float,
            "bool" => CopperheadType::Bool,
            "str" => CopperheadType::Str,
            "None" => CopperheadType::None,
            "UUID" => CopperheadType::Uuid,
            other => CopperheadType::Named(other.to_string()),
        },
        py::Expr::Subscript(s) => lower_subscript_type(&s.value, &s.slice),
        py::Expr::Attribute(_) => {
            if let Some(dotted) = extract_dotted_type_name(expr) {
                CopperheadType::Named(dotted)
            } else {
                CopperheadType::Unknown
            }
        }
        py::Expr::Constant(c) => {
            if let py::Constant::None = &c.value {
                CopperheadType::None
            } else {
                CopperheadType::Unknown
            }
        }
        _ => CopperheadType::Unknown,
    }
}

fn extract_dotted_type_name(expr: &py::Expr) -> Option<String> {
    match expr {
        py::Expr::Name(n) => Some(n.id.to_string()),
        py::Expr::Attribute(a) => {
            let prefix = extract_dotted_type_name(&a.value)?;
            Some(format!("{}::{}", prefix, a.attr))
        }
        _ => None,
    }
}

fn lower_subscript_type(value: &py::Expr, slice: &py::Expr) -> CopperheadType {
    let type_name_owned;
    let type_name = match value {
        py::Expr::Name(n) => n.id.as_str(),
        py::Expr::Attribute(_) => {
            if let Some(dotted) = extract_dotted_type_name(value) {
                type_name_owned = dotted;
                type_name_owned.as_str()
            } else {
                return CopperheadType::Unknown;
            }
        }
        _ => return CopperheadType::Unknown,
    };

    match type_name {
        "list" => {
            let inner = lower_copperhead_type(slice);
            CopperheadType::List(Box::new(inner))
        }
        "dict" => {
            if let py::Expr::Tuple(t) = slice
                && t.elts.len() == 2
            {
                let key = lower_copperhead_type(&t.elts[0]);
                let val = lower_copperhead_type(&t.elts[1]);
                return CopperheadType::Dict(Box::new(key), Box::new(val));
            }
            CopperheadType::Dict(
                Box::new(CopperheadType::Unknown),
                Box::new(CopperheadType::Unknown),
            )
        }
        "set" => {
            let inner = lower_copperhead_type(slice);
            CopperheadType::Set(Box::new(inner))
        }
        "Optional" => {
            let inner = lower_copperhead_type(slice);
            CopperheadType::Optional(Box::new(inner))
        }
        "Result" => {
            if let py::Expr::Tuple(t) = slice
                && t.elts.len() == 2
            {
                let ok = lower_copperhead_type(&t.elts[0]);
                let err = lower_copperhead_type(&t.elts[1]);
                return CopperheadType::Result(Box::new(ok), Box::new(err));
            }
            CopperheadType::Result(
                Box::new(CopperheadType::Unknown),
                Box::new(CopperheadType::Unknown),
            )
        }
        "Option" => {
            let inner = lower_copperhead_type(slice);
            CopperheadType::Option(Box::new(inner))
        }
        "tuple" => {
            if let py::Expr::Tuple(t) = slice {
                let items: Vec<CopperheadType> = t.elts.iter().map(lower_copperhead_type).collect();
                CopperheadType::Tuple(items)
            } else {
                CopperheadType::Tuple(vec![lower_copperhead_type(slice)])
            }
        }
        "own" | "borrow" | "mut" => lower_copperhead_type(slice),
        other => {
            let params = if let py::Expr::Tuple(t) = slice {
                t.elts.iter().map(lower_copperhead_type).collect()
            } else {
                vec![lower_copperhead_type(slice)]
            };
            CopperheadType::Generic(other.to_string(), params)
        }
    }
}
