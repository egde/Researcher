pub mod types;

use types::{Ownership, TypeAnnotation};

#[derive(Debug, Clone)]
pub struct SourceSpan {
    pub start: usize,
    pub end: usize,
}

#[derive(Debug, Clone)]
pub struct Module {
    pub name: String,
    pub items: Vec<Item>,
    pub import_aliases: Vec<ImportAlias>,
}

#[derive(Debug, Clone)]
pub struct ImportAlias {
    pub name: String,
    pub crate_path: String,
}

#[derive(Debug, Clone)]
pub struct Decorator {
    pub name: String,
    pub args: Vec<Expr>,
}

#[derive(Debug, Clone)]
pub enum Item {
    Function(Function),
    Struct(StructDef),
    Import(Import),
}

#[derive(Debug, Clone)]
pub struct Function {
    pub name: String,
    pub params: Vec<Param>,
    pub return_type: Option<TypeAnnotation>,
    pub body: Vec<Statement>,
    pub is_async: bool,
    pub decorators: Vec<Decorator>,
    pub span: SourceSpan,
}

#[derive(Debug, Clone)]
pub struct Param {
    pub name: String,
    pub annotation: Option<TypeAnnotation>,
    pub default: Option<Expr>,
}

#[derive(Debug, Clone)]
pub struct FieldConstraint {
    pub ge: Option<Expr>,
    pub le: Option<Expr>,
    pub gt: Option<Expr>,
    pub lt: Option<Expr>,
    pub min_length: Option<Expr>,
    pub max_length: Option<Expr>,
}

#[derive(Debug, Clone)]
pub struct FieldDef {
    pub name: String,
    pub ty: TypeAnnotation,
    pub default: Option<Expr>,
    pub constraints: Option<FieldConstraint>,
}

#[derive(Debug, Clone)]
pub struct ValidatorDef {
    pub field_name: String,
    pub method_name: String,
    pub body: Vec<Statement>,
}

#[derive(Debug, Clone)]
pub struct MethodDef {
    pub name: String,
    pub self_ownership: Ownership,
    pub params: Vec<Param>,
    pub return_type: Option<TypeAnnotation>,
    pub body: Vec<Statement>,
}

#[derive(Debug, Clone)]
pub struct StructDef {
    pub name: String,
    pub fields: Vec<FieldDef>,
    pub validators: Vec<ValidatorDef>,
    pub methods: Vec<MethodDef>,
    pub is_base_model: bool,
    pub span: SourceSpan,
}

#[derive(Debug, Clone)]
pub struct Import {
    pub module: String,
    pub names: Vec<String>,
    pub span: SourceSpan,
}

#[derive(Debug, Clone)]
pub enum Statement {
    Let {
        name: String,
        annotation: Option<TypeAnnotation>,
        value: Expr,
        mutable: bool,
    },
    Assign {
        target: Expr,
        value: Expr,
    },
    Return(Option<Expr>),
    If {
        condition: Expr,
        then_body: Vec<Statement>,
        elif_clauses: Vec<(Expr, Vec<Statement>)>,
        else_body: Option<Vec<Statement>>,
    },
    While {
        condition: Expr,
        body: Vec<Statement>,
    },
    For {
        target: String,
        iter: Expr,
        body: Vec<Statement>,
    },
    Expr(Expr),
    Pass,
    Break,
    Continue,
}

#[derive(Debug, Clone)]
pub enum Expr {
    IntLiteral(i64),
    FloatLiteral(f64),
    StringLiteral(String),
    FStringLiteral(Vec<FStringPart>),
    BoolLiteral(bool),
    NoneLiteral,

    Name(String),
    Attribute(Box<Expr>, String),
    Index(Box<Expr>, Box<Expr>),

    BinOp(Box<Expr>, BinOp, Box<Expr>),
    UnaryOp(UnaryOp, Box<Expr>),
    Compare(Box<Expr>, CompareOp, Box<Expr>),
    BoolOp(Box<Expr>, BoolOp, Box<Expr>),

    Call(Box<Expr>, Vec<Expr>),
    MethodCall(Box<Expr>, String, Vec<Expr>),

    List(Vec<Expr>),
    Dict(Vec<(Expr, Expr)>),
    Tuple(Vec<Expr>),

    StructInit {
        name: String,
        fields: Vec<(String, Expr)>,
    },

    Lambda(Vec<Param>, Box<Expr>),
    Await(Box<Expr>),
    Try(Box<Expr>),
}

#[derive(Debug, Clone)]
pub enum FStringPart {
    Literal(String),
    Expr(Expr),
}

#[derive(Debug, Clone, Copy)]
pub enum BinOp {
    Add,
    Sub,
    Mul,
    Div,
    FloorDiv,
    Mod,
    Pow,
    BitAnd,
    BitOr,
    BitXor,
    LShift,
    RShift,
}

#[derive(Debug, Clone, Copy)]
pub enum UnaryOp {
    Neg,
    Not,
    BitNot,
}

#[derive(Debug, Clone, Copy)]
pub enum CompareOp {
    Eq,
    NotEq,
    Lt,
    LtEq,
    Gt,
    GtEq,
    In,
    NotIn,
    Is,
    IsNot,
}

#[derive(Debug, Clone, Copy)]
pub enum BoolOp {
    And,
    Or,
}
