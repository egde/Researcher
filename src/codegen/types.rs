use crate::ast::types::{CopperheadType, Ownership, TypeAnnotation};

pub fn to_rust_type(annotation: &TypeAnnotation) -> String {
    let base = type_to_rust(&annotation.ty);
    match annotation.ownership {
        Ownership::Owned => base,
        Ownership::Borrowed => format!("&{base}"),
        Ownership::MutBorrowed => format!("&mut {base}"),
    }
}

fn type_to_rust(ty: &CopperheadType) -> String {
    match ty {
        CopperheadType::Int => "i64".to_string(),
        CopperheadType::Float => "f64".to_string(),
        CopperheadType::Bool => "bool".to_string(),
        CopperheadType::Str => "String".to_string(),
        CopperheadType::None => "()".to_string(),
        CopperheadType::List(inner) => format!("Vec<{}>", type_to_rust(inner)),
        CopperheadType::Dict(k, v) => {
            format!("HashMap<{}, {}>", type_to_rust(k), type_to_rust(v))
        }
        CopperheadType::Set(inner) => format!("HashSet<{}>", type_to_rust(inner)),
        CopperheadType::Optional(inner) => format!("Option<{}>", type_to_rust(inner)),
        CopperheadType::Tuple(items) => {
            let parts: Vec<String> = items.iter().map(type_to_rust).collect();
            format!("({})", parts.join(", "))
        }
        CopperheadType::Result(ok, err) => {
            format!("Result<{}, {}>", type_to_rust(ok), type_to_rust(err))
        }
        CopperheadType::Option(inner) => format!("Option<{}>", type_to_rust(inner)),
        CopperheadType::Named(name) => name.clone(),
        CopperheadType::Generic(name, params) => {
            let parts: Vec<String> = params.iter().map(type_to_rust).collect();
            format!("{}<{}>", name, parts.join(", "))
        }
        CopperheadType::Uuid => "Uuid".to_string(),
        CopperheadType::Unknown => "/* unknown */".to_string(),
    }
}
