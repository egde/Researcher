use std::fmt;

#[derive(Debug, Clone, PartialEq)]
pub enum CopperheadType {
    Int,
    Float,
    Bool,
    Str,
    None,
    List(Box<CopperheadType>),
    Dict(Box<CopperheadType>, Box<CopperheadType>),
    Set(Box<CopperheadType>),
    Optional(Box<CopperheadType>),
    Tuple(Vec<CopperheadType>),
    Result(Box<CopperheadType>, Box<CopperheadType>),
    Option(Box<CopperheadType>),
    Named(String),
    Generic(String, Vec<CopperheadType>),
    Uuid,
    Unknown,
}

#[derive(Debug, Clone, PartialEq)]
pub enum Ownership {
    Owned,
    Borrowed,
    MutBorrowed,
}

#[derive(Debug, Clone, PartialEq)]
pub struct TypeAnnotation {
    pub ty: CopperheadType,
    pub ownership: Ownership,
}

impl fmt::Display for CopperheadType {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            CopperheadType::Int => write!(f, "int"),
            CopperheadType::Float => write!(f, "float"),
            CopperheadType::Bool => write!(f, "bool"),
            CopperheadType::Str => write!(f, "str"),
            CopperheadType::None => write!(f, "None"),
            CopperheadType::List(inner) => write!(f, "list[{inner}]"),
            CopperheadType::Dict(k, v) => write!(f, "dict[{k}, {v}]"),
            CopperheadType::Set(inner) => write!(f, "set[{inner}]"),
            CopperheadType::Optional(inner) => write!(f, "Optional[{inner}]"),
            CopperheadType::Tuple(items) => {
                let parts: Vec<String> = items.iter().map(|t| t.to_string()).collect();
                write!(f, "tuple[{}]", parts.join(", "))
            }
            CopperheadType::Result(ok, err) => write!(f, "Result[{ok}, {err}]"),
            CopperheadType::Option(inner) => write!(f, "Option[{inner}]"),
            CopperheadType::Named(name) => write!(f, "{name}"),
            CopperheadType::Generic(name, params) => {
                let parts: Vec<String> = params.iter().map(|t| t.to_string()).collect();
                write!(f, "{name}[{}]", parts.join(", "))
            }
            CopperheadType::Uuid => write!(f, "UUID"),
            CopperheadType::Unknown => write!(f, "?"),
        }
    }
}
