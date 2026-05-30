pub mod build;
pub mod check;
pub mod init;
pub mod run;
pub mod transpile;

use clap::{Parser, Subcommand};

#[derive(Parser)]
#[command(name = "copperhead")]
#[command(about = "A Python subset that compiles to Rust")]
#[command(version)]
pub struct Cli {
    #[command(subcommand)]
    pub command: Commands,
}

#[derive(Subcommand)]
pub enum Commands {
    /// Create a new Copperhead project
    Init {
        /// Project name
        name: String,
    },
    /// Transpile .cu.py files to Rust and build with Cargo
    Build,
    /// Build and run the project
    Run,
    /// Type-check and ownership-check without compiling
    Check,
    /// Output generated Rust for a single file
    Transpile {
        /// Path to a .cu.py file
        file: String,
    },
}
